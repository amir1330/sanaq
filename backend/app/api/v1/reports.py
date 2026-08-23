from datetime import date, datetime, time, timezone
from decimal import Decimal

from fastapi import APIRouter, Depends, Query
from sqlalchemy import case, func, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import roles
from app.database import get_session
from app.models import Expense, PaymentType, Product, Sale, SaleItem, User, UserRole
from app.schemas.report import DailyPoint, ReportSummary, SellerPoint, TopProduct
from app.services.access import assert_shop_access

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

    revenue = Decimal(str(cash)) + Decimal(str(card))
    cost_d = Decimal(str(cost))
    exp_d = Decimal(str(expenses))
    profit = revenue - cost_d
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
        net_profit=profit - exp_d,
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
            Product.name,
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
        .group_by(SaleItem.product_id, Product.name)
        .order_by(func.sum(SaleItem.quantity).desc())
        .limit(limit)
    )
    return [
        TopProduct(
            product_id=row.product_id,
            name=row.name,
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
        )
        for row in result
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
