# Short AV への誘導バナー（記事ページ・記事一覧）

- `build.js` が SVG を組み立てて `public/banners/swipe-*.png` を出す: `node docs/banners/build.js`（文字は Mac の Hiragino Sans）
- 2026-10-10 にユーザーの希望（黒背景＋スマホの画面イラスト）で作成。4サイズ:
  - `swipe-728x90.png` 記事ページの本文の上（PC）、`swipe-640x200.png` 同（スマホ）
  - `swipe-1200x300.png` 記事一覧の上（PC）、`swipe-640x240.png` 同（スマホ）
- 出す場所は `app/articles/SwipeBanner.tsx`（押した回数は GA の article_cta_click、position: banner_article / banner_list）
