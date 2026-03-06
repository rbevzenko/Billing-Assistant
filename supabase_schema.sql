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
-- Row Level Security — allow access only to authenticated users.
-- Any signed-in user can read/write all data (single-owner app).
-- ============================================================
ALTER TABLE clients         ENABLE ROW LEVEL SECURITY;
ALTER TABLE lawyer_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects        ENABLE ROW LEVEL SECURITY;
ALTER TABLE time_entries    ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices        ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_items   ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth_all" ON clients         FOR ALL USING (auth.uid() IS NOT NULL);
CREATE POLICY "auth_all" ON lawyer_profiles FOR ALL USING (auth.uid() IS NOT NULL);
CREATE POLICY "auth_all" ON projects        FOR ALL USING (auth.uid() IS NOT NULL);
CREATE POLICY "auth_all" ON time_entries    FOR ALL USING (auth.uid() IS NOT NULL);
CREATE POLICY "auth_all" ON invoices        FOR ALL USING (auth.uid() IS NOT NULL);
CREATE POLICY "auth_all" ON invoice_items   FOR ALL USING (auth.uid() IS NOT NULL);

-- ============================================================
-- Create the app user in Supabase Dashboard:
--   Authentication → Users → Invite user (or Add user)
-- No SQL needed — Supabase Auth handles user creation.
-- ============================================================
