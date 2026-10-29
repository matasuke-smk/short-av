import { defineCloudflareConfig } from '@opennextjs/cloudflare';
import r2IncrementalCache from '@opennextjs/cloudflare/overrides/incremental-cache/r2-incremental-cache';
import memoryQueue from '@opennextjs/cloudflare/overrides/queue/memory-queue';

// Cloudflare Workers で動かすための OpenNext の設定（2026-10-29 移行の準備）。
// 作り直し（revalidate）のあるページと unstable_cache の保存先は R2（wrangler.jsonc の NEXT_INC_CACHE_R2_BUCKET）。
// 期限が来たページの作り直しは、同じ Worker の中で順番に行う（memoryQueue）
export default defineCloudflareConfig({
  incrementalCache: r2IncrementalCache,
  queue: memoryQueue,
});
