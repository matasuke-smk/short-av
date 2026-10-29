// Cloudflare Workers の入口（2026-10-29 Vercel からの移行の準備）。
// ページの表示は OpenNext が作った .open-next/worker.js に任せ、定期実行（wrangler.jsonc の triggers.crons）だけここで受ける。
// Vercel の vercel.json の crons と同じ時刻・同じ API を、同じ合言葉（CRON_SECRET）を付けて呼ぶ。API の中身は変えない
// @ts-expect-error 組み立てのときに OpenNext が作るファイル
import { default as handler } from './.open-next/worker.js';

type Env = { CRON_SECRET?: string; WORKER_SELF_REFERENCE: { fetch: (request: Request) => Promise<Response> } };

// 定期実行の時刻（UTC）→ 呼ぶ API。vercel.json の crons と同じ
const CRON_PATHS: Record<string, string> = {
  '30 21 * * *': '/api/cron/update-videos',
  '40 21 * * *': '/api/cron/sample-lengths',
  '*/10 * * * *': '/api/cron/ga-realtime',
  '0 1 * * *': '/api/cron/indexnow',
  '50 21 * * *': '/api/cron/long-scores',
  '0 22 * * *': '/api/cron/daily-summary',
  '0 1 * * 1': '/api/cron/article-ideas',
};

export default {
  fetch: handler.fetch,

  async scheduled(event: { cron: string }, env: Env, ctx: { waitUntil: (p: Promise<unknown>) => void }) {
    const path = CRON_PATHS[event.cron];
    if (!path) {
      console.error(`[cron] 知らない時刻の定期実行: ${event.cron}`);
      return;
    }
    const request = new Request(`https://short-av.com${path}`, {
      headers: { authorization: `Bearer ${env.CRON_SECRET ?? ''}`, 'user-agent': 'cloudflare-cron' },
    });
    ctx.waitUntil(
      env.WORKER_SELF_REFERENCE.fetch(request).then(
        (res) => console.info(`[cron] ${path} ${res.status}`),
        (err) => console.error(`[cron] ${path} 失敗`, err),
      ),
    );
  },
};
