/**
 * FANZA（DMM）へのリンクを、サイトの中の /go を通してから飛ばす（2026-10-27）。
 * /go は robots.txt でロボットに読ませず、守らないロボットも /go の中で User-Agent を見て断る（403）ので、ロボットが作品ページの FANZA のリンクをたどって
 * DMM のクリックに数えられるのを防げる（10/27 に Amazonbot の巡回と同じ時間に、GA に無いクリックが DMM に 27回付いた）。
 * 紹介用の ID（af_id）は同じアカウントの ID のまま渡すので、報酬はこれまでどおり付く（作品のリンクだけ 990 → 991 に付け替える。withGoAffiliateId）。
 */
const GO_HOSTS = ['dmm.co.jp', 'dmm.com', 'fanza.co.jp'];

/**
 * ロボットかどうか（User-Agent で見る）。/go でロボットを FANZA に飛ばさないために使う（2026-10-27）。
 * robots.txt の禁止を守らないロボットがいる（10/27 13時台、Facebook の meta-webindexer が /go を80回開き、DMM のクリックに数えられた）。
 * 「bot」は語の終わりで見る（Googlebot/2.1・Amazonbot/0.1 など）。スマホの機種名 CUBOT は除く。
 * Facebook・Instagram・LINE・X のアプリの中のブラウザは FBAN・Instagram・Line などを名乗り、ここには当たらない
 */
const BOT_UA = /(?<!cu)bot\b|crawler|spider|facebookexternalhit|meta-webindexer|meta-externalagent|headlesschrome|curl\/|wget\/|python-requests|go-http-client/i;

export const isBotUserAgent = (userAgent: string | null): boolean => !userAgent || BOT_UA.test(userAgent);

export const isGoTarget = (url: string): boolean => {
  try {
    const { protocol, hostname } = new URL(url);
    return protocol === 'https:' && GO_HOSTS.some((h) => hostname === h || hostname.endsWith(`.${h}`));
  } catch {
    return false;
  }
};

/**
 * /go を通ったクリックの紹介用の ID を付け替える（2026-10-27）。作品のリンク（DMM の商品情報 API が返す紹介リンク、af_id=matasuke-990）を、
 * /go を通ったときだけ matasuke-991（同じアカウントの別の ID）にする。/go を作る前（10/27 13:07 まで）にページから集めた紹介リンクを
 * ロボットが直接開くと DMM に 990 で数えられるので、DMM の画面で ID 別に見れば「サイトを通った人のクリック（991）」と分けられる。
 * URL の他の部分は変えない（lurl の符号化を崩さないよう、af_id の値だけ置き換える）
 */
const AF_ID_REWRITES: Record<string, string> = { 'matasuke-990': 'matasuke-991' };

export const withGoAffiliateId = (url: string): string =>
  url.replace(/([?&]af_id=)([^&#]+)/, (match, key: string, id: string) => (AF_ID_REWRITES[id] ? `${key}${AF_ID_REWRITES[id]}` : match));

/** FANZA（DMM）の URL なら /go を通す URL に変える。それ以外（DLsite など）はそのまま */
export function goHref(url: string): string;
export function goHref(url: string | null | undefined): string | undefined;
export function goHref(url: string | null | undefined): string | undefined {
  if (!url) return url ?? undefined;
  return isGoTarget(url) ? `/go?u=${encodeURIComponent(url)}` : url;
}
