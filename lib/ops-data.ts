import { getSupabaseAdmin } from '@/lib/supabase-admin';

/**
 * 毎朝の要約に足す、運営まわりの数字（サーバー専用。2026-10-26）
 * - Bing の検索からのクリック・表示（Bing Webmaster の API キー BING_WEBMASTER_API_KEY）
 * - Vercel の公開の失敗（アクセストークン VERCEL_API_TOKEN。チームは VERCEL_TEAM_ID、なければ matasuke チーム）
 * - Supabase のデータベースの大きさ（sql/021_db_size.sql の db_size_bytes()。無料プランの上限は 500MB）
 * - Cloudflare Workers の今月のリクエスト数など（読み取り専用の API トークン CLOUDFLARE_API_TOKEN。アカウントは CLOUDFLARE_ACCOUNT_ID、なければ Bechan のアカウント。2026-10-29）
 * キーや関数がないときは null を返し、要約はその項目を飛ばす
 */

const JST = 9 * 3_600_000;
const ymd = (d: Date) => d.toISOString().slice(0, 10);
const DEFAULT_TEAM_ID = 'team_IGGDmXBHmVIsRsJYicWMHqxo';

export const BING_SITES = { shortav: 'https://short-av.com/', mens: 'https://mens-sizelab.app/' } as const;

export type BingStats = { yesterday: { clicks: number; impressions: number }; week: { clicks: number; impressions: number }; latestDate: string };

/** Bing の日ごとの検索の数字（昨日と、7日間の合計）。Bing のデータは1〜2日遅れるので、最新の日付も返す */
export async function getBingStats(site: keyof typeof BING_SITES, y: string): Promise<BingStats | null> {
  const key = process.env.BING_WEBMASTER_API_KEY?.trim();
  if (!key) return null;
  try {
    const url = `https://ssl.bing.com/webmaster/api.svc/json/GetRankAndTrafficStats?siteUrl=${encodeURIComponent(BING_SITES[site])}&apikey=${encodeURIComponent(key)}`;
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) throw new Error(`Bing ${res.status}`);
    const data = (await res.json()) as { d?: { Date: string; Clicks: number; Impressions: number }[] };
    // 日付は "/Date(1729900800000)/" の形（その日の0時 UTC）
    const rows = (data.d ?? []).map((r) => ({ date: ymd(new Date(Number(r.Date.match(/\d+/)?.[0] ?? 0))), clicks: r.Clicks, impressions: r.Impressions }));
    const weekStart = ymd(new Date(new Date(`${y}T00:00:00Z`).getTime() - 6 * 86_400_000));
    const inWeek = rows.filter((r) => r.date >= weekStart && r.date <= y);
    const yRow = rows.find((r) => r.date === y);
    return {
      yesterday: { clicks: yRow?.clicks ?? 0, impressions: yRow?.impressions ?? 0 },
      week: { clicks: inWeek.reduce((s, r) => s + r.clicks, 0), impressions: inWeek.reduce((s, r) => s + r.impressions, 0) },
      latestDate: rows.map((r) => r.date).sort().at(-1) ?? '',
    };
  } catch (error) {
    console.error('[ops-data] bing', site, error);
    return null;
  }
}

export type VercelStats = {
  total: number;
  failed: { project: string; at: string }[];
  // 今の請求期間（毎月8日から）の利用料金（ドル）と、多い項目（2026-10-26 追加。Billing API。取れなければ null）
  billing: { from: string; usd: number; top: { service: string; usd: number }[] } | null;
};

// Vercel の利用料金（FOCUS 形式の明細、1行1件の JSON）。請求期間は毎月8日から（Pro の契約日）
async function getVercelBilling(token: string, team: string): Promise<VercelStats['billing']> {
  try {
    const now = new Date();
    const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - (now.getUTCDate() >= 8 ? 0 : 1), 8));
    const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));
    const url = `https://api.vercel.com/v1/billing/charges?teamId=${team}&from=${start.toISOString()}&to=${end.toISOString()}`;
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store', signal: AbortSignal.timeout(20_000) });
    if (!res.ok) throw new Error(`Vercel billing ${res.status}`);
    const byService = new Map<string, number>();
    let usd = 0;
    for (const line of (await res.text()).split(/\r?\n/)) {
      if (!line.trim()) continue;
      const c = JSON.parse(line) as { EffectiveCost: number | string; ChargeCategory: string; ServiceName: string };
      // 含まれる分（20ドル）の内側は BilledCost が0なので、使った分の金額 EffectiveCost を足す。
      // ServiceName "Pro" はプランの月額の日割りなので除く（除くと画面の利用額と一致。2026-10-27 確認）
      if (c.ChargeCategory !== 'Usage' || c.ServiceName === 'Pro') continue;
      const cost = Number(c.EffectiveCost) || 0;
      usd += cost;
      byService.set(c.ServiceName, (byService.get(c.ServiceName) ?? 0) + cost);
    }
    const round = (n: number) => Math.round(n * 100) / 100;
    return {
      from: start.toISOString().slice(0, 10),
      usd: round(usd),
      top: [...byService.entries()].sort((x, y) => y[1] - x[1]).slice(0, 3).map(([service, cost]) => ({ service, usd: round(cost) })),
    };
  } catch (error) {
    console.error('[ops-data] vercel billing', error);
    return null;
  }
}

/** 直近24時間の Vercel の公開（デプロイ）の数と、失敗したもの */
export async function getVercelStats(): Promise<VercelStats | null> {
  const token = process.env.VERCEL_API_TOKEN?.trim();
  if (!token) return null;
  try {
    const team = process.env.VERCEL_TEAM_ID?.trim() || DEFAULT_TEAM_ID;
    const since = Date.now() - 86_400_000;
    const res = await fetch(`https://api.vercel.com/v6/deployments?teamId=${team}&since=${since}&limit=100`, { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' });
    if (!res.ok) throw new Error(`Vercel ${res.status}`);
    const data = (await res.json()) as { deployments?: { name: string; state?: string; readyState?: string; created: number }[] };
    const list = data.deployments ?? [];
    return {
      billing: await getVercelBilling(token, team),
      total: list.length,
      failed: list
        .filter((d) => (d.readyState ?? d.state) === 'ERROR')
        .map((d) => ({ project: d.name, at: new Date(d.created + JST).toISOString().slice(5, 16).replace('T', ' ') })),
    };
  } catch (error) {
    console.error('[ops-data] vercel', error);
    return null;
  }
}

const DEFAULT_CF_ACCOUNT_ID = '4c9f9d6a836c5eef08c86b9a95b577e5';
// Workers Paid（月5ドル）に含まれるリクエスト数（月1,000万。超えた分は100万ごとに0.30ドル）
const CF_INCLUDED_REQUESTS = 10_000_000;

export type CloudflareStats = {
  from: string;
  requests: number;
  includedRequests: number;
  // Worker ごと（short-av・mens-size-lab）。cpuP50Ms / cpuP99Ms は1回の処理の CPU 時間（ミリ秒）の中央値と上位1%
  workers: { name: string; requests: number; errors: number; cpuP50Ms: number; cpuP99Ms: number }[];
};

/** Cloudflare Workers の今月（1日から、UTC）のリクエスト数とエラー・CPU 時間（GraphQL の workersInvocationsAdaptive） */
export async function getCloudflareStats(): Promise<CloudflareStats | null> {
  const token = process.env.CLOUDFLARE_API_TOKEN?.trim();
  if (!token) return null;
  try {
    const account = process.env.CLOUDFLARE_ACCOUNT_ID?.trim() || DEFAULT_CF_ACCOUNT_ID;
    const now = new Date();
    const from = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    const query = `query ($account: String!, $from: Time!, $to: Time!) {
      viewer { accounts(filter: { accountTag: $account }) {
        workersInvocationsAdaptive(limit: 100, filter: { datetime_geq: $from, datetime_leq: $to }) {
          sum { requests errors }
          quantiles { cpuTimeP50 cpuTimeP99 }
          dimensions { scriptName }
        }
      } }
    }`;
    const res = await fetch('https://api.cloudflare.com/client/v4/graphql', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, variables: { account, from: from.toISOString(), to: now.toISOString() } }),
      cache: 'no-store',
      signal: AbortSignal.timeout(20_000),
    });
    if (!res.ok) throw new Error(`Cloudflare ${res.status}`);
    type Row = { sum: { requests: number; errors: number }; quantiles: { cpuTimeP50: number; cpuTimeP99: number }; dimensions: { scriptName: string } };
    const data = (await res.json()) as { data?: { viewer?: { accounts?: { workersInvocationsAdaptive?: Row[] }[] } }; errors?: { message: string }[] | null };
    if (data.errors?.length) throw new Error(data.errors.map((e) => e.message).join(' / '));
    const rows = data.data?.viewer?.accounts?.[0]?.workersInvocationsAdaptive ?? [];
    // CPU 時間はマイクロ秒で返る
    const ms = (us: number) => Math.round((us / 1000) * 10) / 10;
    const workers = rows
      .map((r) => ({ name: r.dimensions.scriptName, requests: r.sum.requests, errors: r.sum.errors, cpuP50Ms: ms(r.quantiles.cpuTimeP50), cpuP99Ms: ms(r.quantiles.cpuTimeP99) }))
      .sort((a, b) => b.requests - a.requests);
    return {
      from: from.toISOString().slice(0, 10),
      requests: workers.reduce((sum, w) => sum + w.requests, 0),
      includedRequests: CF_INCLUDED_REQUESTS,
      workers,
    };
  } catch (error) {
    console.error('[ops-data] cloudflare', error);
    return null;
  }
}

/** データベースの大きさ（MB）。無料プランの上限 500MB に対する割合も返す */
export async function getDbSize(): Promise<{ mb: number; percentOfFree: number } | null> {
  try {
    const { data, error } = await getSupabaseAdmin().rpc('db_size_bytes');
    if (error) throw error;
    const mb = Math.round(Number(data) / 1024 / 1024);
    return { mb, percentOfFree: Math.round((mb / 500) * 100) };
  } catch (error) {
    console.error('[ops-data] db size', error);
    return null;
  }
}
