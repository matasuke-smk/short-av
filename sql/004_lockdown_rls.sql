-- =====================================================================
-- RLS（行レベルセキュリティ）の締め直し
--
-- 方針:
--   - 匿名ユーザー（anon キー = ブラウザに配信される公開キー）は「公開データの読み取り」のみ
--   - 書き込み・削除、および likes / size_statistics の読み取りはサーバー（service_role キー）のみ
--     （service_role は RLS をバイパスするため、ポリシーは不要）
--
-- 適用前に必ず Vercel に SUPABASE_SERVICE_ROLE_KEY を設定し、新しいコードをデプロイしておくこと。
-- （先にこのSQLを流すと、旧コードの cron / いいね / サイズ投稿が動かなくなる）
--
-- Supabase ダッシュボード > SQL Editor で実行する。
-- =====================================================================

-- 1. 対象テーブルの既存ポリシーをすべて削除（過去に作った「anon に全部許可」系を一掃する）
DO $$
DECLARE
  pol record;
BEGIN
  FOR pol IN
    SELECT schemaname, tablename, policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN ('videos', 'genres', 'actresses', 'articles', 'settings', 'likes', 'size_statistics')
  LOOP
    EXECUTE format('DROP POLICY %I ON %I.%I', pol.policyname, pol.schemaname, pol.tablename);
  END LOOP;
END $$;

-- 2. RLS 有効化・権限の付け直し・読み取りポリシーの作成
DO $$
DECLARE
  t text;
BEGIN
  -- 公開データ: 誰でも読み取りのみ可
  FOREACH t IN ARRAY ARRAY['videos', 'genres', 'actresses', 'articles'] LOOP
    IF to_regclass('public.' || t) IS NOT NULL THEN
      EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
      EXECUTE format('REVOKE ALL ON public.%I FROM anon, authenticated', t);
      EXECUTE format('GRANT SELECT ON public.%I TO anon, authenticated', t);
      EXECUTE format('CREATE POLICY "Public read" ON public.%I FOR SELECT TO anon, authenticated USING (true)', t);
    END IF;
  END LOOP;

  -- 非公開データ: anon / authenticated からは一切アクセス不可（サーバーのみ）
  FOREACH t IN ARRAY ARRAY['likes', 'size_statistics', 'settings'] LOOP
    IF to_regclass('public.' || t) IS NOT NULL THEN
      EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
      EXECUTE format('REVOKE ALL ON public.%I FROM anon, authenticated', t);
    END IF;
  END LOOP;
END $$;

-- 3. 確認用: 実行後、以下で「Public read」だけが残っていることを確認する
-- SELECT tablename, policyname, roles, cmd FROM pg_policies WHERE schemaname = 'public' ORDER BY tablename;
--
-- 確認用: SECURITY DEFINER の関数は RLS をバイパスするため、書き込み系が無いか確認する
-- SELECT proname FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
--  WHERE n.nspname = 'public' AND p.prosecdef;
