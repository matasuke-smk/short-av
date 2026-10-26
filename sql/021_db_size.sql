-- データベースの大きさ（バイト）。毎朝の要約で無料プランの上限（500MB）に近づいていないかを見る（lib/ops-data.ts）
-- サービスロールだけが呼べる（サイトからは呼べない）
CREATE OR REPLACE FUNCTION public.db_size_bytes()
RETURNS bigint
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT pg_database_size(current_database());
$$;

REVOKE ALL ON FUNCTION public.db_size_bytes() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.db_size_bytes() TO service_role;
