-- 検索の「サンプル動画が長い作品のみ（2分以上）」用
-- サンプル動画の長さ（秒）を保存する列を追加し、選択肢の件数を数える関数でも長さで絞れるようにする。
-- 長さは毎日の自動更新（/api/cron/update-videos）が少しずつ調べて入れる。調べられなかった作品は -1。
-- 先にこの SQL を実行してから、アプリをデプロイすること（列がないと自動更新と検索がエラーになる）。

ALTER TABLE public.videos ADD COLUMN IF NOT EXISTS sample_seconds INTEGER;

CREATE INDEX IF NOT EXISTS videos_sample_seconds_idx ON public.videos (sample_seconds);

-- 引数が増えるため、古い関数は消してから作り直す（同じ名前で引数違いの関数が2つ残らないように）
DROP FUNCTION IF EXISTS public.get_search_facets(TEXT, TEXT[]);

CREATE OR REPLACE FUNCTION public.get_search_facets(
  p_kind TEXT,
  p_selected TEXT[] DEFAULT '{}',
  p_min_sample_seconds INTEGER DEFAULT 0
)
RETURNS JSONB
LANGUAGE sql
STABLE
AS $$
  WITH target AS (
    SELECT CASE WHEN p_kind = 'actress' THEN v.actress_ids ELSE v.genre_ids END::TEXT[] AS ids
    FROM public.videos v
    WHERE v.is_active = true
      AND v.thumbnail_url IS NOT NULL
      AND v.sample_video_url IS NOT NULL
      AND (COALESCE(p_min_sample_seconds, 0) <= 0 OR v.sample_seconds >= p_min_sample_seconds)
  )
  SELECT COALESCE(jsonb_object_agg(f.id, f.cnt), '{}'::JSONB)
  FROM (
    SELECT u.id, count(*) AS cnt
    FROM target t
    CROSS JOIN LATERAL unnest(t.ids) AS u(id)
    WHERE t.ids @> COALESCE(p_selected, '{}')
    GROUP BY u.id
  ) f;
$$;

GRANT EXECUTE ON FUNCTION public.get_search_facets(TEXT, TEXT[], INTEGER) TO anon, authenticated;
