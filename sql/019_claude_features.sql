-- Claude API を使う機能のための表と列（2026-10-25）
-- 1) 毎朝の点検の要約（/api/cron/daily-summary が書く。管理画面のアクセス解析の上に出す）
CREATE TABLE IF NOT EXISTS public.daily_summaries (
  date DATE PRIMARY KEY,               -- 要約の対象の日（日本時間。前日の分）
  summary TEXT NOT NULL,               -- Claude が書いた要約（10行ほど）
  data JSONB NOT NULL DEFAULT '{}',    -- 要約のもとにした数字
  model TEXT,
  yen NUMERIC(8,2),                    -- この要約にかかった費用の目安（円）
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.daily_summaries ENABLE ROW LEVEL SECURITY;

-- 2) 作品の紹介文（検索エンジン・AI 向け。/v/作品番号 の説明文と構造化データに使う）
ALTER TABLE public.videos ADD COLUMN IF NOT EXISTS ai_description TEXT;
ALTER TABLE public.videos ADD COLUMN IF NOT EXISTS ai_description_at TIMESTAMPTZ;

-- 3) 女優ページの紹介文（/actress/女優番号 の見出しの下に出す）
ALTER TABLE public.actresses ADD COLUMN IF NOT EXISTS ai_intro TEXT;
ALTER TABLE public.actresses ADD COLUMN IF NOT EXISTS ai_intro_at TIMESTAMPTZ;
