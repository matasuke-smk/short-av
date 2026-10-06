import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { measureSampleLengths } from '@/lib/sample-player';

// 管理画面用（middleware.ts の認証で保護）
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

async function counts() {
  const supabase = getSupabaseAdmin();
  const base = () =>
    supabase.from('videos').select('id', { count: 'exact', head: true }).not('sample_video_url', 'is', null);
  const [remaining, long, total] = await Promise.all([
    base().is('sample_seconds', null),
    base().gte('sample_seconds', 120),
    base(),
  ]);
  return { remaining: remaining.count ?? 0, long: long.count ?? 0, total: total.count ?? 0 };
}

// サンプル動画の長さの記録状況
export async function GET() {
  return NextResponse.json(await counts());
}

// 「今すぐ調べる」: 約45秒間、まだ調べていない作品のサンプル動画の長さを調べる
export async function POST() {
  try {
    const measured = await measureSampleLengths(getSupabaseAdmin(), Date.now() + 45_000);
    return NextResponse.json({ measured, ...(await counts()) });
  } catch (error) {
    console.error('sample-lengths error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
