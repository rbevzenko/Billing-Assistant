import enum


class ProjectStatus(str, enum.Enum):
    active = "active"
    paused = "paused"
    completed = "completed"


class TimeEntryStatus(str, enum.Enum):
    draft = "draft"
    confirmed = "confirmed"
    billed = "billed"


class InvoiceStatus(str, enum.Enum):
    draft = "draft"
    sent = "sent"
    paid = "paid"
    overdue = "overdue"
