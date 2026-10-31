-- 価格・セールを DMM で最後に確かめた日時（2026-10-31）。毎朝、セールの終わった作品の価格を取り直す（refreshEndedSales）ときの目安
ALTER TABLE public.videos ADD COLUMN IF NOT EXISTS price_checked_at TIMESTAMPTZ;
