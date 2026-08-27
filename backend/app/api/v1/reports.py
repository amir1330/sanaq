from datetime import date, datetime, time, timezone
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import Response
from sqlalchemy import case, func, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import roles
from app.database import get_session
from app.models import (
    Expense,
    FiscalStatus,
    PaymentType,
    Product,
    Sale,
    SaleItem,
    Shop,
    StockRevision,
    StockRevisionLine,
    StockRevisionStatus,
    User,
    UserRole,
)
from app.schemas.report import DailyPoint, FiscalReceipt, ReportSummary, SellerPoint, TopProduct
from app.services.access import assert_shop_access
from app.services.reports import build_report_xlsx

router = APIRouter(tags=["reports"])
manage = roles(UserRole.super_admin, UserRole.owner)


def _range(from_date: date, to_date: date) -> tuple[datetime, datetime]:
    start = datetime.combine(from_date, time.min, tzinfo=timezone.utc)
    end = datetime.combine(to_date, time.max, tzinfo=timezone.utc)
    return start, end


@router.get("/shops/{shop_id}/reports/summary", response_model=ReportSummary)
async def report_summary(
    shop_id: int,
    from_date: date = Query(alias="from"),
    to_date: date = Query(alias="to"),
    user: User = Depends(manage),
    session: AsyncSession = Depends(get_session),
):
    await assert_shop_access(session, user, shop_id)
    start, end = _range(from_date, to_date)

    cash = (
        await session.execute(
            select(func.coalesce(func.sum(Sale.total_amount), 0)).where(
                Sale.shop_id == shop_id,
                Sale.is_refunded.is_(False),
                Sale.payment_type == PaymentType.cash,
                Sale.created_at >= start,
                Sale.created_at <= end,
            )
        )
    ).scalar_one()
    card = (
        await session.execute(
            select(func.coalesce(func.sum(Sale.total_amount), 0)).where(
                Sale.shop_id == shop_id,
                Sale.is_refunded.is_(False),
                Sale.payment_type == PaymentType.card,
                Sale.created_at >= start,
                Sale.created_at <= end,
            )
        )
    ).scalar_one()
    count = (
        await session.execute(
            select(func.count(Sale.id)).where(
                Sale.shop_id == shop_id,
                Sale.is_refunded.is_(False),
                Sale.created_at >= start,
                Sale.created_at <= end,
            )
        )
    ).scalar_one()
    cost = (
        await session.execute(
            select(func.coalesce(func.sum(SaleItem.cost_price_snapshot * SaleItem.quantity), 0))
            .select_from(SaleItem)
            .join(Sale, Sale.id == SaleItem.sale_id)
            .where(
                Sale.shop_id == shop_id,
                Sale.is_refunded.is_(False),
                Sale.created_at >= start,
                Sale.created_at <= end,
            )
        )
    ).scalar_one()
    expenses = (
        await session.execute(
            select(func.coalesce(func.sum(Expense.amount), 0)).where(
                Expense.shop_id == shop_id,
                Expense.created_at >= start,
                Expense.created_at <= end,
            )
        )
    ).scalar_one()

    shortage_raw = (
        await session.execute(
            select(
                func.coalesce(
                    func.sum(
                        case(
                            (
                                StockRevisionLine.difference_quantity < 0,
                                StockRevisionLine.difference_quantity
                                * StockRevisionLine.cost_per_base_unit,
                            ),
                            else_=0,
                        )
                    ),
                    0,
                )
            )
            .select_from(StockRevisionLine)
            .join(StockRevision, StockRevision.id == StockRevisionLine.revision_id)
            .where(
                StockRevision.shop_id == shop_id,
                StockRevision.status == StockRevisionStatus.posted,
                StockRevision.posted_at >= start,
                StockRevision.posted_at <= end,
            )
        )
    ).scalar_one()
    revenue = Decimal(str(cash)) + Decimal(str(card))
    cost_d = Decimal(str(cost))
    exp_d = Decimal(str(expenses))
    shortage_d = abs(Decimal(str(shortage_raw or 0))).quantize(Decimal("0.01"))
    profit = revenue - cost_d
    fiscal_rows = (
        await session.execute(
            select(Sale.fiscal_status, func.count(Sale.id))
            .where(
                Sale.shop_id == shop_id,
                Sale.is_refunded.is_(False),
                Sale.created_at >= start,
                Sale.created_at <= end,
            )
            .group_by(Sale.fiscal_status)
        )
    ).all()
    fiscal = {row[0]: int(row[1]) for row in fiscal_rows}
    return ReportSummary(
        from_date=from_date,
        to_date=to_date,
        cash_revenue=Decimal(str(cash)),
        card_revenue=Decimal(str(card)),
        revenue=revenue,
        cost=cost_d,
        profit=profit,
        sales_count=int(count or 0),
        expenses=exp_d,
        revision_shortage=shortage_d,
        net_profit=profit - exp_d - shortage_d,
        fiscal_sent_count=fiscal.get(FiscalStatus.sent, 0),
        fiscal_failed_count=fiscal.get(FiscalStatus.failed, 0),
        fiscal_pending_count=fiscal.get(FiscalStatus.pending, 0),
        fiscal_skipped_count=fiscal.get(FiscalStatus.skipped, 0),
    )


@router.get("/shops/{shop_id}/reports/top-products", response_model=list[TopProduct])
async def top_products(
    shop_id: int,
    from_date: date = Query(alias="from"),
    to_date: date = Query(alias="to"),
    user: User = Depends(manage),
    session: AsyncSession = Depends(get_session),
    limit: int = Query(10, le=50),
):
    await assert_shop_access(session, user, shop_id)
    start, end = _range(from_date, to_date)
    result = await session.execute(
        select(
            SaleItem.product_id,
            SaleItem.variant_id,
            SaleItem.variant_name_snapshot,
            Product.name,
            Product.name_kk,
            Product.name_en,
            func.sum(SaleItem.quantity).label("qty"),
            func.sum(SaleItem.price_snapshot * SaleItem.quantity).label("revenue"),
            func.sum(
                (SaleItem.price_snapshot - SaleItem.cost_price_snapshot) * SaleItem.quantity
            ).label("profit"),
        )
        .join(Sale, Sale.id == SaleItem.sale_id)
        .join(Product, Product.id == SaleItem.product_id)
        .where(
            Sale.shop_id == shop_id,
            Sale.is_refunded.is_(False),
            Sale.created_at >= start,
            Sale.created_at <= end,
        )
        .group_by(
            SaleItem.product_id,
            SaleItem.variant_id,
            SaleItem.variant_name_snapshot,
            Product.name,
            Product.name_kk,
            Product.name_en,
        )
        .order_by(func.sum(SaleItem.quantity).desc())
        .limit(limit)
    )
    return [
        TopProduct(
            product_id=row.product_id,
            variant_id=row.variant_id,
            name=row.name,
            name_kk=row.name_kk,
            name_en=row.name_en,
            variant_name=row.variant_name_snapshot,
            quantity=int(row.qty or 0),
            revenue=Decimal(str(row.revenue or 0)),
            profit=Decimal(str(row.profit or 0)),
        )
        for row in result.all()
    ]


@router.get("/shops/{shop_id}/reports/daily", response_model=list[DailyPoint])
async def daily_report(
    shop_id: int,
    from_date: date = Query(alias="from"),
    to_date: date = Query(alias="to"),
    user: User = Depends(manage),
    session: AsyncSession = Depends(get_session),
):
    await assert_shop_access(session, user, shop_id)
    start, end = _range(from_date, to_date)
    result = await session.execute(
        text(
            """
            SELECT
                date_trunc('day', s.created_at) AS day,
                COALESCE(SUM(s.total_amount) FILTER (WHERE s.payment_type = 'cash'), 0) AS cash_revenue,
                COALESCE(SUM(s.total_amount) FILTER (WHERE s.payment_type = 'card'), 0) AS card_revenue,
                COALESCE(SUM(s.total_amount), 0) AS revenue,
                COUNT(*) AS sales_count,
                COUNT(*) FILTER (WHERE s.fiscal_status IN ('pending', 'failed')) AS unfiscalized_count,
                COALESCE(SUM(si.cost), 0) AS cost,
                COALESCE(SUM(s.total_amount), 0) - COALESCE(SUM(si.cost), 0) AS profit
            FROM sales s
            LEFT JOIN (
                SELECT sale_id, SUM(cost_price_snapshot * quantity) AS cost
                FROM sale_items
                GROUP BY sale_id
            ) si ON si.sale_id = s.id
            WHERE s.shop_id = :shop_id
              AND NOT s.is_refunded
              AND s.created_at >= :start
              AND s.created_at <= :end
            GROUP BY date_trunc('day', s.created_at)
            ORDER BY 1
            """
        ),
        {"shop_id": shop_id, "start": start, "end": end},
    )
    return [
        DailyPoint(
            day=row.day,
            cash_revenue=Decimal(str(row.cash_revenue)),
            card_revenue=Decimal(str(row.card_revenue)),
            revenue=Decimal(str(row.revenue)),
            cost=Decimal(str(row.cost)),
            profit=Decimal(str(row.profit)),
            sales_count=int(row.sales_count),
            unfiscalized_count=int(row.unfiscalized_count or 0),
        )
        for row in result
    ]


@router.get("/shops/{shop_id}/reports/fiscal", response_model=list[FiscalReceipt])
async def fiscal_receipts(
    shop_id: int,
    from_date: date = Query(alias="from"),
    to_date: date = Query(alias="to"),
    user: User = Depends(manage),
    session: AsyncSession = Depends(get_session),
):
    await assert_shop_access(session, user, shop_id)
    start, end = _range(from_date, to_date)
    result = await session.execute(
        select(Sale, User.full_name)
        .join(User, User.id == Sale.barista_id)
        .where(
            Sale.shop_id == shop_id,
            Sale.created_at >= start,
            Sale.created_at <= end,
            Sale.fiscal_status.in_([FiscalStatus.failed, FiscalStatus.pending]),
        )
        .order_by(Sale.created_at.desc())
        .limit(200)
    )
    return [
        FiscalReceipt(
            id=sale.id,
            created_at=sale.created_at,
            total_amount=sale.total_amount,
            payment_type=sale.payment_type.value,
            fiscal_status=sale.fiscal_status,
            fiscal_receipt_number=sale.fiscal_receipt_number,
            fiscal_receipt_url=sale.fiscal_receipt_url,
            fiscal_error=sale.fiscal_error,
            fiscal_attempts=sale.fiscal_attempts,
            barista_name=name,
        )
        for sale, name in result.all()
    ]


@router.get("/shops/{shop_id}/reports/sellers", response_model=list[SellerPoint])
async def sellers_report(
    shop_id: int,
    from_date: date = Query(alias="from"),
    to_date: date = Query(alias="to"),
    user: User = Depends(manage),
    session: AsyncSession = Depends(get_session),
):
    await assert_shop_access(session, user, shop_id)
    start, end = _range(from_date, to_date)
    result = await session.execute(
        select(
            Sale.barista_id,
            User.full_name,
            func.coalesce(
                func.sum(case((Sale.payment_type == PaymentType.cash, Sale.total_amount), else_=0)),
                0,
            ).label("cash_revenue"),
            func.coalesce(
                func.sum(case((Sale.payment_type == PaymentType.card, Sale.total_amount), else_=0)),
                0,
            ).label("card_revenue"),
            func.coalesce(func.sum(Sale.total_amount), 0).label("revenue"),
            func.count(Sale.id).label("sales_count"),
        )
        .join(User, User.id == Sale.barista_id)
        .where(
            Sale.shop_id == shop_id,
            Sale.is_refunded.is_(False),
            Sale.created_at >= start,
            Sale.created_at <= end,
        )
        .group_by(Sale.barista_id, User.full_name)
        .order_by(func.coalesce(func.sum(Sale.total_amount), 0).desc())
    )
    return [
        SellerPoint(
            barista_id=row.barista_id,
            barista_name=row.full_name,
            cash_revenue=Decimal(str(row.cash_revenue)),
            card_revenue=Decimal(str(row.card_revenue)),
            revenue=Decimal(str(row.revenue)),
            sales_count=int(row.sales_count or 0),
        )
        for row in result.all()
    ]


@router.get("/shops/{shop_id}/reports/export")
async def export_report(
    shop_id: int,
    from_date: date = Query(alias="from"),
    to_date: date = Query(alias="to"),
    user: User = Depends(manage),
    session: AsyncSession = Depends(get_session),
):
    if from_date > to_date:
        raise HTTPException(400, "from must be before to")
    await assert_shop_access(session, user, shop_id)
    shop = await session.get(Shop, shop_id)
    summary = await report_summary(shop_id, from_date, to_date, user, session)
    daily = await daily_report(shop_id, from_date, to_date, user, session)
    products = await top_products(shop_id, from_date, to_date, user, session, limit=50)
    sellers = await sellers_report(shop_id, from_date, to_date, user, session)
    start, end = _range(from_date, to_date)

    expense_rows = (
        await session.execute(
            select(Expense)
            .where(Expense.shop_id == shop_id, Expense.created_at >= start, Expense.created_at <= end)
            .order_by(Expense.created_at)
        )
    ).scalars().all()
    sale_rows = (
        await session.execute(
            select(
                Sale.id,
                Sale.created_at,
                Sale.payment_type,
                Sale.total_amount,
                Sale.is_refunded,
                Sale.fiscal_status,
                User.full_name,
            )
            .join(User, User.id == Sale.barista_id)
            .where(
                Sale.shop_id == shop_id,
                Sale.created_at >= start,
                Sale.created_at <= end,
            )
            .order_by(Sale.created_at)
        )
    ).all()

    xlsx = build_report_xlsx(
        shop_name=shop.name if shop else str(shop_id),
        from_date=from_date,
        to_date=to_date,
        summary=summary.model_dump(),
        daily=[row.model_dump() for row in daily],
        products=[row.model_dump() for row in products],
        sellers=[row.model_dump() for row in sellers],
        expenses=[
            {
                "created_at": row.created_at,
                "category": row.category,
                "amount": row.amount,
                "comment": row.comment,
            }
            for row in expense_rows
        ],
        sales=[
            {
                "id": row.id,
                "created_at": row.created_at,
                "payment_type": row.payment_type.value if hasattr(row.payment_type, "value") else row.payment_type,
                "total_amount": row.total_amount,
                "is_refunded": row.is_refunded,
                "fiscal_status": row.fiscal_status.value
                if hasattr(row.fiscal_status, "value")
                else row.fiscal_status,
                "barista_name": row.full_name,
            }
            for row in sale_rows
        ],
    )
    filename = f"sanaq-{from_date.isoformat()}-{to_date.isoformat()}.xlsx"
    return Response(
        content=xlsx,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
