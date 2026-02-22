"""Reports endpoint — time & billing breakdown + invoice summary."""

from __future__ import annotations

from datetime import date
from decimal import Decimal

from fastapi import APIRouter, Depends, Query
from fastapi.responses import Response
from pydantic import BaseModel
from sqlalchemy.orm import Session, joinedload, selectinload

from app.db.database import get_db
from app.models.client import Client
from app.models.enums import InvoiceStatus, TimeEntryStatus
from app.models.invoice import Invoice
from app.models.invoice_item import InvoiceItem
from app.models.lawyer_profile import LawyerProfile
from app.models.project import Project
from app.models.time_entry import TimeEntry
from app.pdf.report_generator import (
    InvoiceSummaryData,
    ReportClientRow,
    ReportData,
    ReportProjectRow,
    render_report_pdf,
)

router = APIRouter()


# ── Response schemas ───────────────────────────────────────────────────────────

class ProjectBreakdown(BaseModel):
    project_id: int
    project_name: str
    entries_count: int
    hours: float
    amount: float


class ClientBreakdown(BaseModel):
    client_id: int
    client_name: str
    hours: float
    amount: float
    projects: list[ProjectBreakdown]


class InvoiceSummary(BaseModel):
    count_total: int
    count_paid: int
    count_unpaid: int
    count_overdue: int
    total_invoiced: float
    total_paid: float
    total_unpaid: float


class ReportResponse(BaseModel):
    date_from: date
    date_to: date
    client_id: int | None
    total_hours: float
    total_amount: float
    breakdown: list[ClientBreakdown]
    invoice_summary: InvoiceSummary


# ── Helpers ────────────────────────────────────────────────────────────────────

def _build_report(
    db: Session,
    date_from: date,
    date_to: date,
    client_id: int | None,
) -> ReportResponse:
    # Get default rate for projects that don't have their own
    profile = db.query(LawyerProfile).first()
    default_rate = profile.default_hourly_rate if profile else Decimal("0")

    # Time entries in period
    entries_q = (
        db.query(TimeEntry)
        .options(joinedload(TimeEntry.project).joinedload(Project.client))
        .filter(TimeEntry.date >= date_from, TimeEntry.date <= date_to)
    )
    if client_id is not None:
        entries_q = entries_q.join(Project).filter(Project.client_id == client_id)

    entries = entries_q.all()

    # Group by client → project
    client_map: dict[int, dict] = {}
    for e in entries:
        if not e.project:
            continue
        project = e.project
        client = project.client
        if client is None:
            continue

        rate = project.hourly_rate if project.hourly_rate is not None else default_rate
        amount = float(e.duration_hours) * float(rate)

        cid = client.id
        pid = project.id

        if cid not in client_map:
            client_map[cid] = {
                "client_id": cid,
                "client_name": client.name,
                "hours": 0.0,
                "amount": 0.0,
                "projects": {},
            }
        if pid not in client_map[cid]["projects"]:
            client_map[cid]["projects"][pid] = {
                "project_id": pid,
                "project_name": project.name,
                "entries_count": 0,
                "hours": 0.0,
                "amount": 0.0,
            }

        client_map[cid]["hours"] += float(e.duration_hours)
        client_map[cid]["amount"] += amount
        client_map[cid]["projects"][pid]["hours"] += float(e.duration_hours)
        client_map[cid]["projects"][pid]["amount"] += amount
        client_map[cid]["projects"][pid]["entries_count"] += 1

    breakdown = [
        ClientBreakdown(
            client_id=c["client_id"],
            client_name=c["client_name"],
            hours=round(c["hours"], 1),
            amount=round(c["amount"], 2),
            projects=[
                ProjectBreakdown(
                    project_id=p["project_id"],
                    project_name=p["project_name"],
                    entries_count=p["entries_count"],
                    hours=round(p["hours"], 1),
                    amount=round(p["amount"], 2),
                )
                for p in sorted(
                    c["projects"].values(), key=lambda x: x["hours"], reverse=True
                )
            ],
        )
        for c in sorted(
            client_map.values(), key=lambda x: x["hours"], reverse=True
        )
    ]

    total_hours = round(sum(c.hours for c in breakdown), 1)
    total_amount = round(sum(c.amount for c in breakdown), 2)

    # Invoice summary in period
    inv_q = (
        db.query(Invoice)
        .options(selectinload(Invoice.items))
        .filter(Invoice.issue_date >= date_from, Invoice.issue_date <= date_to)
    )
    if client_id is not None:
        inv_q = inv_q.filter(Invoice.client_id == client_id)

    invoices = inv_q.all()
    today = date.today()

    count_paid = sum(1 for inv in invoices if inv.status == InvoiceStatus.paid)
    count_overdue = sum(
        1 for inv in invoices
        if inv.status == InvoiceStatus.overdue
        or (inv.status == InvoiceStatus.sent and inv.due_date < today)
    )
    count_unpaid = sum(
        1 for inv in invoices
        if inv.status in (InvoiceStatus.sent, InvoiceStatus.overdue, InvoiceStatus.draft)
    )
    count_total = len(invoices)

    total_invoiced = sum(
        sum(float(item.amount) for item in inv.items) for inv in invoices
    )
    total_paid = sum(
        sum(float(item.amount) for item in inv.items)
        for inv in invoices
        if inv.status == InvoiceStatus.paid
    )
    total_unpaid = sum(
        sum(float(item.amount) for item in inv.items)
        for inv in invoices
        if inv.status in (InvoiceStatus.sent, InvoiceStatus.overdue)
    )

    invoice_summary = InvoiceSummary(
        count_total=count_total,
        count_paid=count_paid,
        count_unpaid=count_unpaid,
        count_overdue=count_overdue,
        total_invoiced=round(total_invoiced, 2),
        total_paid=round(total_paid, 2),
        total_unpaid=round(total_unpaid, 2),
    )

    return ReportResponse(
        date_from=date_from,
        date_to=date_to,
        client_id=client_id,
        total_hours=total_hours,
        total_amount=total_amount,
        breakdown=breakdown,
        invoice_summary=invoice_summary,
    )


# ── Endpoints ──────────────────────────────────────────────────────────────────

@router.get("", response_model=ReportResponse, summary="Отчёт по времени и биллингу")
def get_report(
    date_from: date = Query(..., description="Начало периода"),
    date_to: date = Query(..., description="Конец периода"),
    client_id: int | None = Query(None, description="Фильтр по клиенту"),
    db: Session = Depends(get_db),
) -> ReportResponse:
    return _build_report(db, date_from, date_to, client_id)


@router.get(
    "/pdf",
    summary="Скачать отчёт в PDF",
    response_class=Response,
    responses={
        200: {"content": {"application/pdf": {}}, "description": "PDF-отчёт"},
    },
)
def get_report_pdf(
    date_from: date = Query(..., description="Начало периода"),
    date_to: date = Query(..., description="Конец периода"),
    client_id: int | None = Query(None, description="Фильтр по клиенту"),
    db: Session = Depends(get_db),
) -> Response:
    report_data = _build_report(db, date_from, date_to, client_id)

    # Resolve client name for PDF title
    client_name: str | None = None
    if client_id is not None:
        client = db.get(Client, client_id)
        if client:
            client_name = client.name

    pdf_report = ReportData(
        date_from=date_from,
        date_to=date_to,
        client_name=client_name,
        total_hours=report_data.total_hours,
        total_amount=report_data.total_amount,
        breakdown=[
            ReportClientRow(
                client_name=c.client_name,
                hours=c.hours,
                amount=c.amount,
                projects=[
                    ReportProjectRow(
                        project_name=p.project_name,
                        entries_count=p.entries_count,
                        hours=p.hours,
                        amount=p.amount,
                    )
                    for p in c.projects
                ],
            )
            for c in report_data.breakdown
        ],
        invoice_summary=InvoiceSummaryData(
            count_total=report_data.invoice_summary.count_total,
            count_paid=report_data.invoice_summary.count_paid,
            count_unpaid=report_data.invoice_summary.count_unpaid,
            count_overdue=report_data.invoice_summary.count_overdue,
            total_invoiced=report_data.invoice_summary.total_invoiced,
            total_paid=report_data.invoice_summary.total_paid,
            total_unpaid=report_data.invoice_summary.total_unpaid,
        ),
    )

    pdf_bytes = render_report_pdf(pdf_report)
    filename = f"report_{date_from}_{date_to}.pdf"
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
