-- Migration: Enable PostGIS and add spatial geography indexing to users and bookings
-- TaskGenie Cloud-Native Architecture

-- 1. Enable PostGIS Extension (if available)
CREATE EXTENSION IF NOT EXISTS postgis;

-- 2. Add Geography Point column to users
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS geom geography(Point, 4326);

-- 3. Create high-performance GIST spatial index for sub-millisecond proximity queries
CREATE INDEX IF NOT EXISTS idx_users_geom_gist ON public.users USING GIST (geom);

-- 4. Backfill existing provider/user coordinates into PostGIS geography points
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'postgis') THEN
    UPDATE public.users 
    SET geom = ST_SetSRID(ST_MakePoint(lng, lat), 4326)::geography 
    WHERE lat IS NOT NULL AND lng IS NOT NULL AND geom IS NULL;
  END IF;
END $$;

-- 5. Add Geography Point column to bookings for service location proximity
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS geom geography(Point, 4326);
CREATE INDEX IF NOT EXISTS idx_bookings_geom_gist ON public.bookings USING GIST (geom);

-- 6. Trigger to automatically keep geom synchronized whenever lat or lng is updated
CREATE OR REPLACE FUNCTION sync_user_geom() 
RETURNS trigger AS $$
BEGIN
  IF NEW.lat IS NOT NULL AND NEW.lng IS NOT NULL THEN
    NEW.geom = ST_SetSRID(ST_MakePoint(NEW.lng, NEW.lat), 4326)::geography;
  ELSE
    NEW.geom = NULL;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_users_geom_sync ON public.users;
CREATE TRIGGER trg_users_geom_sync
BEFORE INSERT OR UPDATE OF lat, lng ON public.users
FOR EACH ROW EXECUTE FUNCTION sync_user_geom();
