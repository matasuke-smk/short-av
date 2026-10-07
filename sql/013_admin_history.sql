-- 運営者（管理画面にログインした端末）の閲覧履歴
-- 一般の利用者の履歴はこれまでどおり端末の localStorage だけに保存する。
-- 運営者は PC・スマホの Chrome・ホーム画面アプリの「サイトを開く」で同じ履歴を見られるよう、共通ID（admin_user_ids）ごとにここへ保存する。
-- この SQL を実行するまでは、運営者の履歴も端末ごとのまま（エラーにはならない）。

CREATE TABLE IF NOT EXISTS public.admin_history (
  user_identifier TEXT NOT NULL,
  video_id TEXT NOT NULL,
  viewed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_identifier, video_id)
);

CREATE INDEX IF NOT EXISTS admin_history_user_viewed_idx ON public.admin_history (user_identifier, viewed_at DESC);

-- 一般の利用者（anon キー）からは読み書きできないようにする（ポリシーは作らない）
ALTER TABLE public.admin_history ENABLE ROW LEVEL SECURITY;
