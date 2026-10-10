/**
 * 記事のアイキャッチ（1200×630）を記事ごとに生成する。記事一覧・記事ページの見出し画像と、X などのリンクカード（OG 画像）に使う。
 * 使い方: node docs/eyecatch/build.js  → public/eyecatch/<slug>.png
 * 見た目: 分類ごとの落ち着いた配色の地に、記事のタイトルを大きく。文字は Mac の Hiragino Sans
 */
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const FONT = "'Hiragino Sans', 'Hiragino Kaku Gothic ProN', sans-serif";
const W = 1200, H = 630;

// 分類ごとの配色（地の色2色と、飾りの色）
const PALETTE = {
  '性の知識': { a: '#0f172a', b: '#1e3a8a', accent: '#60a5fa' },
  'FANZA・購入': { a: '#3b0764', b: '#9d174d', accent: '#f472b6' },
  '作品の探し方': { a: '#042f2e', b: '#0f766e', accent: '#5eead4' },
  '使い方': { a: '#1c1917', b: '#44403c', accent: '#fbbf24' },
  'FAQ': { a: '#1c1917', b: '#44403c', accent: '#fbbf24' },
  'ツール': { a: '#422006', b: '#b45309', accent: '#fde047' },
};

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// 日本語のタイトルを折り返す（全角は1、半角は0.55 として数える。英数字のつながり "S/M/L" などは途中で切らない）
function wrap(text, perLine, maxLines) {
  const tokens = text.replace(/\s+/g, ' ').match(/[A-Za-z0-9\/.%\-]+|./g) || [];
  const width = (t) => [...t].reduce((a, c) => a + (/[ -~]/.test(c) ? 0.55 : 1), 0);
  const lines = [];
  let cur = '', w = 0;
  for (const t of tokens) {
    const tw = width(t);
    if (w + tw > perLine && cur) {
      // 行の終わり近くに区切り（・ 、 空白 ：）があればそこで折り返す
      const cut = Math.max(cur.lastIndexOf('・'), cur.lastIndexOf('、'), cur.lastIndexOf(' '), cur.lastIndexOf('：'));
      if (cut > 0 && cut >= cur.length - 7) {
        const head = cur.slice(0, cut + 1).trim();
        const rest = cur.slice(cut + 1).replace(/^\s+/, '');
        lines.push(head); cur = rest; w = width(rest);
      } else { lines.push(cur); cur = ''; w = 0; }
      if (t === ' ') continue;
    }
    cur += t; w += tw;
  }
  if (cur) lines.push(cur);
  if (lines.length > maxLines) { lines.length = maxLines; lines[maxLines - 1] = lines[maxLines - 1].slice(0, -1) + '…'; }
  return lines;
}

function svg({ title, category }) {
  const p = PALETTE[category] || PALETTE['使い方'];
  const size = title.length > 40 ? 52 : 60;
  const perLine = Math.floor(1040 / size);
  const lines = wrap(title, perLine, 3);
  const lineH = size * 1.45;
  const startY = H / 2 - ((lines.length - 1) * lineH) / 2 + size * 0.35;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${p.a}"/><stop offset="1" stop-color="${p.b}"/></linearGradient>
    <radialGradient id="glow" cx="0.85" cy="0.15" r="0.6"><stop offset="0" stop-color="${p.accent}" stop-opacity="0.35"/><stop offset="1" stop-color="${p.accent}" stop-opacity="0"/></radialGradient>
  </defs>
  <rect width="${W}" height="${H}" fill="url(#bg)"/>
  <rect width="${W}" height="${H}" fill="url(#glow)"/>
  <circle cx="1080" cy="560" r="260" fill="${p.accent}" opacity="0.08"/>
  <circle cx="120" cy="80" r="180" fill="#fff" opacity="0.04"/>
  <rect x="80" y="76" width="6" height="36" rx="3" fill="${p.accent}"/>
  <text x="104" y="104" font-family="${FONT}" font-weight="700" font-size="26" fill="${p.accent}">${esc(category)}</text>
  ${lines.map((l, i) => `<text x="80" y="${startY + i * lineH}" font-family="${FONT}" font-weight="800" font-size="${size}" fill="#fff">${esc(l)}</text>`).join('\n  ')}
  <text x="1120" y="566" text-anchor="end" font-family="${FONT}" font-weight="700" font-size="28" fill="#fff" opacity="0.85">Short AV</text>
  <text x="1120" y="596" text-anchor="end" font-family="${FONT}" font-weight="500" font-size="18" fill="#fff" opacity="0.6">short-av.com</text>
</svg>`;
}

(async () => {
  // 記事の一覧（TypeScript をそのまま読まず、slug/title/category だけ正規表現で拾う）
  const dir = path.join(__dirname, '../../lib/articles/content');
  for (const file of fs.readdirSync(dir).filter((f) => f.endsWith('.ts'))) {
    const src = fs.readFileSync(path.join(dir, file), 'utf8');
    const slug = src.match(/slug:\s*'([^']+)'/)?.[1];
    const title = src.match(/\n\s*title:\s*'([^']+)'/)?.[1];
    const category = src.match(/category:\s*'([^']+)'/)?.[1] || '使い方';
    if (!slug || !title) { console.warn('skip', file); continue; }
    const out = path.join(__dirname, '../../public/eyecatch', `${slug}.png`);
    await sharp(Buffer.from(svg({ title, category }))).png({ quality: 90 }).toFile(out);
    console.log('wrote', slug);
  }
})();
