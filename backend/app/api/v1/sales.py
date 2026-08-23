from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.api.deps import roles
from app.database import get_session
from app.models import Product, Sale, SaleItem, User, UserRole
from app.schemas.shift import SaleCreate, SaleItemOut, SaleOut
from app.services.access import assert_shop_access
from app.services.sales import create_sale, refund_sale

router = APIRouter(tags=["sales"])
pos_roles = roles(UserRole.super_admin, UserRole.owner, UserRole.barista)


def _sale_out(sale: Sale, products: dict[int, Product], alerts=None) -> SaleOut:
    return SaleOut(
        id=sale.id,
        shop_id=sale.shop_id,
        shift_id=sale.shift_id,
        barista_id=sale.barista_id,
        payment_type=sale.payment_type,
        total_amount=sale.total_amount,
        is_refunded=sale.is_refunded,
        created_at=sale.created_at,
        items=[
            SaleItemOut(
                id=item.id,
                product_id=item.product_id,
                product_name=products[item.product_id].name if item.product_id in products else None,
                quantity=item.quantity,
                price_snapshot=item.price_snapshot,
                cost_price_snapshot=item.cost_price_snapshot,
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
    )
    await session.commit()
    result = await session.execute(
        select(Sale).options(selectinload(Sale.items)).where(Sale.id == sale.id)
    )
    sale = result.scalar_one()
    products = await _products_for(session, sale)
    return _sale_out(sale, products, alerts)


@router.post("/sales/{sale_id}/refund", response_model=SaleOut)
async def post_refund(
    sale_id: int,
    shop_id: int,
    user: User = Depends(pos_roles),
    session: AsyncSession = Depends(get_session),
):
    await assert_shop_access(session, user, shop_id, write=True)
    result = await session.execute(
        select(Sale).options(selectinload(Sale.items)).where(Sale.id == sale_id)
    )
    sale = result.scalar_one_or_none()
    if sale is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Sale not found")
    sale = await refund_sale(session, sale, shop_id)
    await session.commit()
    result = await session.execute(
        select(Sale).options(selectinload(Sale.items)).where(Sale.id == sale_id)
    )
    sale = result.scalar_one()
    products = await _products_for(session, sale)
    return _sale_out(sale, products)
