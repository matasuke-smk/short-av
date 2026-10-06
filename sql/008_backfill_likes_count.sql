-- videos.likes_count を likes テーブルの実際の件数に合わせる（1回だけ実行）
-- これまで likes_count は誰にも更新されておらず、/liked のバッジや構造化データが 0 のままだった。
-- 今後はいいねの登録・解除のたびに /api/likes/toggle が数え直す。
-- 前提: sql/006_normalize_likes.sql 実行済み（likes.video_id が dmm_content_id に統一されている）

UPDATE public.videos v
SET likes_count = c.cnt
FROM (
  SELECT v2.id, COUNT(l.video_id) AS cnt
  FROM public.videos v2
  LEFT JOIN public.likes l ON l.video_id = v2.dmm_content_id
  GROUP BY v2.id
) c
WHERE v.id = c.id
  AND v.likes_count IS DISTINCT FROM c.cnt;

-- 確認用: いいねされている作品の件数
-- SELECT dmm_content_id, likes_count FROM public.videos WHERE likes_count > 0 ORDER BY likes_count DESC;
