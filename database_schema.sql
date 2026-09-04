-- ============================================================
-- BustoSight - Complete Database Schema
-- Run this entire file in Supabase SQL Editor (in order)
-- to set up a fresh project from scratch.
-- ============================================================


-- ============================================================
-- SECTION 1: PROFILES TABLE
-- Stores user account info linked to Supabase Auth users.
-- Must be created BEFORE admin_action_logs (which references it).
-- ============================================================

CREATE TABLE public.profiles (
    id UUID NOT NULL,
    employee_id TEXT NULL,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    email TEXT NULL,
    username TEXT NOT NULL,
    role TEXT NULL DEFAULT 'Staff'::text,
    status TEXT NULL DEFAULT 'Active'::text,
    archived BOOLEAN NULL DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE NULL DEFAULT timezone('utc'::text, NOW()),
    updated_at TIMESTAMP WITH TIME ZONE NULL,
    must_change_password BOOLEAN NULL DEFAULT FALSE,
    CONSTRAINT profiles_pkey PRIMARY KEY (id),
    CONSTRAINT profiles_email_key UNIQUE (email),
    CONSTRAINT profiles_employee_id_key UNIQUE (employee_id),
    CONSTRAINT profiles_username_key UNIQUE (username),
    CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE
) TABLESPACE pg_default;

-- Enable Row Level Security (RLS)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view own profile"
ON public.profiles FOR SELECT
USING (auth.uid() = id);

CREATE POLICY "Admins can view all profiles"
ON public.profiles FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = auth.uid()
          AND p.role = 'Admin'
          AND p.archived = FALSE
    )
);

-- --------------------------------------------------------
-- Trigger: Auto-insert a profiles row when a new Auth user
-- signs up via supabase.auth.signUp(). This is required
-- because ManageAccounts.jsx relies on the trigger to
-- populate profiles after authClient.auth.signUp().
-- --------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (
        id,
        email,
        first_name,
        last_name,
        username,
        role,
        employee_id
    )
    VALUES (
        NEW.id,
        NEW.email,
        -- COALESCE fallbacks prevent NOT NULL violations when creating
        -- users via the Supabase dashboard (which sends no metadata).
        COALESCE(NEW.raw_user_meta_data->>'first_name', ''),
        COALESCE(NEW.raw_user_meta_data->>'last_name', ''),
        COALESCE(NEW.raw_user_meta_data->>'username', split_part(NEW.email, '@', 1)),
        COALESCE(NEW.raw_user_meta_data->>'role', 'Staff'),
        NEW.raw_user_meta_data->>'employee_id'
    )
    ON CONFLICT (id) DO NOTHING;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();


-- ============================================================
-- SECTION 2: ADMIN ACTION LOGS TABLE
-- Audit log for sensitive admin actions (e.g. password resets).
-- References profiles(id), so profiles must exist first.
-- ============================================================

CREATE TABLE public.admin_action_logs (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    actor_id UUID NULL,
    action TEXT NOT NULL,
    target_id UUID NULL,
    created_at TIMESTAMP WITH TIME ZONE NULL DEFAULT timezone('utc'::text, NOW()),
    CONSTRAINT admin_action_logs_pkey PRIMARY KEY (id),
    CONSTRAINT admin_action_logs_actor_id_fkey FOREIGN KEY (actor_id) REFERENCES profiles(id),
    CONSTRAINT admin_action_logs_target_id_fkey FOREIGN KEY (target_id) REFERENCES profiles(id)
) TABLESPACE pg_default;


-- ============================================================
-- SECTION 3: RESIDENTS TABLE
-- Stores barangay resident census records.
-- ============================================================

CREATE TABLE public.residents (
    id UUID NOT NULL DEFAULT extensions.uuid_generate_v4(),
    h_no TEXT NOT NULL,
    last_name TEXT NOT NULL,
    first_name TEXT NOT NULL,
    middle_name TEXT NULL,
    qualifier TEXT NULL,
    house_no TEXT NULL,
    street TEXT NULL,
    purok TEXT NULL,
    birth_place TEXT NULL,
    birth_date DATE NULL,
    sex TEXT NULL,
    civil_status TEXT NULL,
    citizenship TEXT NULL DEFAULT 'FILIPINO'::text,
    occupation TEXT NULL,
    relation_to_head TEXT NULL,
    age INTEGER NULL,
    residence_type TEXT NULL,
    is_household_head BOOLEAN NULL DEFAULT FALSE,
    religion TEXT NULL,
    educational_attainment TEXT NULL,
    is_pwd BOOLEAN NULL DEFAULT FALSE,
    has_pwd_id BOOLEAN NULL DEFAULT FALSE,
    is_senior BOOLEAN NULL DEFAULT FALSE,
    has_senior_id BOOLEAN NULL DEFAULT FALSE,
    is_solo_parent BOOLEAN NULL DEFAULT FALSE,
    has_solo_parent_id BOOLEAN NULL DEFAULT FALSE,
    age_at_first_birth INTEGER NULL,
    teenage_pregnancy_case BOOLEAN NULL DEFAULT FALSE,
    current_teenage_mother BOOLEAN NULL DEFAULT FALSE,
    is_4ps BOOLEAN NULL DEFAULT FALSE,
    is_voter TEXT NULL,
    barangay TEXT NOT NULL,
    is_archived BOOLEAN NULL DEFAULT FALSE,
    archive_date TIMESTAMP WITH TIME ZONE NULL,
    created_at TIMESTAMP WITH TIME ZONE NULL DEFAULT NOW(),
    data_year INTEGER NULL,
    CONSTRAINT residents_pkey PRIMARY KEY (id)
) TABLESPACE pg_default;

-- Enable Row Level Security (RLS)
ALTER TABLE public.residents ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Allow all actions for both anon and authenticated users
CREATE POLICY "Allow all actions for all roles"
ON public.residents FOR ALL
USING (true)
WITH CHECK (true);

-- --------------------------------------------------------
-- Function: Prevent duplicate resident records
-- in the same barangay and data year.
-- --------------------------------------------------------
CREATE OR REPLACE FUNCTION public.check_duplicate_resident()
RETURNS TRIGGER AS $$
DECLARE
    existing_rec RECORD;
BEGIN
    SELECT is_archived INTO existing_rec
    FROM public.residents
    WHERE
        LOWER(TRIM(last_name))                          = LOWER(TRIM(NEW.last_name)) AND
        LOWER(TRIM(first_name))                         = LOWER(TRIM(NEW.first_name)) AND
        LOWER(TRIM(COALESCE(middle_name, '')))          = LOWER(TRIM(COALESCE(NEW.middle_name, ''))) AND
        birth_date IS NOT DISTINCT FROM NEW.birth_date AND
        LOWER(TRIM(barangay))                           = LOWER(TRIM(NEW.barangay)) AND
        data_year IS NOT DISTINCT FROM NEW.data_year
    LIMIT 1;

    IF FOUND THEN
        IF existing_rec.is_archived THEN
            RAISE EXCEPTION 'This resident already exists in the system (archived record).';
        ELSE
            RAISE EXCEPTION 'This resident already exists in the system.';
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger: fires on INSERT only (matches live DB definition)
CREATE TRIGGER trg_prevent_duplicate_resident
    BEFORE INSERT ON public.residents
    FOR EACH ROW EXECUTE FUNCTION public.check_duplicate_resident();


-- ============================================================
-- DONE. Summary of what was created:
--
--  Tables:
--    - public.profiles           (user accounts, linked to auth.users)
--    - public.admin_action_logs  (audit log for admin actions)
--    - public.residents          (barangay census data)
--
--  Triggers & Functions:
--    - on_auth_user_created      -> handle_new_user()
--      Fires on auth.users INSERT. Auto-populates profiles row.
--    - trigger_check_duplicate_resident -> check_duplicate_resident()
--      Fires on residents INSERT ONLY. Blocks duplicate entries.
--      Trigger name: trg_prevent_duplicate_resident
--
--  RLS Policies:
--    - profiles: "Users can view own profile"
--    - profiles: "Admins can view all profiles"
--    - residents: "Allow all actions for all roles"
--
--  After running this, set Edge Function secrets:
--    supabase secrets set SERVICE_ROLE_KEY=<your-new-service-role-key>
-- ============================================================


