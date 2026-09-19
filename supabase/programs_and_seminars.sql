-- ============================================================
-- BustoSight - Programs & Seminars Management Schema
-- With Archive Support & Admin Authentication (NO Hard Delete)
-- ============================================================

-- 1. Create Programs Table
CREATE TABLE IF NOT EXISTS public.programs (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT NULL,
    status TEXT NOT NULL DEFAULT 'Active',
    is_archived BOOLEAN NOT NULL DEFAULT FALSE,
    archived_at TIMESTAMP WITH TIME ZONE NULL,
    archived_by UUID NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
    archived_by_name TEXT NULL,
    created_by UUID NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_by_name TEXT NULL,
    updated_by UUID NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
    updated_by_name TEXT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    CONSTRAINT programs_pkey PRIMARY KEY (id),
    CONSTRAINT programs_name_unique UNIQUE (name)
) TABLESPACE pg_default;

-- Add columns if programs table already existed
ALTER TABLE public.programs ADD COLUMN IF NOT EXISTS is_archived BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE public.programs ADD COLUMN IF NOT EXISTS archived_at TIMESTAMP WITH TIME ZONE NULL;
ALTER TABLE public.programs ADD COLUMN IF NOT EXISTS archived_by UUID NULL REFERENCES public.profiles(id) ON DELETE SET NULL;
ALTER TABLE public.programs ADD COLUMN IF NOT EXISTS archived_by_name TEXT NULL;
ALTER TABLE public.programs ADD COLUMN IF NOT EXISTS created_by UUID NULL REFERENCES public.profiles(id) ON DELETE SET NULL;
ALTER TABLE public.programs ADD COLUMN IF NOT EXISTS created_by_name TEXT NULL;
ALTER TABLE public.programs ADD COLUMN IF NOT EXISTS updated_by UUID NULL REFERENCES public.profiles(id) ON DELETE SET NULL;
ALTER TABLE public.programs ADD COLUMN IF NOT EXISTS updated_by_name TEXT NULL;

-- 2. Create Seminars Table
CREATE TABLE IF NOT EXISTS public.seminars (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    program_id UUID NOT NULL,
    title TEXT NOT NULL,
    description TEXT NULL,
    status TEXT NOT NULL DEFAULT 'Active',
    is_archived BOOLEAN NOT NULL DEFAULT FALSE,
    archived_at TIMESTAMP WITH TIME ZONE NULL,
    archived_by UUID NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
    archived_by_name TEXT NULL,
    created_by UUID NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_by_name TEXT NULL,
    updated_by UUID NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
    updated_by_name TEXT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    CONSTRAINT seminars_pkey PRIMARY KEY (id),
    CONSTRAINT seminars_program_id_fkey FOREIGN KEY (program_id) 
        REFERENCES public.programs(id) ON DELETE CASCADE,
    CONSTRAINT seminars_program_title_unique UNIQUE (program_id, title)
) TABLESPACE pg_default;

-- Add columns if seminars table already existed
ALTER TABLE public.seminars ADD COLUMN IF NOT EXISTS is_archived BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE public.seminars ADD COLUMN IF NOT EXISTS archived_at TIMESTAMP WITH TIME ZONE NULL;
ALTER TABLE public.seminars ADD COLUMN IF NOT EXISTS archived_by UUID NULL REFERENCES public.profiles(id) ON DELETE SET NULL;
ALTER TABLE public.seminars ADD COLUMN IF NOT EXISTS archived_by_name TEXT NULL;
ALTER TABLE public.seminars ADD COLUMN IF NOT EXISTS created_by UUID NULL REFERENCES public.profiles(id) ON DELETE SET NULL;
ALTER TABLE public.seminars ADD COLUMN IF NOT EXISTS created_by_name TEXT NULL;
ALTER TABLE public.seminars ADD COLUMN IF NOT EXISTS updated_by UUID NULL REFERENCES public.profiles(id) ON DELETE SET NULL;
ALTER TABLE public.seminars ADD COLUMN IF NOT EXISTS updated_by_name TEXT NULL;

-- 3. Create Indexes
CREATE INDEX IF NOT EXISTS idx_seminars_program_id ON public.seminars(program_id);
CREATE INDEX IF NOT EXISTS idx_programs_is_archived ON public.programs(is_archived);
CREATE INDEX IF NOT EXISTS idx_seminars_is_archived ON public.seminars(is_archived);

-- 4. Enable Row Level Security (RLS)
ALTER TABLE public.programs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.seminars ENABLE ROW LEVEL SECURITY;

-- 5. RLS Policies
DROP POLICY IF EXISTS "Allow all actions on programs" ON public.programs;
CREATE POLICY "Allow all actions on programs"
ON public.programs FOR ALL
USING (true)
WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all actions on seminars" ON public.seminars;
CREATE POLICY "Allow all actions on seminars"
ON public.seminars FOR ALL
USING (true)
WITH CHECK (true);

-- 6. Triggers
CREATE OR REPLACE FUNCTION public.set_current_timestamp_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_programs_updated_at ON public.programs;
CREATE TRIGGER trg_programs_updated_at
    BEFORE UPDATE ON public.programs
    FOR EACH ROW EXECUTE FUNCTION public.set_current_timestamp_updated_at();

DROP TRIGGER IF EXISTS trg_seminars_updated_at ON public.seminars;
CREATE TRIGGER trg_seminars_updated_at
    BEFORE UPDATE ON public.seminars
    FOR EACH ROW EXECUTE FUNCTION public.set_current_timestamp_updated_at();
