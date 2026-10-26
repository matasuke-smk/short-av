-- 点検の記録（ログインが必要なサイトの数字。DMM・A8・DLsite・JuicyAds・Supabase・Google の登録数など）。2026-10-26
-- 今は Claude がログインして確かめた数字を手で入れる（source = 'manual'）。のちに自宅の Mac の自動収集（source = 'auto'）もここに入れる。
-- 今朝の要約は、36時間以内のいちばん新しい記録を「ログインして確かめた数字」として載せる（lib/daily-summary.ts）
CREATE TABLE IF NOT EXISTS public.site_checks (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  checked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  source TEXT NOT NULL DEFAULT 'manual',
  data JSONB NOT NULL
);
CREATE INDEX IF NOT EXISTS site_checks_checked_at ON public.site_checks (checked_at DESC);

-- サイトからは読めないようにする（サーバーはサービスロールで読み書きする）
ALTER TABLE public.site_checks ENABLE ROW LEVEL SECURITY;
