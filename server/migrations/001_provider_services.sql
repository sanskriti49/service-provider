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



CREATE TABLE public.reviews (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    booking_id uuid NOT NULL, -- Optional: links to a specific transaction
    customer_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    provider_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    rating int2 NOT NULL CHECK (rating >= 1 AND rating <= 5),
    comment text NULL,
    created_at timestamp DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT reviews_pkey PRIMARY KEY (id)
);

-- TRIGGER FUNCTION
CREATE OR REPLACE FUNCTION update_provider_average_rating()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE public.providers
    SET rating = (
        SELECT COALESCE(AVG(rating), 0)::float4 
        FROM public.reviews 
        WHERE provider_id = COALESCE(NEW.provider_id, OLD.provider_id)
    )
    WHERE user_id = COALESCE(NEW.provider_id, OLD.provider_id);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_review_changes
AFTER INSERT OR UPDATE OR DELETE ON public.reviews
FOR EACH ROW
EXECUTE FUNCTION update_provider_average_rating();