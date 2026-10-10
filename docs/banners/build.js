/**
 * Short AV への誘導バナー（黒背景＋実際のスワイプ画面を入れたスマホの絵）を SVG で組み立てて PNG にする。
 * 使い方: node docs/banners/build.js  → public/banners/swipe-*.png（2倍の解像度で出力。SVG も docs/banners に残す）
 * phone-src.png は本番のスワイプ画面（390×780 を2倍で撮ったもの）。文字は Mac の Hiragino Sans
 */
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const FONT = "'Hiragino Sans', 'Hiragino Kaku Gothic ProN', sans-serif";
const PHONE = 'data:image/png;base64,' + fs.readFileSync(path.join(__dirname, 'phone-src.png')).toString('base64');

// スマホ: x,y が左上、h が高さ（幅は h の半分弱）。中に本番の画面を上から入れる
function phone(x, y, h, opts = {}) {
  const w = Math.round(h * 0.48);
  const r = Math.round(w * 0.14);
  const bezel = Math.max(3, Math.round(w * 0.028));
  const id = `p${x}${y}`;
  const tilt = opts.tilt ? ` transform="rotate(${opts.tilt} ${x + w / 2} ${y + h / 2})"` : '';
  return `
  <g${tilt} filter="url(#shadow)">
    <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" fill="#0b0b0f" stroke="#2a2a33" stroke-width="${bezel * 0.6}"/>
    <clipPath id="${id}"><rect x="${x + bezel}" y="${y + bezel}" width="${w - bezel * 2}" height="${h - bezel * 2}" rx="${r - bezel}"/></clipPath>
    <image href="${PHONE}" x="${x + bezel}" y="${y + bezel}" width="${w - bezel * 2}" height="${(w - bezel * 2) * 2}" preserveAspectRatio="xMidYMin slice" clip-path="url(#${id})"/>
    <rect x="${x + w * 0.32}" y="${y + bezel * 1.2}" width="${w * 0.36}" height="${Math.max(3, w * 0.04)}" rx="${w * 0.02}" fill="#0b0b0f"/>
  </g>`;
}

const defs = (w, h) => `<defs>
  <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#0a0a12"/><stop offset="1" stop-color="#101427"/></linearGradient>
  <radialGradient id="glow" cx="0.18" cy="0.5" r="0.45"><stop offset="0" stop-color="#2563eb" stop-opacity="0.45"/><stop offset="1" stop-color="#2563eb" stop-opacity="0"/></radialGradient>
  <linearGradient id="btn" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#3b82f6"/><stop offset="1" stop-color="#2563eb"/></linearGradient>
  <filter id="shadow" x="-30%" y="-30%" width="160%" height="160%"><feDropShadow dx="0" dy="${Math.round(h * 0.03)}" stdDeviation="${Math.round(h * 0.04)}" flood-color="#000" flood-opacity="0.6"/></filter>
</defs>`;

function button(x, y, w, h, label, fontSize) {
  return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${h / 2}" fill="url(#btn)"/>
  <text x="${x + w / 2 - fontSize * 0.35}" y="${y + h / 2}" dominant-baseline="central" text-anchor="middle" font-family="${FONT}" font-weight="700" font-size="${fontSize}" fill="#fff">${label}</text>
  <polygon points="${x + w - fontSize * 1.6},${y + h / 2 - fontSize * 0.36} ${x + w - fontSize * 1.6},${y + h / 2 + fontSize * 0.36} ${x + w - fontSize * 1.0},${y + h / 2}" fill="#fff"/>`;
}
const text = (x, y, size, weight, fill, content, anchor = 'start', extra = '') =>
  `<text x="${x}" y="${y}" font-family="${FONT}" font-weight="${weight}" font-size="${size}" fill="${fill}" text-anchor="${anchor}"${extra}>${content}</text>`;
const brand = (x, y, size) => `<circle cx="${x}" cy="${y - size * 0.35}" r="${size * 0.28}" fill="#3b82f6"/>` + text(x + size * 0.6, y, size, 700, '#e5e7eb', 'Short AV');

function banner(w, h, variant) {
  let body = '';
  if (variant === '728x90') {
    body = phone(22, 12, 150)
      + text(120, 40, 21, 800, '#fff', 'サンプル動画を、縦スワイプで次々と')
      + text(120, 65, 13, 500, '#9ca3af', 'FANZA の人気作・新作 ／ 登録不要・無料')
      + brand(455, 69, 12)
      + button(548, 24, 150, 42, 'スワイプで見る', 15);
  } else if (variant === '640x200') {
    body = phone(26, 18, 300)
      + text(172, 64, 29, 800, '#fff', 'サンプル動画を、')
      + text(172, 102, 29, 800, '#fff', '縦スワイプで次々と')
      + text(172, 130, 15, 500, '#9ca3af', 'FANZA の人気作・新作 ／ 登録不要・無料')
      + brand(538, 40, 13)
      + button(172, 148, 210, 38, 'スワイプで見る', 16);
  } else if (variant === '1200x300') {
    body = phone(90, 30, 420, { tilt: -4 })
      + text(310, 118, 35, 800, '#fff', 'FANZA のサンプル動画を、縦スワイプで次々と')
      + text(310, 160, 18, 500, '#9ca3af', '人気作・新作のサンプルを会員登録なしで。気になった作品はそのまま FANZA で買えます')
      + brand(1020, 62, 18)
      + button(310, 198, 280, 62, 'スワイプで見る', 23);
  } else if (variant === '640x240') {
    body = phone(26, 20, 330)
      + text(190, 78, 31, 800, '#fff', 'サンプル動画を、')
      + text(190, 118, 31, 800, '#fff', '縦スワイプで次々と')
      + text(190, 150, 16, 500, '#9ca3af', 'FANZA の人気作・新作 ／ 登録不要・無料')
      + brand(538, 44, 14)
      + button(190, 176, 236, 44, 'スワイプで見る', 18);
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${defs(w, h)}
  <clipPath id="frame"><rect width="${w}" height="${h}"/></clipPath>
  <g clip-path="url(#frame)">
  <rect width="${w}" height="${h}" fill="url(#bg)"/>
  <rect width="${w}" height="${h}" fill="url(#glow)"/>
  <line x1="${w * 0.55}" y1="0" x2="${w * 0.8}" y2="${h}" stroke="#fff" stroke-opacity="0.025" stroke-width="${h * 0.6}"/>
  ${body}
  </g>
</svg>`;
}

(async () => {
  for (const [w, h] of [[728, 90], [640, 200], [1200, 300], [640, 240]]) {
    const variant = `${w}x${h}`;
    const svg = banner(w, h, variant);
    fs.writeFileSync(path.join(__dirname, `swipe-${variant}.svg`), svg);
    await sharp(Buffer.from(svg), { density: 144 }).png().toFile(path.join(__dirname, '../../public/banners', `swipe-${variant}.png`));
    console.log('wrote', variant);
  }
})();
