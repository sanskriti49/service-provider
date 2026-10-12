-- Each booking is one conversation; existing bookings need no backfill.
CREATE TABLE IF NOT EXISTS public.chat_messages (
    id bigserial PRIMARY KEY,
    booking_id uuid NOT NULL REFERENCES public.bookings(booking_id) ON DELETE CASCADE,
    sender_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    client_message_id uuid NOT NULL,
    body text NOT NULL CHECK (char_length(btrim(body)) BETWEEN 1 AND 4000),
    created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
    read_at timestamptz,
    UNIQUE (booking_id, sender_id, client_message_id)
);
CREATE INDEX IF NOT EXISTS ix_chat_messages_history ON public.chat_messages(booking_id, id);
CREATE INDEX IF NOT EXISTS ix_chat_messages_unread ON public.chat_messages(booking_id, sender_id, id)
    WHERE read_at IS NULL;

-- Trust & Safety: bidirectional chat reports for misdemeanours and policy violations
CREATE TABLE IF NOT EXISTS public.chat_reports (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    booking_id uuid NOT NULL REFERENCES public.bookings(booking_id) ON DELETE CASCADE,
    reporter_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    reported_user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    message_id bigint REFERENCES public.chat_messages(id) ON DELETE SET NULL,
    reason text NOT NULL,
    details text,
    status varchar(20) DEFAULT 'pending' NOT NULL,
    action_taken text,
    created_at timestamptz DEFAULT now() NOT NULL,
    updated_at timestamptz DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS ix_chat_reports_booking ON public.chat_reports(booking_id);
CREATE INDEX IF NOT EXISTS ix_chat_reports_reporter ON public.chat_reports(reporter_id);
CREATE INDEX IF NOT EXISTS ix_chat_reports_reported ON public.chat_reports(reported_user_id);
CREATE INDEX IF NOT EXISTS ix_chat_reports_status ON public.chat_reports(status);

