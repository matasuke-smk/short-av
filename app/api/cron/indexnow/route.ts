/**
 * サイトマップにあるページを IndexNow で検索エンジン（Bing など）に知らせる（vercel.json で毎日 10:00 JST に実行）
 * 動画データの更新（9:00）とサンプルの長さの記録（9:30）のあとに動かし、トップ・記事一覧・ランキング・記事の更新を伝える
 */

import { NextResponse } from 'next/server';
import sitemap from '@/app/sitemap';
import { notifyIndexNow } from '@/lib/indexnow';
import { supabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

function verifyCronRequest(request: Request): boolean {
  if (process.env.CRON_SECRET) {
    return request.headers.get('authorization') === `Bearer ${process.env.CRON_SECRET}`;
  }
  return process.env.NODE_ENV === 'development';
}

export async function GET(request: Request) {
  if (!verifyCronRequest(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const urls = sitemap().map((entry) => entry.url);
    // 作品ページはランキング上位 200 件だけ知らせる（全作品だと多すぎる）
    const { data } = await supabase.from('videos').select('dmm_content_id').eq('is_active', true).not('rank_position', 'is', null).order('rank_position', { ascending: true }).limit(200);
    for (const r of data ?? []) urls.push(`https://short-av.com/v/${encodeURIComponent(r.dmm_content_id)}`);
    const result = await notifyIndexNow(urls);
    console.info(`[Cron] IndexNow ${result.submitted}件を送信 (HTTP ${result.status})`);
    return NextResponse.json({ success: result.status >= 200 && result.status < 300, ...result });
  } catch (error) {
    console.error('[Cron] IndexNow の送信に失敗:', error);
    return NextResponse.json({ error: 'IndexNow の送信に失敗しました' }, { status: 500 });
  }
}
