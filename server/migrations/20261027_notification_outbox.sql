CREATE TABLE IF NOT EXISTS public.notification_outbox (
    id uuid PRIMARY KEY,
    event_type text NOT NULL,
    payload jsonb NOT NULL,
    status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'queued', 'completed', 'failed')),
    generation integer NOT NULL DEFAULT 0 CHECK (generation >= 0),
    attempts integer NOT NULL DEFAULT 0 CHECK (attempts >= 0),
    max_attempts integer NOT NULL DEFAULT 3 CHECK (max_attempts BETWEEN 1 AND 20),
    dispatch_attempts integer NOT NULL DEFAULT 0,
    next_dispatch_at timestamptz NOT NULL DEFAULT clock_timestamp(),
    dispatch_lease_until timestamptz,
    last_error text,
    created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
    updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
    completed_at timestamptz
);
CREATE INDEX IF NOT EXISTS notification_outbox_dispatch_idx
    ON public.notification_outbox (next_dispatch_at)
    WHERE status IN ('pending', 'queued');
CREATE INDEX IF NOT EXISTS notification_outbox_failed_idx
    ON public.notification_outbox (created_at) WHERE status = 'failed';
