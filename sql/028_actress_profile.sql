-- 女優のプロフィール（DMM の女優検索 ActressSearch）。女優の詳細（スワイプ画面で女優が1人の作品の顔を押したとき）に出す（2026-10-31）
-- よみ（kana）・生年月日（birth_date）・身長・スリーサイズ・血液型は既存の列に入れる。趣味・出身・FANZA の出演作一覧の紹介リンクを足す
-- profile_at は DMM に問い合わせた日時（写真やプロフィールが無い女優も、もう一度問い合わせないため）
ALTER TABLE public.actresses ADD COLUMN IF NOT EXISTS hobby TEXT;
ALTER TABLE public.actresses ADD COLUMN IF NOT EXISTS prefectures TEXT;
ALTER TABLE public.actresses ADD COLUMN IF NOT EXISTS fanza_list_url TEXT;
ALTER TABLE public.actresses ADD COLUMN IF NOT EXISTS profile_at TIMESTAMPTZ;
