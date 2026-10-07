-- 運営者（管理画面にログインした端末）のユーザーID
-- アクセス解析の「いいね」から運営者自身のいいねを除くために使う。
-- 管理画面を開いたとき、またはログイン中の端末でいいねしたときにアプリが登録する（サーバーの service role のみが読み書き）。
-- この SQL を実行するまでは、アプリは運営者のいいねを除かずに数える（エラーにはならない）。

CREATE TABLE IF NOT EXISTS public.admin_user_ids (
  user_identifier TEXT PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 一般の利用者（anon キー）からは読み書きできないようにする（ポリシーは作らない）
ALTER TABLE public.admin_user_ids ENABLE ROW LEVEL SECURITY;
