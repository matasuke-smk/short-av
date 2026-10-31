-- FANZA の定価とセール（DMM の API の prices.list_price と campaign）。作品詳細のセール情報と、スワイプ画面の「○%OFF」に出す（2026-10-31）
-- セールが終わったら（campaign_end を過ぎたら）、画面では price ではなく list_price を出す（price がセール中の値段のまま残る作品があったため）
ALTER TABLE public.videos ADD COLUMN IF NOT EXISTS list_price INTEGER;
ALTER TABLE public.videos ADD COLUMN IF NOT EXISTS campaign_end TIMESTAMPTZ;
ALTER TABLE public.videos ADD COLUMN IF NOT EXISTS campaign_title TEXT;
