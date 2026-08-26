"""Excel import for stock items."""

from __future__ import annotations

from decimal import Decimal, InvalidOperation
from io import BytesIO
from typing import Any

from openpyxl import Workbook, load_workbook
from openpyxl.styles import Font, PatternFill
from openpyxl.utils import get_column_letter

from app.schemas.stock import StockImportPreviewOut, StockImportPreviewRow, StockImportRowIn

REQUIRED_HEADERS = (
    "name",
    "base_unit",
    "purchase_unit",
    "purchase_to_base",
    "quantity",
    "cost_per_base_unit",
)
OPTIONAL_HEADERS = ("min_quantity", "is_ingredient")
ALL_HEADERS = REQUIRED_HEADERS + OPTIONAL_HEADERS

YELLOW = PatternFill("solid", fgColor="FFE599")
HEADER_FONT = Font(bold=True)


def build_stock_import_template() -> bytes:
    wb = Workbook()
    ws = wb.active
    ws.title = "Склад"
    for col, header in enumerate(ALL_HEADERS, start=1):
        cell = ws.cell(1, col, header)
        cell.font = HEADER_FONT
        if header in REQUIRED_HEADERS:
            cell.fill = YELLOW
        ws.column_dimensions[get_column_letter(col)].width = 18

    example = {
        "name": "Молоко 3.2%",
        "base_unit": "мл",
        "purchase_unit": "л",
        "purchase_to_base": 1000,
        "quantity": 12,
        "cost_per_base_unit": 0.45,
        "min_quantity": 2000,
        "is_ingredient": "да",
    }
    for col, header in enumerate(ALL_HEADERS, start=1):
        ws.cell(2, col, example[header])

    example2 = {
        "name": "Вода 0.5л",
        "base_unit": "шт",
        "purchase_unit": "шт",
        "purchase_to_base": 1,
        "quantity": 48,
        "cost_per_base_unit": 80,
        "min_quantity": 12,
        "is_ingredient": "нет",
    }
    for col, header in enumerate(ALL_HEADERS, start=1):
        ws.cell(3, col, example2[header])

    guide = wb.create_sheet("Инструкция")
    guide["A1"] = "Как заполнять"
    guide["A1"].font = HEADER_FONT
    lines = [
        "Жёлтые колонки обязательны. Белые — по желанию.",
        "name — название позиции.",
        "base_unit — единица остатка (мл, г, шт).",
        "purchase_unit — как покупаете (л, кг, пачка, шт).",
        "purchase_to_base — сколько base_unit в одной purchase_unit (для л→мл обычно 1000).",
        "quantity — начальный остаток в единицах закупки (purchase_unit).",
        "cost_per_base_unit — себестоимость одной base_unit.",
        "min_quantity — порог «мало» в base_unit (необязательно).",
        "is_ingredient — да/нет: только ингредиент (не предлагать «сделать товаром»).",
        "Строки 2–3 на листе «Склад» — примеры, удалите или замените своими данными.",
    ]
    for i, line in enumerate(lines, start=3):
        guide[f"A{i}"] = line
    guide.column_dimensions["A"].width = 90

    buf = BytesIO()
    wb.save(buf)
    return buf.getvalue()


def _cell_str(value: Any) -> str:
    if value is None:
        return ""
    return str(value).strip()


def _parse_bool(raw: str) -> bool:
    v = raw.strip().lower()
    return v in {"1", "true", "yes", "y", "да", "д", "иә", "iae"}


def _parse_decimal(raw: str, *, field: str, errors: list[str]) -> Decimal | None:
    if not raw:
        errors.append(f"{field}: пусто")
        return None
    try:
        return Decimal(raw.replace(",", ".").replace(" ", ""))
    except (InvalidOperation, ValueError):
        errors.append(f"{field}: не число")
        return None


def parse_stock_import_xlsx(content: bytes) -> StockImportPreviewOut:
    wb = load_workbook(BytesIO(content), data_only=True)
    ws = wb.active
    header_row = [ _cell_str(c.value).lower() for c in next(ws.iter_rows(min_row=1, max_row=1)) ]
    index = {name: i for i, name in enumerate(header_row) if name}
    missing = [h for h in REQUIRED_HEADERS if h not in index]
    if missing:
        return StockImportPreviewOut(
            rows=[
                StockImportPreviewRow(
                    row=1,
                    ok=False,
                    errors=[f"Нет колонок: {', '.join(missing)}"],
                )
            ],
            ok_count=0,
            error_count=1,
        )

    rows: list[StockImportPreviewRow] = []
    for r_idx, row in enumerate(ws.iter_rows(min_row=2), start=2):
        values = [_cell_str(c.value) for c in row]
        if not any(values):
            continue
        # skip obvious example rows if untouched
        name = values[index["name"]] if index["name"] < len(values) else ""
        errors: list[str] = []
        if not name:
            errors.append("name: пусто")

        base_unit = values[index["base_unit"]] if index["base_unit"] < len(values) else ""
        purchase_unit = values[index["purchase_unit"]] if index["purchase_unit"] < len(values) else ""
        if not base_unit:
            errors.append("base_unit: пусто")
        if not purchase_unit:
            errors.append("purchase_unit: пусто")

        factor = _parse_decimal(
            values[index["purchase_to_base"]] if index["purchase_to_base"] < len(values) else "",
            field="purchase_to_base",
            errors=errors,
        )
        qty = _parse_decimal(
            values[index["quantity"]] if index["quantity"] < len(values) else "",
            field="quantity",
            errors=errors,
        )
        cost = _parse_decimal(
            values[index["cost_per_base_unit"]] if index["cost_per_base_unit"] < len(values) else "",
            field="cost_per_base_unit",
            errors=errors,
        )
        min_raw = ""
        if "min_quantity" in index and index["min_quantity"] < len(values):
            min_raw = values[index["min_quantity"]]
        min_qty = Decimal("0")
        if min_raw:
            parsed_min = _parse_decimal(min_raw, field="min_quantity", errors=errors)
            if parsed_min is not None:
                min_qty = parsed_min

        is_ing = False
        if "is_ingredient" in index and index["is_ingredient"] < len(values):
            is_ing = _parse_bool(values[index["is_ingredient"]])

        if factor is not None and factor <= 0:
            errors.append("purchase_to_base: должно быть > 0")
        if qty is not None and qty < 0:
            errors.append("quantity: не может быть < 0")
        if cost is not None and cost < 0:
            errors.append("cost_per_base_unit: не может быть < 0")

        data = None
        ok = not errors and factor is not None and qty is not None and cost is not None and bool(name)
        if ok:
            data = StockImportRowIn(
                name=name,
                base_unit=base_unit,
                purchase_unit=purchase_unit,
                purchase_to_base=factor,
                quantity=qty,
                cost_per_base_unit=cost,
                min_quantity=min_qty,
                is_ingredient=is_ing,
            )
        rows.append(StockImportPreviewRow(row=r_idx, ok=ok, errors=errors, data=data))

    ok_count = sum(1 for r in rows if r.ok)
    return StockImportPreviewOut(
        rows=rows,
        ok_count=ok_count,
        error_count=len(rows) - ok_count,
    )
