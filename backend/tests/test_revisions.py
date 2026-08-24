from decimal import Decimal

from app.services.revisions import line_difference, line_value


def test_shortage_is_negative():
    assert line_difference(Decimal("8000"), Decimal("10000")) == Decimal("-2000.000")


def test_surplus_is_positive():
    assert line_difference(Decimal("12.5"), Decimal("10")) == Decimal("2.500")


def test_uncounted_has_no_difference():
    assert line_difference(None, Decimal("4")) is None


def test_shortage_value_uses_unit_cost():
    assert line_value(Decimal("-2000"), Decimal("0.05")) == Decimal("-100.00")


def test_zero_count_is_full_writeoff_value():
    diff = line_difference(Decimal("0"), Decimal("500"))
    assert diff == Decimal("-500.000")
    assert line_value(diff, Decimal("2")) == Decimal("-1000.00")


def test_frozen_snapshot_counts_sale_as_shortage():
    """Revision freezes expected at start; sales are blocked, so Δ is vs snapshot."""
    counted = Decimal("9800")
    start_snapshot = Decimal("10000")
    assert line_difference(counted, start_snapshot) == Decimal("-200.000")


def test_matching_count_is_zero_delta():
    assert line_difference(Decimal("9800"), Decimal("9800")) == Decimal("0.000")
