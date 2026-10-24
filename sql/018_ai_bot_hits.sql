-- AI のボット（ChatGPT・Perplexity など）がどのページをいつ読んだかの記録（2026-10-24）
-- ChatGPT からの訪問が増えているが、ChatGPT がどのページを読んで紹介しているかは GA では分からない
-- （ボットは JavaScript を動かさないため）。middleware.ts で User-Agent を見て、ここに1行ずつ記録する。
-- 管理画面の「AI の読み取り」で、ボットごと・ページごとの回数と最近の記録を見る。60日より古い記録は管理画面を開いたときに消す
CREATE TABLE IF NOT EXISTS public.ai_bot_hits (
  id BIGSERIAL PRIMARY KEY,
  at TIMESTAMPTZ NOT NULL DEFAULT now(),
  bot TEXT NOT NULL,          -- ボットの名前（OAI-SearchBot・ChatGPT-User など）
  path TEXT NOT NULL,         -- 読んだページ（検索文字列を含む。最大 500 文字）
  user_agent TEXT,            -- User-Agent（最大 300 文字）
  referer TEXT                -- Referer（あれば）
);
CREATE INDEX IF NOT EXISTS ai_bot_hits_at_idx ON public.ai_bot_hits (at DESC);

-- 一般の利用者（anon キー）からは読み書きできないようにする（ポリシーは作らない。書き込みは service_role のみ）
ALTER TABLE public.ai_bot_hits ENABLE ROW LEVEL SECURITY;
