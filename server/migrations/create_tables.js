const db = require("../config/db");

// We split the queries into an array to run them one by one
const queries = [
	// 1. Users
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
    CONSTRAINT check_email_lowercase CHECK ((email = lower(email))),
    CONSTRAINT check_indian_ph_no CHECK (((phone)::text ~ '^\\+91 ?[6-9][0-9]{9}$'::text)),
    CONSTRAINT users_check CHECK ((((role IS NULL) AND (custom_id IS NULL)) OR ((role = 'customer'::text) AND (custom_id ~ '^CUS[A-Z0-9]{10,30}$'::text)) OR ((role = 'provider'::text) AND (custom_id ~ '^SRV[A-Z0-9]{10,30}$'::text)))),
    CONSTRAINT users_custom_id_key1 UNIQUE (custom_id),
    CONSTRAINT users_email_key1 UNIQUE (email),
    CONSTRAINT users_pkey1 PRIMARY KEY (id),
    CONSTRAINT users_role_check CHECK ((role = ANY (ARRAY['customer'::text, 'provider'::text])))
  )`,

	// 2. Services
	`CREATE TABLE IF NOT EXISTS public.services (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    "name" text NOT NULL,
    description text NOT NULL,
    price numeric NOT NULL,
    category text NULL,
    image_url text NULL,
    slug text NULL,
    CONSTRAINT services_pkey PRIMARY KEY (id),
    CONSTRAINT services_slug_key UNIQUE (slug)
  )`,

	// 3. Providers
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

	// 4. Availability Slots
	`CREATE TABLE IF NOT EXISTS public.availability_slots (
    provider_id uuid NULL,
    "date" date NULL,
    start_time time NOT NULL,
    end_time time NOT NULL,
    created_at timestamptz DEFAULT now() NULL,
    CONSTRAINT availability_slots_provider_id_fkey FOREIGN KEY (provider_id) REFERENCES public.providers(user_id)
  )`,

	// 5. Bookings
	`CREATE TABLE IF NOT EXISTS public.bookings (
    id serial4 NOT NULL,
    provider_id uuid NOT NULL,
    user_id uuid NOT NULL,
    "date" date NOT NULL,
    start_time time NOT NULL,
    end_time time NOT NULL,
    status varchar(20) DEFAULT 'booked'::character varying NOT NULL,
    created_at timestamptz DEFAULT now() NULL,
    updated_at timestamptz DEFAULT now() NULL,
    booking_id uuid DEFAULT gen_random_uuid() NULL,
    service_id uuid NULL,
    address text NULL,
    CONSTRAINT bookings_booking_id_key UNIQUE (booking_id),
    CONSTRAINT bookings_pkey PRIMARY KEY (id),
    CONSTRAINT bookings_provider_id_fkey FOREIGN KEY (provider_id) REFERENCES public.users(id) ON DELETE CASCADE,
    CONSTRAINT bookings_service_id_fkey FOREIGN KEY (service_id) REFERENCES public.services(id),
    CONSTRAINT bookings_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE
  )`,

	// 5.1 Booking Indexes (Run separately)
	`CREATE INDEX IF NOT EXISTS ix_bookings_booking_id ON public.bookings USING btree (booking_id)`,
	`CREATE INDEX IF NOT EXISTS ix_bookings_provider_date ON public.bookings USING btree (provider_id, date)`,

	// 6. Master Availability
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

	// 7. Exceptions
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
];

const runMigration = async () => {
	try {
		console.log("⏳ Starting migration...");
		// Loop through queries and run them one by one
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

runMigration();
