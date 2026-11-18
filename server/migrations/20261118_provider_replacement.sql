ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS cancellation_reason text;
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS replacement_offered boolean NOT NULL DEFAULT false;
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS replaces_booking_id uuid REFERENCES public.bookings(booking_id) ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS ux_booking_replacement
  ON public.bookings(replaces_booking_id) WHERE replaces_booking_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS ix_booking_replacement_customer
  ON public.bookings(user_id, date DESC) WHERE replacement_offered;
