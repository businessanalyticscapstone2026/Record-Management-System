-- Store the alternative face-comparison pathway and its mandatory staff-review state.
ALTER TABLE public.face_verifications
  ADD COLUMN IF NOT EXISTS initial_verified BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS alternative_verified BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS alternative_similarity NUMERIC(6,4),
  ADD COLUMN IF NOT EXISTS verification_path TEXT NOT NULL DEFAULT 'valid_id',
  ADD COLUMN IF NOT EXISTS requires_additional_review BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS staff_review_status TEXT NOT NULL DEFAULT 'not_required',
  ADD COLUMN IF NOT EXISTS staff_reviewed_by TEXT,
  ADD COLUMN IF NOT EXISTS staff_reviewed_at TIMESTAMPTZ;

ALTER TABLE public.face_verifications
  DROP CONSTRAINT IF EXISTS face_verifications_staff_review_status_check;

ALTER TABLE public.face_verifications
  ADD CONSTRAINT face_verifications_staff_review_status_check
  CHECK (staff_review_status IN ('pending', 'confirmed', 'rejected', 'not_required'));

CREATE INDEX IF NOT EXISTS idx_face_verifications_additional_review
  ON public.face_verifications (requires_additional_review, staff_review_status);
