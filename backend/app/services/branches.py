from decimal import Decimal

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models import Category, OwnerShop, Product, ProductIngredient, Shop, StockItem, User, UserRole
from app.services.access import owned_shop_ids
from app.services.uploads import copy_upload


async def clone_shop_catalog(session: AsyncSession, source_id: int, dest: Shop) -> None:
    source = await session.get(Shop, source_id)
    if source is not None:
        dest.logo = copy_upload(session, source.logo, dest.id, prefix="logo")

    categories = (
        await session.execute(select(Category).where(Category.shop_id == source_id).order_by(Category.id))
    ).scalars().all()
    category_map: dict[int, int] = {}
    for category in categories:
        copy = Category(shop_id=dest.id, name=category.name)
        session.add(copy)
        await session.flush()
        category_map[category.id] = copy.id

    items = (
        await session.execute(select(StockItem).where(StockItem.shop_id == source_id).order_by(StockItem.id))
    ).scalars().all()
    item_map: dict[int, int] = {}
    for item in items:
        copy = StockItem(
            shop_id=dest.id,
            name=item.name,
            base_unit=item.base_unit,
            purchase_unit=item.purchase_unit,
            purchase_to_base=item.purchase_to_base,
            quantity=Decimal("0"),
            min_quantity=item.min_quantity,
            cost_per_base_unit=item.cost_per_base_unit,
        )
        session.add(copy)
        await session.flush()
        copy.image = copy_upload(session, item.image, dest.id, prefix=f"item-{copy.id}")
        item_map[item.id] = copy.id

    products = (
        await session.execute(
            select(Product)
            .options(selectinload(Product.ingredients))
            .where(Product.shop_id == source_id)
            .order_by(Product.id)
        )
    ).scalars().all()
    for product in products:
        copy = Product(
            shop_id=dest.id,
            category_id=category_map.get(product.category_id) if product.category_id else None,
            name=product.name,
            sale_price=product.sale_price,
            is_active=product.is_active,
            fiscal_position_code=product.fiscal_position_code,
            tax_percent=product.tax_percent,
            tax_type=product.tax_type,
        )
        session.add(copy)
        await session.flush()
        copy.image = copy_upload(session, product.image, dest.id, prefix=f"product-{copy.id}")
        for ing in product.ingredients:
            new_item_id = item_map.get(ing.stock_item_id)
            if new_item_id is None:
                continue
            session.add(
                ProductIngredient(
                    product_id=copy.id,
                    stock_item_id=new_item_id,
                    quantity=ing.quantity,
                )
            )


async def attach_owner(session: AsyncSession, owner: User, shop_id: int) -> None:
    exists = (
        await session.execute(
            select(OwnerShop).where(OwnerShop.owner_id == owner.id, OwnerShop.shop_id == shop_id)
        )
    ).scalar_one_or_none()
    if exists is None:
        session.add(OwnerShop(owner_id=owner.id, shop_id=shop_id))


async def create_branch(
    session: AsyncSession,
    *,
    user: User,
    name: str,
    address: str | None,
    timezone: str,
    copy_from_shop_id: int | None,
    copy_catalog: bool,
) -> Shop:
    if copy_from_shop_id is not None and user.role != UserRole.super_admin:
        allowed = await owned_shop_ids(session, user)
        if copy_from_shop_id not in allowed:
            raise HTTPException(status.HTTP_403_FORBIDDEN, "Нет доступа к исходной точке")

    from app.services.sales import ensure_default_cash_register

    shop = Shop(name=name.strip(), address=(address or "").strip() or None, timezone=timezone)
    session.add(shop)
    await session.flush()
    await ensure_default_cash_register(session, shop.id)

    await attach_owner(session, user, shop.id)
    if copy_from_shop_id is not None:
        others = (
            await session.execute(select(OwnerShop.owner_id).where(OwnerShop.shop_id == copy_from_shop_id))
        ).scalars().all()
        for owner_id in others:
            if owner_id == user.id:
                continue
            session.add(OwnerShop(owner_id=owner_id, shop_id=shop.id))
        if copy_catalog:
            await clone_shop_catalog(session, copy_from_shop_id, shop)

    await session.flush()
    return shop
