from decimal import Decimal

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile, status
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.api.deps import get_current_user, roles
from app.database import get_session
from app.models import (
    Category,
    Product,
    ProductIngredient,
    ProductVariant,
    ProductVariantIngredient,
    StockItem,
    User,
    UserRole,
    VitrineColumn,
    VitrineItem,
)
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
    VariantIn,
    VariantOut,
)
from app.schemas.vitrine import (
    VitrineColumnOut,
    VitrineItemOut,
    VitrineLayoutOut,
    VitrineLayoutUpdate,
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


def _norm_barcode(raw: str | None) -> str | None:
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


async def _assert_product_barcode_free(
    session: AsyncSession,
    shop_id: int,
    barcode: str | None,
    *,
    exclude_id: int | None = None,
    exclude_variant_id: int | None = None,
) -> None:
    if not barcode:
        return
    q = select(Product.id).where(Product.shop_id == shop_id, Product.barcode == barcode)
    if exclude_id is not None:
        q = q.where(Product.id != exclude_id)
    if (await session.execute(q.limit(1))).scalar_one_or_none() is not None:
        raise HTTPException(status.HTTP_409_CONFLICT, f"Штрихкод уже занят: {barcode}")
    vq = (
        select(ProductVariant.id)
        .join(Product, Product.id == ProductVariant.product_id)
        .where(Product.shop_id == shop_id, ProductVariant.barcode == barcode)
    )
    if exclude_variant_id is not None:
        vq = vq.where(ProductVariant.id != exclude_variant_id)
    if (await session.execute(vq.limit(1))).scalar_one_or_none() is not None:
        raise HTTPException(status.HTTP_409_CONFLICT, f"Штрихкод уже занят: {barcode}")


def _ingredient_out(ing: ProductIngredient | ProductVariantIngredient) -> IngredientOut:
    item = ing.stock_item
    return IngredientOut(
        stock_item_id=ing.stock_item_id,
        quantity=ing.quantity,
        stock_item_name=item.name if item else None,
        stock_item_sku=getattr(item, "sku", None) if item else None,
        unit=item.base_unit if item else None,
    )


def _variant_out(variant: ProductVariant) -> VariantOut:
    return VariantOut(
        id=variant.id,
        product_id=variant.product_id,
        name=variant.name,
        name_kk=variant.name_kk,
        name_en=variant.name_en,
        sort_order=variant.sort_order,
        sale_price=variant.sale_price,
        sku=variant.sku,
        barcode=variant.barcode,
        is_default=variant.is_default,
        is_active=variant.is_active,
        ingredients=[_ingredient_out(ing) for ing in variant.ingredients],
    )


def _product_out(product: Product, *, with_ingredients: bool = True) -> ProductOut:
    cost: Decimal | None = None
    ingredients: list[IngredientOut] = []
    if with_ingredients:
        cost = Decimal("0")
        for ing in product.ingredients:
            item = ing.stock_item
            cost += ing.quantity * (item.cost_per_base_unit if item else Decimal("0"))
            ingredients.append(_ingredient_out(ing))
        cost = cost.quantize(Decimal("0.01"))
    variants = [_variant_out(v) for v in getattr(product, "variants", []) or []]
    return ProductOut(
        id=product.id,
        shop_id=product.shop_id,
        category_id=product.category_id,
        name=product.name,
        name_kk=product.name_kk,
        name_en=product.name_en,
        sku=getattr(product, "sku", None),
        barcode=getattr(product, "barcode", None),
        sale_price=product.sale_price,
        sort_order=getattr(product, "sort_order", 0) or 0,
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
        variants=variants,
    )


def _product_load_options(*, with_ingredients: bool = True):
    options = [
        selectinload(Product.category),
        selectinload(Product.image),
        selectinload(Product.variants).selectinload(ProductVariant.ingredients).selectinload(
            ProductVariantIngredient.stock_item
        ),
    ]
    if with_ingredients:
        options.append(selectinload(Product.ingredients).selectinload(ProductIngredient.stock_item))
    return options


@router.get("/shops/{shop_id}/categories", response_model=list[CategoryOut])
async def list_categories(
    shop_id: int,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    await assert_shop_access(session, user, shop_id)
    result = await session.execute(
        select(Category)
        .where(Category.shop_id == shop_id)
        .order_by(Category.sort_order, Category.name)
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
        sort_order=body.sort_order,
        color=(body.color or "").strip() or None,
        icon=(body.icon or "").strip() or None,
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
    if "sort_order" in data and data["sort_order"] is not None:
        category.sort_order = data["sort_order"]
    if "color" in data:
        category.color = (data["color"] or "").strip() or None
    if "icon" in data:
        category.icon = (data["icon"] or "").strip() or None
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
        variant_match = (
            select(ProductVariant.product_id)
            .where(
                or_(
                    ProductVariant.sku.ilike(like),
                    ProductVariant.barcode.ilike(like),
                    ProductVariant.name.ilike(like),
                )
            )
        )
        filters.append(
            or_(
                Product.name.ilike(like),
                Product.name_kk.ilike(like),
                Product.name_en.ilike(like),
                Product.sku.ilike(like),
                Product.barcode.ilike(like),
                Product.id.in_(sku_match),
                Product.id.in_(variant_match),
            )
        )

    total = (
        await session.execute(select(func.count()).select_from(Product).where(*filters))
    ).scalar_one()

    result = await session.execute(
        select(Product)
        .options(*_product_load_options(with_ingredients=include_ingredients))
        .where(*filters)
        .order_by(Product.sort_order, Product.name, Product.id)
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


@router.get("/shops/{shop_id}/products/lookup", response_model=ProductOut)
async def lookup_product(
    shop_id: int,
    code: str = Query(..., min_length=1),
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    """Exact match by barcode or SKU — for barcode scanners on POS."""
    await assert_shop_access(session, user, shop_id)
    needle = code.strip()
    if not needle:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Товар не найден")

    active = [Product.is_active.is_(True)] if user.role == UserRole.barista else []
    options = _product_load_options(with_ingredients=True)

    for column in (Product.barcode, Product.sku):
        result = await session.execute(
            select(Product)
            .options(*options)
            .where(Product.shop_id == shop_id, column == needle, *active)
            .limit(1)
        )
        product = result.scalar_one_or_none()
        if product is not None:
            return _product_out(product, with_ingredients=True)

    variant_q = (
        select(ProductVariant)
        .join(Product, Product.id == ProductVariant.product_id)
        .where(
            Product.shop_id == shop_id,
            ProductVariant.is_active.is_(True),
            or_(ProductVariant.barcode == needle, ProductVariant.sku == needle),
            *active,
        )
        .limit(1)
    )
    variant = (await session.execute(variant_q)).scalar_one_or_none()
    if variant is not None:
        result = await session.execute(
            select(Product).options(*options).where(Product.id == variant.product_id)
        )
        product = result.scalar_one()
        out = _product_out(product, with_ingredients=True)
        # Prefer matched variant as default for POS add
        for v in out.variants:
            v.is_default = v.id == variant.id
        return out

    raise HTTPException(status.HTTP_404_NOT_FOUND, "Товар не найден")


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
        .options(*_product_load_options(with_ingredients=True))
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
    barcode = _norm_barcode(body.barcode)
    await _assert_product_sku_free(session, shop_id, sku)
    await _assert_product_barcode_free(session, shop_id, barcode)
    product = Product(
        shop_id=shop_id,
        name=body.name.strip(),
        name_kk=(body.name_kk or "").strip() or None,
        name_en=(body.name_en or "").strip() or None,
        sku=sku,
        barcode=barcode,
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
    if not body.is_service and body.variants:
        await _upsert_variants(session, shop_id, product, body.variants)
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
        .options(*_product_load_options(with_ingredients=True))
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
    variants = changes.pop("variants", None)
    ingredients = changes.pop("ingredients", None)
    if "sku" in changes:
        sku = _norm_sku(changes["sku"])
        await _assert_product_sku_free(session, shop_id, sku, exclude_id=product.id)
        changes["sku"] = sku
    if "barcode" in changes:
        barcode = _norm_barcode(changes["barcode"])
        await _assert_product_barcode_free(session, shop_id, barcode, exclude_id=product.id)
        changes["barcode"] = barcode
    for key, value in changes.items():
        if key in ("name_kk", "name_en"):
            value = (value or "").strip() or None
        elif key == "name" and isinstance(value, str):
            value = value.strip()
        setattr(product, key, value)
    if body.is_service is True:
        await _replace_ingredients(session, shop_id, product, [])
        await _upsert_variants(session, shop_id, product, [])
    elif ingredients is not None:
        await _replace_ingredients(session, shop_id, product, ingredients)
    if variants is not None:
        if product.is_service and variants:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "У услуги не бывает вариантов")
        await _upsert_variants(session, shop_id, product, variants)
        if variants:
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


async def _upsert_variants(
    session: AsyncSession, shop_id: int, product: Product, variants: list[VariantIn]
) -> None:
    existing_rows = (
        await session.execute(select(ProductVariant).where(ProductVariant.product_id == product.id))
    ).scalars().all()
    by_id = {v.id: v for v in existing_rows}
    keep_ids: set[int] = set()

    defaults = [v for v in variants if v.is_default]
    if len(defaults) > 1:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Только один вариант может быть по умолчанию")

    seen_sku: set[str] = set()
    seen_barcode: set[str] = set()
    for idx, body in enumerate(variants):
        name = body.name.strip()
        if not name:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "Пустое название варианта")
        sku = _norm_sku(body.sku)
        barcode = _norm_barcode(body.barcode)
        if sku:
            if sku in seen_sku:
                raise HTTPException(status.HTTP_409_CONFLICT, f"Артикул варианта уже занят: {sku}")
            seen_sku.add(sku)
        if barcode:
            if barcode in seen_barcode:
                raise HTTPException(status.HTTP_409_CONFLICT, f"Штрихкод варианта уже занят: {barcode}")
            seen_barcode.add(barcode)

        variant: ProductVariant | None = None
        if body.id is not None:
            variant = by_id.get(body.id)
            if variant is None or variant.product_id != product.id:
                raise HTTPException(status.HTTP_404_NOT_FOUND, f"Вариант {body.id} не найден")
        if variant is None:
            variant = ProductVariant(product_id=product.id)
            session.add(variant)
            await session.flush()
        else:
            keep_ids.add(variant.id)

        if barcode:
            await _assert_product_barcode_free(
                session, shop_id, barcode, exclude_variant_id=variant.id
            )

        variant.name = name
        variant.name_kk = (body.name_kk or "").strip() or None
        variant.name_en = (body.name_en or "").strip() or None
        variant.sort_order = body.sort_order if body.sort_order else idx
        variant.sale_price = body.sale_price
        variant.sku = sku
        variant.barcode = barcode
        variant.is_default = body.is_default
        variant.is_active = body.is_active
        keep_ids.add(variant.id)

        ing_rows = (
            await session.execute(
                select(ProductVariantIngredient).where(
                    ProductVariantIngredient.variant_id == variant.id
                )
            )
        ).scalars().all()
        for row in ing_rows:
            await session.delete(row)
        await session.flush()
        for ing in body.ingredients:
            item = await session.get(StockItem, ing.stock_item_id)
            if item is None or item.shop_id != shop_id:
                raise HTTPException(status.HTTP_400_BAD_REQUEST, "Stock item not in this shop")
            session.add(
                ProductVariantIngredient(
                    variant_id=variant.id,
                    stock_item_id=ing.stock_item_id,
                    quantity=ing.quantity,
                )
            )

    for row in existing_rows:
        if row.id not in keep_ids:
            await session.delete(row)
    await session.flush()


async def _reload_product(session: AsyncSession, product_id: int) -> ProductOut:
    result = await session.execute(
        select(Product)
        .options(*_product_load_options(with_ingredients=True))
        .where(Product.id == product_id)
    )
    product = result.scalar_one()
    return _product_out(product)


@router.get("/shops/{shop_id}/vitrine-layout", response_model=VitrineLayoutOut)
async def get_vitrine_layout(
    shop_id: int,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    await assert_shop_access(session, user, shop_id)
    return await _load_vitrine_layout(session, shop_id)


@router.put("/shops/{shop_id}/vitrine-layout", response_model=VitrineLayoutOut)
async def put_vitrine_layout(
    shop_id: int,
    body: VitrineLayoutUpdate,
    user: User = Depends(manage),
    session: AsyncSession = Depends(get_session),
):
    await assert_shop_access(session, user, shop_id, write=True)
    existing = (
        await session.execute(select(VitrineColumn).where(VitrineColumn.shop_id == shop_id))
    ).scalars().all()
    for col in existing:
        await session.delete(col)
    await session.flush()

    for col_idx, col_in in enumerate(body.columns):
        title = col_in.title.strip()
        if not title:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "Пустое название колонки")
        if col_in.header_style not in ("ornament", "line", "none"):
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "Неверный стиль заголовка")
        column = VitrineColumn(
            shop_id=shop_id,
            title=title,
            sort_order=col_in.sort_order if col_in.sort_order else col_idx,
            header_style=col_in.header_style,
        )
        session.add(column)
        await session.flush()
        for item_idx, item_in in enumerate(col_in.items):
            product = await session.get(Product, item_in.product_id)
            if product is None or product.shop_id != shop_id:
                raise HTTPException(
                    status.HTTP_404_NOT_FOUND, f"Товар {item_in.product_id} не найден"
                )
            session.add(
                VitrineItem(
                    column_id=column.id,
                    product_id=item_in.product_id,
                    sort_order=item_in.sort_order if item_in.sort_order else item_idx,
                )
            )

    await session.commit()
    return await _load_vitrine_layout(session, shop_id)


async def _load_vitrine_layout(session: AsyncSession, shop_id: int) -> VitrineLayoutOut:
    result = await session.execute(
        select(VitrineColumn)
        .options(
            selectinload(VitrineColumn.items)
            .selectinload(VitrineItem.product)
            .options(*_product_load_options(with_ingredients=False)),
        )
        .where(VitrineColumn.shop_id == shop_id)
        .order_by(VitrineColumn.sort_order, VitrineColumn.id)
    )
    columns = result.scalars().unique().all()
    out_cols: list[VitrineColumnOut] = []
    for col in columns:
        items_out: list[VitrineItemOut] = []
        for item in sorted(col.items, key=lambda i: (i.sort_order, i.id)):
            items_out.append(
                VitrineItemOut(
                    id=item.id,
                    product_id=item.product_id,
                    sort_order=item.sort_order,
                    product=_product_out(item.product, with_ingredients=False),
                )
            )
        out_cols.append(
            VitrineColumnOut(
                id=col.id,
                title=col.title,
                sort_order=col.sort_order,
                header_style=col.header_style or "ornament",
                items=items_out,
            )
        )
    return VitrineLayoutOut(columns=out_cols)
