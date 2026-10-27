/**
 * X のシャドウバンの確認（サーバー専用。2026-10-26）
 * 無料の確認サイト shadowban.yuzurisa.com が使っている結果の API を、毎朝の要約から1日1回だけ呼ぶ（2アカウント）。
 * 寄付で動いている無料のサイトなので、回数は増やさない。ときどき 500 を返すので、5秒あけて3回までやり直す
 */

export const X_ACCOUNTS = ['short_av_dmm', 'mens_sizelab'] as const;

type Raw = {
  profile?: { exists?: boolean; suspended?: boolean | null; protected?: boolean | null; has_tweets?: boolean };
  tests?: { search?: boolean | string | null; typeahead?: boolean | null; ghost?: { ban?: boolean | null } };
};

// 判定: ok（問題なし）・ban（制限あり）・unknown（判定できなかった。問題なしという意味ではない）
type Verdict = 'ok' | 'ban' | 'unknown';
export type ShadowbanResult = { account: string; search: Verdict; suggestion: Verdict; ghost: Verdict; suspended: boolean } | { account: string; error: string };

const verdict = (v: boolean | string | null | undefined): Verdict =>
  v === true || v === '_implied_good' ? 'ok' : v === false || v === '_implied_bad' ? 'ban' : 'unknown';

async function checkOne(account: string): Promise<ShadowbanResult> {
  let last = '';
  for (let attempt = 0; attempt < 3; attempt++) {
    if (attempt > 0) await new Promise((r) => setTimeout(r, 5000));
    try {
      const res = await fetch(`https://shadowban-api.yuzurisa.com:444/${account}`, { cache: 'no-store', signal: AbortSignal.timeout(15_000) });
      if (!res.ok) {
        last = `HTTP ${res.status}`;
        continue;
      }
      const data = (await res.json()) as Raw;
      const result: ShadowbanResult = {
        account,
        search: verdict(data.tests?.search),
        suggestion: verdict(data.tests?.typeahead),
        ghost: data.tests?.ghost?.ban === true ? 'ban' : data.tests?.ghost?.ban === false ? 'ok' : 'unknown',
        suspended: data.profile?.suspended === true,
      };
      // 検索・検索候補がどちらも判定できなかったときは、確認サイトが一時的に答えられなかっただけのことが多いので、やり直す（2026-10-27）
      if (result.search === 'unknown' && result.suggestion === 'unknown' && attempt < 2) {
        last = '判定できず';
        continue;
      }
      return result;
    } catch (error) {
      last = error instanceof Error ? error.message : String(error);
    }
  }
  return { account, error: last || '確認できませんでした' };
}

/** 2つのアカウントを確認する（要約の時間に収まるよう2件は同時に。1件あたり最長でおよそ55秒） */
export async function checkShadowbans(): Promise<ShadowbanResult[]> {
  return Promise.all(X_ACCOUNTS.map(checkOne));
}
