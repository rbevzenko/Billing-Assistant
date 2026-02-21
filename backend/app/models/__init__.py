# Import all models so that:
#   1. Alembic autogenerate detects every table
#   2. SQLAlchemy relationship back-references are resolved at startup
#
# Order matters: referenced models must be imported before referencing ones.

from app.models.enums import InvoiceStatus, ProjectStatus, TimeEntryStatus  # noqa: F401
from app.models.lawyer_profile import LawyerProfile  # noqa: F401
from app.models.client import Client  # noqa: F401
from app.models.project import Project  # noqa: F401
from app.models.time_entry import TimeEntry  # noqa: F401
from app.models.invoice import Invoice  # noqa: F401
from app.models.invoice_item import InvoiceItem  # noqa: F401

__all__ = [
    "InvoiceStatus",
    "ProjectStatus",
    "TimeEntryStatus",
    "LawyerProfile",
    "Client",
    "Project",
    "TimeEntry",
    "Invoice",
    "InvoiceItem",
]
