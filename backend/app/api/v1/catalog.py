from decimal import Decimal

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from sqlalchemy import select
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
    ProductUpdate,
)
from app.services.access import assert_shop_access
from app.services.uploads import delete_upload, replace_upload

router = APIRouter(tags=["catalog"])
manage = roles(UserRole.super_admin, UserRole.owner)


def _product_out(product: Product) -> ProductOut:
    cost = Decimal("0")
    ingredients: list[IngredientOut] = []
    for ing in product.ingredients:
        item = ing.stock_item
        cost += ing.quantity * (item.cost_per_base_unit if item else Decimal("0"))
        ingredients.append(
            IngredientOut(
                stock_item_id=ing.stock_item_id,
                quantity=ing.quantity,
                stock_item_name=item.name if item else None,
                unit=item.base_unit if item else None,
            )
        )
    return ProductOut(
        id=product.id,
        shop_id=product.shop_id,
        category_id=product.category_id,
        name=product.name,
        name_kk=product.name_kk,
        name_en=product.name_en,
        sale_price=product.sale_price,
        is_active=product.is_active,
        image_url=product.image_url,
        created_at=product.created_at,
        category_name=product.category.name if product.category else None,
        category_name_kk=product.category.name_kk if product.category else None,
        category_name_en=product.category.name_en if product.category else None,
        cost_price=cost.quantize(Decimal("0.01")),
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


@router.get("/shops/{shop_id}/products", response_model=list[ProductOut])
async def list_products(
    shop_id: int,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
    active_only: bool = False,
):
    await assert_shop_access(session, user, shop_id)
    query = (
        select(Product)
        .options(
            selectinload(Product.category),
            selectinload(Product.ingredients).selectinload(ProductIngredient.stock_item),
        )
        .where(Product.shop_id == shop_id)
        .order_by(Product.name)
    )
    if active_only or user.role == UserRole.barista:
        query = query.where(Product.is_active.is_(True))
    result = await session.execute(query)
    products = result.scalars().unique().all()
    return [_product_out(p) for p in products]


@router.post("/shops/{shop_id}/products", response_model=ProductOut, status_code=201)
async def create_product(
    shop_id: int,
    body: ProductCreate,
    user: User = Depends(manage),
    session: AsyncSession = Depends(get_session),
):
    await assert_shop_access(session, user, shop_id, write=True)
    product = Product(
        shop_id=shop_id,
        name=body.name.strip(),
        name_kk=(body.name_kk or "").strip() or None,
        name_en=(body.name_en or "").strip() or None,
        sale_price=body.sale_price,
        category_id=body.category_id,
        is_active=body.is_active,
        fiscal_position_code=body.fiscal_position_code,
        tax_percent=body.tax_percent,
        tax_type=body.tax_type,
    )
    session.add(product)
    await session.flush()
    await _replace_ingredients(session, shop_id, product, body.ingredients)
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
    for key, value in body.model_dump(exclude_unset=True).items():
        if key in ("name_kk", "name_en"):
            value = (value or "").strip() or None
        elif key == "name" and isinstance(value, str):
            value = value.strip()
        setattr(product, key, value)
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
