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
