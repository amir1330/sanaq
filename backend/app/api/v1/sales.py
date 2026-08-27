from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.api.deps import roles
from app.database import get_session
from app.models import FiscalStatus, Product, Sale, User, UserRole
from app.schemas.shift import SaleCreate, SaleItemOut, SaleOut, SaleRefundIn
from app.services.access import assert_shop_access
from app.services.sales import create_sale, refund_sale
from app.services.webkassa import fiscalize_sale

router = APIRouter(tags=["sales"])
pos_roles = roles(UserRole.super_admin, UserRole.owner, UserRole.barista)


def _sale_out(sale: Sale, products: dict[int, Product], alerts=None) -> SaleOut:
    return SaleOut(
        id=sale.id,
        shop_id=sale.shop_id,
        shift_id=sale.shift_id,
        barista_id=sale.barista_id,
        payment_type=sale.payment_type,
        subtotal_amount=getattr(sale, "subtotal_amount", None) or sale.total_amount,
        discount_type=getattr(sale, "discount_type", None),
        discount_value=getattr(sale, "discount_value", None),
        discount_amount=getattr(sale, "discount_amount", None) or 0,
        total_amount=sale.total_amount,
        is_refunded=sale.is_refunded,
        created_at=sale.created_at,
        fiscal_status=sale.fiscal_status,
        fiscal_receipt_number=sale.fiscal_receipt_number,
        fiscal_receipt_url=sale.fiscal_receipt_url,
        fiscal_error=sale.fiscal_error,
        items=[
            SaleItemOut(
                id=item.id,
                product_id=item.product_id,
                product_name=products[item.product_id].name if item.product_id in products else None,
                variant_id=getattr(item, "variant_id", None),
                variant_name=getattr(item, "variant_name_snapshot", None),
                quantity=item.quantity,
                price_snapshot=item.price_snapshot,
                cost_price_snapshot=item.cost_price_snapshot,
                discount_type=getattr(item, "discount_type", None),
                discount_value=getattr(item, "discount_value", None),
                discount_amount=getattr(item, "discount_amount", None) or 0,
                line_total=getattr(item, "line_total", None)
                or (item.price_snapshot * item.quantity),
            )
            for item in sale.items
        ],
        alerts=alerts or [],
    )


async def _products_for(session: AsyncSession, sale: Sale) -> dict[int, Product]:
    ids = [i.product_id for i in sale.items]
    if not ids:
        return {}
    result = await session.execute(select(Product).where(Product.id.in_(ids)))
    return {p.id: p for p in result.scalars().all()}


@router.post("/sales", response_model=SaleOut, status_code=201)
async def post_sale(
    body: SaleCreate,
    background_tasks: BackgroundTasks,
    user: User = Depends(pos_roles),
    session: AsyncSession = Depends(get_session),
):
    await assert_shop_access(session, user, body.shop_id, write=True)
    sale, alerts = await create_sale(
        session,
        shop_id=body.shop_id,
        user=user,
        items=body.items,
        payment_type=body.payment_type,
        barista_id=body.barista_id,
        cash_register_id=body.cash_register_id,
        discount=body.discount,
    )
    await session.commit()
    if sale.fiscal_status == FiscalStatus.pending:
        background_tasks.add_task(fiscalize_sale, sale.id)
    result = await session.execute(
        select(Sale).options(selectinload(Sale.items)).where(Sale.id == sale.id)
    )
    sale = result.scalar_one()
    products = await _products_for(session, sale)
    return _sale_out(sale, products, alerts)


@router.get("/shops/{shop_id}/sales/{sale_id}", response_model=SaleOut)
async def get_sale(
    shop_id: int,
    sale_id: int,
    user: User = Depends(pos_roles),
    session: AsyncSession = Depends(get_session),
):
    await assert_shop_access(session, user, shop_id)
    result = await session.execute(
        select(Sale).options(selectinload(Sale.items)).where(Sale.id == sale_id, Sale.shop_id == shop_id)
    )
    sale = result.scalar_one_or_none()
    if sale is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Sale not found")
    products = await _products_for(session, sale)
    return _sale_out(sale, products)


@router.post("/sales/{sale_id}/refund", response_model=SaleOut)
async def post_refund(
    sale_id: int,
    body: SaleRefundIn,
    background_tasks: BackgroundTasks,
    user: User = Depends(pos_roles),
    session: AsyncSession = Depends(get_session),
):
    await assert_shop_access(session, user, body.shop_id, write=True)
    result = await session.execute(
        select(Sale).options(selectinload(Sale.items)).where(Sale.id == sale_id)
    )
    sale = result.scalar_one_or_none()
    if sale is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Sale not found")
    was_sent = sale.fiscal_status == FiscalStatus.sent
    sale = await refund_sale(session, sale, body.shop_id, user, restore_stock=body.restore_stock)
    await session.commit()
    if was_sent:
        background_tasks.add_task(fiscalize_sale, sale.id, refund=True)
    result = await session.execute(
        select(Sale).options(selectinload(Sale.items)).where(Sale.id == sale_id)
    )
    sale = result.scalar_one()
    products = await _products_for(session, sale)
    return _sale_out(sale, products)


@router.post("/shops/{shop_id}/sales/{sale_id}/fiscalize", response_model=SaleOut)
async def retry_fiscalize(
    shop_id: int,
    sale_id: int,
    user: User = Depends(pos_roles),
    session: AsyncSession = Depends(get_session),
):
    await assert_shop_access(session, user, shop_id, write=True)
    result = await session.execute(
        select(Sale).options(selectinload(Sale.items)).where(Sale.id == sale_id, Sale.shop_id == shop_id)
    )
    sale = result.scalar_one_or_none()
    if sale is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Sale not found")
    await fiscalize_sale(sale.id, refund=sale.is_refunded)
    result = await session.execute(
        select(Sale).options(selectinload(Sale.items)).where(Sale.id == sale_id)
    )
    sale = result.scalar_one()
    products = await _products_for(session, sale)
    return _sale_out(sale, products)
