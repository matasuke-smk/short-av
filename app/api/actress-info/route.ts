import { NextResponse } from 'next/server';
import { fetchDMMActress, DMMBlockedError } from '@/lib/dmm-api';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

/**
 * 女優の詳細を開いたときの顔写真・プロフィール・FANZA の出演作一覧のリンク（2026-10-31）。
 * まだ取り込んでいない女優でも出せるように、開いた女優だけ DMM に聞き、データベースにも入れる。
 * DMM への問い合わせは fetchDMMActress の中で1時間使い回す
 */
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const slug = new URL(request.url).searchParams.get('slug') ?? '';
  if (!/^\d{1,10}$/.test(slug)) return NextResponse.json({ error: 'bad slug' }, { status: 400 });
  try {
    const profile = await fetchDMMActress(slug);
    if (!profile) return NextResponse.json({ found: false });
    const supabase = getSupabaseAdmin();
    const { data: row } = await supabase.from('actresses').select('profile_at').eq('slug', slug).maybeSingle();
    if (row && !row.profile_at) await supabase.from('actresses').update({ ...profile, profile_at: new Date().toISOString() }).eq('slug', slug);
    return NextResponse.json({ found: true, ...profile }, { headers: { 'Cache-Control': 'public, max-age=3600' } });
  } catch (e) {
    if (e instanceof DMMBlockedError) return NextResponse.json({ error: 'busy' }, { status: 503 });
    console.error('[actress-info]', e);
    return NextResponse.json({ error: 'failed' }, { status: 500 });
  }
}
