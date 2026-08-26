import enum


class UserRole(str, enum.Enum):
    super_admin = "super_admin"
    owner = "owner"
    barista = "barista"


class PaymentType(str, enum.Enum):
    cash = "cash"
    card = "card"


class ShiftStatus(str, enum.Enum):
    open = "open"
    closed = "closed"


class CashMovementType(str, enum.Enum):
    deposit = "deposit"
    withdrawal = "withdrawal"


class StockMovementType(str, enum.Enum):
    income = "income"
    writeoff = "writeoff"
    correction = "correction"
    sale = "sale"
    refund = "refund"
    transfer_out = "transfer_out"
    transfer_in = "transfer_in"
    regrade_out = "regrade_out"
    regrade_in = "regrade_in"


class StockLogAction(str, enum.Enum):
    created = "created"
    updated = "updated"
    deleted = "deleted"


class StockRevisionStatus(str, enum.Enum):
    draft = "draft"
    posted = "posted"
    cancelled = "cancelled"


class FiscalStatus(str, enum.Enum):
    pending = "pending"
    sent = "sent"
    failed = "failed"
    skipped = "skipped"


class DiscountType(str, enum.Enum):
    percent = "percent"
    amount = "amount"
