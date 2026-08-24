from datetime import datetime
from decimal import Decimal

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, roles
from app.database import get_session
from app.models import StockItem, StockLogAction, StockMovement, StockMovementType, User, UserRole
from app.schemas.stock import (
    StockItemCreate,
    StockItemOut,
    StockItemUpdate,
    StockJournalEntry,
    StockMovementCreate,
    StockMovementOut,
    StockRegradeIn,
    StockTransferIn,
)
from app.services.access import assert_shop_access, can_receive_stock
from app.services.revisions import assert_no_open_revision
from app.services.stock import (
    apply_stock_movement,
    item_create_detail,
    item_update_detail,
    list_stock_journal,
    regrade_stock,
    remove_stock_item,
    to_purchase,
    transfer_stock,
    write_stock_log,
)
from app.services.uploads import delete_upload, replace_upload

router = APIRouter(tags=["stock"])
manage = roles(UserRole.super_admin, UserRole.owner)


def _item_out(
    item: StockItem,
    *,
    hide_cost: bool,
    last_income_at: datetime | None = None,
) -> StockItemOut:
    cost = Decimal("0") if hide_cost else item.cost_per_base_unit
    value = Decimal("0") if hide_cost else (item.quantity * item.cost_per_base_unit).quantize(Decimal("0.01"))
    return StockItemOut(
        id=item.id,
        shop_id=item.shop_id,
        name=item.name,
        base_unit=item.base_unit,
        purchase_unit=item.purchase_unit,
        purchase_to_base=item.purchase_to_base,
        quantity=item.quantity,
        quantity_in_purchase=to_purchase(item.quantity, item.purchase_to_base),
        min_quantity=item.min_quantity,
        cost_per_base_unit=cost,
        value=value,
        image_url=item.image_url,
        updated_at=item.updated_at,
        last_income_at=last_income_at,
        is_low=item.quantity <= item.min_quantity,
    )


async def _last_income_map(session: AsyncSession, shop_id: int, item_id: int | None = None) -> dict[int, datetime]:
    q = (
        select(StockMovement.stock_item_id, func.max(StockMovement.created_at))
        .where(
            StockMovement.shop_id == shop_id,
            StockMovement.type == StockMovementType.income,
            StockMovement.stock_item_id.is_not(None),
        )
        .group_by(StockMovement.stock_item_id)
    )
    if item_id is not None:
        q = q.where(StockMovement.stock_item_id == item_id)
    rows = (await session.execute(q)).all()
    return {item: at for item, at in rows if item is not None}


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
    last = await _last_income_map(session, shop_id)
    return [_item_out(i, hide_cost=hide, last_income_at=last.get(i.id)) for i in result.scalars().all()]


@router.get("/shops/{shop_id}/stock-items/{item_id}", response_model=StockItemOut)
async def get_stock_item(
    shop_id: int,
    item_id: int,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    await assert_shop_access(session, user, shop_id)
    item = await session.get(StockItem, item_id)
    if item is None or item.shop_id != shop_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Позиция не найдена")
    last = await _last_income_map(session, shop_id, item_id)
    return _item_out(item, hide_cost=user.role == UserRole.barista, last_income_at=last.get(item.id))


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
    await session.flush()
    write_stock_log(
        session,
        item=item,
        action=StockLogAction.created,
        user=user,
        detail=item_create_detail(item),
    )
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
    changes = body.model_dump(exclude_unset=True)
    detail = item_update_detail(item, changes)
    for key, value in changes.items():
        setattr(item, key, value)
    if detail:
        write_stock_log(session, item=item, action=StockLogAction.updated, user=user, detail=detail)
    await session.commit()
    await session.refresh(item)
    return _item_out(item, hide_cost=False)


@router.post("/shops/{shop_id}/stock-items/{item_id}/image", response_model=StockItemOut)
async def upload_stock_image(
    shop_id: int,
    item_id: int,
    file: UploadFile = File(...),
    user: User = Depends(manage),
    session: AsyncSession = Depends(get_session),
):
    await assert_shop_access(session, user, shop_id, write=True)
    item = await session.get(StockItem, item_id)
    if item is None or item.shop_id != shop_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Позиция не найдена")
    item.image = await replace_upload(
        session,
        file,
        shop_id=shop_id,
        kind="stock",
        prefix=f"item-{item.id}",
        uploader_id=user.id,
        previous=item.image,
    )
    await session.commit()
    await session.refresh(item)
    return _item_out(item, hide_cost=False)


@router.delete("/shops/{shop_id}/stock-items/{item_id}/image", response_model=StockItemOut)
async def delete_stock_image(
    shop_id: int,
    item_id: int,
    user: User = Depends(manage),
    session: AsyncSession = Depends(get_session),
):
    await assert_shop_access(session, user, shop_id, write=True)
    item = await session.get(StockItem, item_id)
    if item is None or item.shop_id != shop_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Позиция не найдена")
    await delete_upload(session, item.image)
    item.image = None
    await session.commit()
    await session.refresh(item)
    return _item_out(item, hide_cost=False)


@router.delete("/shops/{shop_id}/stock-items/{item_id}", status_code=204)
async def delete_stock_item(
    shop_id: int,
    item_id: int,
    user: User = Depends(manage),
    session: AsyncSession = Depends(get_session),
):
    await assert_shop_access(session, user, shop_id, write=True)
    item = await session.get(StockItem, item_id)
    if item is None or item.shop_id != shop_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Позиция не найдена")
    await remove_stock_item(session, item, user)
    await session.commit()


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
    await assert_no_open_revision(session, shop_id)
    if user.role == UserRole.barista and body.type != StockMovementType.income:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Кассир может только принять товар")
    if body.type not in (StockMovementType.income, StockMovementType.writeoff):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Так двигают только приход и списание")
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


@router.post(
    "/shops/{shop_id}/stock-items/{item_id}/regrade",
    response_model=list[StockMovementOut],
    status_code=201,
)
async def regrade_item(
    shop_id: int,
    item_id: int,
    body: StockRegradeIn,
    user: User = Depends(manage),
    session: AsyncSession = Depends(get_session),
):
    await assert_shop_access(session, user, shop_id, write=True)
    await assert_no_open_revision(session, shop_id)
    from_item = await session.get(StockItem, item_id)
    to_item = await session.get(StockItem, body.to_item_id)
    if from_item is None or from_item.shop_id != shop_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Позиция не найдена")
    if to_item is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Куда переложить — не найдено")
    outgoing, incoming = await regrade_stock(
        session,
        shop_id=shop_id,
        from_item=from_item,
        to_item=to_item,
        quantity_from=body.quantity_from,
        quantity_to=body.quantity_to,
        user=user,
        comment=body.comment,
    )
    await session.commit()
    await session.refresh(outgoing)
    await session.refresh(incoming)
    return [outgoing, incoming]


@router.post(
    "/shops/{shop_id}/stock-items/{item_id}/transfer",
    response_model=list[StockMovementOut],
    status_code=201,
)
async def transfer_item(
    shop_id: int,
    item_id: int,
    body: StockTransferIn,
    user: User = Depends(manage),
    session: AsyncSession = Depends(get_session),
):
    from_shop = await assert_shop_access(session, user, shop_id, write=True)
    to_shop = await assert_shop_access(session, user, body.to_shop_id, write=True)
    await assert_no_open_revision(session, shop_id)
    await assert_no_open_revision(session, body.to_shop_id)
    from_item = await session.get(StockItem, item_id)
    to_item = await session.get(StockItem, body.to_item_id)
    if from_item is None or from_item.shop_id != shop_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Позиция не найдена")
    if to_item is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "На той точке нет такой позиции")
    outgoing, incoming = await transfer_stock(
        session,
        from_shop=from_shop,
        to_shop=to_shop,
        from_item=from_item,
        to_item=to_item,
        quantity=body.quantity,
        quantity_to=body.quantity_to,
        user=user,
        comment=body.comment,
    )
    await session.commit()
    await session.refresh(outgoing)
    await session.refresh(incoming)
    return [outgoing, incoming]


@router.get("/shops/{shop_id}/stock-journal", response_model=list[StockJournalEntry])
async def stock_journal(
    shop_id: int,
    item_id: int | None = Query(default=None),
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    await assert_shop_access(session, user, shop_id)
    return await list_stock_journal(
        session,
        shop_id=shop_id,
        item_id=item_id,
        hide_cost=user.role == UserRole.barista,
    )
