-- 女優ごと・ジャンルごとのページ（/actress/女優番号・/genre/ジャンル番号）の一覧とサイトマップ用に、
-- 掲載中の作品（サンプルあり）の本数を DB 側で数える。2026-10-12
--
-- 戻り値は JSON 1 行（PostgREST の 1000 行上限にかからないよう 1 行にまとめる）:
--   [{ "slug": "1072127", "name": "石川澪", "works": 12 }, ...]（本数の多い順）
-- slug は DMM の女優番号・ジャンル番号（actresses.slug / genres.slug）

CREATE OR REPLACE FUNCTION public.get_catalog_entries(
  p_kind TEXT,          -- 'actress' または 'genre'
  p_min_works INT DEFAULT 3
)
RETURNS JSONB
LANGUAGE sql
STABLE
AS $$
  WITH counts AS (
    SELECT u.id, count(*) AS works
    FROM public.videos v
    CROSS JOIN LATERAL unnest(CASE WHEN p_kind = 'actress' THEN v.actress_ids ELSE v.genre_ids END) AS u(id)
    WHERE v.is_active = true
      AND v.thumbnail_url IS NOT NULL
      AND v.sample_video_url IS NOT NULL
    GROUP BY u.id
    HAVING count(*) >= p_min_works
  ),
  named AS (
    SELECT a.slug, a.name, c.works FROM counts c JOIN public.actresses a ON a.id = c.id WHERE p_kind = 'actress' AND a.slug IS NOT NULL
    UNION ALL
    SELECT g.slug, g.name, c.works FROM counts c JOIN public.genres g ON g.id = c.id WHERE p_kind = 'genre' AND g.slug IS NOT NULL
  )
  SELECT COALESCE(jsonb_agg(jsonb_build_object('slug', slug, 'name', name, 'works', works) ORDER BY works DESC, slug), '[]'::JSONB)
  FROM named;
$$;

GRANT EXECUTE ON FUNCTION public.get_catalog_entries(TEXT, INT) TO anon, authenticated;
