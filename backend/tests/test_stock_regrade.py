from decimal import Decimal

from app.services.stock import pair_quantity
from fastapi import HTTPException
import pytest


def test_same_unit_keeps_qty():
    assert pair_quantity("мл", "мл", Decimal("180"), None) == Decimal("180.000")


def test_explicit_output_qty():
    assert pair_quantity("г", "мл", Decimal("18"), Decimal("180")) == Decimal("180.000")


def test_diff_unit_needs_output():
    with pytest.raises(HTTPException) as err:
        pair_quantity("г", "мл", Decimal("18"), None)
    assert err.value.status_code == 400
