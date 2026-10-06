-- サイズ比較ツール: 同じ回線（IP）からの重複登録を防ぐ
-- IP アドレスそのものは保存せず、サーバーだけが知る秘密の値で HMAC にした文字列を保存する。
-- /api/size-stats は同じ ip_hash から30日以内に登録があれば保存しない。
-- 先にこの SQL を実行してから、アプリをデプロイすること（列がないと保存がエラーになる）。

ALTER TABLE public.size_statistics ADD COLUMN IF NOT EXISTS ip_hash TEXT;

CREATE INDEX IF NOT EXISTS size_statistics_ip_hash_created_at_idx
  ON public.size_statistics (ip_hash, created_at);

-- 確認用: 重複登録の疑いがある既存データ（同じ値が24時間以内に続いているもの）
-- SELECT a.id, a.length_mm, a.diameter_mm, a.age_group, a.created_at, b.id AS similar_id, b.created_at AS similar_at
-- FROM public.size_statistics a
-- JOIN public.size_statistics b
--   ON a.id < b.id
--  AND a.length_mm = b.length_mm
--  AND a.diameter_mm = b.diameter_mm
--  AND a.age_group IS NOT DISTINCT FROM b.age_group
--  AND b.created_at - a.created_at < INTERVAL '24 hours'
-- ORDER BY a.created_at;
