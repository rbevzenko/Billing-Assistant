#!/usr/bin/env python3
"""
Seed script — наполняет БД тестовыми данными.

Запуск:
    # Из директории backend/
    python seed.py

    # Или через Docker:
    docker compose exec backend python seed.py
"""

from __future__ import annotations

import os
import sys
from datetime import date, timedelta
from decimal import Decimal

# Ensure the app package is importable when running from /app
sys.path.insert(0, os.path.dirname(__file__))

# Trigger table creation (same as main.py lifespan)
from app.db.database import SessionLocal, engine, Base
import app.models.client  # noqa: F401
import app.models.lawyer_profile  # noqa: F401
import app.models.project  # noqa: F401
import app.models.time_entry  # noqa: F401
import app.models.invoice  # noqa: F401
import app.models.invoice_item  # noqa: F401

Base.metadata.create_all(bind=engine)

from app.models.client import Client
from app.models.invoice import Invoice
from app.models.invoice_item import InvoiceItem
from app.models.lawyer_profile import LawyerProfile
from app.models.project import Project
from app.models.time_entry import TimeEntry
from app.models.enums import InvoiceStatus, TimeEntryStatus


def seed(db):
    # ── Lawyer profile ────────────────────────────────────────────────────────
    if not db.query(LawyerProfile).first():
        db.add(LawyerProfile(
            full_name="Иванов Алексей Сергеевич",
            company_name="ИП Иванов А.С.",
            inn="771234567890",
            address="г. Москва, ул. Арбат, д. 12, оф. 34",
            phone="+7 (495) 123-45-67",
            email="ivanov@legal.ru",
            default_hourly_rate=Decimal("5000.00"),
            bank_name='АО "Тинькофф Банк"',
            bik="044525974",
            checking_account="40802810500001234567",
            correspondent_account="30101810145250000974",
        ))
        print("✓ Профиль юриста создан")

    # ── Clients ───────────────────────────────────────────────────────────────
    existing = {c.name for c in db.query(Client).all()}

    clients_data = [
        dict(
            name='ООО "Альфа Технологии"',
            contact_person="Петров Дмитрий Викторович",
            email="petrov@alpha-tech.ru",
            phone="+7 (985) 234-56-78",
            inn="7701234561",
            address="г. Москва, Ленинградский пр-т, д. 80, корп. 1",
            bank_name='ПАО "Сбербанк"',
            bik="044525225",
            checking_account="40702810338000012345",
            correspondent_account="30101810400000000225",
        ),
        dict(
            name='АО "Бета Инвест"',
            contact_person="Сидорова Мария Ивановна",
            email="sidorova@beta-invest.ru",
            phone="+7 (916) 345-67-89",
            inn="7702345672",
            address="г. Москва, ул. Новый Арбат, д. 19",
            bank_name='ВТБ (ПАО)',
            bik="044525187",
            checking_account="40702810900002345678",
            correspondent_account="30101810700000000187",
        ),
        dict(
            name="ИП Козлов Сергей",
            contact_person="Козлов Сергей Петрович",
            email="kozlov@mail.ru",
            phone="+7 (926) 456-78-90",
            inn="771345678901",
            address="г. Москва, ул. Садовая, д. 5, кв. 12",
        ),
    ]

    client_objs: dict[str, Client] = {}
    for cd in clients_data:
        if cd["name"] not in existing:
            c = Client(**cd)
            db.add(c)
            db.flush()
            client_objs[cd["name"]] = c
            print(f"✓ Клиент: {cd['name']}")
        else:
            client_objs[cd["name"]] = db.query(Client).filter_by(name=cd["name"]).first()

    # ── Projects ──────────────────────────────────────────────────────────────
    alpha = client_objs['ООО "Альфа Технологии"']
    beta = client_objs['АО "Бета Инвест"']
    kozlov = client_objs["ИП Козлов Сергей"]

    existing_proj = {p.name for p in db.query(Project).all()}

    projects_data = [
        dict(name="Сопровождение сделки по слиянию", client_id=alpha.id, hourly_rate=Decimal("7000.00"), status="active"),
        dict(name="Юридический аудит договоров", client_id=alpha.id, hourly_rate=Decimal("6000.00"), status="active"),
        dict(name="Корпоративное структурирование", client_id=beta.id, hourly_rate=Decimal("8000.00"), status="active"),
        dict(name="Защита в арбитраже", client_id=beta.id, hourly_rate=Decimal("7500.00"), status="paused"),
        dict(name="Консультации по налогам", client_id=kozlov.id, hourly_rate=None, status="active"),
    ]

    proj_objs: dict[str, Project] = {}
    for pd in projects_data:
        if pd["name"] not in existing_proj:
            p = Project(**pd)
            db.add(p)
            db.flush()
            proj_objs[pd["name"]] = p
            print(f"✓ Проект: {pd['name']}")
        else:
            proj_objs[pd["name"]] = db.query(Project).filter_by(name=pd["name"]).first()

    # ── Time entries ──────────────────────────────────────────────────────────
    if db.query(TimeEntry).count() > 0:
        print("ℹ  Записи времени уже существуют, пропуск")
    else:
        today = date.today()

        def days_ago(n: int) -> date:
            return today - timedelta(days=n)

        entries = [
            # Alpha — слияние (confirmed → billed)
            TimeEntry(project_id=proj_objs["Сопровождение сделки по слиянию"].id,
                      date=days_ago(28), duration_hours=Decimal("4.0"),
                      description="Анализ документов целевой компании", status=TimeEntryStatus.billed),
            TimeEntry(project_id=proj_objs["Сопровождение сделки по слиянию"].id,
                      date=days_ago(25), duration_hours=Decimal("3.5"),
                      description="Подготовка due diligence отчёта", status=TimeEntryStatus.billed),
            TimeEntry(project_id=proj_objs["Сопровождение сделки по слиянию"].id,
                      date=days_ago(20), duration_hours=Decimal("6.0"),
                      description="Переговоры с контрагентами", status=TimeEntryStatus.billed),

            # Alpha — аудит (confirmed)
            TimeEntry(project_id=proj_objs["Юридический аудит договоров"].id,
                      date=days_ago(15), duration_hours=Decimal("5.0"),
                      description="Проверка договоров поставки", status=TimeEntryStatus.confirmed),
            TimeEntry(project_id=proj_objs["Юридический аудит договоров"].id,
                      date=days_ago(10), duration_hours=Decimal("3.0"),
                      description="Анализ рисков по агентским договорам", status=TimeEntryStatus.confirmed),
            TimeEntry(project_id=proj_objs["Юридический аудит договоров"].id,
                      date=days_ago(5), duration_hours=Decimal("2.5"),
                      description="Подготовка заключения", status=TimeEntryStatus.draft),

            # Beta — корпоративное
            TimeEntry(project_id=proj_objs["Корпоративное структурирование"].id,
                      date=days_ago(22), duration_hours=Decimal("8.0"),
                      description="Разработка схемы холдинговой структуры", status=TimeEntryStatus.billed),
            TimeEntry(project_id=proj_objs["Корпоративное структурирование"].id,
                      date=days_ago(18), duration_hours=Decimal("4.5"),
                      description="Подготовка уставных документов", status=TimeEntryStatus.billed),

            # Beta — арбитраж (draft)
            TimeEntry(project_id=proj_objs["Защита в арбитраже"].id,
                      date=days_ago(7), duration_hours=Decimal("6.0"),
                      description="Изучение материалов дела", status=TimeEntryStatus.confirmed),
            TimeEntry(project_id=proj_objs["Защита в арбитраже"].id,
                      date=days_ago(3), duration_hours=Decimal("3.0"),
                      description="Подготовка возражений", status=TimeEntryStatus.draft),

            # Козлов
            TimeEntry(project_id=proj_objs["Консультации по налогам"].id,
                      date=days_ago(12), duration_hours=Decimal("2.0"),
                      description="Консультация по НДС", status=TimeEntryStatus.confirmed),
            TimeEntry(project_id=proj_objs["Консультации по налогам"].id,
                      date=days_ago(4), duration_hours=Decimal("1.5"),
                      description="Оптимизация налоговой нагрузки", status=TimeEntryStatus.draft),
        ]

        for e in entries:
            db.add(e)
        db.flush()
        print(f"✓ Записи времени: {len(entries)} шт.")

        # ── Invoices ──────────────────────────────────────────────────────────
        # Invoice 1: Alpha, paid (for entries: слияние)
        inv1 = Invoice(
            client_id=alpha.id,
            issue_date=days_ago(21),
            due_date=days_ago(7),
            status=InvoiceStatus.paid,
            notes="Оплата за сопровождение сделки M&A, 1-й этап",
        )
        db.add(inv1)
        db.flush()
        inv1_entries = [e for e in entries if e.project_id == proj_objs["Сопровождение сделки по слиянию"].id]
        for e in inv1_entries:
            rate = proj_objs["Сопровождение сделки по слиянию"].hourly_rate
            db.add(InvoiceItem(
                invoice_id=inv1.id,
                time_entry_id=e.id,
                hours=e.duration_hours,
                rate=rate,
                amount=e.duration_hours * rate,
            ))

        # Invoice 2: Beta, sent (for entries: корпоративное)
        inv2 = Invoice(
            client_id=beta.id,
            issue_date=days_ago(14),
            due_date=days_ago(0),  # due today → borderline
            status=InvoiceStatus.sent,
            notes="Корпоративное структурирование холдинга",
        )
        db.add(inv2)
        db.flush()
        inv2_entries = [e for e in entries if e.project_id == proj_objs["Корпоративное структурирование"].id]
        for e in inv2_entries:
            rate = proj_objs["Корпоративное структурирование"].hourly_rate
            db.add(InvoiceItem(
                invoice_id=inv2.id,
                time_entry_id=e.id,
                hours=e.duration_hours,
                rate=rate,
                amount=e.duration_hours * rate,
            ))

        print("✓ Счета: 2 шт. (1 оплачен, 1 отправлен)")

    db.commit()
    print("\n✅ Seed завершён успешно!")


if __name__ == "__main__":
    db = SessionLocal()
    try:
        seed(db)
    except Exception as e:
        db.rollback()
        print(f"❌ Ошибка: {e}")
        raise
    finally:
        db.close()
