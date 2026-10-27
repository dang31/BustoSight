-- ============================================================
-- BustoSight - Resident Program/Seminar Attendance Schema
-- ============================================================
-- Run this in the Supabase SQL Editor to add the "Services/Program
-- Attended" field to the residents table. Safe to re-run: every
-- statement below is idempotent.
--
-- This mirrors the column declared inline in database_schema.sql
-- (Section 3), so a fresh install gets the same shape.

-- 1. Add the attended_items column
--    Existing rows backfill to an empty array via the DEFAULT.
ALTER TABLE public.residents
    ADD COLUMN IF NOT EXISTS attended_items JSONB NOT NULL DEFAULT '[]'::jsonb;

-- 2. Guard against a non-array value being written by another client.
--    DO block so the constraint is only added when it is missing.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'residents_attended_items_is_array_chk'
          AND conrelid = 'public.residents'::regclass
    ) THEN
        ALTER TABLE public.residents
            ADD CONSTRAINT residents_attended_items_is_array_chk
            CHECK (jsonb_typeof(attended_items) = 'array');
    END IF;
END
$$;

-- 3. GIN index so Reports can do containment lookups, e.g.
--    WHERE attended_items @> '[{"kind":"program","id":"<uuid>"}]'::jsonb
CREATE INDEX IF NOT EXISTS idx_residents_attended_items
    ON public.residents USING GIN (attended_items);


-- ============================================================
-- STORED SHAPE
-- ============================================================
-- attended_items is a JSONB array of typed entries:
--
--   [
--     { "kind": "program", "id": "<uuid>", "name": "Family Planning" },
--     { "kind": "seminar", "id": "<uuid>",
--       "program_id": "<uuid>", "name": "Nutrition Seminar" }
--   ]
--
-- "kind" disambiguates program vs seminar uuids because JSONB cannot be
-- joined to the programs/seminars tables, so the type of each uuid would
-- otherwise be unknowable. "name" is denormalized so reports stay readable
-- after a program is renamed or archived.
--
-- Note: JSONB cannot enforce referential integrity. If a program or seminar
-- is hard-deleted, previously stored uuids will dangle. Programs and
-- seminars are soft-archived (is_archived) rather than deleted, so this is
-- mitigated in practice. Archived programs are filtered out of the
-- AddResident dropdown by src/lib/attendance.js.