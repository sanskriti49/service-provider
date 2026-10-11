-- Atomic, non-destructive migration. Duplicate payment IDs or active overlaps
-- deliberately stop the migration instead of silently deleting business records.
ALTER TABLE public.providers ALTER COLUMN status SET DEFAULT 'pending';
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS hold_expires_at timestamptz;
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS last_payment_check_at timestamptz;
UPDATE public.bookings SET hold_expires_at=created_at+INTERVAL '5 minutes'
WHERE payment_method='online' AND hold_expires_at IS NULL;
ALTER TABLE public.bookings ALTER COLUMN price TYPE numeric(12,2) USING round(price::numeric,2);
ALTER TABLE public.provider_services ALTER COLUMN price TYPE numeric(12,2) USING round(price::numeric,2);
CREATE UNIQUE INDEX IF NOT EXISTS ux_booking_order ON public.bookings(razorpay_order_id) WHERE razorpay_order_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS ux_booking_payment ON public.bookings(razorpay_payment_id) WHERE razorpay_payment_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS ux_availability_slot ON public.availability_slots(provider_id,date,start_time,end_time);
CREATE UNIQUE INDEX IF NOT EXISTS ux_booking_review ON public.reviews(booking_id,customer_id) WHERE booking_id IS NOT NULL;

DO $$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='public.bookings'::regclass AND conname='booking_provider_fk') THEN
  ALTER TABLE public.bookings ADD CONSTRAINT booking_provider_fk FOREIGN KEY(provider_id) REFERENCES public.users(id) NOT VALID;
  ALTER TABLE public.bookings ADD CONSTRAINT booking_customer_fk FOREIGN KEY(user_id) REFERENCES public.users(id) NOT VALID;
  ALTER TABLE public.bookings ADD CONSTRAINT booking_service_fk FOREIGN KEY(service_id) REFERENCES public.services(id) NOT VALID;
  ALTER TABLE public.bookings ADD CONSTRAINT booking_times CHECK(end_time>start_time) NOT VALID;
  ALTER TABLE public.bookings ADD CONSTRAINT booking_price CHECK(price IS NOT NULL AND price>0) NOT VALID;
  ALTER TABLE public.bookings ADD CONSTRAINT booking_service_required CHECK(service_id IS NOT NULL) NOT VALID;
  ALTER TABLE public.bookings ADD CONSTRAINT booking_distinct_participants CHECK(provider_id<>user_id) NOT VALID;
  ALTER TABLE public.bookings ADD CONSTRAINT booking_state CHECK(status IN ('pending','booked','confirmed','in_progress','completed','cancelled','expired','no_show')) NOT VALID;
  ALTER TABLE public.bookings ADD CONSTRAINT booking_payment_method CHECK(payment_method IS NOT NULL AND payment_method IN ('cod','online')) NOT VALID;
  ALTER TABLE public.bookings ADD CONSTRAINT booking_payment_state CHECK(payment_status IS NOT NULL AND payment_status IN ('pending','failed','paid','refund_pending','refund_failed','refunded','partially_refunded')) NOT VALID;
  ALTER TABLE public.bookings ADD CONSTRAINT booking_online_order CHECK(payment_method<>'online' OR razorpay_order_id IS NOT NULL) NOT VALID;
  ALTER TABLE public.bookings ADD CONSTRAINT booking_capture CHECK(payment_method<>'online' OR payment_status NOT IN ('paid','refund_pending','refund_failed','refunded','partially_refunded') OR razorpay_payment_id IS NOT NULL) NOT VALID;
 END IF;
 IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='public.provider_master_availability'::regclass AND conname='master_availability_times') THEN
  ALTER TABLE public.provider_master_availability ADD CONSTRAINT master_availability_times CHECK(end_time>start_time AND day_of_week BETWEEN 0 AND 6) NOT VALID;
  ALTER TABLE public.availability_slots ADD CONSTRAINT availability_times CHECK(end_time>start_time AND provider_id IS NOT NULL AND date IS NOT NULL) NOT VALID;
 END IF;
 IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='public.reviews'::regclass AND conname='review_booking_fk') THEN
  ALTER TABLE public.reviews ADD CONSTRAINT review_booking_fk FOREIGN KEY(booking_id) REFERENCES public.bookings(booking_id) NOT VALID;
 END IF;
END $$;

CREATE EXTENSION IF NOT EXISTS btree_gist;
DO $$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='public.bookings'::regclass AND conname='booking_active_overlap') THEN
  ALTER TABLE public.bookings ADD CONSTRAINT booking_active_overlap EXCLUDE USING gist
  (provider_id WITH =, tsrange(date+start_time,date+end_time,'[)') WITH &&)
  WHERE (status IN ('booked','confirmed','in_progress') OR (status='pending' AND payment_method='cod'));
 END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.booking_refunds (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 booking_id uuid NOT NULL REFERENCES public.bookings(booking_id),
 payment_id text NOT NULL,
 amount_paise bigint NOT NULL CHECK(amount_paise>0),
 request_key text NOT NULL,
 state text NOT NULL DEFAULT 'pending' CHECK(state IN ('pending','submitting','unknown','processing','processed','failed')),
 gateway_refund_id text UNIQUE,
 last_error text,
 created_at timestamptz NOT NULL DEFAULT NOW(),
 updated_at timestamptz NOT NULL DEFAULT NOW(),
 UNIQUE(booking_id,request_key)
);
CREATE INDEX IF NOT EXISTS ix_refunds_reconcile ON public.booking_refunds(updated_at) WHERE state<>'processed';
