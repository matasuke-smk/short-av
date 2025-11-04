-- いいね機能のためのテーブルとカラムを追加

-- 1. videosテーブルにlikes_countカラムを追加
ALTER TABLE videos
ADD COLUMN IF NOT EXISTS likes_count INTEGER DEFAULT 0 NOT NULL;

-- 2. likesテーブルを作成（ユーザーのいいね情報を保存）
CREATE TABLE IF NOT EXISTS likes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  video_id UUID NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
  user_identifier TEXT NOT NULL, -- LocalStorageのユニークID、将来的にはユーザーIDに変更可能
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,

  -- 同じユーザーが同じ動画に複数回いいねできないように制約
  UNIQUE(video_id, user_identifier)
);

-- 3. likesテーブルのインデックスを作成（検索高速化）
CREATE INDEX IF NOT EXISTS idx_likes_video_id ON likes(video_id);
CREATE INDEX IF NOT EXISTS idx_likes_user_identifier ON likes(user_identifier);

-- 4. likes_countを自動更新するトリガー関数
CREATE OR REPLACE FUNCTION update_video_likes_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    -- いいね追加時
    UPDATE videos SET likes_count = likes_count + 1 WHERE id = NEW.video_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    -- いいね削除時
    UPDATE videos SET likes_count = likes_count - 1 WHERE id = OLD.video_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- 5. トリガーを設定
DROP TRIGGER IF EXISTS trigger_update_likes_count ON likes;
CREATE TRIGGER trigger_update_likes_count
  AFTER INSERT OR DELETE ON likes
  FOR EACH ROW
  EXECUTE FUNCTION update_video_likes_count();

-- 6. 既存のいいね数を0で初期化（既にデータがある場合）
UPDATE videos SET likes_count = 0 WHERE likes_count IS NULL;
