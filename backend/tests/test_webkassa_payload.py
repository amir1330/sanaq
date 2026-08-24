from decimal import Decimal
from types import SimpleNamespace

from app.models.enums import PaymentType
from app.services.webkassa import build_check_payload, money_float, tax_amount


def test_tax_zero_when_simplified():
    assert tax_amount(Decimal("4.50"), Decimal("0")) == 0.0


def test_money_quantizes():
    assert money_float(Decimal("4.5")) == 4.5
    assert money_float("10.009") == 10.01


def test_check_payload_is_idempotent():
    shop = SimpleNamespace(webkassa_cashbox_number="KKM-1")
    sale = SimpleNamespace(id=42, total_amount=Decimal("9.00"), payment_type=PaymentType.cash)
    item = SimpleNamespace(product_id=7, quantity=2, price_snapshot=Decimal("4.50"))
    product = SimpleNamespace(
        name="Латте",
        fiscal_position_code=None,
        tax_percent=Decimal("0"),
        tax_type=0,
    )
    payload = build_check_payload(
        shop=shop,
        sale=sale,
        items=[item],
        products={7: product},
        token="tok",
        operation_type=2,
    )
    assert payload["ExternalCheckNumber"] == "42"
    assert payload["ExternalOrderNumber"] == "42"
    assert payload["CashboxUniqueNumber"] == "KKM-1"
    assert payload["Token"] == "tok"
    assert payload["Positions"][0]["PositionName"] == "Латте"
    assert payload["Positions"][0]["PositionCode"] == "7"
    assert payload["Positions"][0]["Tax"] == 0.0
    assert payload["Payments"][0]["Sum"] == 9.0
