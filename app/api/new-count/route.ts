import { NextResponse, type NextRequest } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

/**
 * 前回来たとき以降に入った新作の本数（2026-10-28、app/components/ReturnHelpers.tsx の「前回から新作 ○本」）。
 * since は前回来た時刻。同じ時間帯の問い合わせをまとめて使い回せるよう、1時間単位に丸めて10分のあいだ使い回す。最大30日前まで
 */
export async function GET(request: NextRequest) {
  const since = new Date(request.nextUrl.searchParams.get('since') ?? '');
  if (Number.isNaN(since.getTime())) return NextResponse.json({ error: 'since が正しくありません' }, { status: 400 });
  const from = new Date(Math.max(since.getTime(), Date.now() - 30 * 86_400_000));
  from.setUTCMinutes(0, 0, 0);
  const { count, error } = await getSupabaseAdmin().from('videos').select('id', { count: 'exact', head: true }).gte('created_at', from.toISOString());
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ count: count ?? 0 }, { headers: { 'Cache-Control': 'public, s-maxage=600, stale-while-revalidate=600' } });
}
