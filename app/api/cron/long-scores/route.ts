/**
 * 「4分以上」のボタンの並べ順のための数字を集める（vercel.json で毎日 6:50 JST に実行（2026-10-27 に 9:50 から変更）。2026-10-26）
 * GA の直近28日の作品ごとの再生・クリックと、FANZA のレビュー数（まだない作品を1件ずつ）。
 * 2026-10-31 から、レビューの平均点と女優の顔写真（作品の操作の行・作品詳細に出す）も少しずつ入れる
 */

import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { fillActressImages, fillReviewAverages, fillReviewCounts, updateReactionCounts } from '@/lib/long-sample-scores';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

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
  const started = Date.now();
  const deadline = started + 50_000;
  const reactions = await updateReactionCounts(supabase).catch((error) => {
    console.error('[Cron] 再生・クリックの記録エラー:', error);
    return -1;
  });
  const reviews = await fillReviewCounts(supabase, deadline).catch((error) => {
    console.error('[Cron] レビュー数の記録エラー:', error);
    return -1;
  });
  // 平均点と顔写真は、残りの時間（全体で最大 280 秒）を半分ずつ使う。DMM には1件ずつ 0.7 秒あけて問い合わせる
  const averages = await fillReviewAverages(supabase, Math.max(Date.now(), started + 50_000) + 115_000).catch((error) => {
    console.error('[Cron] レビューの平均点の記録エラー:', error);
    return -1;
  });
  const actressImages = await fillActressImages(supabase, started + 280_000).catch((error) => {
    console.error('[Cron] 女優の顔写真の記録エラー:', error);
    return -1;
  });
  console.info(`[Cron] 並べ順の数字: 再生・クリック ${reactions}件、レビュー数 ${reviews}件、平均点 ${averages}件、女優の顔写真 ${actressImages}件`);
  return NextResponse.json({ success: true, reactions, reviews, averages, actressImages });
}
