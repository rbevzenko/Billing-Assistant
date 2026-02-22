"""PDF generation for activity reports using WeasyPrint + Jinja2."""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import date
from decimal import Decimal
from pathlib import Path

from jinja2 import BaseLoader, Environment
from weasyprint import HTML

_FONT_DIR = Path("/usr/share/fonts/truetype/dejavu")
_FONT_REGULAR = _FONT_DIR / "DejaVuSans.ttf"
_FONT_BOLD = _FONT_DIR / "DejaVuSans-Bold.ttf"


# ── Data classes ───────────────────────────────────────────────────────────────

@dataclass
class ReportProjectRow:
    project_name: str
    entries_count: int
    hours: float
    amount: float


@dataclass
class ReportClientRow:
    client_name: str
    hours: float
    amount: float
    projects: list[ReportProjectRow] = field(default_factory=list)


@dataclass
class InvoiceSummaryData:
    count_total: int
    count_paid: int
    count_unpaid: int
    count_overdue: int
    total_invoiced: float
    total_paid: float
    total_unpaid: float


@dataclass
class ReportData:
    date_from: date
    date_to: date
    client_name: str | None  # None = all clients
    total_hours: float
    total_amount: float
    breakdown: list[ReportClientRow] = field(default_factory=list)
    invoice_summary: InvoiceSummaryData | None = None


# ── Jinja2 filters ─────────────────────────────────────────────────────────────

def _fmt_date(value: date | None) -> str:
    if value is None:
        return "—"
    return value.strftime("%d.%m.%Y")


def _fmt_money(value: float | Decimal | str) -> str:
    n = float(value)
    formatted = f"{n:,.2f}".replace(",", "\u2009").replace(".", ",")
    return formatted


def _fmt_num(value: float | Decimal | str, decimals: int = 1) -> str:
    return f"{float(value):.{decimals}f}"


# ── HTML Template ──────────────────────────────────────────────────────────────

_TEMPLATE = """<!DOCTYPE html>
<html lang="ru">
<head>
<meta charset="utf-8">
<style>
@font-face {
  font-family: 'DejaVu';
  src: url('{{ font_regular }}');
  font-weight: normal;
}
@font-face {
  font-family: 'DejaVu';
  src: url('{{ font_bold }}');
  font-weight: bold;
}

* { box-sizing: border-box; margin: 0; padding: 0; }

body {
  font-family: 'DejaVu', sans-serif;
  font-size: 10pt;
  color: #1a1a2e;
  line-height: 1.5;
  background: #fff;
}

@page {
  size: A4;
  margin: 18mm 18mm 20mm 18mm;
  @bottom-center {
    content: "Стр. " counter(page) " из " counter(pages);
    font-family: 'DejaVu', sans-serif;
    font-size: 8pt;
    color: #999;
  }
}

/* ── Page header */
.report-header {
  border-bottom: 2pt solid #1a1a2e;
  padding-bottom: 12pt;
  margin-bottom: 20pt;
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
}

.report-title {
  font-size: 18pt;
  font-weight: bold;
  color: #1a1a2e;
}

.report-subtitle {
  font-size: 9pt;
  color: #64748b;
  margin-top: 3pt;
}

.report-period {
  text-align: right;
  font-size: 9pt;
  color: #475569;
}

.report-period strong {
  display: block;
  font-size: 11pt;
  color: #1a1a2e;
  font-weight: bold;
}

/* ── Summary cards */
.summary-row {
  display: flex;
  gap: 12pt;
  margin-bottom: 24pt;
}

.summary-card {
  flex: 1;
  border: 0.5pt solid #e2e8f0;
  border-radius: 4pt;
  padding: 10pt 14pt;
  background: #f8fafc;
}

.summary-card-label {
  font-size: 7.5pt;
  font-weight: bold;
  text-transform: uppercase;
  letter-spacing: 0.8pt;
  color: #94a3b8;
  margin-bottom: 4pt;
}

.summary-card-value {
  font-size: 16pt;
  font-weight: bold;
  color: #1a1a2e;
}

.summary-card-value.accent {
  color: #2563eb;
}

/* ── Section heading */
.section-title {
  font-size: 11pt;
  font-weight: bold;
  color: #1a1a2e;
  margin-bottom: 10pt;
  padding-bottom: 4pt;
  border-bottom: 0.5pt solid #e2e8f0;
}

/* ── Breakdown table */
.breakdown-table {
  width: 100%;
  border-collapse: collapse;
  margin-bottom: 24pt;
  font-size: 9pt;
}

.breakdown-table thead tr {
  background: #1a1a2e;
  color: #fff;
}

.breakdown-table thead th {
  padding: 6pt 10pt;
  font-size: 8pt;
  font-weight: bold;
  text-transform: uppercase;
  letter-spacing: 0.4pt;
  text-align: left;
}

.breakdown-table thead th.r { text-align: right; }
.breakdown-table thead th.num { width: 22pt; text-align: center; }
.breakdown-table thead th.hours { width: 48pt; text-align: right; }
.breakdown-table thead th.amount { width: 80pt; text-align: right; }

/* Client row */
.breakdown-table tr.client-row td {
  background: #eff6ff;
  font-weight: bold;
  font-size: 9.5pt;
  color: #1e40af;
  padding: 7pt 10pt;
  border-top: 1pt solid #bfdbfe;
  border-bottom: 0.5pt solid #bfdbfe;
}

/* Project row */
.breakdown-table tr.project-row td {
  background: #fff;
  color: #334155;
  padding: 5pt 10pt 5pt 22pt;
  border-bottom: 0.5pt solid #f1f5f9;
}

.breakdown-table tr.project-row:nth-child(even) td {
  background: #f8fafc;
}

.td-r { text-align: right; font-variant-numeric: tabular-nums; }
.td-c { text-align: center; color: #94a3b8; }

/* Client subtotal */
.breakdown-table tr.client-subtotal td {
  background: #dbeafe;
  font-weight: bold;
  font-size: 9pt;
  color: #1e3a8a;
  padding: 5pt 10pt;
  border-bottom: 1pt solid #bfdbfe;
}

/* Grand total row */
.breakdown-table tr.grand-total td {
  background: #1a1a2e;
  color: #fff;
  font-weight: bold;
  font-size: 10pt;
  padding: 8pt 10pt;
  border-top: 2pt solid #1a1a2e;
}

/* ── Invoice summary table */
.inv-summary-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 9pt;
  margin-bottom: 0;
}

.inv-summary-table thead tr {
  background: #334155;
  color: #fff;
}

.inv-summary-table thead th {
  padding: 6pt 10pt;
  font-size: 8pt;
  font-weight: bold;
  text-transform: uppercase;
  letter-spacing: 0.4pt;
  text-align: left;
}

.inv-summary-table thead th.r { text-align: right; }

.inv-summary-table tbody td {
  padding: 7pt 10pt;
  border-bottom: 0.5pt solid #e2e8f0;
  color: #334155;
}

.inv-summary-table tbody td.r {
  text-align: right;
  font-variant-numeric: tabular-nums;
}

.inv-summary-table tfoot td {
  padding: 7pt 10pt;
  font-weight: bold;
  background: #f8fafc;
  border-top: 1pt solid #94a3b8;
}

.inv-summary-table tfoot td.r {
  text-align: right;
  font-variant-numeric: tabular-nums;
}

.status-paid   { color: #16a34a; font-weight: bold; }
.status-unpaid { color: #dc2626; font-weight: bold; }
.status-overdue{ color: #ea580c; font-weight: bold; }

/* ── Footer */
.report-footer {
  margin-top: 28pt;
  padding-top: 8pt;
  border-top: 0.5pt solid #e2e8f0;
  font-size: 8pt;
  color: #94a3b8;
  text-align: center;
}
</style>
</head>
<body>

<!-- ── Header ─────────────────────────────────────────────────────────────── -->
<div class="report-header">
  <div>
    <div class="report-title">Отчёт по рабочему времени</div>
    {% if report.client_name %}
    <div class="report-subtitle">Клиент: {{ report.client_name }}</div>
    {% else %}
    <div class="report-subtitle">Все клиенты</div>
    {% endif %}
  </div>
  <div class="report-period">
    <strong>{{ report.date_from | fmt_date }} — {{ report.date_to | fmt_date }}</strong>
    Период отчёта
  </div>
</div>

<!-- ── Summary cards ──────────────────────────────────────────────────────── -->
<div class="summary-row">
  <div class="summary-card">
    <div class="summary-card-label">Всего часов</div>
    <div class="summary-card-value">{{ report.total_hours | fmt_num(1) }} ч</div>
  </div>
  <div class="summary-card">
    <div class="summary-card-label">Сумма к биллингу</div>
    <div class="summary-card-value accent">{{ report.total_amount | fmt_money }} ₽</div>
  </div>
  {% if report.invoice_summary %}
  <div class="summary-card">
    <div class="summary-card-label">Выставлено счетов</div>
    <div class="summary-card-value">{{ report.invoice_summary.count_total }}</div>
  </div>
  <div class="summary-card">
    <div class="summary-card-label">Оплачено</div>
    <div class="summary-card-value">{{ report.invoice_summary.total_paid | fmt_money }} ₽</div>
  </div>
  {% endif %}
</div>

<!-- ── Breakdown ──────────────────────────────────────────────────────────── -->
{% if report.breakdown %}
<div class="section-title">Детализация по клиентам и проектам</div>

<table class="breakdown-table">
  <thead>
    <tr>
      <th class="num">№</th>
      <th>Клиент / Проект</th>
      <th class="hours r">Часы</th>
      <th class="amount r">Сумма, ₽</th>
    </tr>
  </thead>
  <tbody>
    {% set ns = namespace(row_num=0) %}
    {% for client in report.breakdown %}
    <tr class="client-row">
      <td class="td-c">—</td>
      <td>{{ client.client_name }}</td>
      <td class="td-r">{{ client.hours | fmt_num(1) }} ч</td>
      <td class="td-r">{{ client.amount | fmt_money }}</td>
    </tr>
    {% for proj in client.projects %}
    {% set ns.row_num = ns.row_num + 1 %}
    <tr class="project-row">
      <td class="td-c">{{ ns.row_num }}</td>
      <td>{{ proj.project_name }}
        <span style="color:#94a3b8; font-size:8pt;"> · {{ proj.entries_count }} зап.</span>
      </td>
      <td class="td-r">{{ proj.hours | fmt_num(1) }}</td>
      <td class="td-r">{{ proj.amount | fmt_money }}</td>
    </tr>
    {% endfor %}
    {% endfor %}
  </tbody>
  <tfoot>
    <tr class="grand-total">
      <td></td>
      <td>ИТОГО</td>
      <td class="td-r">{{ report.total_hours | fmt_num(1) }} ч</td>
      <td class="td-r">{{ report.total_amount | fmt_money }} ₽</td>
    </tr>
  </tfoot>
</table>
{% endif %}

<!-- ── Invoice summary ────────────────────────────────────────────────────── -->
{% if report.invoice_summary %}
<div class="section-title">Сводка по счетам</div>

<table class="inv-summary-table">
  <thead>
    <tr>
      <th>Статус</th>
      <th class="r">Количество</th>
      <th class="r">Сумма, ₽</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td><span class="status-paid">Оплачено</span></td>
      <td class="r">{{ report.invoice_summary.count_paid }}</td>
      <td class="r">{{ report.invoice_summary.total_paid | fmt_money }}</td>
    </tr>
    <tr>
      <td><span class="status-unpaid">Не оплачено</span></td>
      <td class="r">{{ report.invoice_summary.count_unpaid }}</td>
      <td class="r">{{ report.invoice_summary.total_unpaid | fmt_money }}</td>
    </tr>
    {% if report.invoice_summary.count_overdue > 0 %}
    <tr>
      <td><span class="status-overdue">Просрочено</span></td>
      <td class="r">{{ report.invoice_summary.count_overdue }}</td>
      <td class="r">—</td>
    </tr>
    {% endif %}
  </tbody>
  <tfoot>
    <tr>
      <td><strong>Всего выставлено</strong></td>
      <td class="r"><strong>{{ report.invoice_summary.count_total }}</strong></td>
      <td class="r"><strong>{{ report.invoice_summary.total_invoiced | fmt_money }}</strong></td>
    </tr>
  </tfoot>
</table>
{% endif %}

<!-- ── Footer ─────────────────────────────────────────────────────────────── -->
<div class="report-footer">
  Сформировано: {{ generated_at | fmt_date }}
</div>

</body>
</html>
"""


# ── Public API ─────────────────────────────────────────────────────────────────

def render_report_pdf(report: ReportData) -> bytes:
    """Render a report as PDF bytes."""
    from datetime import date as _date
    env = Environment(loader=BaseLoader(), autoescape=True)
    env.filters["fmt_date"] = _fmt_date
    env.filters["fmt_money"] = _fmt_money
    env.filters["fmt_num"] = _fmt_num

    html_str = env.from_string(_TEMPLATE).render(
        report=report,
        generated_at=_date.today(),
        font_regular=_FONT_REGULAR.as_uri(),
        font_bold=_FONT_BOLD.as_uri(),
    )

    return HTML(string=html_str).write_pdf()
