-- ============================================================
-- BustoSight — Sensitive child-pregnancy classification
-- and DSWD referral tracking
--
-- Run this once in the Supabase SQL editor after the base schema.
-- It is idempotent: missing columns are added, the trigger,
-- function and index are replaced, and the backfill only changes
-- rows that need reclassification.
--
-- Why a database trigger in addition to the app gate?
-- The app enforces the age rule when a record is saved, but the
-- Sensitive Cases page is protected mainly by an app-level password
-- gate. The trigger makes sure that even a direct table write cannot
-- create a contradictory "child + teenage pregnancy" record.
-- ============================================================

-- ------------------------------------------------------------
-- 0. Classification columns required by this migration
--
-- The fresh-install schema already includes these columns, but an
-- older live database may not. They must exist before the trigger,
-- backfill and app queries reference them.
-- ------------------------------------------------------------
ALTER TABLE public.residents
  ADD COLUMN IF NOT EXISTS child_pregnancy_case BOOLEAN NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS teenage_pregnancy_case BOOLEAN NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS current_teenage_mother BOOLEAN NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS age_at_first_birth INTEGER NULL;

-- ------------------------------------------------------------
-- 1. DSWD referral tracking
-- ------------------------------------------------------------
ALTER TABLE public.residents
  ADD COLUMN IF NOT EXISTS dswd_referral_status TEXT NOT NULL DEFAULT 'Pending',
  ADD COLUMN IF NOT EXISTS dswd_referred_at TIMESTAMPTZ NULL,
  ADD COLUMN IF NOT EXISTS dswd_referral_notes TEXT NULL;

-- Normalize legacy/partial values before the check constraint is added.
UPDATE public.residents
SET dswd_referral_status = CASE LOWER(TRIM(dswd_referral_status))
  WHEN 'referred' THEN 'Referred'
  WHEN 'closed' THEN 'Closed'
  ELSE 'Pending'
END
WHERE dswd_referral_status IS NULL
   OR dswd_referral_status NOT IN ('Pending', 'Referred', 'Closed');

ALTER TABLE public.residents
  ALTER COLUMN dswd_referral_status SET DEFAULT 'Pending',
  ALTER COLUMN dswd_referral_status SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'residents_dswd_referral_status_chk'
      AND conrelid = 'public.residents'::regclass
  ) THEN
    ALTER TABLE public.residents
      ADD CONSTRAINT residents_dswd_referral_status_chk
      CHECK (dswd_referral_status IN ('Pending', 'Referred', 'Closed'));
  END IF;
END $$;

COMMENT ON COLUMN public.residents.dswd_referral_status IS
  'Confidential DSWD referral state for a child-pregnancy case: Pending, Referred, or Closed.';
COMMENT ON COLUMN public.residents.dswd_referred_at IS
  'Date/time the child-pregnancy case was referred to DSWD.';
COMMENT ON COLUMN public.residents.dswd_referral_notes IS
  'Confidential DSWD referral notes. Visible only through the Sensitive Cases module.';

-- ------------------------------------------------------------
-- 2. Age helper
--
-- Mirrors the app's policy: use today while encoding the current
-- year, otherwise December 31 of the target data year. If there is
-- no birth date, fall back to the stored age.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.resident_pregnancy_age(
  p_birth_date DATE,
  p_age INTEGER,
  p_data_year INTEGER
)
RETURNS INTEGER
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_reference_date DATE;
BEGIN
  IF p_birth_date IS NULL THEN
    RETURN p_age;
  END IF;

  IF p_data_year IS NULL
     OR p_data_year = EXTRACT(YEAR FROM CURRENT_DATE)::INTEGER THEN
    v_reference_date := CURRENT_DATE;
  ELSE
    v_reference_date := make_date(p_data_year, 12, 31);
  END IF;

  RETURN EXTRACT(YEAR FROM AGE(v_reference_date, p_birth_date))::INTEGER;
EXCEPTION
  WHEN others THEN
    -- Invalid/out-of-range year or date: never let a bad row block a save.
    RETURN p_age;
END;
$$;

-- ------------------------------------------------------------
-- 3. Classification trigger
--
-- Rules:
--   * non-female -> no pregnancy classification at all
--   * reported child flag -> child case, never a teenage case
--   * age at first birth <= 9 -> historical child case
--   * age <= 9 with any pregnancy evidence (teen flag, current
--     teenage-mother flag, or first birth) -> automatic child case
--   * otherwise, a first birth <= 19 -> historical teenage case
--   * current teenage mother only applies to ages 10-19
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.enforce_child_pregnancy_classification()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_is_female BOOLEAN;
  v_age INTEGER;
  v_first_birth INTEGER := COALESCE(NEW.age_at_first_birth, 0);
BEGIN
  v_is_female := LOWER(TRIM(COALESCE(NEW.sex, ''))) IN
    ('female', 'f', 'woman', 'girl');

  v_age := public.resident_pregnancy_age(
    NEW.birth_date,
    NEW.age,
    NEW.data_year
  );

  -- The birth date is authoritative for the stored age.
  IF NEW.birth_date IS NOT NULL AND v_age IS NOT NULL THEN
    NEW.age := v_age;
  END IF;

  NEW.child_pregnancy_case := COALESCE(NEW.child_pregnancy_case, FALSE);
  NEW.teenage_pregnancy_case := COALESCE(NEW.teenage_pregnancy_case, FALSE);
  NEW.current_teenage_mother := COALESCE(NEW.current_teenage_mother, FALSE);

  IF NOT v_is_female THEN
    NEW.child_pregnancy_case := FALSE;
    NEW.teenage_pregnancy_case := FALSE;
    NEW.current_teenage_mother := FALSE;
    RETURN NEW;
  END IF;

  -- A child case is explicit, historical (first birth <= 9 while <= current age),
  -- or automatic because the recorded age is <= 9 and pregnancy evidence exists.
  IF NEW.child_pregnancy_case IS TRUE
     OR (v_first_birth BETWEEN 1 AND 9 AND (v_age IS NULL OR v_first_birth <= v_age))
     OR (
       v_age IS NOT NULL
       AND v_age <= 9
       AND (
         NEW.teenage_pregnancy_case IS TRUE
         OR NEW.current_teenage_mother IS TRUE
         OR (v_first_birth BETWEEN 1 AND v_age)
       )
     )
  THEN
    NEW.child_pregnancy_case := TRUE;
    -- A child case always wins. It must never also be counted as an
    -- official teenage pregnancy or as a current teenage mother, even
    -- after the resident becomes a teenager.
    NEW.teenage_pregnancy_case := FALSE;
    NEW.current_teenage_mother := FALSE;

    RETURN NEW;
  END IF;

  -- Not a child case. Derive the historical teenage-pregnancy flag from
  -- the first-birth age when it is available and valid for the current age.
  IF v_first_birth > 0 AND (v_age IS NULL OR v_first_birth <= v_age) THEN
    NEW.teenage_pregnancy_case := (v_first_birth <= 19);
  ELSIF v_first_birth > 0 AND v_age IS NOT NULL AND v_first_birth > v_age THEN
    NEW.teenage_pregnancy_case := FALSE;
  END IF;

  -- Current teenage mother only applies to females aged 10-19.
  IF v_age IS NULL OR v_age < 10 OR v_age > 19 THEN
    NEW.current_teenage_mother := FALSE;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_child_pregnancy_classification
  ON public.residents;

CREATE TRIGGER trg_enforce_child_pregnancy_classification
  BEFORE INSERT OR UPDATE OF
    birth_date,
    age,
    sex,
    data_year,
    teenage_pregnancy_case,
    current_teenage_mother,
    child_pregnancy_case,
    age_at_first_birth
  ON public.residents
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_child_pregnancy_classification();

-- ------------------------------------------------------------
-- 4. One-time backfill
--
-- This UPDATE deliberately touches child_pregnancy_case on every
-- candidate row so the trigger fires and normalizes the pair of
-- flags. Existing teenage flags on <= 9 records become child cases;
-- existing child flags stay child cases after the resident turns 10.
-- ------------------------------------------------------------
UPDATE public.residents
SET child_pregnancy_case = COALESCE(child_pregnancy_case, FALSE)
WHERE LOWER(TRIM(COALESCE(sex, ''))) IN ('female', 'f', 'woman', 'girl')
  AND (
    child_pregnancy_case IS TRUE
    OR teenage_pregnancy_case IS TRUE
    OR current_teenage_mother IS TRUE
    OR age_at_first_birth IS NOT NULL
  );

-- Male records cannot carry a pregnancy classification. Clear any legacy
-- flags so they cannot appear in official teenage-pregnancy totals.
UPDATE public.residents
SET child_pregnancy_case = FALSE,
    teenage_pregnancy_case = FALSE,
    current_teenage_mother = FALSE
WHERE LOWER(TRIM(COALESCE(sex, ''))) NOT IN ('female', 'f', 'woman', 'girl')
  AND (
    child_pregnancy_case IS TRUE
    OR teenage_pregnancy_case IS TRUE
    OR current_teenage_mother IS TRUE
  );

-- Safety net for any pre-existing contradictory row. A child case must not
-- appear in either the teenage-pregnancy or current-teenage-mother totals.
UPDATE public.residents
SET teenage_pregnancy_case = FALSE,
    current_teenage_mother = FALSE
WHERE child_pregnancy_case IS TRUE
  AND (teenage_pregnancy_case IS TRUE OR current_teenage_mother IS TRUE);

-- ------------------------------------------------------------
-- 5. Query support for the Sensitive Cases page
-- ------------------------------------------------------------
-- Includes archived rows: a child-pregnancy case must remain available in the
-- confidential registry even after the resident record is archived. Drop and
-- recreate so a previous version of this script also gets the corrected
-- predicate.
DROP INDEX IF EXISTS public.idx_residents_sensitive_child_pregnancy;
CREATE INDEX idx_residents_sensitive_child_pregnancy
  ON public.residents (data_year, barangay, dswd_referral_status)
  WHERE child_pregnancy_case IS TRUE;

-- The dashboard's get_dashboard_stats RPC must count only
-- teenage_pregnancy_case = true. After this migration, child cases are
-- forced to teenage_pregnancy_case = false, so they disappear from the
-- official teenage-pregnancy charts without exposing their details.
