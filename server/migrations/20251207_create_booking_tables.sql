CREATE TABLE provider_master_availability(
    id SERIAL PRIMARY KEY,
    provider_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    day_of_week SMALLINT NOT NULL, --0=Sunday  ..6=Saturday
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE UNIQUE INDEX ux_provider_day_start_end ON provider_master_availability(provider_id,day_of_week,start_time,end_time);

CREATE TABLE provider_date_exceptions(
    id SERIAL PRIMARY KEY,
    provider_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    is_available BOOLEAN NOT NULL DEFAULT false, --false=blcoked, true=available override
    override_slots JSONB DEFAULT NULL, -- optional: [{start:"09:00",end:"11:00"},...]
    note TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    UNIQUE(provider_id,date)
);

CREATE TABLE bookings(
    id SERIAL PRIMARY KEY,
    provider_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'booked',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE INDEX ix_bookings_provider_date ON bookings(provider_id,date);
CREATE INDEX ix_exceptions_provider_date ON provider_date_exceptions(provider_id,date);

