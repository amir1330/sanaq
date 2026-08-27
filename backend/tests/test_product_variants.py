from decimal import Decimal

from app.models.catalog import ProductVariant, ProductVariantIngredient


def test_variant_defaults_and_fields():
    variant = ProductVariant(
        product_id=1,
        name="Средний",
        sale_price=Decimal("4.50"),
        sort_order=1,
        is_default=True,
        is_active=True,
    )
    assert variant.name == "Средний"
    assert variant.sale_price == Decimal("4.50")
    assert variant.is_default is True
    assert variant.is_active is True
    assert variant.sort_order == 1


def test_variant_ingredient_quantity():
    row = ProductVariantIngredient(
        variant_id=1,
        stock_item_id=2,
        quantity=Decimal("180.000"),
    )
    assert row.quantity == Decimal("180.000")
