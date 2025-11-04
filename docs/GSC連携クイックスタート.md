# Google Search Console 連携クイックスタート

最短5分でGoogle Search Consoleを設定する手順です。

---

## 🚀 最速セットアップ（メタタグ方式）

### Step 1: GSCにアクセス

1. https://search.google.com/search-console/ にアクセス
2. Googleアカウントでログイン

### Step 2: プロパティを追加

1. 左上の「プロパティを追加」をクリック
2. 「URLプレフィックス」を選択
3. `https://short-av.com` を入力
4. 「続行」をクリック

### Step 3: 確認コードを取得

1. 「HTMLタグ」を選択
2. 以下のようなタグが表示されます：
   ```html
   <meta name="google-site-verification" content="abc123xyz789..." />
   ```
3. `content="..."` の中の値（abc123xyz789...）をコピー

### Step 4: コードに追加

`app/layout.tsx` を開いて、metadataに追加：

```typescript
export const metadata: Metadata = {
  // 既存のメタデータの後に追加
  verification: {
    google: 'abc123xyz789...', // ← Step 3でコピーした値
  },
};
```

### Step 5: デプロイ

```bash
git add app/layout.tsx
git commit -m "Add Google Search Console verification"
git push
```

デプロイ完了まで待機（約2-5分）

### Step 6: 確認

1. GSCの画面に戻る
2. 「確認」ボタンをクリック
3. ✅「所有権を確認しました」と表示されればOK

---

## 📨 サイトマップ送信

確認が完了したら、すぐにサイトマップを送信：

1. 左メニューから「サイトマップ」を選択
2. 以下を入力：
   ```
   https://short-av.com/sitemap.xml
   ```
3. 「送信」をクリック
4. ステータスが「成功しました」になればOK

---

## ✅ これだけでOK！

以上で基本設定は完了です。

24時間後にはデータが表示され始めます。

---

## 🔍 次のステップ

詳細な使い方は [Google-Search-Console-連携ガイド.md](./Google-Search-Console-連携ガイド.md) を参照してください。

特に以下は重要です：

- **検索パフォーマンス**: どのキーワードで検索されているか
- **URL検査**: 個別ページのインデックス状況
- **カバレッジ**: すべてのページが正しくインデックスされているか

---

## 🐛 うまくいかない場合

### エラー: 確認できませんでした

**原因**: デプロイが完了していない

**対処法**:
1. https://short-av.com にアクセスしてデプロイ完了を確認
2. ブラウザのキャッシュをクリア
3. もう一度「確認」をクリック

### エラー: サイトマップを取得できませんでした

**原因**: URLが間違っている

**対処法**:
1. 正しいURLを確認：`https://short-av.com/sitemap.xml`
2. ブラウザで直接アクセスして確認
3. もう一度送信

---

**所要時間**: 5-10分
**難易度**: ★☆☆☆☆（簡単）
