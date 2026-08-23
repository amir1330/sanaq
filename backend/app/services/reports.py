from __future__ import annotations

import csv
import io
from collections.abc import Iterable, Sequence
from datetime import date, datetime
from decimal import Decimal


def _num(value: object) -> str:
    if value is None:
        return "0"
    if isinstance(value, Decimal):
        return format(value, "f")
    return str(value)


def _when(value: datetime | date | str) -> str:
    if isinstance(value, datetime):
        return value.strftime("%Y-%m-%d %H:%M")
    if isinstance(value, date):
        return value.isoformat()
    return str(value)[:16]


def _write_table(out: io.StringIO, title: str, headers: Sequence[str], rows: Iterable[Sequence[object]]) -> None:
    writer = csv.writer(out, delimiter=";", lineterminator="\n")
    writer.writerow([title])
    writer.writerow(headers)
    for row in rows:
        writer.writerow(["" if cell is None else cell for cell in row])
    writer.writerow([])


def build_report_csv(
    *,
    shop_name: str,
    from_date: date,
    to_date: date,
    summary: dict[str, object],
    daily: list[dict[str, object]],
    products: list[dict[str, object]],
    sellers: list[dict[str, object]],
    expenses: list[dict[str, object]],
    sales: list[dict[str, object]],
) -> str:
    buf = io.StringIO()
    buf.write("\ufeff")
    writer = csv.writer(buf, delimiter=";", lineterminator="\n")
    writer.writerow(["CoffeeOS"])
    writer.writerow(["Точка", shop_name])
    writer.writerow(["Период", from_date.isoformat(), to_date.isoformat()])
    writer.writerow([])

    _write_table(
        buf,
        "Сводка",
        ["Показатель", "Сумма"],
        [
            ("Выручка", _num(summary.get("revenue"))),
            ("Наличный", _num(summary.get("cash_revenue"))),
            ("Безналичный", _num(summary.get("card_revenue"))),
            ("Себестоимость", _num(summary.get("cost"))),
            ("Прибыль", _num(summary.get("profit"))),
            ("Расходы", _num(summary.get("expenses"))),
            ("Чистыми", _num(summary.get("net_profit"))),
            ("Чеков", summary.get("sales_count") or 0),
        ],
    )
    _write_table(
        buf,
        "По дням",
        ["День", "Наличный", "Безналичный", "Выручка", "Себестоимость", "Прибыль", "Чеки"],
        [
            (
                _when(row["day"]),
                _num(row.get("cash_revenue")),
                _num(row.get("card_revenue")),
                _num(row.get("revenue")),
                _num(row.get("cost")),
                _num(row.get("profit")),
                row.get("sales_count") or 0,
            )
            for row in daily
        ],
    )
    _write_table(
        buf,
        "Товары",
        ["Товар", "Штук", "Выручка", "Прибыль"],
        [
            (row.get("name"), row.get("quantity") or 0, _num(row.get("revenue")), _num(row.get("profit")))
            for row in products
        ],
    )
    _write_table(
        buf,
        "Продавцы",
        ["Имя", "Наличный", "Безналичный", "Выручка", "Чеки"],
        [
            (
                row.get("barista_name"),
                _num(row.get("cash_revenue")),
                _num(row.get("card_revenue")),
                _num(row.get("revenue")),
                row.get("sales_count") or 0,
            )
            for row in sellers
        ],
    )
    _write_table(
        buf,
        "Расходы",
        ["Дата", "Категория", "Сумма", "Комментарий"],
        [
            (_when(row["created_at"]), row.get("category"), _num(row.get("amount")), row.get("comment") or "")
            for row in expenses
        ],
    )
    _write_table(
        buf,
        "Чеки",
        ["Дата", "Номер", "Продавец", "Оплата", "Сумма", "Возврат"],
        [
            (
                _when(row["created_at"]),
                row.get("id"),
                row.get("barista_name"),
                "Наличный" if row.get("payment_type") == "cash" else "Безналичный",
                _num(row.get("total_amount")),
                "да" if row.get("is_refunded") else "",
            )
            for row in sales
        ],
    )
    return buf.getvalue()
