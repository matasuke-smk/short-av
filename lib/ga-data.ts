import { createSign } from 'crypto';

/**
 * Google Analytics Data API（GA4 のレポート取得）をサーバー側で呼ぶための最小限のクライアント
 *
 * 必要な環境変数:
 * - GA_SERVICE_ACCOUNT_KEY: サービスアカウントの JSON キー（中身そのまま、または base64）
 * - GA_PROPERTY_ID: GA4 のプロパティ ID（数字のみ。未設定なら short-av.com のプロパティ）
 * サービスアカウントのメールアドレスを、GA の「プロパティのアクセス管理」で「閲覧者」として追加しておく。
 */

const DEFAULT_PROPERTY_ID = '511166539';
const SCOPE = 'https://www.googleapis.com/auth/analytics.readonly';

type ServiceAccountKey = { client_email: string; private_key: string };

export class GaNotConfiguredError extends Error {}

function readKey(): ServiceAccountKey {
  const raw = process.env.GA_SERVICE_ACCOUNT_KEY?.trim();
  if (!raw) throw new GaNotConfiguredError('GA_SERVICE_ACCOUNT_KEY が設定されていません');
  const json = raw.startsWith('{') ? raw : Buffer.from(raw, 'base64').toString('utf8');
  const key = JSON.parse(json) as ServiceAccountKey;
  if (!key.client_email || !key.private_key) {
    throw new GaNotConfiguredError('GA_SERVICE_ACCOUNT_KEY の形式が正しくありません');
  }
  return key;
}

const base64url = (input: string | Buffer) =>
  Buffer.from(input).toString('base64').replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');

let cachedToken: { token: string; expiresAt: number } | null = null;

// サービスアカウントの JWT をアクセストークンに交換する（1時間有効。期限の少し前まで使い回す）
async function getAccessToken(): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) return cachedToken.token;

  const key = readKey();
  const now = Math.floor(Date.now() / 1000);
  const header = base64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claims = base64url(
    JSON.stringify({
      iss: key.client_email,
      scope: SCOPE,
      aud: 'https://oauth2.googleapis.com/token',
      iat: now,
      exp: now + 3600,
    }),
  );
  const signer = createSign('RSA-SHA256');
  signer.update(`${header}.${claims}`);
  const signature = base64url(signer.sign(key.private_key));

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: `${header}.${claims}.${signature}`,
    }),
    cache: 'no-store',
  });
  const data = await response.json();
  if (!response.ok) throw new Error(`GA のアクセストークン取得に失敗: ${data.error_description ?? data.error}`);

  cachedToken = { token: data.access_token, expiresAt: Date.now() + data.expires_in * 1000 };
  return cachedToken.token;
}

export type ReportRequest = {
  dateRanges: { startDate: string; endDate: string }[];
  dimensions?: { name: string }[];
  metrics: { name: string }[];
  dimensionFilter?: unknown;
  orderBys?: unknown[];
  limit?: number;
};

export type ReportRow = { dimensions: string[]; metrics: number[] };

/** 複数のレポートをまとめて取得する（1回のリクエストで最大5件） */
export async function runReports(requests: ReportRequest[]): Promise<ReportRow[][]> {
  const propertyId = process.env.GA_PROPERTY_ID || DEFAULT_PROPERTY_ID;
  const token = await getAccessToken();
  const results: ReportRow[][] = [];

  for (let i = 0; i < requests.length; i += 5) {
    const response = await fetch(
      `https://analyticsdata.googleapis.com/v1beta/properties/${propertyId}:batchRunReports`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ requests: requests.slice(i, i + 5) }),
        cache: 'no-store',
      },
    );
    const data = await response.json();
    if (!response.ok) throw new Error(`GA のレポート取得に失敗: ${data.error?.message ?? response.status}`);

    for (const report of data.reports ?? []) {
      results.push(
        (report.rows ?? []).map((row: { dimensionValues?: { value: string }[]; metricValues?: { value: string }[] }) => ({
          dimensions: (row.dimensionValues ?? []).map((v) => v.value),
          metrics: (row.metricValues ?? []).map((v) => Number(v.value)),
        })),
      );
    }
  }
  return results;
}

/** リアルタイムレポート（直近30分）。dateRanges は指定しない */
export async function runRealtimeReport(
  request: Omit<ReportRequest, 'dateRanges'> & { minuteRanges?: { startMinutesAgo: number; endMinutesAgo: number }[] },
): Promise<ReportRow[]> {
  const propertyId = process.env.GA_PROPERTY_ID || DEFAULT_PROPERTY_ID;
  const token = await getAccessToken();
  const response = await fetch(`https://analyticsdata.googleapis.com/v1beta/properties/${propertyId}:runRealtimeReport`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
    cache: 'no-store',
  });
  const data = await response.json();
  if (!response.ok) throw new Error(`GA のリアルタイムの取得に失敗: ${data.error?.message ?? response.status}`);
  return (data.rows ?? []).map((row: { dimensionValues?: { value: string }[]; metricValues?: { value: string }[] }) => ({
    dimensions: (row.dimensionValues ?? []).map((v) => v.value),
    metrics: (row.metricValues ?? []).map((v) => Number(v.value)),
  }));
}
