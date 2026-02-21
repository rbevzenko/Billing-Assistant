# Billing Assistant

Веб-приложение для учёта рабочего времени и биллинга юриста.

## Стек технологий

| Уровень | Технологии |
|---------|-----------|
| Backend | Python 3.12, FastAPI, SQLAlchemy 2, Alembic, Pydantic v2, SQLite |
| Frontend | React 18, TypeScript, Vite, React Router v7, Axios |
| Инфраструктура | Docker, Docker Compose, nginx |

## Структура проекта

```
Billing-Assistant/
├── backend/                  # FastAPI приложение
│   ├── app/
│   │   ├── api/
│   │   │   └── routes/       # Эндпоинты API
│   │   ├── core/
│   │   │   └── config.py     # Настройки (pydantic-settings)
│   │   ├── db/
│   │   │   └── database.py   # SQLAlchemy engine и сессия
│   │   ├── models/           # ORM-модели (SQLAlchemy)
│   │   ├── schemas/          # Pydantic-схемы (DTO)
│   │   └── main.py           # Точка входа FastAPI
│   ├── alembic/              # Миграции БД
│   │   └── versions/
│   ├── alembic.ini
│   └── requirements.txt
├── frontend/                 # React приложение
│   ├── src/
│   │   ├── components/       # Переиспользуемые компоненты
│   │   ├── hooks/            # Кастомные хуки
│   │   ├── pages/            # Страницы (роуты)
│   │   ├── services/
│   │   │   └── api.ts        # Axios-клиент
│   │   ├── App.tsx
│   │   └── main.tsx
│   ├── index.html
│   ├── vite.config.ts
│   └── package.json
├── docker/
│   ├── Dockerfile.backend
│   ├── Dockerfile.frontend
│   └── nginx.conf
├── docker-compose.yml
└── README.md
```

## Быстрый старт

### Запуск через Docker Compose (рекомендуется)

```bash
# Клонировать репозиторий
git clone <repo-url>
cd Billing-Assistant

# Запустить оба сервиса одной командой
docker compose up --build
```

После успешного запуска:
- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:8000
- **Swagger UI**: http://localhost:8000/docs
- **ReDoc**: http://localhost:8000/redoc

### Остановка

```bash
docker compose down

# С удалением тома БД
docker compose down -v
```

---

## Локальная разработка без Docker

### Backend

```bash
cd backend

# Создать виртуальное окружение
python -m venv .venv
source .venv/bin/activate        # Linux/macOS
# .venv\Scripts\activate         # Windows

# Установить зависимости
pip install -r requirements.txt

# Скопировать конфигурацию
cp .env.example .env

# Применить миграции
alembic upgrade head

# Запустить сервер (с hot-reload)
uvicorn app.main:app --reload --port 8000
```

### Frontend

```bash
cd frontend

# Установить зависимости
npm install

# Запустить dev-сервер
npm run dev
```

Dev-сервер Vite запустится на http://localhost:3000 и будет проксировать
запросы `/api/*` на `http://localhost:8000`.

---

## Миграции базы данных

```bash
cd backend

# Создать новую миграцию
alembic revision --autogenerate -m "describe_change"

# Применить все миграции
alembic upgrade head

# Откатить последнюю миграцию
alembic downgrade -1
```

---

## API

| Метод | Путь | Описание |
|-------|------|----------|
| GET | `/health` | Проверка работоспособности сервиса |
| GET | `/api/v1/hello` | Hello World — проверка API |

Полная документация доступна в Swagger UI по адресу `/docs`.

---

## Переменные окружения

### Backend (`.env`)

| Переменная | По умолчанию | Описание |
|-----------|-------------|----------|
| `DATABASE_URL` | `sqlite:///./billing.db` | URL подключения к БД |

### Frontend (`.env`)

| Переменная | Описание |
|-----------|----------|
| `VITE_API_URL` | URL backend API (используется при сборке) |
