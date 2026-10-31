/**
 * 品番（2026-10-31）。FANZA の作品番号（例: 1stars00840・h_386acrn00093）から、よく検索される形（STARS-840・ACRN-093）を作る。
 * 作品番号の頭の数字（メーカーの番号）と h_数字_ を取り、英字＋数字（数字は3桁以上にそろえる）にする。形が合わなければ null
 */
export function productCode(contentId: string | null | undefined): string | null {
  if (!contentId) return null;
  const m = contentId.toLowerCase().replace(/^h_\d+/, '').replace(/^\d+/, '').match(/^([a-z]{2,10})(\d{2,7})([a-z]{0,3})$/);
  if (!m) return null;
  const num = String(parseInt(m[2], 10)).padStart(3, '0');
  return `${m[1].toUpperCase()}-${num}${m[3].toUpperCase()}`;
}

/**
 * 検索の言葉が品番の形（STARS-840 / stars840 / STARS 840）なら、作品番号に当てる正規表現（PostgREST の match 用）を返す。
 * 作品番号は数字を5桁などにそろえて0で埋めているので、0の数は問わない
 */
export function productCodePattern(input: string): string | null {
  const m = input.trim().toLowerCase().match(/^([a-z]{2,10})[-_ ]?0*(\d{1,6})([a-z]{0,3})$/);
  if (!m) return null;
  return `^(h_[0-9]+)?[0-9]*${m[1]}0*${m[2]}${m[3]}$`;
}
