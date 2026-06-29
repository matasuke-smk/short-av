-- 1ユーザー1データ制約の追加
-- size_statistics テーブルに user_identifier 列を追加し、
-- 同一ユーザーからの重複投稿を防ぐ（最初の投稿のみDBに保存される）

-- ユーザー識別子の列を追加（LocalStorageベースの匿名ID）
ALTER TABLE size_statistics
  ADD COLUMN IF NOT EXISTS user_identifier TEXT;

-- 同一ユーザーの重複登録を禁止するUNIQUE制約
-- （既存行は user_identifier が NULL のまま。Postgres では NULL は重複扱いされないため影響なし）
ALTER TABLE size_statistics
  DROP CONSTRAINT IF EXISTS size_statistics_user_identifier_key;

ALTER TABLE size_statistics
  ADD CONSTRAINT size_statistics_user_identifier_key UNIQUE (user_identifier);

-- 検索高速化用インデックス
CREATE INDEX IF NOT EXISTS idx_size_statistics_user_identifier
  ON size_statistics(user_identifier);

COMMENT ON COLUMN size_statistics.user_identifier IS 'LocalStorageベースの匿名ユーザーID。UNIQUE制約により1ユーザー1データを保証する';
