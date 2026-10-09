# ページ専用の OG 画像（X などのリンクカード）

- `size-tool.svg` → `public/og/size-tool.png`（1200×630）: ペニスサイズ偏差値チェッカー用。2026-10-10 にユーザーの希望（直接的でポップ、バナナ）で作成
- PNG の作り直し: `node -e "require('sharp')('docs/og/size-tool.svg').png().toFile('public/og/size-tool.png')"`（文字は Mac の Hiragino Sans で描画）
- 記事に `ogImage: '/og/size-tool.png'` を付けると、その記事だけこの画像になる（lib/articles/types.ts、app/articles/[slug]/page.tsx）
