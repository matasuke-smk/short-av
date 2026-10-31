-- FANZA のレビューの平均点（DMM の API の review.average）。スワイプ画面の作品の操作の行と作品詳細の ⭐ に出す（2026-10-31）
-- 作品の取り込み（lib/dmm-api.ts convertDMMItemToVideo）と、毎朝の /api/cron/long-scores（fillReviewAverages）で入れる。
-- 平均点が取れなかった作品は 0（画面では「ー」）。女優の顔写真は既存の actresses.profile_image_url に入れる（fillActressImages）
ALTER TABLE public.videos ADD COLUMN IF NOT EXISTS review_average NUMERIC(3, 2);
