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
