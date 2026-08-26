from decimal import Decimal

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile, status
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.api.deps import get_current_user, roles
from app.database import get_session
from app.models import Category, Product, ProductIngredient, StockItem, User, UserRole
from app.schemas.catalog import (
    CategoryCreate,
    CategoryOut,
    CategoryUpdate,
    IngredientIn,
    IngredientOut,
    ProductBulkCreate,
    ProductCreate,
    ProductOut,
    ProductPage,
    ProductUpdate,
)
from app.services.access import assert_shop_access
from app.services.uploads import delete_upload, replace_upload

router = APIRouter(tags=["catalog"])
manage = roles(UserRole.super_admin, UserRole.owner)


def _norm_sku(raw: str | None) -> str | None:
    if raw is None:
        return None
    value = raw.strip()
    return value or None


async def _assert_product_sku_free(
    session: AsyncSession,
    shop_id: int,
    sku: str | None,
    *,
    exclude_id: int | None = None,
) -> None:
    if not sku:
        return
    q = select(Product.id).where(Product.shop_id == shop_id, Product.sku == sku)
    if exclude_id is not None:
        q = q.where(Product.id != exclude_id)
    if (await session.execute(q.limit(1))).scalar_one_or_none() is not None:
        raise HTTPException(status.HTTP_409_CONFLICT, f"Артикул уже занят: {sku}")


def _product_out(product: Product, *, with_ingredients: bool = True) -> ProductOut:
    cost: Decimal | None = None
    ingredients: list[IngredientOut] = []
    if with_ingredients:
        cost = Decimal("0")
        for ing in product.ingredients:
            item = ing.stock_item
            cost += ing.quantity * (item.cost_per_base_unit if item else Decimal("0"))
            ingredients.append(
                IngredientOut(
                    stock_item_id=ing.stock_item_id,
                    quantity=ing.quantity,
                    stock_item_name=item.name if item else None,
                    stock_item_sku=getattr(item, "sku", None) if item else None,
                    unit=item.base_unit if item else None,
                )
            )
        cost = cost.quantize(Decimal("0.01"))
    return ProductOut(
        id=product.id,
        shop_id=product.shop_id,
        category_id=product.category_id,
        name=product.name,
        name_kk=product.name_kk,
        name_en=product.name_en,
        sku=getattr(product, "sku", None),
        sale_price=product.sale_price,
        is_active=product.is_active,
        is_service=bool(getattr(product, "is_service", False)),
        image_url=product.image_url,
        created_at=product.created_at,
        category_name=product.category.name if product.category else None,
        category_name_kk=product.category.name_kk if product.category else None,
        category_name_en=product.category.name_en if product.category else None,
        cost_price=cost,
        fiscal_position_code=product.fiscal_position_code,
        tax_percent=product.tax_percent,
        tax_type=product.tax_type,
        ingredients=ingredients,
    )


@router.get("/shops/{shop_id}/categories", response_model=list[CategoryOut])
async def list_categories(
    shop_id: int,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    await assert_shop_access(session, user, shop_id)
    result = await session.execute(
        select(Category).where(Category.shop_id == shop_id).order_by(Category.name)
    )
    return result.scalars().all()


@router.post("/shops/{shop_id}/categories", response_model=CategoryOut, status_code=201)
async def create_category(
    shop_id: int,
    body: CategoryCreate,
    user: User = Depends(manage),
    session: AsyncSession = Depends(get_session),
):
    await assert_shop_access(session, user, shop_id, write=True)
    category = Category(
        shop_id=shop_id,
        name=body.name.strip(),
        name_kk=(body.name_kk or "").strip() or None,
        name_en=(body.name_en or "").strip() or None,
    )
    session.add(category)
    await session.commit()
    await session.refresh(category)
    return category


@router.patch("/shops/{shop_id}/categories/{category_id}", response_model=CategoryOut)
async def update_category(
    shop_id: int,
    category_id: int,
    body: CategoryUpdate,
    user: User = Depends(manage),
    session: AsyncSession = Depends(get_session),
):
    await assert_shop_access(session, user, shop_id, write=True)
    category = await session.get(Category, category_id)
    if category is None or category.shop_id != shop_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Category not found")
    if body.name is not None:
        category.name = body.name.strip()
    data = body.model_dump(exclude_unset=True)
    if "name_kk" in data:
        category.name_kk = (data["name_kk"] or "").strip() or None
    if "name_en" in data:
        category.name_en = (data["name_en"] or "").strip() or None
    await session.commit()
    await session.refresh(category)
    return category


@router.delete("/shops/{shop_id}/categories/{category_id}", status_code=204)
async def delete_category(
    shop_id: int,
    category_id: int,
    user: User = Depends(manage),
    session: AsyncSession = Depends(get_session),
):
    await assert_shop_access(session, user, shop_id, write=True)
    category = await session.get(Category, category_id)
    if category is None or category.shop_id != shop_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Category not found")
    await session.delete(category)
    await session.commit()


@router.get("/shops/{shop_id}/products", response_model=ProductPage)
async def list_products(
    shop_id: int,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
    q: str | None = Query(None),
    category_id: int | None = Query(None),
    active_only: bool = False,
    include_ingredients: bool = False,
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
):
    await assert_shop_access(session, user, shop_id)
    filters = [Product.shop_id == shop_id]
    if active_only or user.role == UserRole.barista:
        filters.append(Product.is_active.is_(True))
    if category_id is not None:
        filters.append(Product.category_id == category_id)
    needle = (q or "").strip()
    if needle:
        like = f"%{needle}%"
        sku_match = (
            select(ProductIngredient.product_id)
            .join(StockItem, StockItem.id == ProductIngredient.stock_item_id)
            .where(StockItem.shop_id == shop_id, StockItem.sku.ilike(like))
        )
        filters.append(
            or_(
                Product.name.ilike(like),
                Product.name_kk.ilike(like),
                Product.name_en.ilike(like),
                Product.sku.ilike(like),
                Product.id.in_(sku_match),
            )
        )

    total = (
        await session.execute(select(func.count()).select_from(Product).where(*filters))
    ).scalar_one()

    options = [selectinload(Product.category)]
    if include_ingredients:
        options.append(selectinload(Product.ingredients).selectinload(ProductIngredient.stock_item))

    result = await session.execute(
        select(Product)
        .options(*options)
        .where(*filters)
        .order_by(Product.name, Product.id)
        .offset(offset)
        .limit(limit)
    )
    products = list(result.scalars().unique().all())
    return ProductPage(
        items=[_product_out(p, with_ingredients=include_ingredients) for p in products],
        total=int(total),
        limit=limit,
        offset=offset,
    )


@router.get("/shops/{shop_id}/products/{product_id}", response_model=ProductOut)
async def get_product(
    shop_id: int,
    product_id: int,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    await assert_shop_access(session, user, shop_id)
    result = await session.execute(
        select(Product)
        .options(
            selectinload(Product.category),
            selectinload(Product.ingredients).selectinload(ProductIngredient.stock_item),
            selectinload(Product.image),
        )
        .where(Product.id == product_id, Product.shop_id == shop_id)
    )
    product = result.scalar_one_or_none()
    if product is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Product not found")
    return _product_out(product, with_ingredients=True)

@router.post("/shops/{shop_id}/products", response_model=ProductOut, status_code=201)
async def create_product(
    shop_id: int,
    body: ProductCreate,
    user: User = Depends(manage),
    session: AsyncSession = Depends(get_session),
):
    await assert_shop_access(session, user, shop_id, write=True)
    sku = _norm_sku(body.sku)
    await _assert_product_sku_free(session, shop_id, sku)
    product = Product(
        shop_id=shop_id,
        name=body.name.strip(),
        name_kk=(body.name_kk or "").strip() or None,
        name_en=(body.name_en or "").strip() or None,
        sku=sku,
        sale_price=body.sale_price,
        category_id=body.category_id,
        is_active=body.is_active,
        is_service=body.is_service,
        fiscal_position_code=body.fiscal_position_code,
        tax_percent=body.tax_percent,
        tax_type=body.tax_type,
    )
    session.add(product)
    await session.flush()
    await _replace_ingredients(
        session, shop_id, product, [] if body.is_service else body.ingredients
    )
    await session.commit()
    return await _reload_product(session, product.id)


@router.post("/shops/{shop_id}/products/bulk", response_model=list[ProductOut], status_code=201)
async def create_products_bulk(
    shop_id: int,
    body: ProductBulkCreate,
    user: User = Depends(manage),
    session: AsyncSession = Depends(get_session),
):
    await assert_shop_access(session, user, shop_id, write=True)
    if body.category_id is not None:
        category = await session.get(Category, body.category_id)
        if category is None or category.shop_id != shop_id:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Категория не найдена")

    created_ids: list[int] = []
    for item in body.items:
        name = item.name.strip()
        if not name:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "Пустое название в списке")
        product = Product(
            shop_id=shop_id,
            name=name,
            sale_price=item.sale_price,
            category_id=body.category_id,
            is_active=True,
            tax_percent=Decimal("0"),
            tax_type=0,
        )
        session.add(product)
        await session.flush()
        created_ids.append(product.id)

    await session.commit()
    result = await session.execute(
        select(Product)
        .options(
            selectinload(Product.category),
            selectinload(Product.ingredients).selectinload(ProductIngredient.stock_item),
        )
        .where(Product.id.in_(created_ids))
        .order_by(Product.id)
    )
    return [_product_out(p) for p in result.scalars().unique().all()]


@router.patch("/shops/{shop_id}/products/{product_id}", response_model=ProductOut)
async def update_product(
    shop_id: int,
    product_id: int,
    body: ProductUpdate,
    user: User = Depends(manage),
    session: AsyncSession = Depends(get_session),
):
    await assert_shop_access(session, user, shop_id, write=True)
    product = await session.get(Product, product_id)
    if product is None or product.shop_id != shop_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Product not found")
    changes = body.model_dump(exclude_unset=True)
    if "sku" in changes:
        sku = _norm_sku(changes["sku"])
        await _assert_product_sku_free(session, shop_id, sku, exclude_id=product.id)
        changes["sku"] = sku
    for key, value in changes.items():
        if key in ("name_kk", "name_en"):
            value = (value or "").strip() or None
        elif key == "name" and isinstance(value, str):
            value = value.strip()
        setattr(product, key, value)
    if body.is_service is True:
        await _replace_ingredients(session, shop_id, product, [])
    await session.commit()
    return await _reload_product(session, product.id)


@router.post("/shops/{shop_id}/products/{product_id}/image", response_model=ProductOut)
async def upload_product_image(
    shop_id: int,
    product_id: int,
    file: UploadFile = File(...),
    user: User = Depends(manage),
    session: AsyncSession = Depends(get_session),
):
    await assert_shop_access(session, user, shop_id, write=True)
    product = await session.get(Product, product_id)
    if product is None or product.shop_id != shop_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Product not found")
    product.image = await replace_upload(
        session,
        file,
        shop_id=shop_id,
        kind="product",
        prefix=f"product-{product.id}",
        uploader_id=user.id,
        previous=product.image,
    )
    await session.commit()
    return await _reload_product(session, product.id)


@router.delete("/shops/{shop_id}/products/{product_id}/image", response_model=ProductOut)
async def delete_product_image(
    shop_id: int,
    product_id: int,
    user: User = Depends(manage),
    session: AsyncSession = Depends(get_session),
):
    await assert_shop_access(session, user, shop_id, write=True)
    product = await session.get(Product, product_id)
    if product is None or product.shop_id != shop_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Product not found")
    await delete_upload(session, product.image)
    product.image = None
    await session.commit()
    return await _reload_product(session, product.id)


@router.delete("/shops/{shop_id}/products/{product_id}", status_code=204)
async def delete_product(
    shop_id: int,
    product_id: int,
    user: User = Depends(manage),
    session: AsyncSession = Depends(get_session),
):
    await assert_shop_access(session, user, shop_id, write=True)
    product = await session.get(Product, product_id)
    if product is None or product.shop_id != shop_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Product not found")
    await delete_upload(session, product.image)
    await session.delete(product)
    await session.commit()


@router.post("/shops/{shop_id}/products/{product_id}/ingredients", response_model=ProductOut)
async def set_ingredients(
    shop_id: int,
    product_id: int,
    body: list[IngredientIn],
    user: User = Depends(manage),
    session: AsyncSession = Depends(get_session),
):
    await assert_shop_access(session, user, shop_id, write=True)
    product = await session.get(Product, product_id)
    if product is None or product.shop_id != shop_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Product not found")
    await _replace_ingredients(session, shop_id, product, body)
    await session.commit()
    return await _reload_product(session, product.id)


async def _replace_ingredients(
    session: AsyncSession, shop_id: int, product: Product, ingredients: list[IngredientIn]
) -> None:
    existing = await session.execute(
        select(ProductIngredient).where(ProductIngredient.product_id == product.id)
    )
    for row in existing.scalars().all():
        await session.delete(row)
    await session.flush()
    for ing in ingredients:
        item = await session.get(StockItem, ing.stock_item_id)
        if item is None or item.shop_id != shop_id:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "Stock item not in this shop")
        session.add(
            ProductIngredient(
                product_id=product.id,
                stock_item_id=ing.stock_item_id,
                quantity=ing.quantity,
            )
        )


async def _reload_product(session: AsyncSession, product_id: int) -> ProductOut:
    result = await session.execute(
        select(Product)
        .options(
            selectinload(Product.category),
            selectinload(Product.ingredients).selectinload(ProductIngredient.stock_item),
        )
        .where(Product.id == product_id)
    )
    product = result.scalar_one()
    return _product_out(product)
