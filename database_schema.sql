-- Create Residents Table
CREATE TABLE residents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    h_no TEXT NOT NULL,
    last_name TEXT NOT NULL,
    first_name TEXT NOT NULL,
    middle_name TEXT,
    qualifier TEXT,
    house_no TEXT,
    street TEXT,
    purok TEXT,
    birth_place TEXT,
    birth_date DATE,
    sex TEXT,
    civil_status TEXT,
    citizenship TEXT DEFAULT 'FILIPINO',
    occupation TEXT,
    relation_to_head TEXT,
    age INTEGER,
    residence_type TEXT,
    is_household_head BOOLEAN DEFAULT FALSE,
    religion TEXT,
    educational_attainment TEXT,
    is_pwd BOOLEAN DEFAULT FALSE,
    has_pwd_id BOOLEAN DEFAULT FALSE,
    is_senior BOOLEAN DEFAULT FALSE,
    has_senior_id BOOLEAN DEFAULT FALSE,
    is_solo_parent BOOLEAN DEFAULT FALSE,
    has_solo_parent_id BOOLEAN DEFAULT FALSE,
    age_at_first_birth INTEGER,
    teenage_pregnancy_case BOOLEAN DEFAULT FALSE,
    current_teenage_mother BOOLEAN DEFAULT FALSE,
    is_4ps BOOLEAN DEFAULT FALSE,
    is_voter TEXT,
    barangay TEXT NOT NULL,
    data_year INTEGER DEFAULT EXTRACT(YEAR FROM CURRENT_DATE),
    is_archived BOOLEAN DEFAULT FALSE,
    archive_date TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable Row Level Security (RLS)
ALTER TABLE residents ENABLE ROW LEVEL SECURITY;

-- Create policies (Allow all actions for both anon and authenticated users)
CREATE POLICY "Allow all actions for all roles" 
ON residents FOR ALL 
USING (true)
WITH CHECK (true);

-- Function and Trigger to prevent duplicate resident records in the same year
CREATE OR REPLACE FUNCTION check_duplicate_resident()
RETURNS TRIGGER AS $$
DECLARE
    existing_rec RECORD;
BEGIN
    SELECT is_archived INTO existing_rec
    FROM public.residents
    WHERE
        LOWER(TRIM(last_name)) = LOWER(TRIM(NEW.last_name)) AND
        LOWER(TRIM(first_name)) = LOWER(TRIM(NEW.first_name)) AND
        LOWER(TRIM(COALESCE(middle_name, ''))) = LOWER(TRIM(COALESCE(NEW.middle_name, ''))) AND
        birth_date IS NOT DISTINCT FROM NEW.birth_date AND
        LOWER(TRIM(barangay)) = LOWER(TRIM(NEW.barangay)) AND
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

CREATE TRIGGER trigger_check_duplicate_resident
BEFORE INSERT OR UPDATE ON residents
FOR EACH ROW
EXECUTE FUNCTION check_duplicate_resident();


