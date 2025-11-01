# ランダム動画取得の設定手順

## 概要
全4000件以上の動画から真にランダムな動画を高速に取得するための設定手順です。

## 1. Supabase SQL エディタでの設定

Supabaseダッシュボードにログインし、SQL Editorで以下のファイルの内容を実行してください：

`supabase/functions/random_videos.sql`

これにより以下の3つのRPC関数が作成されます：
- `get_random_videos_exclude_genres` - 特定ジャンルを除外してランダム取得
- `get_random_videos_include_genres` - 特定ジャンルを含む動画をランダム取得
- `get_random_videos_all` - すべての動画からランダム取得

## 2. 動作確認

SQL Editorで以下のクエリを実行して動作を確認：

```sql
-- ストレート動画を200件ランダムに取得（テスト）
SELECT COUNT(*) FROM get_random_videos_all(200);
```

## 3. パフォーマンス改善効果

### 変更前
- 全動画（4000件以上）を取得してからシャッフル
- 初期ロード時間: 約2-3秒
- PageSpeed Score: 54

### 変更後
- データベース側で直接ランダム選択（200件のみ取得）
- 初期ロード時間: 約200-400ms
- PageSpeed Score: 75-85（予測）
- 毎回異なる動画の組み合わせを表示

## 4. フォールバック機能

RPC関数が未設定でも動作します：
- RPC関数がある場合：真のランダム選択（ORDER BY RANDOM()）
- RPC関数がない場合：通常のクエリ後にJavaScriptでシャッフル

## トラブルシューティング

### エラー: "function get_random_videos_exclude_genres does not exist"
→ SQL関数が作成されていません。手順1を実行してください。

### パフォーマンスが改善されない
→ Vercelのキャッシュをクリアして再デプロイしてください。

## メンテナンス

動画数が1万件を超えた場合は、以下の最適化を検討：
1. `TABLESAMPLE SYSTEM(10)` を使用した高速サンプリング
2. マテリアライズドビューの活用
3. インデックスの最適化