-- Update size statistics table constraints to realistic ranges
-- 既存のテーブルがある場合のマイグレーション用SQL

-- 既存のチェック制約を削除
ALTER TABLE size_statistics DROP CONSTRAINT IF EXISTS size_statistics_length_mm_check;
ALTER TABLE size_statistics DROP CONSTRAINT IF EXISTS size_statistics_diameter_mm_check;

-- 新しいチェック制約を追加（現実的な範囲）
ALTER TABLE size_statistics
  ADD CONSTRAINT size_statistics_length_mm_check
  CHECK (length_mm >= 60 AND length_mm <= 220);

ALTER TABLE size_statistics
  ADD CONSTRAINT size_statistics_diameter_mm_check
  CHECK (diameter_mm >= 22 AND diameter_mm <= 55);

-- コメントを更新
COMMENT ON TABLE size_statistics IS 'Anonymous penis size statistics collected from users (erect only, realistic ranges)';
COMMENT ON COLUMN size_statistics.length_mm IS 'Length in millimeters (60-220mm / 6.0-22.0cm)';
COMMENT ON COLUMN size_statistics.diameter_mm IS 'Diameter in millimeters (22-55mm)';

-- 範囲外のデータを確認（実行前に確認推奨）
-- SELECT COUNT(*) FROM size_statistics WHERE length_mm < 60 OR length_mm > 220;
-- SELECT COUNT(*) FROM size_statistics WHERE diameter_mm < 22 OR diameter_mm > 55;
