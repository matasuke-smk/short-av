-- Size statistics table for anonymous data collection (erect only)
CREATE TABLE IF NOT EXISTS size_statistics (
  id BIGSERIAL PRIMARY KEY,
  length_mm INTEGER NOT NULL CHECK (length_mm >= 60 AND length_mm <= 220),
  diameter_mm INTEGER NOT NULL CHECK (diameter_mm >= 22 AND diameter_mm <= 55),
  erection_state VARCHAR(10) NOT NULL CHECK (erection_state IN ('erect', 'flaccid')),
  age_group VARCHAR(10) CHECK (age_group IN ('20s', '30s', '40s', '50s', '')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_size_statistics_erection_state ON size_statistics(erection_state);
CREATE INDEX IF NOT EXISTS idx_size_statistics_age_group ON size_statistics(age_group);
CREATE INDEX IF NOT EXISTS idx_size_statistics_created_at ON size_statistics(created_at);

-- Enable Row Level Security
ALTER TABLE size_statistics ENABLE ROW LEVEL SECURITY;

-- Allow anyone to insert (anonymous data collection)
CREATE POLICY "Allow anonymous insert" ON size_statistics
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- Allow authenticated users to read (for admin dashboard)
CREATE POLICY "Allow authenticated read" ON size_statistics
  FOR SELECT
  TO authenticated
  USING (true);

-- Grant necessary permissions
GRANT INSERT ON size_statistics TO anon;
GRANT INSERT ON size_statistics TO authenticated;
GRANT SELECT ON size_statistics TO authenticated;

-- Comments for documentation
COMMENT ON TABLE size_statistics IS 'Anonymous penis size statistics collected from users';
COMMENT ON COLUMN size_statistics.length_mm IS 'Length in millimeters (50-250mm)';
COMMENT ON COLUMN size_statistics.diameter_mm IS 'Diameter in millimeters (20-60mm)';
COMMENT ON COLUMN size_statistics.erection_state IS 'State during measurement: erect or flaccid';
COMMENT ON COLUMN size_statistics.age_group IS 'Optional age group: 20s, 30s, 40s, 50s';
