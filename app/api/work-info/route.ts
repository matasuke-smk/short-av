import { NextResponse } from 'next/server';
import { fetchDMMProducts, DMMBlockedError } from '@/lib/dmm-api';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

/**
 * 作品詳細を開いたときの最新の価格・定価・セール・レビュー（2026-10-31）。
 * データベースの価格はセール中の値段のまま残ることがあるので、開いた作品だけ DMM に聞き直し、違っていれば書き戻す。
 * DMM への問い合わせは fetchDMMProducts の中で1時間使い回す（同じ作品を何人が開いても1時間に1回）
 */
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const cid = new URL(request.url).searchParams.get('cid') ?? '';
  if (!/^[0-9a-z_]{1,64}$/.test(cid)) return NextResponse.json({ error: 'bad cid' }, { status: 400 });
  try {
    const res = await fetchDMMProducts({ service: 'digital', floor: 'videoa', cid, hits: 1 });
    const it = res.result?.items?.[0];
    if (!it) return NextResponse.json({ found: false });
    const info = {
      price: parseInt(it.prices?.price) || null,
      list_price: parseInt(it.prices?.list_price ?? '') || null,
      campaign_end: it.campaign?.[0]?.date_end ? new Date(`${it.campaign[0].date_end.replace(' ', 'T')}+09:00`).toISOString() : null,
      campaign_title: it.campaign?.[0]?.title ?? null,
      review_count: it.review?.count ?? 0,
      review_average: it.review?.average ? Number(it.review.average) || 0 : 0,
    };
    // 違っていればデータベースも直す（失敗しても表示はする）
    const supabase = getSupabaseAdmin();
    const { data: row } = await supabase.from('videos').select('price, list_price, campaign_end, review_count, review_average').eq('dmm_content_id', cid).maybeSingle();
    if (row && (row.price !== info.price || row.list_price !== info.list_price || (row.campaign_end ? new Date(row.campaign_end).toISOString() : null) !== info.campaign_end || row.review_count !== info.review_count || Number(row.review_average ?? -1) !== info.review_average)) {
      await supabase.from('videos').update({ ...info, price_checked_at: new Date().toISOString() }).eq('dmm_content_id', cid);
    }
    return NextResponse.json({ found: true, ...info }, { headers: { 'Cache-Control': 'public, max-age=600' } });
  } catch (e) {
    if (e instanceof DMMBlockedError) return NextResponse.json({ error: 'busy' }, { status: 503 });
    console.error('[work-info]', e);
    return NextResponse.json({ error: 'failed' }, { status: 500 });
  }
}
