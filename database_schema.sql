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
    is_voter TEXT,
    barangay TEXT NOT NULL,
    is_archived BOOLEAN DEFAULT FALSE,
    archive_date TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable Row Level Security (RLS)
ALTER TABLE residents ENABLE ROW LEVEL SECURITY;

-- Create policies (Example: Allow authenticated users to do everything)
CREATE POLICY "Allow all actions for authenticated users" 
ON residents FOR ALL 
USING (auth.role() = 'authenticated');

-- Example: Allow public read access (if needed)
-- CREATE POLICY "Allow public read access" ON residents FOR SELECT USING (true);
