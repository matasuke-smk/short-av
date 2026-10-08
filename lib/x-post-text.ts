/**
 * X 投稿文まわりの共通処理（サーバー・管理画面の両方で使用）
 */
import type { Doujin } from '@/lib/doujin-types';

export const SITE_URL = 'https://short-av.com';
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
 * X 投稿用の同人誌の URL。開くと同人誌中心の画面（その作品から。ときどき動画を挟む）になる
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
 * 同人誌の X 投稿文。リンクを開くと、その作品から始まる同人誌中心の画面（ときどき動画）になる（?mode=doujin&d=）
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
