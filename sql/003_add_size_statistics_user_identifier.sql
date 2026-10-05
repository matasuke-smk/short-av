-- size_statistics に user_identifier を追加（1ユーザー1データ）
-- ※本番には適用済み。元のSQLファイルが空になっていたため、再現用に復元したもの

ALTER TABLE size_statistics ADD COLUMN IF NOT EXISTS user_identifier TEXT;

-- /api/size-stats の upsert(onConflict: 'user_identifier') に必要な一意制約
CREATE UNIQUE INDEX IF NOT EXISTS size_statistics_user_identifier_key
  ON size_statistics(user_identifier);
