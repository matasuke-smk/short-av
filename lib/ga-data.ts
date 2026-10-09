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

// GA Data API は1つのプロパティに同時に送れるリクエストが10件まで（超えると「Exhausted concurrent requests quota」）。
// アクセス解析は期間ごとの集計を並行して取るうえ、リアルタイムの記録なども同時に走るため、
// このサーバーから同時に送るのを MAX_CONCURRENT 件までに抑え、それでも上限に当たったら少し待って送り直す
const MAX_CONCURRENT = 4;
let running = 0;
const waiting: (() => void)[] = [];

async function withSlot<T>(task: () => Promise<T>): Promise<T> {
  if (running >= MAX_CONCURRENT) await new Promise<void>((resolve) => waiting.push(resolve));
  running++;
  try {
    return await task();
  } finally {
    running--;
    waiting.shift()?.();
  }
}

// 同時リクエストの上限・1時間あたりの上限などで断られたときは、待ってから最大 RETRIES 回送り直す
const RETRIES = 3;
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- GA の応答（reports / rows / error）をそのまま扱う
async function gaFetch(url: string, body: unknown, token: string): Promise<{ ok: boolean; status: number; data: any }> {
  for (let attempt = 0; ; attempt++) {
    const result = await withSlot(async () => {
      const response = await fetch(url, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        cache: 'no-store',
      });
      return { ok: response.ok, status: response.status, data: await response.json() };
    });
    const retryable = result.status === 429 || /concurrent requests/i.test(result.data?.error?.message ?? '');
    if (result.ok || !retryable || attempt >= RETRIES) return result;
    await new Promise((resolve) => setTimeout(resolve, 500 * 2 ** attempt));
  }
}

/** 複数のレポートをまとめて取得する（1回のリクエストで最大5件）。5件ずつの組は同時に送る（同時に送る数は withSlot で4つまで） */
export async function runReports(requests: ReportRequest[]): Promise<ReportRow[][]> {
  const propertyId = process.env.GA_PROPERTY_ID || DEFAULT_PROPERTY_ID;
  const token = await getAccessToken();
  const batches: ReportRequest[][] = [];
  for (let i = 0; i < requests.length; i += 5) batches.push(requests.slice(i, i + 5));

  const responses = await Promise.all(
    batches.map(async (batch) => {
      const { ok, status, data } = await gaFetch(
        `https://analyticsdata.googleapis.com/v1beta/properties/${propertyId}:batchRunReports`,
        { requests: batch },
        token,
      );
      if (!ok) throw new Error(`GA のレポート取得に失敗: ${data.error?.message ?? status}`);
      return (data.reports ?? []).map((report: { rows?: { dimensionValues?: { value: string }[]; metricValues?: { value: string }[] }[] }) =>
        (report.rows ?? []).map((row) => ({
          dimensions: (row.dimensionValues ?? []).map((v) => v.value),
          metrics: (row.metricValues ?? []).map((v) => Number(v.value)),
        })),
      ) as ReportRow[][];
    }),
  );
  return responses.flat();
}

/** リアルタイムレポート（直近30分）。dateRanges は指定しない */
export async function runRealtimeReport(
  request: Omit<ReportRequest, 'dateRanges'> & { minuteRanges?: { startMinutesAgo: number; endMinutesAgo: number }[] },
): Promise<ReportRow[]> {
  const propertyId = process.env.GA_PROPERTY_ID || DEFAULT_PROPERTY_ID;
  const token = await getAccessToken();
  const { ok, status, data } = await gaFetch(
    `https://analyticsdata.googleapis.com/v1beta/properties/${propertyId}:runRealtimeReport`,
    request,
    token,
  );
  if (!ok) throw new Error(`GA のリアルタイムの取得に失敗: ${data.error?.message ?? status}`);
  return (data.rows ?? []).map((row: { dimensionValues?: { value: string }[]; metricValues?: { value: string }[] }) => ({
    dimensions: (row.dimensionValues ?? []).map((v) => v.value),
    metrics: (row.metricValues ?? []).map((v) => Number(v.value)),
  }));
}
