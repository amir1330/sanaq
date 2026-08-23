from datetime import date, datetime, timezone
from decimal import Decimal

from app.services.reports import build_report_csv


def test_report_csv_has_sections_and_bom():
    csv = build_report_csv(
        shop_name="Corner",
        from_date=date(2026, 8, 1),
        to_date=date(2026, 8, 23),
        summary={
            "revenue": Decimal("120.00"),
            "cash_revenue": Decimal("80"),
            "card_revenue": Decimal("40"),
            "cost": Decimal("30"),
            "profit": Decimal("90"),
            "expenses": Decimal("10"),
            "net_profit": Decimal("80"),
            "sales_count": 3,
        },
        daily=[
            {
                "day": datetime(2026, 8, 23, 0, 0, tzinfo=timezone.utc),
                "cash_revenue": Decimal("80"),
                "card_revenue": Decimal("40"),
                "revenue": Decimal("120"),
                "cost": Decimal("30"),
                "profit": Decimal("90"),
                "sales_count": 3,
            }
        ],
        products=[{"name": "Латте", "quantity": 2, "revenue": Decimal("10"), "profit": Decimal("4")}],
        sellers=[
            {
                "barista_name": "Amina",
                "cash_revenue": Decimal("80"),
                "card_revenue": Decimal("0"),
                "revenue": Decimal("80"),
                "sales_count": 2,
            }
        ],
        expenses=[
            {
                "created_at": datetime(2026, 8, 10, 12, 0, tzinfo=timezone.utc),
                "category": "Аренда",
                "amount": Decimal("10"),
                "comment": "август",
            }
        ],
        sales=[
            {
                "created_at": datetime(2026, 8, 23, 9, 15, tzinfo=timezone.utc),
                "id": 11,
                "barista_name": "Amina",
                "payment_type": "cash",
                "total_amount": Decimal("4.50"),
                "is_refunded": False,
            }
        ],
    )
    assert csv.startswith("\ufeff")
    assert "Corner" in csv
    assert "Сводка" in csv
    assert "По дням" in csv
    assert "Латте" in csv
    assert "Amina" in csv
    assert "Аренда" in csv
    assert "Наличный" in csv
