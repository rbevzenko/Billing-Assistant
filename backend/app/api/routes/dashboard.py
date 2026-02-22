"""Dashboard endpoint — aggregated metrics and recent activity."""

from __future__ import annotations

from datetime import date, timedelta
from decimal import Decimal

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import func, or_
from sqlalchemy.orm import Session, joinedload, selectinload

from app.db.database import get_db
from app.models.enums import InvoiceStatus, TimeEntryStatus
from app.models.invoice import Invoice
from app.models.invoice_item import InvoiceItem
from app.models.lawyer_profile import LawyerProfile
from app.models.project import Project
from app.models.time_entry import TimeEntry

router = APIRouter()


# ── Response schemas ──────────────────────────────────────────────────────────

class RecentTimeEntry(BaseModel):
    id: int
    date: date
    project_id: int
    project_name: str
    client_id: int
    client_name: str
    duration_hours: float
    description: str | None
    status: str


class RecentInvoice(BaseModel):
    id: int
    invoice_number: str
    client_id: int
    client_name: str
    issue_date: date
    due_date: date
    status: str
    total_amount: float


class DashboardResponse(BaseModel):
    hours_this_week: float
    hours_this_month: float
    unbilled_amount: float
    unpaid_amount: float
    overdue_invoices_count: int
    recent_time_entries: list[RecentTimeEntry]
    recent_invoices: list[RecentInvoice]


# ── Endpoint ──────────────────────────────────────────────────────────────────

@router.get("", response_model=DashboardResponse, summary="Данные для дашборда")
def get_dashboard(db: Session = Depends(get_db)) -> DashboardResponse:
    today = date.today()
    week_start = today - timedelta(days=today.weekday())
    month_start = today.replace(day=1)

    # ── Hours this week
    hours_week = float(
        db.query(func.coalesce(func.sum(TimeEntry.duration_hours), 0))
        .filter(TimeEntry.date >= week_start, TimeEntry.date <= today)
        .scalar() or 0
    )

    # ── Hours this month
    hours_month = float(
        db.query(func.coalesce(func.sum(TimeEntry.duration_hours), 0))
        .filter(TimeEntry.date >= month_start, TimeEntry.date <= today)
        .scalar() or 0
    )

    # ── Unbilled amount (confirmed entries × rate)
    profile = db.query(LawyerProfile).first()
    default_rate = profile.default_hourly_rate if profile else Decimal("0")

    confirmed_entries = (
        db.query(TimeEntry)
        .options(joinedload(TimeEntry.project))
        .filter(TimeEntry.status == TimeEntryStatus.confirmed)
        .all()
    )
    unbilled_amount = sum(
        float(e.duration_hours) * float(
            e.project.hourly_rate
            if (e.project and e.project.hourly_rate is not None)
            else default_rate
        )
        for e in confirmed_entries
    )

    # ── Unpaid amount (sent + overdue invoices)
    unpaid_invoices = (
        db.query(Invoice)
        .options(selectinload(Invoice.items))
        .filter(Invoice.status.in_([InvoiceStatus.sent, InvoiceStatus.overdue]))
        .all()
    )
    unpaid_amount = sum(
        sum(float(item.amount) for item in inv.items)
        for inv in unpaid_invoices
    )

    # ── Overdue count (explicitly overdue OR sent past due_date)
    overdue_count = int(
        db.query(func.count(Invoice.id))
        .filter(
            or_(
                Invoice.status == InvoiceStatus.overdue,
                (Invoice.status == InvoiceStatus.sent) & (Invoice.due_date < today),
            )
        )
        .scalar() or 0
    )

    # ── Recent 5 time entries (with project + client)
    recent_entries_orm = (
        db.query(TimeEntry)
        .options(joinedload(TimeEntry.project).joinedload(Project.client))
        .order_by(TimeEntry.date.desc(), TimeEntry.id.desc())
        .limit(5)
        .all()
    )
    recent_entries = [
        RecentTimeEntry(
            id=e.id,
            date=e.date,
            project_id=e.project_id,
            project_name=e.project.name if e.project else "—",
            client_id=e.project.client_id if e.project else 0,
            client_name=(
                e.project.client.name
                if (e.project and e.project.client)
                else "—"
            ),
            duration_hours=float(e.duration_hours),
            description=e.description,
            status=e.status.value,
        )
        for e in recent_entries_orm
    ]

    # ── Recent 5 invoices (with client + items for total)
    recent_invoices_orm = (
        db.query(Invoice)
        .options(selectinload(Invoice.items), joinedload(Invoice.client))
        .order_by(Invoice.issue_date.desc(), Invoice.id.desc())
        .limit(5)
        .all()
    )
    recent_invoices = [
        RecentInvoice(
            id=inv.id,
            invoice_number=inv.invoice_number,
            client_id=inv.client_id,
            client_name=inv.client.name if inv.client else "—",
            issue_date=inv.issue_date,
            due_date=inv.due_date,
            status=inv.status.value,
            total_amount=sum(float(item.amount) for item in inv.items),
        )
        for inv in recent_invoices_orm
    ]

    return DashboardResponse(
        hours_this_week=round(hours_week, 1),
        hours_this_month=round(hours_month, 1),
        unbilled_amount=round(unbilled_amount, 2),
        unpaid_amount=round(unpaid_amount, 2),
        overdue_invoices_count=overdue_count,
        recent_time_entries=recent_entries,
        recent_invoices=recent_invoices,
    )
