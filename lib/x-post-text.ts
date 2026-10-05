/**
 * X 投稿文まわりの共通処理（サーバー・管理画面の両方で使用）
 */

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

/**
 * 本文を入力済みにした X の投稿画面の URL
 */
export function buildXIntentUrl(text: string): string {
  return `https://x.com/intent/post?text=${encodeURIComponent(text)}`;
}
