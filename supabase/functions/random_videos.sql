-- Supabase SQL Editor で実行するランダム動画取得用の関数
-- これによりデータベース側で効率的にランダム選択が可能になります

-- 1. 特定ジャンルを除外してランダムに動画を取得する関数
CREATE OR REPLACE FUNCTION get_random_videos_exclude_genres(
  p_limit INT DEFAULT 200,
  p_exclude_genres UUID[] DEFAULT '{}'
)
RETURNS TABLE (
  id UUID,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  content_id TEXT,
  title TEXT,
  description TEXT,
  thumbnail_url TEXT,
  sample_video_url TEXT,
  actresses_ids UUID[],
  genre_ids UUID[],
  is_active BOOLEAN,
  duration INT,
  release_date DATE,
  likes_count INT,
  series_id UUID,
  maker_id UUID,
  label_id UUID,
  director_id UUID
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT v.*
  FROM videos v
  WHERE v.is_active = true
    AND v.thumbnail_url IS NOT NULL
    AND v.sample_video_url IS NOT NULL
    AND NOT (v.genre_ids && p_exclude_genres)  -- 指定ジャンルを含まない
  ORDER BY RANDOM()
  LIMIT p_limit;
END;
$$;

-- 2. 特定ジャンルを含む動画をランダムに取得する関数
CREATE OR REPLACE FUNCTION get_random_videos_include_genres(
  p_limit INT DEFAULT 200,
  p_include_genres UUID[] DEFAULT '{}'
)
RETURNS TABLE (
  id UUID,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  content_id TEXT,
  title TEXT,
  description TEXT,
  thumbnail_url TEXT,
  sample_video_url TEXT,
  actresses_ids UUID[],
  genre_ids UUID[],
  is_active BOOLEAN,
  duration INT,
  release_date DATE,
  likes_count INT,
  series_id UUID,
  maker_id UUID,
  label_id UUID,
  director_id UUID
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT v.*
  FROM videos v
  WHERE v.is_active = true
    AND v.thumbnail_url IS NOT NULL
    AND v.sample_video_url IS NOT NULL
    AND (v.genre_ids && p_include_genres)  -- 指定ジャンルを含む
  ORDER BY RANDOM()
  LIMIT p_limit;
END;
$$;

-- 3. すべての動画からランダムに取得する関数（汎用）
CREATE OR REPLACE FUNCTION get_random_videos_all(
  p_limit INT DEFAULT 200
)
RETURNS TABLE (
  id UUID,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  content_id TEXT,
  title TEXT,
  description TEXT,
  thumbnail_url TEXT,
  sample_video_url TEXT,
  actresses_ids UUID[],
  genre_ids UUID[],
  is_active BOOLEAN,
  duration INT,
  release_date DATE,
  likes_count INT,
  series_id UUID,
  maker_id UUID,
  label_id UUID,
  director_id UUID
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT v.*
  FROM videos v
  WHERE v.is_active = true
    AND v.thumbnail_url IS NOT NULL
    AND v.sample_video_url IS NOT NULL
  ORDER BY RANDOM()
  LIMIT p_limit;
END;
$$;

-- 使用例:
-- SELECT * FROM get_random_videos_exclude_genres(200, ARRAY['genre-uuid-1', 'genre-uuid-2']::UUID[]);
-- SELECT * FROM get_random_videos_include_genres(200, ARRAY['genre-uuid-1']::UUID[]);
-- SELECT * FROM get_random_videos_all(200);