-- Run in the Supabase SQL Editor before using the disability field.
-- Existing PWD records remain valid; registration/editing requires a
-- description when those records are next saved through the resident form.
ALTER TABLE public.residents
    ADD COLUMN IF NOT EXISTS disability_details TEXT NULL;
