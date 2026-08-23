from decimal import Decimal

from app.services.stock import moving_average_cost, to_base, to_purchase


def test_pack_of_milk_to_ml():
    assert to_base(Decimal("12"), Decimal("1000")) == Decimal("12000.000")


def test_remaining_packs():
    assert to_purchase(Decimal("12400"), Decimal("1000")) == Decimal("12.400")


def test_moving_average_on_second_delivery():
    # 10 л по 500 ₸/л уже на складе как 10000 мл по 0.05 ₸/мл
    new_cost = moving_average_cost(
        Decimal("10000"),
        Decimal("0.05"),
        Decimal("5000"),
        Decimal("300"),
    )
    assert new_cost.quantize(Decimal("0.0001")) == Decimal("0.0533")


def test_income_without_price_keeps_cost():
    assert moving_average_cost(Decimal("100"), Decimal("2"), Decimal("10"), None) == Decimal("2")


def test_first_delivery_sets_cost_from_batch():
    assert moving_average_cost(Decimal("0"), Decimal("0"), Decimal("1000"), Decimal("500")) == Decimal("0.5")


def test_resale_piece_is_one_to_one():
    assert to_base(Decimal("24"), Decimal("1")) == Decimal("24.000")
    assert to_purchase(Decimal("24"), Decimal("1")) == Decimal("24.000")
