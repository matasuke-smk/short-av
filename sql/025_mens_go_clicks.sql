-- 男のからだ研究室の /go（A8 の広告への入口）に来たものの記録（2026-10-30）
-- 10/28 に /go でロボットを断るようにした後も、A8 のクリックが GA の広告のクリック（0回）より多いまま（10/29 は16回）。
-- /go を通った人・断ったロボットを数えて、A8 のクリックがどこから付いているか（/go を通っているか、A8 のリンクを直接開いているか）を見る。
-- 書き込みは mens の app/go/route.ts → lib/go-log.ts（Cloudflare Workers）。読むのは short-av の毎朝の要約（lib/daily-summary.ts）。
-- mens には service_role の鍵を置かないので、anon キーで「書き込みだけ」できるようにする（読めない・消せない）
CREATE TABLE IF NOT EXISTS public.mens_go_clicks (
  id BIGSERIAL PRIMARY KEY,
  at TIMESTAMPTZ NOT NULL DEFAULT now(),
  blocked BOOLEAN NOT NULL,  -- ロボットとして断った（403）
  ad TEXT,                   -- 広告の名前（lib/ads.ts。最大 50 文字）
  kind TEXT,                 -- banner / text
  country TEXT,              -- 国（Cloudflare の cf-ipcountry）
  as_org TEXT,               -- 回線の持ち主（Cloudflare の asOrganization。データセンターならロボットの疑い。最大 100 文字）
  referer TEXT,              -- どのページから押したか（最大 300 文字）
  user_agent TEXT            -- User-Agent（最大 300 文字）
);
CREATE INDEX IF NOT EXISTS mens_go_clicks_at_idx ON public.mens_go_clicks (at DESC);

ALTER TABLE public.mens_go_clicks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS mens_go_clicks_insert ON public.mens_go_clicks;
CREATE POLICY mens_go_clicks_insert ON public.mens_go_clicks FOR INSERT TO anon WITH CHECK (true);
