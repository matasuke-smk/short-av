/**
 * Short AV への誘導バナー（黒背景＋スマホの画面イラスト）を SVG で組み立てて PNG にする。
 * 使い方: node docs/banners/build.js  → public/banners/swipe-*.png（SVG も docs/banners に残す）
 * 文字は Mac の Hiragino Sans で描画する（README 参照）
 */
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const FONT = "'Hiragino Sans', 'Hiragino Kaku Gothic ProN', sans-serif";

// スマホの絵: x,y が左上、h が高さ。中に作品カードが縦に3枚並び、右に上向きの矢印（スワイプ）
function phone(x, y, h) {
  const w = Math.round(h * 0.5);
  const r = Math.round(h * 0.09);
  const pad = Math.round(h * 0.05);
  const cardW = w - pad * 2;
  const cardH = Math.round(h * 0.42);
  const gap = Math.round(h * 0.03);
  const cy = y + Math.round(h * 0.29); // 真ん中のカードの上端
  const cards = [
    { y: cy - cardH - gap, g: 'g1', op: 0.45 },
    { y: cy, g: 'g2', op: 1 },
    { y: cy + cardH + gap, g: 'g3', op: 0.45 },
  ];
  const tri = (cx, cyy, s) => `<polygon points="${cx - s * 0.4},${cyy - s * 0.5} ${cx - s * 0.4},${cyy + s * 0.5} ${cx + s * 0.6},${cyy}" fill="#fff"/>`;
  const arrowX = x + w + Math.round(h * 0.12);
  const chevron = (cyy, s, op) => `<polyline points="${arrowX - s},${cyy + s * 0.6} ${arrowX},${cyy - s * 0.4} ${arrowX + s},${cyy + s * 0.6}" fill="none" stroke="#fff" stroke-width="${Math.max(2, s * 0.28)}" stroke-linecap="round" stroke-linejoin="round" opacity="${op}"/>`;
  const s = Math.round(h * 0.07);
  return `
  <clipPath id="clip-${x}-${y}"><rect x="${x + pad}" y="${y + pad}" width="${cardW}" height="${h - pad * 2}" rx="${Math.round(r * 0.6)}"/></clipPath>
  <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" fill="#171717" stroke="#3f3f46" stroke-width="${Math.max(2, h * 0.012)}"/>
  <g clip-path="url(#clip-${x}-${y})">
    ${cards.map((c) => `<rect x="${x + pad}" y="${c.y}" width="${cardW}" height="${cardH}" rx="${Math.round(r * 0.5)}" fill="url(#${c.g})" opacity="${c.op}"/>`).join('')}
    ${tri(x + w / 2, cy + cardH / 2, Math.round(h * 0.12))}
  </g>
  ${chevron(y + h * 0.40, s, 1)}${chevron(y + h * 0.52, s, 0.55)}${chevron(y + h * 0.64, s, 0.25)}`;
}

const defs = `<defs>
  <linearGradient id="g1" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#f472b6"/><stop offset="1" stop-color="#7c3aed"/></linearGradient>
  <linearGradient id="g2" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#38bdf8"/><stop offset="1" stop-color="#2563eb"/></linearGradient>
  <linearGradient id="g3" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fb923c"/><stop offset="1" stop-color="#e11d48"/></linearGradient>
</defs>`;

function button(x, y, w, h, label, fontSize) {
  return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${h / 2}" fill="#2563eb"/>
  <text x="${x + w / 2}" y="${y + h / 2}" dominant-baseline="central" text-anchor="middle" font-family="${FONT}" font-weight="700" font-size="${fontSize}" fill="#fff">${label}</text>`;
}

const text = (x, y, size, weight, fill, content, anchor = 'start') =>
  `<text x="${x}" y="${y}" font-family="${FONT}" font-weight="${weight}" font-size="${size}" fill="${fill}" text-anchor="${anchor}">${content}</text>`;

function banner(w, h, variant) {
  let body = '';
  if (variant === '728x90') {
    // 横長（PC の記事の上）: 左にスマホ、中央に1行、右にボタン
    body = phone(16, 10, 70)
      + text(96, 40, 22, 800, '#fff', 'サンプル動画を、縦スワイプで次々と')
      + text(96, 68, 13, 500, '#a3a3a3', 'FANZA の人気作・新作 ／ 登録不要・無料')
      + text(536, 68, 12, 700, '#737373', 'Short AV', 'end')
      + button(552, 24, 160, 42, 'スワイプ画面を開く', 15);
  } else if (variant === '640x200') {
    // スマホの記事の上
    body = phone(24, 20, 160)
      + text(160, 70, 30, 800, '#fff', 'サンプル動画を、')
      + text(160, 108, 30, 800, '#fff', '縦スワイプで次々と')
      + text(160, 136, 15, 500, '#a3a3a3', 'FANZA の人気作・新作 ／ 登録不要・無料')
      + text(616, 36, 14, 700, '#737373', 'Short AV', 'end')
      + button(160, 152, 220, 36, 'スワイプ画面を開く ▶', 16);
  } else if (variant === '1200x300') {
    // PC の記事一覧の上
    body = phone(70, 30, 240)
      + text(260, 118, 46, 800, '#fff', 'サンプル動画を、縦スワイプで次々と')
      + text(260, 166, 22, 500, '#a3a3a3', 'FANZA の人気作・新作のサンプルを、会員登録なしで。気になったらそのまま FANZA へ')
      + text(1130, 60, 18, 700, '#737373', 'Short AV', 'end')
      + button(260, 200, 300, 64, 'スワイプ画面を開く ▶', 24);
  } else if (variant === '640x240') {
    // スマホの記事一覧の上
    body = phone(24, 20, 200)
      + text(185, 80, 32, 800, '#fff', 'サンプル動画を、')
      + text(185, 122, 32, 800, '#fff', '縦スワイプで次々と')
      + text(185, 156, 16, 500, '#a3a3a3', 'FANZA の人気作・新作 ／ 登録不要・無料')
      + text(616, 36, 14, 700, '#737373', 'Short AV', 'end')
      + button(185, 180, 240, 44, 'スワイプ画面を開く ▶', 18);
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${defs}
  <rect width="${w}" height="${h}" fill="#0a0a0a"/>${body}
</svg>`;
}

(async () => {
  for (const [w, h] of [[728, 90], [640, 200], [1200, 300], [640, 240]]) {
    const variant = `${w}x${h}`;
    const svg = banner(w, h, variant);
    fs.writeFileSync(path.join(__dirname, `swipe-${variant}.svg`), svg);
    await sharp(Buffer.from(svg)).png().toFile(path.join(__dirname, '../../public/banners', `swipe-${variant}.png`));
    console.log('wrote', variant);
  }
})();
