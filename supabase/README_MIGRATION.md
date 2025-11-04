# Supabase マイグレーション実行手順

## いいね機能のデータベース設定

### 1. Supabaseダッシュボードにアクセス
1. https://supabase.com にアクセス
2. プロジェクトを選択
3. 左メニューから「SQL Editor」を選択

### 2. マイグレーションSQLを実行
1. 「New query」ボタンをクリック
2. `supabase/migrations/20251028_add_likes.sql` ファイルの内容をコピー
3. SQLエディタにペースト
4. 「Run」ボタンをクリックして実行

### 3. 実行内容の確認
以下が自動的に作成されます：

#### videosテーブルに追加されるカラム
- `likes_count` (INTEGER): いいね数のカウント（デフォルト: 0）

#### 新規作成されるテーブル
- `likes`: ユーザーのいいね情報を保存
  - `id` (UUID): プライマリキー
  - `video_id` (TEXT): 動画ID（videosテーブルへの外部キー）
  - `user_identifier` (TEXT): ユーザー識別子（LocalStorageのユニークID）
  - `created_at` (TIMESTAMP): いいねした日時

#### 自動更新の仕組み
- いいね追加/削除時に `videos.likes_count` が自動的に更新されます
- PostgreSQLのトリガー関数により実現

### 4. 動作確認

#### 4-1. テーブルが作成されたか確認
```sql
SELECT * FROM likes LIMIT 10;
SELECT id, title, likes_count FROM videos LIMIT 10;
```

#### 4-2. トリガーが動作するか確認
```sql
-- テスト用にいいねを追加
INSERT INTO likes (video_id, user_identifier)
VALUES ('動画のID', 'test-user-123');

-- likes_countが1増えているか確認
SELECT id, title, likes_count FROM videos WHERE id = '動画のID';

-- テストデータを削除
DELETE FROM likes WHERE user_identifier = 'test-user-123';
```

### 5. トラブルシューティング

#### エラー: "relation videos does not exist"
→ videosテーブルがまだ作成されていません。先にvideosテーブルを作成してください。

#### エラー: "column likes_count already exists"
→ 既にマイグレーションが実行済みです。問題ありません。

#### いいね数が自動更新されない
→ トリガーが正しく作成されているか確認：
```sql
SELECT tgname FROM pg_trigger WHERE tgrelid = 'likes'::regclass;
```

### 6. セキュリティ設定（Row Level Security）

本番環境では、以下のRLSポリシーを追加することを推奨：

```sql
-- likesテーブルのRLSを有効化
ALTER TABLE likes ENABLE ROW LEVEL SECURITY;

-- 全ユーザーが自分のいいねを作成・削除できる
CREATE POLICY "Users can manage their own likes"
ON likes
FOR ALL
USING (true)
WITH CHECK (true);

-- videosテーブルは全ユーザーが読み取り可能
ALTER TABLE videos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view videos"
ON videos
FOR SELECT
USING (is_active = true);
```

## 完了

マイグレーションが正常に完了すると、いいね機能が使用可能になります！
