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

