import { getSupabaseAdmin } from '@/lib/supabase-admin';

/**
 * 毎朝の要約に足す、運営まわりの数字（サーバー専用。2026-10-26）
 * - Bing の検索からのクリック・表示（Bing Webmaster の API キー BING_WEBMASTER_API_KEY）
 * - Vercel の公開の失敗（アクセストークン VERCEL_API_TOKEN。チームは VERCEL_TEAM_ID、なければ matasuke チーム）
 * - Supabase のデータベースの大きさ（sql/021_db_size.sql の db_size_bytes()。無料プランの上限は 500MB）
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

export type VercelStats = { total: number; failed: { project: string; at: string }[] };

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
