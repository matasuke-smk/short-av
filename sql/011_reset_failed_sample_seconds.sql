-- 2026-10-06: Vercel の海外（アメリカ）のサーバーから調べたため、サンプル動画が読めず
-- 全件が「調べられなかった（-1）」として記録されてしまった。未記録（NULL）に戻して調べ直す。
UPDATE public.videos SET sample_seconds = NULL WHERE sample_seconds = -1;
