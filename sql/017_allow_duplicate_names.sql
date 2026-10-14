-- 女優・ジャンルの名前の重複を許す（2026-10-14）
-- DMM には同じ名前で別の女優番号を持つ女優がいる（例: 白石るな）。名前の UNIQUE 制約があると、
-- 毎日の取り込み（/api/cron/update-videos）が 2人目の登録で失敗して止まっていた。
-- 区別は slug（DMM の女優番号・ジャンル番号）で行い、こちらの UNIQUE はそのまま残す
ALTER TABLE public.actresses DROP CONSTRAINT IF EXISTS actresses_name_key;
ALTER TABLE public.genres DROP CONSTRAINT IF EXISTS genres_name_key;
