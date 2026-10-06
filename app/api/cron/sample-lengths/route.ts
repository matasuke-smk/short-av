/**
 * サンプル動画の長さの記録（vercel.json で毎日 9:30 JST に実行）
 * 動画データの更新（9:00）は保存だけで1分近くかかり、長さを調べる時間が残らないため別に動かす。
 * まだ調べていない作品を新しい順に、約50秒間調べて videos.sample_seconds に記録する。
 */

import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { measureSampleLengths } from '@/lib/sample-player';

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

  const measured = await measureSampleLengths(getSupabaseAdmin(), Date.now() + 50_000);
  console.info(`[Cron] サンプルの長さ ${measured}件`);
  return NextResponse.json({ success: true, measured });
}
