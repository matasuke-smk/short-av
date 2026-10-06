/**
 * Vercel Cron用API Route（vercel.json で毎日実行）
 *
 * Vercelの実行時間制限内に収めるため、以下の方針で処理する:
 * - ランキング・新着は毎回取得し、ジャンル別はローテーションで一部のみ取得（数日で全ジャンルを一巡）
 * - DBへの書き込みはまとめて（バルクで）実行する
 * - 古いデータの削除は保存が成功した後にのみ行う（途中で打ち切られても動画が減り続けないように）
 */

import { NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  fetchRankingVideos,
  fetchNewReleases,
  searchByGenre,
  fetchGenres,
  convertDMMItemToVideo,
  extractActresses,
  extractGenres,
  type DMMItem,
} from '@/lib/dmm-api';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// 1回の実行で取得するジャンル数（100ジャンル ÷ 15 ≒ 7日で一巡）
const GENRES_PER_RUN = 15;
// ジャンル取得に使う時間の上限（DB保存の時間を残すため）
const GENRE_FETCH_BUDGET_MS = 25_000;
// この日数以上更新されず、いいねもされていない動画を削除する（ジャンル一巡の期間より十分長くする）
const STALE_DAYS = 30;
// .in() / バルク書き込み1回あたりの件数
const CHUNK_SIZE = 200;
// 既存動画の更新を並列実行する件数
const UPDATE_CONCURRENCY = 20;

function verifyCronRequest(request: Request): boolean {
  const authHeader = request.headers.get('authorization');

  if (process.env.CRON_SECRET) {
    return authHeader === `Bearer ${process.env.CRON_SECRET}`;
  }

  // 開発環境ではチェックをスキップ
  return process.env.NODE_ENV === 'development';
}

function chunk<T>(array: T[], size: number): T[][] {
  const result: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    result.push(array.slice(i, i + size));
  }
  return result;
}

/**
 * slug → id のマップを作成し、未登録のものはまとめて追加する（女優・ジャンル共通）
 */
async function upsertBySlug(
  supabase: SupabaseClient,
  table: 'actresses' | 'genres',
  items: Map<string, string>, // slug → name
): Promise<Map<string, string>> {
  const slugToId = new Map<string, string>();
  const slugs = [...items.keys()];

  for (const slugChunk of chunk(slugs, CHUNK_SIZE)) {
    const { data, error } = await supabase.from(table).select('id, slug').in('slug', slugChunk);
    if (error) throw error;
    for (const row of data ?? []) slugToId.set(row.slug, row.id);
  }

  const missing = slugs.filter((slug) => !slugToId.has(slug));
  for (const slugChunk of chunk(missing, CHUNK_SIZE)) {
    const rows = slugChunk.map((slug) =>
      table === 'actresses'
        ? { name: items.get(slug)!, slug, video_count: 0, is_active: true }
        : { name: items.get(slug)!, slug, sort_order: 999, is_active: true },
    );
    const { data, error } = await supabase.from(table).insert(rows).select('id, slug');
    if (error) throw error;
    for (const row of data ?? []) slugToId.set(row.slug, row.id);
  }

  return slugToId;
}

export async function GET(request: Request) {
  const startTime = Date.now();
  const elapsed = () => `${((Date.now() - startTime) / 1000).toFixed(1)}秒`;

  if (!verifyCronRequest(request)) {
    console.warn('[Cron] 認証失敗');
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const supabase = getSupabaseAdmin();
    console.info('[Cron] 動画データ更新開始');

    // 1. ランキング・新着を取得
    const [rankingVideos, newVideos] = await Promise.all([
      fetchRankingVideos(100),
      fetchNewReleases(100),
    ]);
    console.info(`[Cron] ランキング${rankingVideos.length}件 / 新着${newVideos.length}件 (${elapsed()})`);

    // 2. ジャンル別TOP100をローテーションで取得
    const genres = await fetchGenres();
    const genreVideos: DMMItem[] = [];
    let genresFetched = 0;
    if (genres.length > 0) {
      const dayIndex = Math.floor(Date.now() / 86_400_000);
      const offset = (dayIndex * GENRES_PER_RUN) % genres.length;
      const genreStart = Date.now();

      for (let i = 0; i < Math.min(GENRES_PER_RUN, genres.length); i++) {
        if (Date.now() - genreStart > GENRE_FETCH_BUDGET_MS) {
          console.warn('[Cron] ジャンル取得の時間上限に達したため打ち切り');
          break;
        }
        const genre = genres[(offset + i) % genres.length];
        try {
          genreVideos.push(...(await searchByGenre(genre.id, 100)));
          genresFetched++;
        } catch (error) {
          console.error(`[Cron] ジャンル${genre.name}(${genre.id})の取得失敗:`, error);
        }
      }
    }
    console.info(`[Cron] ジャンル${genresFetched}/${genres.length}件から${genreVideos.length}件取得 (${elapsed()})`);

    // 3. 重複除去（サムネイルとサンプル動画が両方ある動画のみ）
    const allVideos = new Map<string, DMMItem>();
    for (const video of [...rankingVideos, ...newVideos, ...genreVideos]) {
      if (video.imageURL?.large && video.sampleMovieURL?.size_560_360 && !allVideos.has(video.content_id)) {
        allVideos.set(video.content_id, video);
      }
    }
    const rankMap = new Map(rankingVideos.map((v, i) => [v.content_id, i + 1]));

    // 4. 女優・ジャンルをまとめて登録
    const actressNames = new Map<string, string>();
    const genreNames = new Map<string, string>();
    for (const video of allVideos.values()) {
      for (const a of extractActresses(video)) actressNames.set(a.slug, a.name);
      for (const g of extractGenres(video)) genreNames.set(g.slug, g.name);
    }
    const actressIdMap = await upsertBySlug(supabase, 'actresses', actressNames);
    const genreIdMap = await upsertBySlug(supabase, 'genres', genreNames);
    console.info(`[Cron] 女優${actressIdMap.size}件 / ジャンル${genreIdMap.size}件を紐付け (${elapsed()})`);

    // 5. 動画をまとめて保存
    const now = new Date().toISOString();
    const videoRows = [...allVideos.values()].map((video) => {
      const actressIds = extractActresses(video).map((a) => actressIdMap.get(a.slug)).filter(Boolean) as string[];
      const genreIds = extractGenres(video).map((g) => genreIdMap.get(g.slug)).filter(Boolean) as string[];
      // videos.id はDB側で採番されるUUIDのため、convertDMMItemToVideo の id（content_id）は除く
      const { id: _contentId, ...row } = convertDMMItemToVideo(video, rankMap.get(video.content_id));
      return {
        ...row,
        genre_ids: genreIds.length > 0 ? genreIds : null,
        actress_ids: actressIds.length > 0 ? actressIds : null,
        updated_at: now,
      };
    });

    // dmm_content_id → 既存動画のUUID
    const existingIdMap = new Map<string, string>();
    for (const idChunk of chunk(videoRows.map((v) => v.dmm_content_id), CHUNK_SIZE)) {
      const { data, error } = await supabase
        .from('videos')
        .select('id, dmm_content_id')
        .in('dmm_content_id', idChunk);
      if (error) throw error;
      for (const row of data ?? []) existingIdMap.set(row.dmm_content_id, row.id);
    }

    const newRows = videoRows.filter((v) => !existingIdMap.has(v.dmm_content_id));
    // 既存動画は閲覧数・クリック数を上書きしないよう、カウンタ列を除いて更新する
    const updateRows = videoRows
      .filter((v) => existingIdMap.has(v.dmm_content_id))
      .map(({ view_count: _view, click_count: _click, ...rest }) => rest);

    let saveErrors = 0;
    for (const rows of chunk(newRows, CHUNK_SIZE)) {
      const { error } = await supabase.from('videos').insert(rows);
      if (error) {
        console.error('[Cron] 新規保存エラー:', error);
        saveErrors += rows.length;
      }
    }
    for (const rows of chunk(updateRows, UPDATE_CONCURRENCY)) {
      const results = await Promise.all(
        rows.map((row) =>
          supabase.from('videos').update(row).eq('id', existingIdMap.get(row.dmm_content_id)!),
        ),
      );
      for (const { error } of results) {
        if (error) {
          console.error('[Cron] 更新エラー:', error);
          saveErrors++;
        }
      }
    }
    const saved = videoRows.length - saveErrors;
    console.info(`[Cron] 新規${newRows.length}件 / 更新${updateRows.length}件 / エラー${saveErrors}件 (${elapsed()})`);

    // 今回のランキングから外れた動画の順位を消す（残すと古い順位が重複して表示される）
    if (rankMap.size > 0 && saveErrors === 0) {
      const rankedIds = [...rankMap.keys()].map((id) => `"${id}"`).join(',');
      const { error } = await supabase
        .from('videos')
        .update({ rank_position: null })
        .not('rank_position', 'is', null)
        .not('dmm_content_id', 'in', `(${rankedIds})`);
      if (error) console.error('[Cron] 順位のリセットに失敗:', error);
    }

    // 6. 保存が成功した場合のみ、古い動画（いいね無し）を削除
    let deletedCount = 0;
    if (saved > 0 && saveErrors === 0) {
      const threshold = new Date(Date.now() - STALE_DAYS * 86_400_000).toISOString();
      // 1回の実行で扱うのは最大1000件（PostgREST の上限）。残りは翌日以降の実行で処理される
      const { data: oldVideos, error } = await supabase
        .from('videos')
        .select('id, dmm_content_id')
        .lt('updated_at', threshold)
        .order('id', { ascending: true });
      if (error) throw error;

      // いいね済み・X で紹介済みの作品は残す。
      // likes / x_posts を丸ごと取得すると 1000 行で切れて判定漏れが起きるため、候補ごとに照合する
      const deletableIds: string[] = [];
      for (const candidates of chunk(oldVideos ?? [], CHUNK_SIZE)) {
        const contentIds = candidates.map((v) => v.dmm_content_id as string);
        // いいねの video_id はUUIDとcontent_idが混在しうるため、両方で照合する
        const [{ data: liked, error: likesError }, { data: promoted, error: promotedError }] = await Promise.all([
          supabase.from('likes').select('video_id').in('video_id', [...candidates.map((v) => v.id as string), ...contentIds]),
          supabase.from('x_posts').select('dmm_content_id').in('dmm_content_id', contentIds).neq('status', 'skipped'),
        ]);
        if (likesError) throw likesError;
        if (promotedError) throw promotedError;
        const keep = new Set([
          ...(liked ?? []).map((l) => String(l.video_id)),
          ...(promoted ?? []).map((p) => p.dmm_content_id as string),
        ]);
        for (const v of candidates) {
          if (!keep.has(v.id) && !keep.has(v.dmm_content_id)) deletableIds.push(v.id as string);
        }
      }

      for (const deletable of chunk(deletableIds, CHUNK_SIZE)) {
        const { error: deleteError } = await supabase.from('videos').delete().in('id', deletable);
        if (deleteError) throw deleteError;
        deletedCount += deletable.length;
      }
    } else {
      console.warn('[Cron] 保存に失敗があったため古いデータの削除をスキップ');
    }

    const result = {
      success: saveErrors === 0,
      timestamp: new Date().toISOString(),
      executionTime: elapsed(),
      stats: {
        total: videoRows.length,
        inserted: newRows.length,
        updated: updateRows.length,
        deleted: deletedCount,
        errors: saveErrors,
        genresFetched,
      },
    };
    console.info('[Cron] 処理完了:', JSON.stringify(result.stats));

    return NextResponse.json(result, { status: saveErrors === 0 ? 200 : 500 });
  } catch (error) {
    console.error(`[Cron] エラー発生 (${elapsed()}):`, error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
        executionTime: elapsed(),
      },
      { status: 500 },
    );
  }
}

// POSTメソッドもサポート（手動実行用）
export const POST = GET;
