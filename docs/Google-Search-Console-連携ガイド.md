# Google Search Console 連携ガイド

Short AVのGoogle Search Console（GSC）連携手順を詳しく解説します。

**最終更新日**: 2025-11-04

---

## 📋 目次

1. [事前準備](#事前準備)
2. [所有権の確認方法](#所有権の確認方法)
3. [サイトマップの送信](#サイトマップの送信)
4. [初期設定](#初期設定)
5. [定期的なモニタリング](#定期的なモニタリング)
6. [トラブルシューティング](#トラブルシューティング)

---

## 🎯 事前準備

### 必要なもの

- ✅ Googleアカウント
- ✅ サイトへのアクセス権限（すでに所有）
- ✅ デプロイ済みのWebサイト（https://short-av.com）

### 現在の状態確認

Short AVでは以下が既に設定済みです：

**サイトマップ** ✅
- URL: `https://short-av.com/sitemap.xml`
- 動的生成: 全28記事 + 静的ページ自動反映
- ファイル: `app/sitemap.ts`

**robots.txt** ✅
- URL: `https://short-av.com/robots.txt`
- サイトマップへのリンク設定済み
- AI学習ボット除外設定済み
- ファイル: `app/robots.ts`

---

## 🔐 所有権の確認方法

Google Search Consoleでサイトを登録するには、所有権の確認が必要です。
以下の5つの方法から選択できます。

### 方法1: HTMLファイルをアップロード（推奨）

最もシンプルで確実な方法です。

#### 手順

1. **Google Search Consoleにアクセス**
   - https://search.google.com/search-console/
   - Googleアカウントでログイン

2. **プロパティを追加**
   - 「プロパティを追加」をクリック
   - 「URLプレフィックス」を選択
   - `https://short-av.com` を入力

3. **確認ファイルをダウンロード**
   - HTMLファイル（例: `google1234567890abcdef.html`）をダウンロード

4. **ファイルをプロジェクトに追加**

```bash
# public ディレクトリに配置
# Next.jsはpublic内のファイルをルートに配置します
mv ~/Downloads/google1234567890abcdef.html ./public/
```

5. **デプロイ**

```bash
git add public/google1234567890abcdef.html
git commit -m "Add Google Search Console verification file"
git push
```

6. **確認**
   - デプロイ完了後、GSCで「確認」ボタンをクリック
   - ブラウザで `https://short-av.com/google1234567890abcdef.html` にアクセスして確認

---

### 方法2: HTMLタグ（メタタグ）

コードに直接追加する方法です。

#### 手順

1. **GSCで「HTMLタグ」を選択**
   - 以下のようなタグが表示されます：
   ```html
   <meta name="google-site-verification" content="abc123...xyz" />
   ```

2. **app/layout.tsx に追加**

`app/layout.tsx` のメタデータに追加します：

```typescript
export const metadata: Metadata = {
  // 既存のメタデータ
  verification: {
    google: 'abc123...xyz', // GSCから取得したcontent値
  },
};
```

**または**、直接headに追加：

```typescript
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ja">
      <head>
        <meta name="google-site-verification" content="abc123...xyz" />
      </head>
      <body>{children}</body>
    </html>
  );
}
```

3. **デプロイして確認**

```bash
git add app/layout.tsx
git commit -m "Add Google Search Console verification meta tag"
git push
```

---

### 方法3: Google Analytics

Google Analyticsを既に使用している場合の最も簡単な方法です。

#### 手順

1. **GSCで「Google Analytics」を選択**
2. **同じGoogleアカウントでログイン**していれば自動的に確認されます
3. **「確認」をクリック**

**注意**: Google Analytics 4（GA4）が正しく設定されている必要があります。

---

### 方法4: Google Tag Manager

Google Tag Managerを使用している場合の方法です。

#### 手順

1. **GSCで「Google Tag Manager」を選択**
2. **同じGoogleアカウントでログイン**していれば自動的に確認されます
3. **「確認」をクリック**

**注意**: GTMコンテナが正しく設定され、公開されている必要があります。

---

### 方法5: DNSレコード

ドメインのDNS設定にアクセスできる場合の方法です。

#### 手順

1. **GSCで「ドメインプロパティ」を選択**
   - `short-av.com` を入力（https://なし）

2. **TXTレコードをコピー**
   - 例: `google-site-verification=abc123...xyz`

3. **DNSプロバイダーで設定**
   - お名前.com、Cloudflare、Route53など
   - TXTレコードを追加

4. **伝播を待つ**
   - 数分〜24時間かかる場合があります
   - `nslookup -type=TXT short-av.com` で確認可能

5. **GSCで「確認」をクリック**

**メリット**: サイトのコードを変更する必要がない
**デメリット**: DNS伝播に時間がかかる

---

## 🗺️ サイトマップの送信

所有権の確認が完了したら、サイトマップを送信します。

### 手順

1. **GSCのダッシュボードにアクセス**
   - 左メニューから「サイトマップ」を選択

2. **サイトマップURLを入力**
   ```
   https://short-av.com/sitemap.xml
   ```

3. **「送信」をクリック**

4. **ステータスを確認**
   - 「成功しました」と表示されればOK
   - 「取得できませんでした」の場合は下記を確認：
     - URLが正しいか
     - サイトマップが実際にアクセス可能か
     - robots.txtでブロックされていないか

### サイトマップの内容確認

現在のサイトマップには以下が含まれています：

**静的ページ** (4ページ)
- `/` - ホーム（priority: 1.0）
- `/articles` - 記事一覧（priority: 0.8）
- `/privacy` - プライバシーポリシー（priority: 0.3）
- `/terms` - 利用規約（priority: 0.3）

**記事ページ** (28ページ)
- `/articles/[slug]` - 各記事（priority: 0.7）

**合計**: 32ページ

---

## ⚙️ 初期設定

サイトマップ送信後、以下の設定を行うことをお勧めします。

### 1. URL検査

任意のページが正しくインデックスされているか確認します。

**手順**:
1. GSC上部の検索バーにURLを入力
   ```
   https://short-av.com/articles/male-vio-depilation-guide
   ```
2. 「Enter」を押す
3. インデックス状況を確認
4. 問題があれば「インデックス登録をリクエスト」

### 2. モバイルユーザビリティ

モバイルフレンドリーかどうか確認します。

**手順**:
1. 左メニューから「モバイルユーザビリティ」を選択
2. エラーがないか確認
3. エラーがある場合は修正して再クロール

**Short AVの状態**: 完全にモバイル最適化済み ✅

### 3. Core Web Vitals

ページ体験の指標を確認します。

**手順**:
1. 左メニューから「ページエクスペリエンス」を選択
2. 「Core Web Vitals」を確認
3. 問題がある場合は以下を確認：
   - LCP（Largest Contentful Paint）
   - FID（First Input Delay）
   - CLS（Cumulative Layout Shift）

### 4. リッチリザルトテスト

構造化データが正しく実装されているか確認します。

**手順**:
1. https://search.google.com/test/rich-results にアクセス
2. URLまたはコードを入力
   ```
   https://short-av.com/articles/male-vio-depilation-guide
   ```
3. エラーがないか確認

**Short AVの状態**: Article + BreadcrumbList 実装済み ✅

---

## 📊 定期的なモニタリング

GSC設定後、定期的に以下を確認してください。

### 毎日確認すべき項目

#### 1. 検索パフォーマンス
- 左メニュー「検索パフォーマンス」
- 確認項目：
  - 合計クリック数
  - 合計表示回数
  - 平均CTR
  - 平均掲載順位

#### 2. カバレッジ
- 左メニュー「カバレッジ」
- 確認項目：
  - エラー数
  - 警告数
  - 有効なページ数
  - 除外されたページ数

### 週次で確認すべき項目

#### 3. 上位のクエリ
- 「検索パフォーマンス」→「クエリ」タブ
- どのキーワードで検索されているか確認
- 順位が低いキーワードを見つけて改善

#### 4. 上位のページ
- 「検索パフォーマンス」→「ページ」タブ
- どのページがアクセスされているか確認
- パフォーマンスの悪いページを改善

### 月次で確認すべき項目

#### 5. リンク
- 左メニュー「リンク」
- 確認項目：
  - 外部リンク数
  - 内部リンク数
  - リンク元サイト

#### 6. ユーザーエクスペリエンス
- 「ページエクスペリエンス」
- モバイル/デスクトップのスコア確認

---

## 🎯 重要なKPI

以下のKPIを定期的にトラッキングしてください。

### 3ヶ月後の目標

| 指標 | 目標値 | 測定場所 |
|-----|--------|---------|
| インデックス済みページ | 30ページ以上 | カバレッジ |
| 検索クエリ数 | 100以上 | 検索パフォーマンス |
| 合計クリック数 | 500/月 | 検索パフォーマンス |
| 平均CTR | 3%以上 | 検索パフォーマンス |
| TOP10入りクエリ | 10個以上 | 検索パフォーマンス |
| 平均掲載順位 | 30位以内 | 検索パフォーマンス |

### データのエクスポート

定期的にデータをエクスポートして記録を残しましょう。

**手順**:
1. 検索パフォーマンスページ右上の「エクスポート」
2. CSV、Excel、Google スプレッドシートから選択
3. 毎月1日にデータをエクスポート

---

## 🐛 トラブルシューティング

### 問題1: サイトマップが送信できない

**症状**: 「取得できませんでした」エラー

**原因と対処法**:

1. **URLが間違っている**
   - 確認: `https://short-av.com/sitemap.xml`
   - ブラウザで直接アクセスして確認

2. **robots.txtでブロックされている**
   - 確認: `https://short-av.com/robots.txt`
   - `Sitemap:` が正しく記載されているか確認

3. **サイトマップが生成されていない**
   - ビルドログを確認
   - `npm run build` を実行してエラーがないか確認

### 問題2: ページがインデックスされない

**症状**: 「URLがGoogleに登録されていません」

**原因と対処法**:

1. **robots.txtでブロックされている**
   - robots.txtを確認
   - 該当URLが許可されているか確認

2. **クロール済みですがインデックス未登録**
   - コンテンツの質を改善
   - 重複コンテンツがないか確認
   - noindexタグがないか確認

3. **まだクロールされていない**
   - 「インデックス登録をリクエスト」を実行
   - サイトマップに含まれているか確認

### 問題3: モバイルユーザビリティエラー

**症状**: 「テキストが小さすぎる」「クリック可能な要素が近すぎる」

**対処法**:

Short AVでは既にモバイル最適化済みですが、エラーが出た場合：

1. **フォントサイズを確認**
   - 最小16px以上に設定

2. **タップ領域を確認**
   - ボタンは最小44x44px

3. **ビューポートを確認**
   - `viewport` メタタグが設定されているか

### 問題4: Core Web Vitalsが悪い

**症状**: LCP、FID、CLSの値が悪い

**対処法**:

1. **LCP（読み込み速度）の改善**
   - 画像を最適化（WebP形式）
   - サーバーレスポンスを高速化
   - 不要なJavaScriptを削除

2. **FID（インタラクティブ性）の改善**
   - JavaScriptの実行時間を短縮
   - コード分割を実装

3. **CLS（視覚的安定性）の改善**
   - 画像に明示的なサイズを指定
   - フォントの読み込みを最適化
   - 動的コンテンツの高さを確保

---

## 📈 高度な活用方法

### 1. 検索アナリティクスの活用

**目的**: どのクエリで流入しているか分析

**手順**:
1. 「検索パフォーマンス」→「クエリ」タブ
2. 「表示回数」でソート
3. CTRが低いクエリを特定
4. タイトル・説明文を改善

### 2. インデックスカバレッジの最適化

**目的**: すべての重要ページをインデックス

**手順**:
1. 「カバレッジ」レポートを確認
2. 「除外」されているページを確認
3. 重要なページが除外されている場合：
   - 理由を特定（重複、noindex、など）
   - 適切に修正

### 3. 内部リンクの最適化

**目的**: クロール効率を高める

**手順**:
1. 「リンク」→「内部リンク」を確認
2. 重要ページへのリンク数を確認
3. リンクが少ないページは記事内リンクを追加

### 4. 段階的なインデックス登録

**目的**: 優先度の高いページから登録

**手順**:
1. 新記事公開後、手動で「インデックス登録をリクエスト」
2. 優先度: 新記事 > 更新記事 > 既存記事
3. 1日の上限は約10件まで

---

## 🔗 関連リソース

### 公式ドキュメント
- [Google Search Console ヘルプ](https://support.google.com/webmasters/)
- [検索セントラル](https://developers.google.com/search)
- [Google検索の仕組み](https://www.google.com/search/howsearchworks/)

### 推奨ツール
- [Rich Results Test](https://search.google.com/test/rich-results) - 構造化データテスト
- [PageSpeed Insights](https://pagespeed.web.dev/) - パフォーマンステスト
- [Mobile-Friendly Test](https://search.google.com/test/mobile-friendly) - モバイル対応テスト

### Short AV 関連ドキュメント
- [進捗記録](./進捗記録.md)
- [SEO評価レポート](./SEO評価レポート.md)
- [記事作成ガイドライン](./記事作成ガイドライン.md)

---

## ✅ チェックリスト

GSC連携完了までのチェックリストです。

### 初期設定
- [ ] Google Search Consoleにアクセス
- [ ] プロパティを追加（https://short-av.com）
- [ ] 所有権を確認（HTMLファイル or メタタグ）
- [ ] サイトマップを送信（sitemap.xml）
- [ ] サイトマップのステータス確認（成功）

### 設定確認
- [ ] URL検査を実行（サンプルページ）
- [ ] モバイルユーザビリティ確認（エラーなし）
- [ ] Core Web Vitals確認（良好）
- [ ] リッチリザルトテスト実行（エラーなし）

### 継続的な作業
- [ ] 毎日：検索パフォーマンスを確認
- [ ] 毎日：カバレッジを確認
- [ ] 毎週：上位クエリを分析
- [ ] 毎週：上位ページを分析
- [ ] 毎月：データをエクスポート
- [ ] 毎月：KPI達成状況を評価

---

## 📞 サポート

### 問題が解決しない場合

1. **Google Search Consoleヘルプフォーラム**
   - https://support.google.com/webmasters/community

2. **GitHubでIssue作成**
   - https://github.com/matasuke-smk/short-av/issues

3. **ドキュメントの再確認**
   - このガイドを最初から見直す

---

**最終更新日**: 2025-11-04
**作成者**: Claude Code
**バージョン**: 1.0.0
