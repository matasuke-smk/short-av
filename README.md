# Short AV - 動画レビューサイト

DMMアフィリエイトを活用したハイブリッド型動画閲覧サイト

## 技術スタック

- **フロントエンド**: Next.js 15 (App Router) + TypeScript
- **スタイリング**: Tailwind CSS
- **データベース**: PostgreSQL (Supabase)
- **ホスティング**: Vercel
- **ドメイン管理**: Cloudflare
- **API連携**: DMM Affiliate SDK

## 開発環境のセットアップ

```bash
# 依存関係のインストール
npm install

# 開発サーバー起動
npm run dev
```

ブラウザで [http://localhost:3000](http://localhost:3000) を開いてください。

## 環境変数

| 変数名 | 用途 | 公開 |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | SupabaseのURL | ブラウザに配信 |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabaseの公開キー（RLSで読み取り専用） | ブラウザに配信 |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabaseの管理者キー（cron・いいね・サイズ統計の書き込み用） | **サーバーのみ** |
| `DMM_API_ID` / `DMM_AFFILIATE_ID` | DMM Webサービス | サーバーのみ |
| `CRON_SECRET` | `/api/cron/update-videos` の認証 | サーバーのみ |
| `ADMIN_USER` / `ADMIN_PASSWORD` | `/admin` のBasic認証（未設定時は常にアクセス拒否） | サーバーのみ |
| `NEXT_PUBLIC_GA_MEASUREMENT_ID` | Google Analytics | ブラウザに配信 |
| `NEXT_PUBLIC_ENABLE_AFFILIATE_LINKS` | アフィリエイトリンクの有効化（`true`） | ブラウザに配信 |

## データベース

`sql/` 配下のSQLをSupabaseのSQL Editorで番号順に適用します。
`sql/004_lockdown_rls.sql` は匿名ユーザーを読み取り専用にするため、`SUPABASE_SERVICE_ROLE_KEY` を設定してデプロイした後に適用してください。

## デプロイ

Vercelに自動デプロイされます。

## ドメイン

- 本番環境: https://short-av.com
