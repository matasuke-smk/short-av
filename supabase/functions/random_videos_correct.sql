-- Supabase SQL Editor で実行するランダム動画取得用の関数
-- videosテーブルの実際の構造に合わせた正しい実装

-- 1. 特定ジャンルを除外してランダムに動画を取得する関数
CREATE OR REPLACE FUNCTION get_random_videos_exclude_genres(
  p_limit INT DEFAULT 200,
  p_exclude_genres UUID[] DEFAULT '{}'
)
RETURNS TABLE (
  id UUID,
  dmm_content_id VARCHAR(100),
  title TEXT,
  description TEXT,
  thumbnail_url TEXT,
  sample_video_url TEXT,
  dmm_product_url TEXT,
  price INT,
  release_date DATE,
  duration INT,
  maker VARCHAR(255),
  label VARCHAR(255),
  series VARCHAR(255),
  genre_ids UUID[],
  actress_ids UUID[],
  view_count INT,
  click_count INT,
  rank_position INT,
  is_active BOOLEAN,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  likes_count INT
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
  dmm_content_id VARCHAR(100),
  title TEXT,
  description TEXT,
  thumbnail_url TEXT,
  sample_video_url TEXT,
  dmm_product_url TEXT,
  price INT,
  release_date DATE,
  duration INT,
  maker VARCHAR(255),
  label VARCHAR(255),
  series VARCHAR(255),
  genre_ids UUID[],
  actress_ids UUID[],
  view_count INT,
  click_count INT,
  rank_position INT,
  is_active BOOLEAN,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  likes_count INT
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
  dmm_content_id VARCHAR(100),
  title TEXT,
  description TEXT,
  thumbnail_url TEXT,
  sample_video_url TEXT,
  dmm_product_url TEXT,
  price INT,
  release_date DATE,
  duration INT,
  maker VARCHAR(255),
  label VARCHAR(255),
  series VARCHAR(255),
  genre_ids UUID[],
  actress_ids UUID[],
  view_count INT,
  click_count INT,
  rank_position INT,
  is_active BOOLEAN,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  likes_count INT
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

-- 動作確認用のテストクエリ
-- SELECT COUNT(*) FROM get_random_videos_all(10);
-- SELECT title FROM get_random_videos_all(5) LIMIT 5;