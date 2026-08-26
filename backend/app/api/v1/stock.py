from datetime import datetime
from decimal import Decimal

from fastapi import APIRouter, Depends, File, HTTPException, Query, Response, UploadFile, status
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.api.deps import get_current_user, roles
from app.database import get_session
from app.models import (
    Category,
    Product,
    ProductIngredient,
    StockItem,
    StockLogAction,
    StockMovement,
    StockMovementType,
    User,
    UserRole,
)
from app.schemas.catalog import ProductOut
from app.schemas.stock import (
    MakeProductIn,
    StockImportConfirmIn,
    StockImportPreviewOut,
    StockItemCreate,
    StockItemOut,
    StockItemPage,
    StockItemUpdate,
    StockJournalEntry,
    StockMovementCreate,
    StockMovementOut,
    StockRegradeIn,
    StockStatsOut,
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
from app.services.stock_import import build_stock_import_template, parse_stock_import_xlsx
from app.services.uploads import delete_upload, replace_upload

router = APIRouter(tags=["stock"])
manage = roles(UserRole.super_admin, UserRole.owner)


def _norm_sku(raw: str | None) -> str | None:
    if raw is None:
        return None
    value = raw.strip()
    return value or None


async def _assert_stock_sku_free(
    session: AsyncSession,
    shop_id: int,
    sku: str | None,
    *,
    exclude_id: int | None = None,
) -> None:
    if not sku:
        return
    q = select(StockItem.id).where(StockItem.shop_id == shop_id, StockItem.sku == sku)
    if exclude_id is not None:
        q = q.where(StockItem.id != exclude_id)
    if (await session.execute(q.limit(1))).scalar_one_or_none() is not None:
        raise HTTPException(status.HTTP_409_CONFLICT, f"Артикул уже занят: {sku}")


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
        sku=getattr(item, "sku", None),
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
        is_ingredient=bool(getattr(item, "is_ingredient", False)),
    )


async def _last_income_map(
    session: AsyncSession,
    shop_id: int,
    item_id: int | None = None,
    item_ids: list[int] | None = None,
) -> dict[int, datetime]:
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
    elif item_ids is not None:
        if not item_ids:
            return {}
        q = q.where(StockMovement.stock_item_id.in_(item_ids))
    rows = (await session.execute(q)).all()
    return {item: at for item, at in rows if item is not None}


@router.get("/shops/{shop_id}/stock-items/stats", response_model=StockStatsOut)
async def stock_stats(
    shop_id: int,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    await assert_shop_access(session, user, shop_id)
    hide = user.role == UserRole.barista
    total = (
        await session.execute(select(func.count()).select_from(StockItem).where(StockItem.shop_id == shop_id))
    ).scalar_one()
    low = (
        await session.execute(
            select(func.count())
            .select_from(StockItem)
            .where(
                StockItem.shop_id == shop_id,
                StockItem.quantity <= StockItem.min_quantity,
            )
        )
    ).scalar_one()
    shelf = Decimal("0")
    if not hide:
        shelf = (
            await session.execute(
                select(func.coalesce(func.sum(StockItem.quantity * StockItem.cost_per_base_unit), 0)).where(
                    StockItem.shop_id == shop_id
                )
            )
        ).scalar_one()
        shelf = Decimal(str(shelf)).quantize(Decimal("0.01"))
    return StockStatsOut(total_count=int(total), low_count=int(low), shelf_value=shelf)


@router.get("/shops/{shop_id}/stock-items", response_model=StockItemPage)
async def list_stock(
    shop_id: int,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
    q: str | None = Query(None),
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
    is_low: bool | None = Query(None),
):
    await assert_shop_access(session, user, shop_id)
    filters = [StockItem.shop_id == shop_id]
    needle = (q or "").strip()
    if needle:
        like = f"%{needle}%"
        filters.append(or_(StockItem.name.ilike(like), StockItem.sku.ilike(like)))
    if is_low is True:
        filters.append(StockItem.quantity <= StockItem.min_quantity)
    total = (
        await session.execute(select(func.count()).select_from(StockItem).where(*filters))
    ).scalar_one()
    result = await session.execute(
        select(StockItem)
        .where(*filters)
        .order_by(StockItem.name, StockItem.id)
        .offset(offset)
        .limit(limit)
    )
    items = list(result.scalars().all())
    hide = user.role == UserRole.barista
    last = await _last_income_map(session, shop_id, item_ids=[i.id for i in items])
    return StockItemPage(
        items=[_item_out(i, hide_cost=hide, last_income_at=last.get(i.id)) for i in items],
        total=int(total),
        limit=limit,
        offset=offset,
    )

@router.get("/shops/{shop_id}/stock-items/import-template")
async def stock_import_template(
    shop_id: int,
    lang: str = Query("ru"),
    user: User = Depends(manage),
    session: AsyncSession = Depends(get_session),
):
    await assert_shop_access(session, user, shop_id)
    data = build_stock_import_template(lang)
    return Response(
        content=data,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": 'attachment; filename="stock-import-template.xlsx"'},
    )


@router.post("/shops/{shop_id}/stock-items/import/preview", response_model=StockImportPreviewOut)
async def stock_import_preview(
    shop_id: int,
    file: UploadFile = File(...),
    user: User = Depends(manage),
    session: AsyncSession = Depends(get_session),
):
    await assert_shop_access(session, user, shop_id)
    content = await file.read()
    if not content:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Пустой файл")
    return parse_stock_import_xlsx(content)


@router.post("/shops/{shop_id}/stock-items/import/confirm", response_model=list[StockItemOut], status_code=201)
async def stock_import_confirm(
    shop_id: int,
    body: StockImportConfirmIn,
    user: User = Depends(manage),
    session: AsyncSession = Depends(get_session),
):
    await assert_shop_access(session, user, shop_id, write=True)
    await assert_no_open_revision(session, shop_id)
    created: list[StockItem] = []
    for row in body.rows:
        sku = _norm_sku(row.sku)
        await _assert_stock_sku_free(session, shop_id, sku)
        item = StockItem(
            shop_id=shop_id,
            name=row.name.strip(),
            sku=sku,
            base_unit=row.base_unit.strip(),
            purchase_unit=row.purchase_unit.strip(),
            purchase_to_base=row.purchase_to_base,
            quantity=Decimal("0"),
            min_quantity=row.min_quantity,
            cost_per_base_unit=row.cost_per_base_unit,
            is_ingredient=row.is_ingredient,
        )
        session.add(item)
        await session.flush()
        write_stock_log(
            session,
            item=item,
            action=StockLogAction.created,
            user=user,
            detail=item_create_detail(item),
        )
        if row.quantity > 0:
            price_total = (row.quantity * row.purchase_to_base * row.cost_per_base_unit).quantize(
                Decimal("0.01")
            )
            await apply_stock_movement(
                session,
                shop_id=shop_id,
                item=item,
                movement_type=StockMovementType.income,
                quantity=row.quantity,
                price_total=price_total,
                user=user,
                comment="импорт склада",
            )
        created.append(item)
    await session.commit()
    for item in created:
        await session.refresh(item)
    return [_item_out(item, hide_cost=False) for item in created]


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
    data = body.model_dump()
    data["sku"] = _norm_sku(data.get("sku"))
    await _assert_stock_sku_free(session, shop_id, data["sku"])
    item = StockItem(shop_id=shop_id, **data)
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
    if "sku" in changes:
        changes["sku"] = _norm_sku(changes["sku"])
        await _assert_stock_sku_free(session, shop_id, changes["sku"], exclude_id=item.id)
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


@router.post("/shops/{shop_id}/stock-items/{item_id}/make-product", response_model=ProductOut, status_code=201)
async def make_product_from_stock(
    shop_id: int,
    item_id: int,
    body: MakeProductIn,
    user: User = Depends(manage),
    session: AsyncSession = Depends(get_session),
):
    await assert_shop_access(session, user, shop_id, write=True)
    item = await session.get(StockItem, item_id)
    if item is None or item.shop_id != shop_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Позиция не найдена")
    if body.category_id is not None:
        category = await session.get(Category, body.category_id)
        if category is None or category.shop_id != shop_id:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Категория не найдена")
    product = Product(
        shop_id=shop_id,
        name=item.name,
        sku=_norm_sku(getattr(item, "sku", None)),
        sale_price=body.sale_price,
        category_id=body.category_id,
        is_active=True,
        is_service=False,
    )
    session.add(product)
    await session.flush()
    session.add(
        ProductIngredient(
            product_id=product.id,
            stock_item_id=item.id,
            quantity=Decimal("1"),
        )
    )
    await session.commit()
    result = await session.execute(
        select(Product)
        .options(
            selectinload(Product.category),
            selectinload(Product.ingredients).selectinload(ProductIngredient.stock_item),
            selectinload(Product.image),
        )
        .where(Product.id == product.id)
    )
    product = result.scalar_one()
    from app.api.v1.catalog import _product_out

    return _product_out(product)


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
