-- X 予約投稿用のストック
-- 毎週水曜に cron が翌木曜〜次の水曜分（1日3枠）を生成し、管理画面 /admin/x-posts から X で予約投稿する。
-- サーバー（service_role）からのみ読み書きするため、anon / authenticated には権限を与えない。

CREATE TABLE IF NOT EXISTS public.x_posts (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slot_at         TIMESTAMPTZ NOT NULL,          -- 予約投稿する日時
  slot_type       TEXT NOT NULL,                 -- new（新着）/ ranking（ランキング）/ random（ランダム）
  dmm_content_id  TEXT NOT NULL,
  title           TEXT NOT NULL,                 -- 生成時点の作品タイトル（videos から消えても表示できるように保持）
  thumbnail_url   TEXT,
  text            TEXT NOT NULL,                 -- 投稿文（管理画面で編集可）
  status          TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'scheduled', 'skipped')),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 1枠につき有効な投稿は1件（スキップしたものは除く）
CREATE UNIQUE INDEX IF NOT EXISTS x_posts_slot_active_key
  ON public.x_posts (slot_at) WHERE status <> 'skipped';

CREATE INDEX IF NOT EXISTS x_posts_dmm_content_id_idx ON public.x_posts (dmm_content_id);

ALTER TABLE public.x_posts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.x_posts FROM anon, authenticated;
