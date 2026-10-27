/**
 * FANZA（DMM）へのリンクを、サイトの中の /go を通してから飛ばす（2026-10-27）。
 * /go は robots.txt でロボットに読ませず、守らないロボットも /go の中で User-Agent を見てトップへ戻すので、ロボットが作品ページの FANZA のリンクをたどって
 * DMM のクリックに数えられるのを防げる（10/27 に Amazonbot の巡回と同じ時間に、GA に無いクリックが DMM に 27回付いた）。
 * 紹介用の ID（af_id など）は URL ごとそのまま渡すので、報酬はこれまでどおり付く。
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

/** FANZA（DMM）の URL なら /go を通す URL に変える。それ以外（DLsite など）はそのまま */
export function goHref(url: string): string;
export function goHref(url: string | null | undefined): string | undefined;
export function goHref(url: string | null | undefined): string | undefined {
  if (!url) return url ?? undefined;
  return isGoTarget(url) ? `/go?u=${encodeURIComponent(url)}` : url;
}
