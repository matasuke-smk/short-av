-- Supabase SQL Editor で実行するランダム動画取得用の関数（簡易版）
-- videosテーブルの構造に依存しない汎用的な実装

-- 1. 特定ジャンルを除外してランダムに動画を取得する関数
CREATE OR REPLACE FUNCTION get_random_videos_exclude_genres(
  p_limit INT DEFAULT 200,
  p_exclude_genres UUID[] DEFAULT '{}'
)
RETURNS SETOF videos
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT *
  FROM videos
  WHERE is_active = true
    AND thumbnail_url IS NOT NULL
    AND sample_video_url IS NOT NULL
    AND NOT (genre_ids && p_exclude_genres)  -- 指定ジャンルを含まない
  ORDER BY RANDOM()
  LIMIT p_limit;
END;
$$;

-- 2. 特定ジャンルを含む動画をランダムに取得する関数
CREATE OR REPLACE FUNCTION get_random_videos_include_genres(
  p_limit INT DEFAULT 200,
  p_include_genres UUID[] DEFAULT '{}'
)
RETURNS SETOF videos
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT *
  FROM videos
  WHERE is_active = true
    AND thumbnail_url IS NOT NULL
    AND sample_video_url IS NOT NULL
    AND (genre_ids && p_include_genres)  -- 指定ジャンルを含む
  ORDER BY RANDOM()
  LIMIT p_limit;
END;
$$;

-- 3. すべての動画からランダムに取得する関数（汎用）
CREATE OR REPLACE FUNCTION get_random_videos_all(
  p_limit INT DEFAULT 200
)
RETURNS SETOF videos
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT *
  FROM videos
  WHERE is_active = true
    AND thumbnail_url IS NOT NULL
    AND sample_video_url IS NOT NULL
  ORDER BY RANDOM()
  LIMIT p_limit;
END;
$$;

-- 動作確認用のテストクエリ
-- SELECT COUNT(*) FROM get_random_videos_all(10);
-- SELECT title FROM get_random_videos_all(5);