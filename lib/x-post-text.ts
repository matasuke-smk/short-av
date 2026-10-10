/**
 * X 投稿文まわりの共通処理（サーバー・管理画面の両方で使用）
 */
import type { Doujin } from '@/lib/doujin-types';

export const SITE_URL = 'https://short-av.com';
// 投稿文のリンクの下に付ける一言。X のアプリ内ブラウザだと表示が狭くスワイプもしづらいので、ブラウザで開いてもらう（2026-10-09）
export const BROWSER_HINT = '※ブラウザで開くと快適です';
export const X_MAX_WEIGHTED_LENGTH = 280;
// X は URL を長さに関わらず 23 文字として数える
const X_URL_LENGTH = 23;

export function getVideoUrl(dmmContentId: string): string {
  return `${SITE_URL}/?v=${encodeURIComponent(dmmContentId)}`;
}

// 投稿形式。Google Analytics で効果を比べられるよう utm_content に入れる
export type XPostFormat = 'card' | 'img4';
export const X_POST_FORMAT_LABEL: Record<XPostFormat, string> = {
  card: 'リンクカード',
  img4: '画像4枚',
};

/**
 * X 投稿用の作品 URL（計測用の utm パラメータ付き）
 */
export function getXPostVideoUrl(dmmContentId: string, format: XPostFormat = 'card'): string {
  const params = new URLSearchParams({
    v: dmmContentId,
    utm_source: 'x',
    utm_medium: 'social',
    utm_campaign: 'x_post',
    utm_content: format,
  });
  return `${SITE_URL}/?${params.toString()}`;
}

/**
 * X 投稿用の同人誌の URL。開くと同人誌モードの画面（その作品から。同人誌だけ）になる
 */
export function getXPostDoujinUrl(contentId: string): string {
  const params = new URLSearchParams({
    mode: 'doujin',
    d: contentId,
    utm_source: 'x',
    utm_medium: 'social',
    utm_campaign: 'x_post_doujin',
  });
  return `${SITE_URL}/?${params.toString()}`;
}

export function getPostFormat(text: string): XPostFormat {
  return /[?&]utm_content=img4\b/.test(text) ? 'img4' : 'card';
}

/**
 * 投稿文中の作品 URL の utm_content を書き換える。
 * utm パラメータが無い URL（この機能より前に作った候補）には付け足す。
 */
export function setPostFormat(text: string, format: XPostFormat): string {
  return text.replace(/https:\/\/short-av\.com\/\?\S+/g, (url) => {
    const parsed = new URL(url);
    const v = parsed.searchParams.get('v');
    return v ? getXPostVideoUrl(v, format) : url;
  });
}

/**
 * X の文字数カウント（twitter-text の重み付けを簡略化したもの）
 * ラテン文字などは1、日本語・絵文字などは2、URL は23として数える。上限は280。
 */
export function countXWeightedLength(text: string): number {
  let length = 0;
  const withoutUrls = text.replace(/https?:\/\/\S+/g, () => {
    length += X_URL_LENGTH;
    return '';
  });

  for (const char of withoutUrls) {
    const code = char.codePointAt(0)!;
    const isLight =
      code <= 0x10ff ||
      (code >= 0x2000 && code <= 0x200d) ||
      (code >= 0x2010 && code <= 0x201f) ||
      (code >= 0x2032 && code <= 0x2037);
    length += isLight ? 1 : 2;
  }
  return length;
}

const yenText = (n: number) => `¥${n.toLocaleString('ja-JP')}`;

// 見出し（「別の見出しにする」で順に切り替える）
const DOUJIN_HEADINGS = [(n: number) => `【同人誌・${n}ページ試し読み】`, (n: number) => `【スワイプで${n}ページ読める同人誌】`, () => '【人気の同人誌】'];


/**
 * 同人誌の X 投稿文。リンクを開くと、その作品から始まる同人誌モードの画面（同人誌だけ）になる（?mode=doujin&d=）
 * 280 を超える場合はタイトルを切り詰める
 */
export function buildDoujinPostText(doujin: Doujin, headingIndex: number): string {
  const url = getXPostDoujinUrl(doujin.contentId);
  const onSale = doujin.price !== null && doujin.listPrice !== null && doujin.listPrice > doujin.price;
  const price = doujin.price === null ? '' : onSale ? `セール中 ${yenText(doujin.price)}（通常 ${yenText(doujin.listPrice!)}）` : yenText(doujin.price);
  const build = (title: string) =>
    [
      DOUJIN_HEADINGS[headingIndex % DOUJIN_HEADINGS.length](doujin.samples.length),
      title,
      doujin.circle ? `サークル: ${doujin.circle}` : '',
      price,
      '',
      'スワイプで試し読みはこちら👇',
      url,
      BROWSER_HINT,
      '',
      '#PR #FANZA同人',
    ]
      .filter((line, i, arr) => line !== '' || arr[i - 1] !== '')
      .join('\n');
  let title = doujin.title;
  let text = build(title);
  while (countXWeightedLength(text) > X_MAX_WEIGHTED_LENGTH && title.length > 10) {
    title = `${[...title].slice(0, -5).join('')}…`;
    text = build(title);
  }
  return text;
}

// ---------------------------------------------------------------------------
// 動画の投稿文（文の構造を毎回変える）
//
// 以前は「見出し／題名／出演／『サンプル動画はこちら👇』／リンク／注意書き／タグ」の並びが毎回同じで、
// 見出しの語句だけを変えていた。並びまで同じなのが機械的に見える原因だったので、
// 文の構造（何から書き出すか）・締めの言い回し・タグの揺らぎを組み合わせて、同じ作品でも毎回ちがう文にする（2026-10-10）
// ---------------------------------------------------------------------------

export type VideoPostFacts = {
  title: string;
  /** 出演（最大2人を「・」でつないだもの） */
  actress?: string;
  maker?: string | null;
  rank?: number | null;
  /** 発売から日が浅い */
  isNew?: boolean;
  sampleSeconds?: number | null;
  /** ジャンル名（DMM のもの。技術的なもの「ハイビジョン」などは除いて渡す） */
  genres?: string[];
};

const pickOne = <T,>(items: T[]): T => items[Math.floor(Math.random() * items.length)];

// ジャンル名 → 書き出しに使う言い回し（部分一致。上から順に見る）
const GENRE_PHRASES: [RegExp, string[]][] = [
  [/ジム|スポーツ|アスリート|体操/, ['ジムやスポーツものが好きなら', 'スポーツウェア好きに']],
  [/痴女/, ['痴女ものが好きなら', '責められたい人向け']],
  [/人妻|主婦/, ['人妻ものが好きなら', '人妻系で探している人に']],
  [/熟女|四十路|五十路/, ['熟女好きなら', '大人の女性が好きな人に']],
  [/巨乳|爆乳|パイズリ/, ['巨乳好きなら', 'おっぱい重視の人に']],
  [/巨尻|美尻|尻/, ['お尻好きなら', 'お尻で選ぶ人に']],
  [/寝取|NTR/, ['寝取られものが好きなら', 'NTR で探している人に']],
  [/素人|ナンパ/, ['素人ものが好きなら', 'ガチっぽさ重視の人に']],
  [/OL|秘書/, ['OL ものが好きなら', 'スーツ系が好きな人に']],
  [/ナース|看護/, ['ナースものが好きなら']],
  [/女教師|先生/, ['女教師ものが好きなら']],
  [/メイド|コスプレ/, ['コスプレ好きなら']],
  [/中出し/, ['中出しもので探している人に']],
  [/乱交|複数|3P|4P/, ['複数ものが好きなら']],
  [/美少女|ロリ/, ['かわいい系が好きなら']],
  [/美乳|スレンダー|スリム/, ['スレンダー好きなら']],
  [/温泉|旅行/, ['温泉・旅行ものが好きなら']],
  [/ドラマ|ストーリー/, ['ストーリー重視の人に']],
  [/VR/, ['VR で見たい人に']],
];

// 書き出しに使わない技術的なジャンル
const SKIP_GENRES = /ハイビジョン|4K|独占|単体|配信専用|サンプル|デジモ|期間限定|セール|キャンペーン|FANZA|MGS|アダルト|AV/;

function genrePhrase(genres: string[] | undefined): string | null {
  const usable = (genres ?? []).filter((g) => !SKIP_GENRES.test(g));
  for (const [re, phrases] of GENRE_PHRASES) {
    if (usable.some((g) => re.test(g))) return pickOne(phrases);
  }
  if (usable.length > 0) return `${usable[0]}ものが好きなら`;
  return null;
}

const minutesText = (seconds: number) => {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  if (s < 10) return `${m}分`;
  if (s < 45) return `${m}分半`;
  return `${m + 1}分近く`;
};

/** 構造ごとの「書き出し」の候補（作品の情報から作れるものだけ） */
function openers(f: VideoPostFacts): string[] {
  const out: string[] = [];
  const g = genrePhrase(f.genres);
  const sample = f.sampleSeconds ? minutesText(f.sampleSeconds) : null;
  if (f.rank && f.rank <= 30) {
    out.push(`いま人気${f.rank}位。`, `人気ランキング${f.rank}位の作品。`);
    if (f.actress) out.push(`人気${f.rank}位の${f.actress}。`);
  }
  if (f.isNew) {
    out.push('今週の新作。', '発売されたばかりの新作。');
    if (f.actress) out.push(`${f.actress}の新作が出ました。`);
  }
  if (sample) {
    out.push(`サンプルが${sample}ある1本。`, `無料サンプル${sample}。まずこれだけでも。`);
    if (f.sampleSeconds! >= 240) out.push(`サンプルだけで${sample}。本編を買う前に、ほぼ雰囲気がつかめます。`);
  }
  if (g) out.push(`${g}、これは見ておいていい1本。`, `${g}チェックしてほしい作品。`);
  if (f.actress) out.push(`${f.actress}が気になっている人へ。`, `${f.actress}出演。`);
  if (f.maker && !f.actress) out.push(`${f.maker}の作品。`);
  if (out.length === 0) out.push('今日のおすすめ。', 'サンプルから見てほしい1本。');
  return out;
}

/** 締め（リンクの前の1行） */
function ctaLines(f: VideoPostFacts): string[] {
  const sample = f.sampleSeconds ? minutesText(f.sampleSeconds) : null;
  const out = ['サンプル動画はこちら👇', 'サンプルは下のリンクから👇', 'まずサンプルを👇', '気になったらサンプルをどうぞ👇'];
  if (sample) out.push(`無料サンプル（${sample}）はこちら👇`, `${sample}のサンプルはこちら👇`);
  return out;
}

const TAG_LINES = ['#PR #FANZA', '#PR #FANZA', '#PR #FANZA #AV', '#FANZA #PR'];

/**
 * 動画の X 投稿文。構造を4通りから選ぶ:
 *  A 事実から: 書き出し → 題名 → 出演 → 締め → リンク
 *  B 題名から: 題名 → 出演・補足 → 一言 → 締め → リンク
 *  C 一言だけ: 書き出し（短い） → 題名 → 締め → リンク（出演は題名に入っていることが多いので省く）
 *  D 見出し型: 【…】見出し → 題名 → 出演 → 締め → リンク（以前の形。検索されやすい語を頭に置く）
 * 280 を超える場合は題名を切り詰める
 */
export function buildVideoPost(f: VideoPostFacts, url: string, headings: string[] = []): string {
  const structure = pickOne(['A', 'B', 'C', 'D'] as const);
  const opener = pickOne(openers(f));
  const cta = pickOne(ctaLines(f));
  const tags = pickOne(TAG_LINES);
  const cast = f.actress ? `出演: ${f.actress}` : f.maker ? `メーカー: ${f.maker}` : '';
  const sample = f.sampleSeconds ? `サンプル ${minutesText(f.sampleSeconds)}` : '';
  const note = [cast, sample].filter(Boolean).join('／');
  const heading = headings.length > 0 ? pickOne(headings) : null;

  const build = (title: string): string => {
    let lines: string[];
    switch (structure) {
      case 'A':
        lines = [opener, title, cast, '', cta, url, BROWSER_HINT, '', tags];
        break;
      case 'B':
        lines = [title, note, '', opener, cta, url, BROWSER_HINT, '', tags];
        break;
      case 'C':
        lines = [opener, '', title, '', cta, url, BROWSER_HINT, '', tags];
        break;
      default:
        lines = [heading ?? opener, title, cast, '', cta, url, BROWSER_HINT, '', tags];
    }
    return lines.filter((line, i, arr) => line !== '' || (i > 0 && arr[i - 1] !== '')).join('\n');
  };

  let title = f.title;
  let text = build(title);
  while (countXWeightedLength(text) > X_MAX_WEIGHTED_LENGTH && title.length > 10) {
    title = `${[...title].slice(0, -5).join('')}…`;
    text = build(title);
  }
  return text;
}
