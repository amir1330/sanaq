from decimal import Decimal
from types import SimpleNamespace

from app.models.enums import CashMovementType, PaymentType, ShiftStatus
from app.services.sales import shift_totals


def test_expected_cash_includes_sales_and_movements():
    shift = SimpleNamespace(
        opening_cash=Decimal("50.00"),
        closing_cash=Decimal("120.00"),
        status=ShiftStatus.closed,
    )
    sales = [
        SimpleNamespace(is_refunded=False, payment_type=PaymentType.cash, total_amount=Decimal("40")),
        SimpleNamespace(is_refunded=False, payment_type=PaymentType.card, total_amount=Decimal("25")),
        SimpleNamespace(is_refunded=True, payment_type=PaymentType.cash, total_amount=Decimal("10")),
    ]
    movements = [
        SimpleNamespace(type=CashMovementType.deposit, amount=Decimal("20")),
        SimpleNamespace(type=CashMovementType.withdrawal, amount=Decimal("5")),
    ]
    totals = shift_totals(shift, sales, movements)
    assert totals["cash_revenue"] == Decimal("40")
    assert totals["card_revenue"] == Decimal("25")
    assert totals["sales_count"] == 2
    assert totals["expected_cash"] == Decimal("105.00")
    assert totals["cash_difference"] == Decimal("15.00")


def test_seller_totals_split_revenue():
    from app.services.sales import seller_totals

    sales = [
        SimpleNamespace(
            is_refunded=False,
            payment_type=PaymentType.cash,
            total_amount=Decimal("40"),
            barista_id=1,
            barista=SimpleNamespace(full_name="Amina"),
        ),
        SimpleNamespace(
            is_refunded=False,
            payment_type=PaymentType.card,
            total_amount=Decimal("25"),
            barista_id=2,
            barista=SimpleNamespace(full_name="Bekzat"),
        ),
        SimpleNamespace(
            is_refunded=False,
            payment_type=PaymentType.cash,
            total_amount=Decimal("10"),
            barista_id=1,
            barista=SimpleNamespace(full_name="Amina"),
        ),
    ]
    rows = seller_totals(sales)
    assert rows[0].barista_name == "Amina"
    assert rows[0].revenue == Decimal("50")
    assert rows[0].sales_count == 2
    assert rows[1].barista_name == "Bekzat"
    assert rows[1].card_revenue == Decimal("25")
