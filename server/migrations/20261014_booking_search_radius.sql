-- Keep the customer's selected radius for subsequent address/travel checks.
-- Preserve the full submitted coordinate precision across payment/address checks.
-- PostgreSQL prevents a type change while an UPDATE OF trigger names that
-- column. Preserve its exact definition and enablement state in this transaction.
DO $$
DECLARE definitions jsonb; item jsonb;
BEGIN
  SELECT COALESCE(jsonb_agg(jsonb_build_object('table',t.tgrelid::regclass::text,
    'name',t.tgname,'definition',pg_get_triggerdef(t.oid),'enabled',t.tgenabled)), '[]'::jsonb)
    INTO definitions FROM pg_trigger t
    WHERE t.tgrelid IN ('public.users'::regclass,'public.bookings'::regclass) AND NOT t.tgisinternal
      AND EXISTS (SELECT 1 FROM pg_attribute a WHERE a.attrelid=t.tgrelid
        AND a.attnum=ANY(t.tgattr::smallint[]) AND a.attname IN ('lat','lng','latitude','longitude'));
  FOR item IN SELECT value FROM jsonb_array_elements(definitions) LOOP
    EXECUTE format('DROP TRIGGER %I ON %s',item->>'name',item->>'table');
  END LOOP;
  ALTER TABLE public.users ALTER COLUMN lat TYPE double precision, ALTER COLUMN lng TYPE double precision;
  ALTER TABLE public.bookings ALTER COLUMN latitude TYPE double precision, ALTER COLUMN longitude TYPE double precision;
  FOR item IN SELECT value FROM jsonb_array_elements(definitions) LOOP
    EXECUTE item->>'definition';
    IF item->>'enabled' <> 'O' THEN
      EXECUTE format('ALTER TABLE %s %s TRIGGER %I',item->>'table',
        CASE item->>'enabled' WHEN 'D' THEN 'DISABLE' WHEN 'R' THEN 'ENABLE REPLICA' ELSE 'ENABLE ALWAYS' END,item->>'name');
    END IF;
  END LOOP;
END $$;
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS search_radius_km double precision NOT NULL DEFAULT 50;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='bookings_search_radius_valid' AND conrelid='public.bookings'::regclass) THEN
    ALTER TABLE public.bookings ADD CONSTRAINT bookings_search_radius_valid CHECK (search_radius_km BETWEEN 1 AND 500);
  END IF;
END $$;
