# Billing Assistant

Веб-приложение для учёта рабочего времени и биллинга юриста.

Позволяет вести записи потраченного времени по клиентам и проектам, выставлять счета из подтверждённых записей, генерировать PDF-счета и отчёты, и отслеживать оплату на дашборде.

---

## Возможности

| Раздел | Функциональность |
|--------|-----------------|
| **Дашборд** | Метрики за неделю/месяц, невыставленные часы, просроченные счета, последние записи |
| **Клиенты** | CRUD с банковскими реквизитами, поиск, защита от удаления с проектами |
| **Проекты** | Привязка к клиентам, индивидуальная ставка руб/час, статусы |
| **Учёт времени** | Быстрый ввод, встроенный таймер (start/stop), групповое подтверждение, фильтры |
| **Счета** | Мастер создания из подтверждённых записей, статусы draft→sent→paid, подсветка просроченных |
| **PDF** | WeasyPrint: счёт с реквизитами и таблицей позиций, отчёт по периоду |
| **Отчёты** | Период + фильтр по клиенту, разбивка по клиентам/проектам, сводка счетов |

---

## Стек технологий

| Уровень | Технологии |
|---------|-----------|
| Backend | Python 3.12, FastAPI 0.115, SQLAlchemy 2, Pydantic v2, Alembic, SQLite |
| PDF | WeasyPrint 68, Jinja2, шрифты DejaVu (кириллица) |
| Frontend | React 18, TypeScript, Vite 6, React Router v7, Axios |
| Инфраструктура | Docker, Docker Compose, nginx |

---

## Быстрый старт с Docker

```bash
git clone <repo-url>
cd Billing-Assistant

# Собрать образы и запустить
docker compose up --build
```

После запуска:

| Сервис | URL |
|--------|-----|
| Приложение | http://localhost:3000 |
| Swagger UI | http://localhost:8000/docs |
| ReDoc | http://localhost:8000/redoc |
| Health check | http://localhost:8000/health |

```bash
# Остановить
docker compose down

# Остановить + удалить базу данных
docker compose down -v
```

### Наполнить тестовыми данными

```bash
# После запуска docker compose up --build:
docker compose exec backend python seed.py
```

Создаёт: 3 клиента, 5 проектов, 12 записей времени, 2 счёта (paid + sent).

---

## Локальная разработка

### Backend

```bash
cd backend

python -m venv .venv
source .venv/bin/activate   # Windows: .venv\Scripts\activate

pip install -r requirements.txt

# На Ubuntu/Debian также нужны системные зависимости для WeasyPrint:
# sudo apt-get install libpangocairo-1.0-0 libcairo2 fonts-dejavu-core

# Применить миграции и запустить
alembic upgrade head
uvicorn app.main:app --reload --port 8000
```

> **Примечание:** Таблицы также создаются автоматически при запуске приложения (`lifespan`).

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Vite-сервер запускается на http://localhost:3000 и проксирует `/api/*` → `http://localhost:8000`.

### Seed-данные

```bash
cd backend
python seed.py
```

---

## Структура проекта

```
Billing-Assistant/
├── backend/
│   ├── app/
│   │   ├── api/
│   │   │   ├── deps.py               # PaginationParams dependency
│   │   │   └── routes/
│   │   │       ├── clients.py        # GET/POST/PUT/DELETE /clients
│   │   │       ├── projects.py       # GET/POST/PUT/DELETE /projects
│   │   │       ├── time_entries.py   # CRUD + /confirm + /bulk-confirm
│   │   │       ├── invoices.py       # CRUD + /send + /pay + /pdf
│   │   │       ├── dashboard.py      # GET /dashboard
│   │   │       ├── reports.py        # GET /reports + /reports/pdf
│   │   │       └── profile.py        # GET/PUT /profile
│   │   ├── core/config.py            # Pydantic-settings конфигурация
│   │   ├── db/database.py            # SQLAlchemy engine + SessionLocal
│   │   ├── models/                   # ORM-модели
│   │   │   ├── client.py
│   │   │   ├── project.py
│   │   │   ├── time_entry.py
│   │   │   ├── invoice.py            # after_insert → INV-XXXX номер
│   │   │   ├── invoice_item.py
│   │   │   ├── lawyer_profile.py
│   │   │   └── enums.py
│   │   ├── schemas/                  # Pydantic DTO
│   │   ├── pdf/
│   │   │   ├── generator.py          # Шаблон счёта (Jinja2 + WeasyPrint)
│   │   │   └── report_generator.py   # Шаблон отчёта
│   │   └── main.py                   # FastAPI app + lifespan (create_all)
│   ├── alembic/                      # Миграции БД
│   ├── seed.py                       # Тестовые данные
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── components/ui/            # Button, Input, Modal, Table, Badge…
│   │   ├── context/
│   │   │   ├── TimerContext.tsx      # Глобальный таймер (localStorage)
│   │   │   └── ToastContext.tsx      # Toast-уведомления
│   │   ├── pages/
│   │   │   ├── DashboardPage.tsx
│   │   │   ├── ClientsPage.tsx
│   │   │   ├── ProjectsPage.tsx
│   │   │   ├── TimeEntriesPage.tsx
│   │   │   ├── InvoicesPage.tsx
│   │   │   ├── InvoiceDetailPage.tsx
│   │   │   ├── ReportsPage.tsx
│   │   │   └── ProfilePage.tsx
│   │   ├── services/                 # Axios-клиенты для каждого ресурса
│   │   ├── types/index.ts            # TypeScript-типы
│   │   └── App.tsx                   # Роутинг
│   ├── docker/nginx.conf             # nginx для SPA + proxy /api
│   └── package.json
├── docker/
│   ├── Dockerfile.backend            # python:3.12-slim + WeasyPrint deps
│   ├── Dockerfile.frontend           # node:22 builder + nginx:1.27
│   └── nginx.conf
└── docker-compose.yml
```

---

## API документация

Полная интерактивная документация: **http://localhost:8000/docs**

### Основные эндпоинты

| Метод | Путь | Описание |
|-------|------|----------|
| GET | `/api/v1/dashboard` | Метрики + последние записи/счета |
| GET | `/api/v1/reports` | Отчёт по периоду (JSON) |
| GET | `/api/v1/reports/pdf` | Скачать отчёт PDF |
| GET/POST/PUT/DELETE | `/api/v1/clients` | Управление клиентами |
| GET/POST/PUT/DELETE | `/api/v1/projects` | Управление проектами |
| GET/POST/PUT/DELETE | `/api/v1/time-entries` | Записи времени |
| POST | `/api/v1/time-entries/bulk-confirm` | Групповое подтверждение |
| POST | `/api/v1/time-entries/{id}/confirm` | Подтвердить запись |
| GET/POST/PUT/DELETE | `/api/v1/invoices` | Управление счетами |
| POST | `/api/v1/invoices/{id}/send` | Перевести в статус "Отправлен" |
| POST | `/api/v1/invoices/{id}/pay` | Перевести в статус "Оплачен" |
| GET | `/api/v1/invoices/{id}/pdf` | Скачать счёт PDF |
| GET/PUT | `/api/v1/profile` | Профиль юриста |

### Статусы записей времени

```
draft → confirmed → billed
```

- `draft` — черновик, можно редактировать и удалять
- `confirmed` — подтверждена, готова для включения в счёт
- `billed` — включена в счёт, редактирование заблокировано

### Статусы счетов

```
draft → sent → paid
         ↓
       overdue (вычисляется: due_date < today)
```

---

## Переменные окружения

### Backend

| Переменная | По умолчанию | Описание |
|-----------|-------------|----------|
| `DATABASE_URL` | `sqlite:///./billing.db` | URL подключения к БД |
| `PROJECT_NAME` | `Billing Assistant` | Название в Swagger |
| `VERSION` | `0.1.0` | Версия API |

В Docker значение `DATABASE_URL` переопределяется через `docker-compose.yml`:
```
sqlite:////app/data/billing.db
```

---

## Миграции

```bash
cd backend

# Создать новую миграцию (после изменения моделей)
alembic revision --autogenerate -m "add_field_xxx"

# Применить
alembic upgrade head

# Откатить
alembic downgrade -1
```

---

## Скриншоты

> Ниже описано содержимое каждой страницы:

- **Дашборд** — 4 карточки с метриками (часы за неделю/месяц, невыставленная сумма, просроченные счета), таблицы последних 5 записей времени и 5 счетов
- **Учёт времени** — форма быстрого ввода с таймером, таблица с колонками дата/клиент/проект/описание/часы/ставка/сумма/статус, групповое подтверждение черновиков
- **Счета** — список счетов с подсветкой просроченных, мастер создания из подтверждённых записей времени
- **Счёт (детали)** — документ с реквизитами исполнителя и заказчика, таблица позиций, итог, кнопки скачать PDF / Отправлен / Оплачен
- **Отчёты** — выбор периода (пресеты + произвольный), фильтр по клиенту, разворачиваемая таблица по клиентам/проектам, сводка по счетам, кнопка «Скачать PDF»
- **Профиль** — форма реквизитов юриста (личные данные + банк), используются при генерации PDF
