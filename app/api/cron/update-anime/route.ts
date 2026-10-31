/**
 * アニメの作品の毎日の更新（vercel.json で毎日 7:10 JST。2026-10-31）
 * 1. FANZA のアニメの人気順の上位1,000本と新着100本を取り直し、anime_videos に入れる（人気の順位も付け直す）
 * 2. セールの終わった作品の価格を取り直す
 * 3. まだ長さを調べていないサンプル動画の長さを調べる
 * DMM には順番に問い合わせる（fetchDMMProducts の中で間隔をあける）
 */

import { NextResponse } from 'next/server';
import { fetchDMMProducts, convertDMMItemToVideo, extractGenres, type DMMItem } from '@/lib/dmm-api';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { chunk, upsertBySlug } from '@/lib/video-import';
import { refreshEndedSales } from '@/lib/long-sample-scores';
import { measureSampleLengths } from '@/lib/sample-player';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

const RANK_PAGES = 10; // 100本 × 10 = 人気の上位1,000本

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
  const start = Date.now();
  const supabase = getSupabaseAdmin();

  // 1. 人気順と新着
  const ranked: DMMItem[] = [];
  for (let page = 0; page < RANK_PAGES; page++) {
    const res = await fetchDMMProducts({ service: 'digital', floor: 'anime', sort: 'rank', hits: 100, offset: page * 100 + 1 }).catch(() => null);
    const items = (res?.result?.items ?? []) as DMMItem[];
    ranked.push(...items);
    if (items.length < 100) break;
  }
  const newest = ((await fetchDMMProducts({ service: 'digital', floor: 'anime', sort: 'date', hits: 100 }).catch(() => null))?.result?.items ?? []) as DMMItem[];
  const rankOf = new Map(ranked.map((it, i) => [it.content_id, i + 1]));
  const items = new Map<string, DMMItem>();
  for (const it of [...ranked, ...newest]) {
    if (it.imageURL?.large && it.sampleMovieURL?.size_560_360 && !items.has(it.content_id)) items.set(it.content_id, it);
  }

  let saved = 0;
  if (ranked.length > 0) {
    const genreNames = new Map<string, string>();
    for (const it of items.values()) for (const g of extractGenres(it)) genreNames.set(g.slug, g.name);
    const genreIdMap = await upsertBySlug(supabase, 'genres', genreNames, 200);
    const now = new Date().toISOString();
    const rows = [...items.values()].map((it) => {
      // id はデータベースで付けるので除く。数えている列（閲覧・クリック・いいね）は上書きしない
      const { id: _cid, view_count: _v, click_count: _c, genre_ids: _g, actress_ids: _a, ...row } = convertDMMItemToVideo(it, rankOf.get(it.content_id));
      const genreIds = extractGenres(it).map((g) => genreIdMap.get(g.slug)).filter(Boolean) as string[];
      return { ...row, genre_ids: genreIds.length > 0 ? genreIds : null, updated_at: now };
    });
    // 人気の順位は付け直す（上位から外れた作品は順位なしにする）
    await supabase.from('anime_videos').update({ rank_position: null }).not('rank_position', 'is', null);
    for (const part of chunk(rows, 200)) {
      const { error } = await supabase.from('anime_videos').upsert(part, { onConflict: 'dmm_content_id' });
      if (error) console.error('[update-anime] 保存エラー:', error);
      else saved += part.length;
    }
  }

  // 2. セールの終わった作品（残り時間の半分まで）
  const sales = await refreshEndedSales(supabase, start + 200_000, 'anime_videos').catch(() => 0);
  // 3. サンプルの長さ（残りの時間で）
  const lengths = await measureSampleLengths(supabase, start + 280_000, 8, 'anime_videos').catch(() => 0);

  console.info(`[update-anime] 保存${saved}件 / セール${sales}件 / 長さ${lengths}件 (${((Date.now() - start) / 1000).toFixed(1)}秒)`);
  return NextResponse.json({ success: true, saved, sales, lengths });
}
