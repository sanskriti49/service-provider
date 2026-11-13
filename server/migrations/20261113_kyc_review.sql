-- Additive only: existing KYC documents and statuses are preserved.
ALTER TABLE public.providers ADD COLUMN IF NOT EXISTS kyc_version integer NOT NULL DEFAULT 0;
ALTER TABLE public.providers ADD COLUMN IF NOT EXISTS kyc_reviewed_by uuid REFERENCES public.users(id) ON DELETE SET NULL;
ALTER TABLE public.providers ADD COLUMN IF NOT EXISTS kyc_reviewed_at timestamptz;
ALTER TABLE public.providers ADD COLUMN IF NOT EXISTS kyc_rejection_reason text;
CREATE TABLE IF NOT EXISTS public.kyc_review_events (
  id bigserial PRIMARY KEY,
  provider_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  submission_version integer NOT NULL,
  reviewer_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  decision varchar(16) NOT NULL CHECK (decision IN ('verified', 'rejected')),
  reason text,
  reviewed_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(provider_id, submission_version)
);
