from app.schemas.common import Page
from app.schemas.profile import LawyerProfileRead, LawyerProfileUpdate
from app.schemas.client import ClientCreate, ClientRead, ClientUpdate
from app.schemas.project import (
    ProjectCreate,
    ProjectDetailRead,
    ProjectRead,
    ProjectStats,
    ProjectUpdate,
)
from app.schemas.time_entry import (
    BulkConfirmRequest,
    BulkConfirmResponse,
    TimeEntryCreate,
    TimeEntryRead,
    TimeEntryUpdate,
)
from app.schemas.invoice import (
    InvoiceCreateRequest,
    InvoiceItemRead,
    InvoiceRead,
    InvoiceUpdate,
)

__all__ = [
    "Page",
    "LawyerProfileRead",
    "LawyerProfileUpdate",
    "ClientCreate",
    "ClientRead",
    "ClientUpdate",
    "ProjectCreate",
    "ProjectDetailRead",
    "ProjectRead",
    "ProjectStats",
    "ProjectUpdate",
    "BulkConfirmRequest",
    "BulkConfirmResponse",
    "TimeEntryCreate",
    "TimeEntryRead",
    "TimeEntryUpdate",
    "InvoiceCreateRequest",
    "InvoiceItemRead",
    "InvoiceRead",
    "InvoiceUpdate",
]
