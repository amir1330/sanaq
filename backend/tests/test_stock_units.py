from decimal import Decimal
from types import SimpleNamespace

from app.services.stock import fifo_consume, fifo_unit_cost, to_base, to_purchase


def test_pack_of_milk_to_ml():
    assert to_base(Decimal("12"), Decimal("1000")) == Decimal("12000.000")


def test_remaining_packs():
    assert to_purchase(Decimal("12400"), Decimal("1000")) == Decimal("12.400")


def test_fifo_uses_old_batch_first():
    lots = [
        SimpleNamespace(quantity_remaining=Decimal("1000"), cost_per_base_unit=Decimal("0.05")),
        SimpleNamespace(quantity_remaining=Decimal("500"), cost_per_base_unit=Decimal("0.08")),
    ]
    cogs = fifo_consume(lots, Decimal("1200"), Decimal("0.05"))
    assert cogs == Decimal("66.00")  # 1000*0.05 + 200*0.08
    assert lots[0].quantity_remaining == Decimal("0.000")
    assert lots[1].quantity_remaining == Decimal("300.000")


def test_fifo_remaining_cost_is_whats_left_on_shelf():
    lots = [
        SimpleNamespace(quantity_remaining=Decimal("0"), cost_per_base_unit=Decimal("0.05")),
        SimpleNamespace(quantity_remaining=Decimal("300"), cost_per_base_unit=Decimal("0.08")),
    ]
    assert fifo_unit_cost(lots, Decimal("0.05")) == Decimal("0.0800")


def test_oversell_uses_fallback_cost():
    lots = [SimpleNamespace(quantity_remaining=Decimal("10"), cost_per_base_unit=Decimal("2"))]
    cogs = fifo_consume(lots, Decimal("15"), Decimal("2"))
    assert cogs == Decimal("30.00")
    assert lots[0].quantity_remaining == Decimal("0.000")


def test_resale_piece_is_one_to_one():
    assert to_base(Decimal("24"), Decimal("1")) == Decimal("24.000")
    assert to_purchase(Decimal("24"), Decimal("1")) == Decimal("24.000")
