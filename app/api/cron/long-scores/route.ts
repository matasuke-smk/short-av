/**
 * 「4分以上」のボタンの並べ順のための数字を集める（vercel.json で毎日 9:50 JST に実行。2026-10-26）
 * GA の直近28日の作品ごとの再生・クリックと、FANZA のレビュー数（まだない作品を1件ずつ）
 */

import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { fillReviewCounts, updateReactionCounts } from '@/lib/long-sample-scores';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

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
  const supabase = getSupabaseAdmin();
  const deadline = Date.now() + 50_000;
  const reactions = await updateReactionCounts(supabase).catch((error) => {
    console.error('[Cron] 再生・クリックの記録エラー:', error);
    return -1;
  });
  const reviews = await fillReviewCounts(supabase, deadline).catch((error) => {
    console.error('[Cron] レビュー数の記録エラー:', error);
    return -1;
  });
  console.info(`[Cron] 並べ順の数字: 再生・クリック ${reactions}件、レビュー数 ${reviews}件`);
  return NextResponse.json({ success: true, reactions, reviews });
}
