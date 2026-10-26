-- FANZA のレビュー数（DMM の API の review.count）。「4分以上」のボタンで作品を人気の順に並べるのに使う（2026-10-26）
-- このサイトでの反応（view_count = 直近28日の再生回数、click_count = FANZA へのクリック回数。どちらも GA から毎日入れ直す）と合わせて点数にする
ALTER TABLE public.videos ADD COLUMN IF NOT EXISTS review_count INTEGER;
