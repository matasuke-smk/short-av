# 記事のアイキャッチ（記事一覧・関連記事・OG 画像）

- `build.js` が `lib/articles/content/*.ts` の slug / title / category を読んで `public/eyecatch/<slug>.png`（1200×630）を作る: `node docs/eyecatch/build.js`
- 分類ごとの配色の地にタイトルを大きく置くだけの画像。記事を追加・改題したら作り直す
- 専用の OG 画像がある記事（`ogImage`）はそちらが優先（`getArticleEyecatch`）。X のリンクカードもこの画像になる
