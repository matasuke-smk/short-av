-- 人が /go（FANZA への転送）を通ったクリックの記録（2026-10-27）
-- GA は広告ブロック・すぐ閉じた人・数時間の集計待ちで数が欠けるので、サーバー側でも数える（app/go/route.ts → lib/go-clicks.ts）。
-- ロボット（lib/go-link.ts の isBotUserAgent）は記録しない（ai_bot_hits に記録される）。管理画面にログインしている端末は owner=true。
-- 毎朝の要約（lib/daily-summary.ts）で「DMM のクリック／/go を通った人のクリック／GA のクリック」を並べる。
-- DMM のバナー・ウィジェットは DMM の仕組みで直接 FANZA へ飛ぶので、ここには入らない
CREATE TABLE IF NOT EXISTS public.go_clicks (
  id BIGSERIAL PRIMARY KEY,
  at TIMESTAMPTZ NOT NULL DEFAULT now(),
  owner BOOLEAN NOT NULL DEFAULT false, -- 運営者の端末（sav_admin_ui cookie）
  target TEXT NOT NULL,                 -- 転送先（紹介リンク。最大 500 文字）
  country TEXT,                         -- 国（Vercel の x-vercel-ip-country）
  referer TEXT,                         -- どのページから押したか（最大 300 文字）
  user_agent TEXT                       -- User-Agent（最大 300 文字）
);
CREATE INDEX IF NOT EXISTS go_clicks_at_idx ON public.go_clicks (at DESC);

-- 一般の利用者（anon キー）からは読み書きできないようにする（ポリシーは作らない。書き込みは service_role のみ）
ALTER TABLE public.go_clicks ENABLE ROW LEVEL SECURITY;
