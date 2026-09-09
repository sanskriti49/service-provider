const db = require("../config/db");

const queries = [
	`CREATE TABLE IF NOT EXISTS public.users (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    "name" text NOT NULL,
    email text NOT NULL,
    "role" text DEFAULT 'customer'::text NULL,
    custom_id text NULL,
    "password" text NOT NULL,
    photo text NULL,
    "location" text NULL,
    lat float4 NULL,
    lng float4 NULL,
    bio text NULL,
    created_at timestamptz DEFAULT now() NULL,
    phone varchar(15) NULL,
    address text NULL,
    reset_password_token text NULL,
    reset_password_expires int8 NULL,
    temp_email text NULL,
    temp_email_otp text NULL,
    temp_email_expires int8 NULL,
    CONSTRAINT check_email_lowercase CHECK ((email = lower(email))),
    CONSTRAINT check_indian_ph_no CHECK (((phone)::text ~ '^\\+91 ?[6-9][0-9]{9}$'::text)),
    CONSTRAINT users_check CHECK ((((role IS NULL) AND (custom_id IS NULL)) OR ((role = 'customer'::text) AND (custom_id ~ '^CUS[A-Z0-9]{10,30}$'::text)) OR ((role = 'provider'::text) AND (custom_id ~ '^SRV[A-Z0-9]{10,30}$'::text)))),
    CONSTRAINT users_custom_id_key1 UNIQUE (custom_id),
    CONSTRAINT users_email_key1 UNIQUE (email),
    CONSTRAINT users_pkey1 PRIMARY KEY (id),
    CONSTRAINT users_role_check CHECK ((role = ANY (ARRAY['customer'::text, 'provider'::text])))
  )`,
	`CREATE INDEX IF NOT EXISTS ix_users_custom_id ON public.users(custom_id)`,
	`CREATE INDEX IF NOT EXISTS ix_users_role ON public.users(role)`,
	`CREATE INDEX IF NOT EXISTS ix_users_lat_lng ON public.users(lat, lng)`,
	`ALTER TABLE public.users ADD COLUMN IF NOT EXISTS reset_password_token text NULL`,
	`ALTER TABLE public.users ADD COLUMN IF NOT EXISTS reset_password_expires int8 NULL`,
	`ALTER TABLE public.users ADD COLUMN IF NOT EXISTS temp_email text NULL`,
	`ALTER TABLE public.users ADD COLUMN IF NOT EXISTS temp_email_otp text NULL`,
	`ALTER TABLE public.users ADD COLUMN IF NOT EXISTS temp_email_expires int8 NULL`,

	`CREATE TABLE IF NOT EXISTS public.services (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    "name" text NOT NULL,
    description text NOT NULL,
    price numeric NOT NULL,
    price_unit text DEFAULT 'fixed'::text NULL,
    category text NULL,
    image_url text NULL,
    slug text NULL,
    CONSTRAINT services_pkey PRIMARY KEY (id),
    CONSTRAINT services_slug_key UNIQUE (slug)
  )`,

	`CREATE TABLE IF NOT EXISTS public.providers (
    user_id uuid NOT NULL,
    price float4 NULL,
    rating float4 NULL,
    availability jsonb NULL,
    slug text NULL,
    description text NULL,
    service_id uuid NULL,
    CONSTRAINT providers_pkey PRIMARY KEY (user_id),
    CONSTRAINT fk_service FOREIGN KEY (service_id) REFERENCES public.services(id) ON DELETE SET NULL,
    CONSTRAINT fk_user FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE
  )`,

	`CREATE TABLE IF NOT EXISTS public.provider_services (
    id serial4 NOT NULL,
    provider_id uuid NOT NULL,
    service_id uuid NOT NULL,
    price float4 NOT NULL DEFAULT 0,
    price_unit varchar(20) NOT NULL DEFAULT 'fixed',
    is_visible bool NOT NULL DEFAULT true,
    slug text NULL,
    description text NULL,
    created_at timestamptz DEFAULT now() NULL,
    CONSTRAINT provider_services_pkey PRIMARY KEY (id),
    CONSTRAINT provider_services_provider_service_key UNIQUE (provider_id, service_id),
    CONSTRAINT provider_services_provider_id_fkey FOREIGN KEY (provider_id) REFERENCES public.users(id) ON DELETE CASCADE,
    CONSTRAINT provider_services_service_id_fkey FOREIGN KEY (service_id) REFERENCES public.services(id) ON DELETE CASCADE
  )`,
	`CREATE INDEX IF NOT EXISTS ix_provider_services_provider ON public.provider_services(provider_id)`,
	`CREATE INDEX IF NOT EXISTS ix_provider_services_service ON public.provider_services(service_id)`,

	`CREATE TABLE IF NOT EXISTS public.availability_slots (
    provider_id uuid NULL,
    "date" date NULL,
    start_time time NOT NULL,
    end_time time NOT NULL,
    is_booked bool DEFAULT false NOT NULL,
    created_at timestamptz DEFAULT now() NULL,
    CONSTRAINT availability_slots_provider_id_fkey FOREIGN KEY (provider_id) REFERENCES public.providers(user_id)
  )`,
	`CREATE INDEX IF NOT EXISTS ix_availability_slots_provider_date ON public.availability_slots(provider_id, date)`,
	`ALTER TABLE public.availability_slots ADD COLUMN IF NOT EXISTS is_booked bool DEFAULT false NOT NULL`,

	`CREATE TABLE IF NOT EXISTS public.bookings (
    booking_id uuid DEFAULT gen_random_uuid() NOT NULL,
    provider_id uuid NOT NULL,
    user_id uuid NOT NULL,
    service_id uuid NULL,
    "date" date NOT NULL,
    start_time time NOT NULL,
    end_time time NOT NULL,
    status varchar(20) DEFAULT 'booked'::character varying NOT NULL,
    address text NULL,
    price float4 NULL,
    payment_method varchar(20) DEFAULT 'cod'::character varying NULL,
    payment_status varchar(20) DEFAULT 'pending'::character varying NULL,
    razorpay_order_id varchar(255) NULL,
    razorpay_payment_id varchar(255) NULL,
    otp varchar(6) NULL,
    action_by varchar(20) NULL,
    cancellation_reason text NULL,
    latitude float4 NULL,
    longitude float4 NULL,
    created_at timestamptz DEFAULT now() NULL,
    updated_at timestamptz DEFAULT now() NULL,
    CONSTRAINT bookings_pkey PRIMARY KEY (booking_id)
  )`,
	`CREATE INDEX IF NOT EXISTS ix_bookings_booking_id ON public.bookings USING btree (booking_id)`,
	`CREATE INDEX IF NOT EXISTS ix_bookings_provider_date ON public.bookings USING btree (provider_id, date)`,
	`CREATE INDEX IF NOT EXISTS ix_bookings_user_id ON public.bookings(user_id)`,
	`CREATE INDEX IF NOT EXISTS ix_bookings_status ON public.bookings(status)`,

	`CREATE TABLE IF NOT EXISTS public.provider_master_availability (
    id serial4 NOT NULL,
    provider_id uuid NOT NULL,
    day_of_week int2 NOT NULL,
    start_time time NOT NULL,
    end_time time NOT NULL,
    created_at timestamptz DEFAULT now() NULL,
    CONSTRAINT provider_master_availability_pkey PRIMARY KEY (id),
    CONSTRAINT provider_master_availability_provider_id_fkey FOREIGN KEY (provider_id) REFERENCES public.users(id) ON DELETE CASCADE
  )`,
	`CREATE UNIQUE INDEX IF NOT EXISTS ux_provider_day_start_end ON public.provider_master_availability USING btree (provider_id, day_of_week, start_time, end_time)`,

	`CREATE TABLE IF NOT EXISTS public.provider_date_exceptions (
    id serial4 NOT NULL,
    provider_id uuid NOT NULL,
    "date" date NOT NULL,
    is_available bool DEFAULT false NOT NULL,
    override_slots jsonb NULL,
    note text NULL,
    created_at timestamptz DEFAULT now() NULL,
    CONSTRAINT provider_date_exceptions_pkey PRIMARY KEY (id),
    CONSTRAINT provider_date_exceptions_provider_id_date_key UNIQUE (provider_id, date),
    CONSTRAINT provider_date_exceptions_provider_id_fkey FOREIGN KEY (provider_id) REFERENCES public.users(id) ON DELETE CASCADE
  )`,
	`CREATE INDEX IF NOT EXISTS ix_exceptions_provider_date ON public.provider_date_exceptions USING btree (provider_id, date)`,

	`CREATE TABLE IF NOT EXISTS public.reviews (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    booking_id uuid NULL,
    customer_id uuid NOT NULL,
    provider_id uuid NOT NULL,
    rating int2 NOT NULL CHECK (rating >= 1 AND rating <= 5),
    comment text NULL,
    tags jsonb DEFAULT '[]'::jsonb NULL,
    created_at timestamptz DEFAULT now() NULL,
    CONSTRAINT reviews_pkey PRIMARY KEY (id),
    CONSTRAINT fk_review_customer FOREIGN KEY (customer_id) REFERENCES public.users(id) ON DELETE CASCADE,
    CONSTRAINT fk_review_provider FOREIGN KEY (provider_id) REFERENCES public.users(id) ON DELETE CASCADE
  )`,
	`CREATE INDEX IF NOT EXISTS ix_reviews_provider ON public.reviews(provider_id)`,
	`CREATE INDEX IF NOT EXISTS ix_reviews_customer ON public.reviews(customer_id)`,
	`CREATE INDEX IF NOT EXISTS ix_reviews_booking ON public.reviews(booking_id)`,

	`CREATE TABLE IF NOT EXISTS public.notifications (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    title text NOT NULL,
    message text NOT NULL,
    type varchar(50) DEFAULT 'system'::character varying NOT NULL,
    data jsonb DEFAULT '{}'::jsonb NULL,
    is_read bool DEFAULT false NOT NULL,
    created_at timestamptz DEFAULT now() NULL,
    CONSTRAINT notifications_pkey PRIMARY KEY (id),
    CONSTRAINT fk_notification_user FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE
  )`,
	`CREATE INDEX IF NOT EXISTS ix_notifications_user_unread ON public.notifications(user_id, is_read, created_at DESC)`,

	// Admin & Ops Schema Updates
	`ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_role_check`,
	`ALTER TABLE public.users ADD CONSTRAINT users_role_check CHECK (role = ANY (ARRAY['customer'::text, 'provider'::text, 'admin'::text]))`,
	`ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_check`,
	`ALTER TABLE public.users ADD CONSTRAINT users_check CHECK (
    ((role IS NULL) AND (custom_id IS NULL)) OR
    ((role = 'customer'::text) AND (custom_id ~ '^CUS[A-Z0-9]{10,30}$'::text)) OR
    ((role = 'provider'::text) AND (custom_id ~ '^SRV[A-Z0-9]{10,30}$'::text)) OR
    ((role = 'admin'::text) AND (custom_id ~ '^ADM[A-Z0-9]{10,30}$'::text))
  )`,

	`ALTER TABLE public.providers ADD COLUMN IF NOT EXISTS status varchar(20) DEFAULT 'approved' NOT NULL`,
	`ALTER TABLE public.providers ADD COLUMN IF NOT EXISTS rejection_reason text NULL`,
	`ALTER TABLE public.providers ADD COLUMN IF NOT EXISTS approved_at timestamptz DEFAULT now() NULL`,

	`CREATE TABLE IF NOT EXISTS public.disputes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    booking_id uuid NOT NULL,
    raised_by uuid NOT NULL,
    provider_id uuid NOT NULL,
    reason text NOT NULL,
    details text NULL,
    status varchar(20) DEFAULT 'opened'::character varying NOT NULL,
    refund_amount float4 DEFAULT 0,
    resolution_notes text NULL,
    resolved_by uuid NULL,
    resolved_at timestamptz NULL,
    created_at timestamptz DEFAULT now() NULL,
    CONSTRAINT disputes_pkey PRIMARY KEY (id),
    CONSTRAINT fk_dispute_booking FOREIGN KEY (booking_id) REFERENCES public.bookings(booking_id) ON DELETE CASCADE,
    CONSTRAINT fk_dispute_raised_by FOREIGN KEY (raised_by) REFERENCES public.users(id) ON DELETE CASCADE,
    CONSTRAINT fk_dispute_provider FOREIGN KEY (provider_id) REFERENCES public.users(id) ON DELETE CASCADE
  )`,
	`CREATE INDEX IF NOT EXISTS ix_disputes_booking ON public.disputes(booking_id)`,
	`CREATE INDEX IF NOT EXISTS ix_disputes_status ON public.disputes(status)`,
	`CREATE INDEX IF NOT EXISTS ix_disputes_provider ON public.disputes(provider_id)`,

	`CREATE TABLE IF NOT EXISTS public.platform_settings (
    key varchar(50) NOT NULL,
    value jsonb NOT NULL,
    updated_at timestamptz DEFAULT now() NULL,
    CONSTRAINT platform_settings_pkey PRIMARY KEY (key)
  )`,
	`INSERT INTO public.platform_settings (key, value)
   VALUES 
     ('commission_rate', '{"percentage": 15, "min_fee": 50}'::jsonb),
     ('cancellation_fee', '{"customer_fee": 100, "provider_penalty": 150}'::jsonb)
   ON CONFLICT (key) DO NOTHING`,
];

const runMigration = async () => {
	try {
		console.log("⏳ Starting migration...");
		for (const [index, query] of queries.entries()) {
			console.log(`... Running Step ${index + 1}/${queries.length}`);
			await db.query(query);
		}
		console.log("✅ All tables created successfully!");
	} catch (err) {
		console.error("❌ Migration failed:", err.message);
	} finally {
		db.end();
	}
};

if (require.main === module) {
	runMigration();
}

module.exports = { queries, runMigration };
