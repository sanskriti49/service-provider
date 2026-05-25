-- Migration: 001_provider_services.sql
-- Creates the provider_services junction table that enables multi-service providers
-- Run once: psql -d service_app -f 001_provider_services.sql

CREATE TABLE IF NOT EXISTS provider_services (
    id           SERIAL PRIMARY KEY,
    provider_id  INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    service_id   INTEGER NOT NULL REFERENCES services(id) ON DELETE CASCADE,
    price        NUMERIC(10,2) NOT NULL DEFAULT 0,
    price_unit   VARCHAR(20)   NOT NULL DEFAULT 'fixed',
    is_visible   BOOLEAN       NOT NULL DEFAULT TRUE,
    created_at   TIMESTAMPTZ   NOT NULL DEFAULT NOW(),

    UNIQUE(provider_id, service_id)
);

-- Backfill existing providers from the providers table
-- so nothing is lost on existing data
INSERT INTO provider_services (provider_id, service_id, price, price_unit, is_visible)
SELECT p.user_id, p.service_id, COALESCE(p.price, 0), COALESCE(p.price_unit, 'fixed'), TRUE
FROM providers p
WHERE p.service_id IS NOT NULL
ON CONFLICT (provider_id, service_id) DO NOTHING;

-- Index for fast lookups by provider
CREATE INDEX IF NOT EXISTS idx_provider_services_provider_id ON provider_services(provider_id);
CREATE INDEX IF NOT EXISTS idx_provider_services_service_id  ON provider_services(service_id);