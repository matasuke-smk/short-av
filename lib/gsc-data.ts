import { createSign } from 'crypto';

/**
 * Google Search Console の検索語・ページのデータを読む（サーバー専用。2026-10-25）
 * GA と同じサービスアカウントの鍵（GA_SERVICE_ACCOUNT_KEY）を使う。Search Console の「ユーザーと権限」に
 * ga-reader@short-av-analytics.iam.gserviceaccount.com を「制限付き」で追加してある（short-av.com・mens-sizelab.app）
 */

export const GSC_SITES = { shortav: 'sc-domain:short-av.com', mens: 'sc-domain:mens-sizelab.app' } as const;
export type GscSite = keyof typeof GSC_SITES;

const SCOPE = 'https://www.googleapis.com/auth/webmasters.readonly';
type Key = { client_email: string; private_key: string };
let cached: { token: string; expiresAt: number } | null = null;
const b64url = (s: string | Buffer) => Buffer.from(s).toString('base64').replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');

async function token(): Promise<string> {
  if (cached && cached.expiresAt > Date.now() + 60_000) return cached.token;
  const raw = process.env.GA_SERVICE_ACCOUNT_KEY?.trim();
  if (!raw) throw new Error('GA_SERVICE_ACCOUNT_KEY が設定されていません');
  const key = JSON.parse(raw.startsWith('{') ? raw : Buffer.from(raw, 'base64').toString('utf8')) as Key;
  const now = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claims = b64url(JSON.stringify({ iss: key.client_email, scope: SCOPE, aud: 'https://oauth2.googleapis.com/token', iat: now, exp: now + 3600 }));
  const signer = createSign('RSA-SHA256');
  signer.update(`${header}.${claims}`);
  const sig = b64url(signer.sign(key.private_key));
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: `${header}.${claims}.${sig}` }),
    cache: 'no-store',
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`Search Console のトークン取得に失敗: ${data.error_description ?? data.error}`);
  cached = { token: data.access_token, expiresAt: Date.now() + data.expires_in * 1000 };
  return cached.token;
}

export type GscRow = { keys: string[]; clicks: number; impressions: number; ctr: number; position: number };

/** 検索語（dimension 'query'）やページ（'page'）ごとの数字。日付は YYYY-MM-DD */
export async function gscQuery(site: GscSite, startDate: string, endDate: string, dimensions: ('query' | 'page')[], rowLimit = 200): Promise<GscRow[]> {
  const url = `https://searchconsole.googleapis.com/webmasters/v3/sites/${encodeURIComponent(GSC_SITES[site])}/searchAnalytics/query`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${await token()}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ startDate, endDate, dimensions, rowLimit, dataState: 'all' }),
    cache: 'no-store',
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`Search Console の取得に失敗（${site}）: ${data.error?.message ?? res.status}`);
  return (data.rows ?? []) as GscRow[];
}
