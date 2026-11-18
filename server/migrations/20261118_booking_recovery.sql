ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS request_hash text;
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS renewed_hold_at timestamptz;
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS next_payment_check_at timestamptz;
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS payment_check_failures integer NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS public.booking_order_intents (
    booking_id uuid PRIMARY KEY,
    user_id uuid NOT NULL REFERENCES public.users(id),
    request_hash text NOT NULL,
    amount_paise bigint NOT NULL CHECK (amount_paise > 0),
    payment_method text NOT NULL CHECK (payment_method IN ('cod', 'online')),
    order_id text UNIQUE,
    last_create_at timestamptz NOT NULL DEFAULT clock_timestamp(),
    next_lookup_at timestamptz NOT NULL DEFAULT clock_timestamp(),
    created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);

CREATE INDEX IF NOT EXISTS ix_booking_order_intents_lookup
    ON public.booking_order_intents (next_lookup_at)
    WHERE payment_method = 'online' AND order_id IS NULL;

CREATE INDEX IF NOT EXISTS ix_booking_payment_recovery
    ON public.bookings (next_payment_check_at NULLS FIRST, created_at)
    WHERE payment_method = 'online' AND razorpay_order_id IS NOT NULL AND razorpay_payment_id IS NULL;

CREATE TABLE IF NOT EXISTS public.booking_reconciliation_health (
    singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton),
    lease_token uuid,
    lease_until timestamptz,
    last_success_at timestamptz,
    last_failure_at timestamptz,
    payment_checks bigint NOT NULL DEFAULT 0,
    captures_recovered bigint NOT NULL DEFAULT 0,
    holds_expired bigint NOT NULL DEFAULT 0,
    gateway_failures bigint NOT NULL DEFAULT 0
);
