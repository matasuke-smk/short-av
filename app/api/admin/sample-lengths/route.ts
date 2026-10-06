import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { measureSampleLengths } from '@/lib/sample-player';
import { LONG_SAMPLE_SECONDS } from '@/config/site';

// 管理画面用（middleware.ts の認証で保護）
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

async function counts() {
  const supabase = getSupabaseAdmin();
  const base = () =>
    supabase.from('videos').select('id', { count: 'exact', head: true }).not('sample_video_url', 'is', null);
  const [remaining, measured, failed, long, total] = await Promise.all([
    base().is('sample_seconds', null),
    base().gt('sample_seconds', 0),
    base().eq('sample_seconds', -1),
    base().gte('sample_seconds', LONG_SAMPLE_SECONDS),
    base(),
  ]);
  return {
    remaining: remaining.count ?? 0, // まだ調べていない
    measured: measured.count ?? 0, // 長さが分かった
    failed: failed.count ?? 0, // 調べられなかった
    long: long.count ?? 0, // うち基準（LONG_SAMPLE_SECONDS）以上
    total: total.count ?? 0,
  };
}

// サンプル動画の長さの記録状況
export async function GET() {
  return NextResponse.json(await counts());
}

// 「今すぐ調べる」: 約45秒間、まだ調べていない作品のサンプル動画の長さを調べる
export async function POST() {
  try {
    // recorded: 今回長さが分かった件数（counts の measured は合計）
    const recorded = await measureSampleLengths(getSupabaseAdmin(), Date.now() + 45_000);
    return NextResponse.json({ recorded, ...(await counts()) });
  } catch (error) {
    console.error('sample-lengths error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
