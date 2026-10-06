-- 検索モーダルの「選べるジャンル/女優」と各件数を DB 側で集計する
-- 以前はブラウザが全動画の genre_ids / actress_ids を取得して数えていたが、
-- PostgREST の 1000 行上限で途中から切れ、動画が増えるほど転送量も増えていた。
--
-- p_kind: 'genre' または 'actress'
-- p_selected: 選択中の ID（すべて含む動画だけを対象にする。空なら全動画）
-- 戻り値: { "<id>": 件数, ... } の JSON 1 行（行数上限にかからないよう 1 行にまとめる）

CREATE OR REPLACE FUNCTION public.get_search_facets(
  p_kind TEXT,
  p_selected TEXT[] DEFAULT '{}'
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

GRANT EXECUTE ON FUNCTION public.get_search_facets(TEXT, TEXT[]) TO anon, authenticated;
