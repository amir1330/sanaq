from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, roles
from app.database import get_session
from app.models import StockItem, StockMovementType, User, UserRole
from app.schemas.stock import (
    StockItemCreate,
    StockItemOut,
    StockItemUpdate,
    StockMovementCreate,
    StockMovementOut,
)
from app.services.access import assert_shop_access, can_receive_stock
from app.services.stock import apply_stock_movement

router = APIRouter(tags=["stock"])
manage = roles(UserRole.super_admin, UserRole.owner)


def _item_out(item: StockItem, *, hide_cost: bool) -> StockItemOut:
    return StockItemOut(
        id=item.id,
        shop_id=item.shop_id,
        name=item.name,
        unit=item.unit,
        quantity=item.quantity,
        min_quantity=item.min_quantity,
        cost_per_unit=0 if hide_cost else item.cost_per_unit,
        updated_at=item.updated_at,
        is_low=item.quantity <= item.min_quantity,
    )


@router.get("/shops/{shop_id}/stock-items", response_model=list[StockItemOut])
async def list_stock(
    shop_id: int,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    await assert_shop_access(session, user, shop_id)
    result = await session.execute(
        select(StockItem).where(StockItem.shop_id == shop_id).order_by(StockItem.name)
    )
    hide = user.role == UserRole.barista
    return [_item_out(i, hide_cost=hide) for i in result.scalars().all()]


@router.post("/shops/{shop_id}/stock-items", response_model=StockItemOut, status_code=201)
async def create_stock_item(
    shop_id: int,
    body: StockItemCreate,
    user: User = Depends(manage),
    session: AsyncSession = Depends(get_session),
):
    await assert_shop_access(session, user, shop_id, write=True)
    item = StockItem(shop_id=shop_id, **body.model_dump())
    session.add(item)
    await session.commit()
    await session.refresh(item)
    return _item_out(item, hide_cost=False)


@router.patch("/shops/{shop_id}/stock-items/{item_id}", response_model=StockItemOut)
async def update_stock_item(
    shop_id: int,
    item_id: int,
    body: StockItemUpdate,
    user: User = Depends(manage),
    session: AsyncSession = Depends(get_session),
):
    await assert_shop_access(session, user, shop_id, write=True)
    item = await session.get(StockItem, item_id)
    if item is None or item.shop_id != shop_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Stock item not found")
    for key, value in body.model_dump(exclude_unset=True).items():
        setattr(item, key, value)
    await session.commit()
    await session.refresh(item)
    return _item_out(item, hide_cost=False)


@router.post(
    "/shops/{shop_id}/stock-items/{item_id}/movements",
    response_model=StockMovementOut,
    status_code=201,
)
async def create_movement(
    shop_id: int,
    item_id: int,
    body: StockMovementCreate,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    await assert_shop_access(session, user, shop_id, write=True)
    if not can_receive_stock(user):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Нет права на склад")
    if user.role == UserRole.barista and body.type != StockMovementType.income:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Бариста может только принять товар")
    item = await session.get(StockItem, item_id)
    if item is None or item.shop_id != shop_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Stock item not found")
    movement = await apply_stock_movement(
        session,
        shop_id=shop_id,
        item=item,
        movement_type=body.type,
        quantity=body.quantity,
        price_total=body.price_total,
        user=user,
        comment=body.comment,
    )
    await session.commit()
    await session.refresh(movement)
    return movement
