-- 検索語からの記事のネタ出し（2026-10-25。Claude API を使う機能の 3 つ目）
-- 毎週月曜 10:00（日本時間）に /api/cron/article-ideas が Search Console の検索語を集めて Claude にネタを出させ、ここに残す。
-- 管理画面「男のからだ研究室」のタブの上に最新の回を出す
CREATE TABLE IF NOT EXISTS public.article_ideas (
  week DATE PRIMARY KEY,               -- その回の週の月曜（日本時間）
  trend TEXT NOT NULL,                 -- 検索の傾向のひとこと
  ideas JSONB NOT NULL DEFAULT '[]',   -- ネタの一覧（題名・ねらう検索語・理由・見出し案）
  data JSONB NOT NULL DEFAULT '{}',    -- もとにした検索語の数字
  model TEXT,
  yen NUMERIC(8,2),                    -- かかった費用の目安（円）
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.article_ideas ENABLE ROW LEVEL SECURITY;
