-- いいね（likes.video_id）を dmm_content_id に統一する
-- 以前は画面によって videos.id（UUID）と dmm_content_id のどちらかが保存されていた。
-- アプリ側は両方を受け付けるので、このSQLの実行はデプロイの前後どちらでもよい。

-- 1. UUID で保存されたいいねを dmm_content_id に置き換える
UPDATE public.likes AS l
SET video_id = v.dmm_content_id
FROM public.videos AS v
WHERE l.video_id = v.id::text;

-- 2. 置き換えで重複した（同じユーザー・同じ作品）いいねは、最初の1件だけ残す
DELETE FROM public.likes AS a
USING public.likes AS b
WHERE a.user_identifier = b.user_identifier
  AND a.video_id = b.video_id
  AND (a.created_at, a.id) > (b.created_at, b.id);

-- 3. 連打などで二重に登録されないよう一意制約を付ける
CREATE UNIQUE INDEX IF NOT EXISTS likes_user_video_key
  ON public.likes (user_identifier, video_id);
