-- ============================================================
-- Billing Assistant – Supabase Schema
-- Run this in the Supabase SQL Editor to create all tables.
-- ============================================================

-- Clients
CREATE TABLE IF NOT EXISTS clients (
  id               BIGSERIAL PRIMARY KEY,
  name             TEXT NOT NULL,
  contact_person   TEXT,
  email            TEXT,
  phone            TEXT,
  address          TEXT,
  inn              TEXT,
  bank_name        TEXT,
  bik              TEXT,
  checking_account      TEXT,
  correspondent_account TEXT,
  notes            TEXT,
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

-- Lawyer Profiles
CREATE TABLE IF NOT EXISTS lawyer_profiles (
  id                   BIGSERIAL PRIMARY KEY,
  label                TEXT NOT NULL DEFAULT 'Профиль',
  type                 TEXT NOT NULL DEFAULT 'ru',
  language             TEXT NOT NULL DEFAULT 'ru',
  full_name            TEXT,
  company_name         TEXT,
  address              TEXT,
  email                TEXT,
  phone                TEXT,
  default_hourly_rate  TEXT,
  default_currency     TEXT DEFAULT 'RUB',
  vat_type             TEXT DEFAULT 'none',
  logo_path            TEXT,
  -- Russian bank
  inn                  TEXT,
  bank_name            TEXT,
  bik                  TEXT,
  checking_account     TEXT,
  correspondent_account TEXT,
  -- EU / international
  iban                 TEXT,
  swift                TEXT,
  bank_country         TEXT,
  vat_number           TEXT,
  created_at           TIMESTAMPTZ DEFAULT NOW()
);

-- Projects
CREATE TABLE IF NOT EXISTS projects (
  id          BIGSERIAL PRIMARY KEY,
  client_id   BIGINT REFERENCES clients(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  description TEXT,
  hourly_rate TEXT,
  currency    TEXT DEFAULT 'RUB',
  status      TEXT DEFAULT 'active',
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Time Entries
CREATE TABLE IF NOT EXISTS time_entries (
  id             BIGSERIAL PRIMARY KEY,
  project_id     BIGINT REFERENCES projects(id) ON DELETE CASCADE,
  date           DATE NOT NULL,
  duration_hours TEXT NOT NULL,
  description    TEXT,
  status         TEXT DEFAULT 'draft',
  created_at     TIMESTAMPTZ DEFAULT NOW(),
  updated_at     TIMESTAMPTZ DEFAULT NOW()
);

-- Invoices
CREATE TABLE IF NOT EXISTS invoices (
  id              BIGSERIAL PRIMARY KEY,
  client_id       BIGINT REFERENCES clients(id),
  profile_id      BIGINT REFERENCES lawyer_profiles(id),
  invoice_number  TEXT NOT NULL,
  issue_date      DATE NOT NULL,
  due_date        DATE NOT NULL,
  status          TEXT DEFAULT 'draft',
  notes           TEXT,
  currency        TEXT DEFAULT 'RUB',
  vat_type        TEXT DEFAULT 'none',
  subtotal        TEXT DEFAULT '0',
  vat_amount      TEXT DEFAULT '0',
  total_amount    TEXT DEFAULT '0',
  payment_currency TEXT,
  exchange_rate   NUMERIC,
  payment_amount  TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Invoice Items
CREATE TABLE IF NOT EXISTS invoice_items (
  id             BIGSERIAL PRIMARY KEY,
  invoice_id     BIGINT REFERENCES invoices(id) ON DELETE CASCADE,
  time_entry_id  BIGINT REFERENCES time_entries(id) ON DELETE SET NULL,
  hours          TEXT NOT NULL,
  rate           TEXT NOT NULL,
  amount         TEXT NOT NULL,
  date           DATE,
  project_name   TEXT,
  description    TEXT
);

-- ============================================================
-- Disable Row Level Security (single-user app without auth).
-- WARNING: anyone with the anon key can read/write all data.
-- Enable RLS + add auth if you need multi-user isolation.
-- ============================================================
ALTER TABLE clients         DISABLE ROW LEVEL SECURITY;
ALTER TABLE lawyer_profiles DISABLE ROW LEVEL SECURITY;
ALTER TABLE projects        DISABLE ROW LEVEL SECURITY;
ALTER TABLE time_entries    DISABLE ROW LEVEL SECURITY;
ALTER TABLE invoices        DISABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_items   DISABLE ROW LEVEL SECURITY;
