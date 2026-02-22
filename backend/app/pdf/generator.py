"""PDF generation for invoices using WeasyPrint + Jinja2."""

from __future__ import annotations

import locale
from dataclasses import dataclass, field
from datetime import date
from decimal import Decimal
from pathlib import Path

from jinja2 import Environment, BaseLoader
from weasyprint import HTML, CSS

# ── Font paths (DejaVu Sans — full Cyrillic support, ships with Ubuntu/Debian)
_FONT_DIR = Path("/usr/share/fonts/truetype/dejavu")
_FONT_REGULAR = _FONT_DIR / "DejaVuSans.ttf"
_FONT_BOLD = _FONT_DIR / "DejaVuSans-Bold.ttf"

# ── Data classes ──────────────────────────────────────────────────────────────

@dataclass
class InvoiceItemData:
    date: date | None
    project_name: str | None
    description: str | None
    hours: Decimal
    rate: Decimal
    amount: Decimal


@dataclass
class ProfileData:
    full_name: str
    company_name: str
    inn: str
    address: str
    phone: str
    email: str
    bank_name: str
    bik: str
    checking_account: str
    correspondent_account: str
    logo_path: str | None = None


@dataclass
class ClientData:
    name: str
    contact_person: str | None = None
    inn: str | None = None
    address: str | None = None
    phone: str | None = None
    email: str | None = None
    bank_name: str | None = None
    bik: str | None = None
    checking_account: str | None = None
    correspondent_account: str | None = None


@dataclass
class InvoiceData:
    invoice_number: str
    issue_date: date
    due_date: date
    status: str
    notes: str | None
    items: list[InvoiceItemData] = field(default_factory=list)
    total_amount: Decimal = Decimal("0")


# ── Template ──────────────────────────────────────────────────────────────────

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

/* ── Page layout ────────────────────────────────────────────────────────── */
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

/* ── Header ─────────────────────────────────────────────────────────────── */
.header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  padding-bottom: 14pt;
  border-bottom: 2pt solid #1a1a2e;
  margin-bottom: 18pt;
}

.header-left { flex: 1; }

{% if logo_path %}
.logo {
  max-height: 52pt;
  max-width: 160pt;
  display: block;
  margin-bottom: 6pt;
}
{% endif %}

.company-name {
  font-size: 13pt;
  font-weight: bold;
  color: #1a1a2e;
  line-height: 1.3;
}

.company-sub {
  font-size: 8.5pt;
  color: #555;
  margin-top: 3pt;
}

.invoice-title-block {
  text-align: right;
  flex: 0 0 auto;
}

.invoice-title {
  font-size: 18pt;
  font-weight: bold;
  color: #1a1a2e;
  letter-spacing: -0.3pt;
}

.invoice-number {
  font-size: 11pt;
  font-weight: bold;
  color: #2563eb;
  margin-top: 3pt;
}

.invoice-date {
  font-size: 9pt;
  color: #555;
  margin-top: 4pt;
}

/* ── Parties ─────────────────────────────────────────────────────────────── */
.parties {
  display: flex;
  gap: 16pt;
  margin-bottom: 20pt;
}

.party {
  flex: 1;
  background: #f8fafc;
  border: 0.5pt solid #e2e8f0;
  border-radius: 4pt;
  padding: 12pt 14pt;
}

.party-label {
  font-size: 7.5pt;
  font-weight: bold;
  text-transform: uppercase;
  letter-spacing: 0.8pt;
  color: #94a3b8;
  margin-bottom: 6pt;
}

.party-name {
  font-size: 11pt;
  font-weight: bold;
  color: #1a1a2e;
  margin-bottom: 4pt;
  line-height: 1.3;
}

.party-row {
  font-size: 8.5pt;
  color: #475569;
  line-height: 1.6;
}

.party-divider {
  border: none;
  border-top: 0.5pt dashed #cbd5e1;
  margin: 6pt 0;
}

/* ── Items table ─────────────────────────────────────────────────────────── */
.items-table {
  width: 100%;
  border-collapse: collapse;
  margin-bottom: 0;
}

.items-table thead tr {
  background: #1a1a2e;
  color: #fff;
}

.items-table thead th {
  padding: 7pt 10pt;
  font-size: 8pt;
  font-weight: bold;
  text-align: left;
  text-transform: uppercase;
  letter-spacing: 0.5pt;
  white-space: nowrap;
}

.items-table thead th.num   { width: 24pt; text-align: center; }
.items-table thead th.hours { width: 36pt; text-align: right; }
.items-table thead th.rate  { width: 60pt; text-align: right; }
.items-table thead th.sum   { width: 70pt; text-align: right; }

.items-table tbody tr:nth-child(even) { background: #f8fafc; }
.items-table tbody tr:nth-child(odd)  { background: #ffffff; }

.items-table tbody td {
  padding: 7pt 10pt;
  font-size: 9pt;
  color: #334155;
  border-bottom: 0.5pt solid #e2e8f0;
  vertical-align: top;
}

.items-table tbody td.num   { text-align: center; color: #94a3b8; }
.items-table tbody td.hours { text-align: right; white-space: nowrap; }
.items-table tbody td.rate  { text-align: right; white-space: nowrap; }
.items-table tbody td.sum   { text-align: right; white-space: nowrap; font-weight: bold; }

.desc-main  { font-size: 9pt; color: #1a1a2e; }
.desc-sub   { font-size: 8pt; color: #94a3b8; margin-top: 1pt; }

/* ── Totals ──────────────────────────────────────────────────────────────── */
.totals-block {
  display: flex;
  justify-content: flex-end;
  margin-top: 0;
  border-top: 2pt solid #1a1a2e;
}

.totals-table {
  width: 240pt;
  border-collapse: collapse;
}

.totals-table td {
  padding: 6pt 10pt;
  font-size: 9.5pt;
}

.totals-table tr.total-final td {
  font-size: 12pt;
  font-weight: bold;
  color: #1a1a2e;
  border-top: 0.5pt solid #e2e8f0;
  padding-top: 8pt;
}

.totals-table td.t-label { color: #64748b; }
.totals-table td.t-value { text-align: right; font-weight: bold; white-space: nowrap; }

/* ── Due date + notes ────────────────────────────────────────────────────── */
.meta-block {
  margin-top: 20pt;
  display: flex;
  gap: 16pt;
}

.due-block {
  background: #eff6ff;
  border: 0.5pt solid #bfdbfe;
  border-radius: 4pt;
  padding: 10pt 14pt;
  flex: 0 0 auto;
}

.due-label {
  font-size: 7.5pt;
  font-weight: bold;
  text-transform: uppercase;
  letter-spacing: 0.8pt;
  color: #3b82f6;
  margin-bottom: 3pt;
}

.due-date {
  font-size: 12pt;
  font-weight: bold;
  color: #1e40af;
}

.notes-block {
  flex: 1;
  background: #fefce8;
  border: 0.5pt solid #fde68a;
  border-radius: 4pt;
  padding: 10pt 14pt;
}

.notes-label {
  font-size: 7.5pt;
  font-weight: bold;
  text-transform: uppercase;
  letter-spacing: 0.8pt;
  color: #92400e;
  margin-bottom: 3pt;
}

.notes-text {
  font-size: 9pt;
  color: #451a03;
  line-height: 1.5;
}

/* ── Footer ──────────────────────────────────────────────────────────────── */
.footer {
  margin-top: 24pt;
  padding-top: 10pt;
  border-top: 0.5pt solid #e2e8f0;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.footer-contacts {
  font-size: 8pt;
  color: #94a3b8;
}

.footer-sign {
  font-size: 8pt;
  color: #94a3b8;
  text-align: right;
}

.sign-line {
  display: inline-block;
  width: 120pt;
  border-bottom: 0.5pt solid #94a3b8;
  margin-top: 20pt;
}
</style>
</head>
<body>

<!-- ── Header ─────────────────────────────────────────────────────────────── -->
<div class="header">
  <div class="header-left">
    {% if logo_path %}
    <img class="logo" src="{{ logo_path }}" alt="Логотип">
    {% endif %}
    <div class="company-name">{{ profile.company_name or profile.full_name }}</div>
    {% if profile.company_name and profile.full_name %}
    <div class="company-sub">{{ profile.full_name }}</div>
    {% endif %}
    {% if profile.inn %}
    <div class="company-sub">ИНН: {{ profile.inn }}</div>
    {% endif %}
  </div>
  <div class="invoice-title-block">
    <div class="invoice-title">СЧЁТ</div>
    <div class="invoice-number">№ {{ invoice.invoice_number }}</div>
    <div class="invoice-date">от {{ invoice.issue_date | fmt_date }}</div>
  </div>
</div>

<!-- ── Parties ────────────────────────────────────────────────────────────── -->
<div class="parties">
  <!-- Исполнитель -->
  <div class="party">
    <div class="party-label">Исполнитель</div>
    <div class="party-name">{{ profile.company_name or profile.full_name }}</div>
    {% if profile.address %}
    <div class="party-row">{{ profile.address }}</div>
    {% endif %}
    {% if profile.phone %}
    <div class="party-row">Тел.: {{ profile.phone }}</div>
    {% endif %}
    {% if profile.email %}
    <div class="party-row">Email: {{ profile.email }}</div>
    {% endif %}
    {% if profile.bank_name or profile.checking_account %}
    <hr class="party-divider">
    {% if profile.bank_name %}
    <div class="party-row">{{ profile.bank_name }}</div>
    {% endif %}
    {% if profile.bik %}
    <div class="party-row">БИК: {{ profile.bik }}</div>
    {% endif %}
    {% if profile.checking_account %}
    <div class="party-row">Р/с: {{ profile.checking_account }}</div>
    {% endif %}
    {% if profile.correspondent_account %}
    <div class="party-row">К/с: {{ profile.correspondent_account }}</div>
    {% endif %}
    {% endif %}
  </div>

  <!-- Заказчик -->
  <div class="party">
    <div class="party-label">Заказчик</div>
    <div class="party-name">{{ client.name }}</div>
    {% if client.contact_person %}
    <div class="party-row">{{ client.contact_person }}</div>
    {% endif %}
    {% if client.inn %}
    <div class="party-row">ИНН: {{ client.inn }}</div>
    {% endif %}
    {% if client.address %}
    <div class="party-row">{{ client.address }}</div>
    {% endif %}
    {% if client.phone %}
    <div class="party-row">Тел.: {{ client.phone }}</div>
    {% endif %}
    {% if client.email %}
    <div class="party-row">Email: {{ client.email }}</div>
    {% endif %}
    {% if client.bank_name or client.checking_account %}
    <hr class="party-divider">
    {% if client.bank_name %}
    <div class="party-row">{{ client.bank_name }}</div>
    {% endif %}
    {% if client.bik %}
    <div class="party-row">БИК: {{ client.bik }}</div>
    {% endif %}
    {% if client.checking_account %}
    <div class="party-row">Р/с: {{ client.checking_account }}</div>
    {% endif %}
    {% if client.correspondent_account %}
    <div class="party-row">К/с: {{ client.correspondent_account }}</div>
    {% endif %}
    {% endif %}
  </div>
</div>

<!-- ── Items table ────────────────────────────────────────────────────────── -->
<table class="items-table">
  <thead>
    <tr>
      <th class="num">№</th>
      <th>Дата</th>
      <th>Описание услуги</th>
      <th class="hours">Часы</th>
      <th class="rate">Ставка, ₽/ч</th>
      <th class="sum">Сумма, ₽</th>
    </tr>
  </thead>
  <tbody>
    {% for item in invoice.items %}
    <tr>
      <td class="num">{{ loop.index }}</td>
      <td>{{ item.date | fmt_date if item.date else '—' }}</td>
      <td>
        {% if item.project_name %}
        <div class="desc-main">{{ item.project_name }}</div>
        {% endif %}
        {% if item.description %}
        <div class="desc-sub">{{ item.description }}</div>
        {% endif %}
        {% if not item.project_name and not item.description %}
        <div class="desc-main">Юридические услуги</div>
        {% endif %}
      </td>
      <td class="hours">{{ item.hours | fmt_num(1) }}</td>
      <td class="rate">{{ item.rate | fmt_money }}</td>
      <td class="sum">{{ item.amount | fmt_money }}</td>
    </tr>
    {% endfor %}
  </tbody>
</table>

<!-- ── Totals ─────────────────────────────────────────────────────────────── -->
<div class="totals-block">
  <table class="totals-table">
    <tr>
      <td class="t-label">Итого часов:</td>
      <td class="t-value">{{ total_hours | fmt_num(1) }} ч</td>
    </tr>
    <tr class="total-final">
      <td class="t-label">ИТОГО К ОПЛАТЕ:</td>
      <td class="t-value">{{ invoice.total_amount | fmt_money }} ₽</td>
    </tr>
  </table>
</div>

<!-- ── Due date + Notes ───────────────────────────────────────────────────── -->
<div class="meta-block">
  <div class="due-block">
    <div class="due-label">Срок оплаты</div>
    <div class="due-date">{{ invoice.due_date | fmt_date }}</div>
  </div>
  {% if invoice.notes %}
  <div class="notes-block">
    <div class="notes-label">Примечания</div>
    <div class="notes-text">{{ invoice.notes }}</div>
  </div>
  {% endif %}
</div>

<!-- ── Footer ─────────────────────────────────────────────────────────────── -->
<div class="footer">
  <div class="footer-contacts">
    {% if profile.phone %}{{ profile.phone }}{% endif %}
    {% if profile.phone and profile.email %} &nbsp;·&nbsp; {% endif %}
    {% if profile.email %}{{ profile.email }}{% endif %}
  </div>
  <div class="footer-sign">
    Исполнитель: &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;/&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;/
    <br>
    <span style="font-size:7pt; color:#bbb;">(подпись / расшифровка)</span>
  </div>
</div>

</body>
</html>
"""


# ── Jinja2 filters ────────────────────────────────────────────────────────────

def _fmt_date(value: date | None) -> str:
    if value is None:
        return "—"
    return value.strftime("%d.%m.%Y")


def _fmt_money(value: Decimal | float | str) -> str:
    n = float(value)
    # Format with space as thousands separator, comma as decimal
    formatted = f"{n:,.2f}".replace(",", " ").replace(".", ",")
    return formatted


def _fmt_num(value: Decimal | float | str, decimals: int = 1) -> str:
    return f"{float(value):.{decimals}f}"


# ── Public API ────────────────────────────────────────────────────────────────

def render_invoice_pdf(
    invoice: InvoiceData,
    profile: ProfileData,
    client: ClientData,
) -> bytes:
    """Render an invoice as PDF bytes."""
    env = Environment(loader=BaseLoader(), autoescape=True)
    env.filters["fmt_date"] = _fmt_date
    env.filters["fmt_money"] = _fmt_money
    env.filters["fmt_num"] = _fmt_num

    total_hours = sum(float(item.hours) for item in invoice.items)

    html_str = env.from_string(_TEMPLATE).render(
        invoice=invoice,
        profile=profile,
        client=client,
        total_hours=total_hours,
        font_regular=_FONT_REGULAR.as_uri(),
        font_bold=_FONT_BOLD.as_uri(),
        logo_path=profile.logo_path,
    )

    pdf_bytes: bytes = HTML(string=html_str).write_pdf()
    return pdf_bytes
