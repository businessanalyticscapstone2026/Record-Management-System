-- Add a dedicated remarks field for registered senior citizen profiles.
ALTER TABLE public.applications
ADD COLUMN IF NOT EXISTS remarks TEXT;

-- Preserve the meaning of existing membership values when migrating.
-- Completed applications previously marked Active become Registered.
-- Existing Deceased records remain Deceased.
UPDATE public.applications
SET remarks = CASE
  WHEN LOWER(TRIM(COALESCE(membership_status, ''))) = 'deceased' THEN 'Deceased'
  WHEN LOWER(TRIM(COALESCE(membership_status, ''))) = 'active' THEN 'Registered'
  ELSE remarks
END
WHERE remarks IS NULL
  AND membership_status IS NOT NULL;

-- Ensure previously completed profiles with no legacy membership value
-- still have a meaningful default remark.
UPDATE public.applications AS a
SET remarks = 'Registered'
WHERE a.remarks IS NULL
  AND EXISTS (
    SELECT 1
    FROM public.application_status_history AS h
    WHERE h.application_id = a.application_id
      AND h.status = 'Completed'
  );
