-- Add created_at column to likes table for period-based ranking
ALTER TABLE likes
ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Create index for faster period-based queries
CREATE INDEX IF NOT EXISTS idx_likes_created_at ON likes(created_at DESC);

-- Create index for video_id + created_at for ranking queries
CREATE INDEX IF NOT EXISTS idx_likes_video_id_created_at ON likes(video_id, created_at DESC);

-- Backfill existing data with current timestamp
UPDATE likes SET created_at = NOW() WHERE created_at IS NULL;

-- Make created_at NOT NULL after backfill
ALTER TABLE likes ALTER COLUMN created_at SET NOT NULL;
