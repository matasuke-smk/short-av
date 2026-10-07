import { NextRequest, NextResponse } from 'next/server';
import {
  fetchWeeklyRanking,
  fetchMonthlyRanking,
  fetchAllTimeRanking,
  convertDMMItemToVideo,
} from '@/lib/dmm-api';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const period = searchParams.get('period') || 'all'; // weekly, monthly, all
    // DMM APIの1リクエスト上限（100件）に制限
    const requested = parseInt(searchParams.get('limit') || '20', 10);
    const limit = Number.isFinite(requested) ? Math.min(Math.max(requested, 1), 100) : 20;

    console.log(`[Ranking API] Fetching ${period} ranking, limit: ${limit}`);

    // サンプル動画のない作品は押しても再生できないため除く。半分ほど除かれることがあるので2倍取得する
    const fetchCount = Math.min(limit * 2, 100);
    let dmmItems;

    // DMM APIから期間別ランキングを取得
    if (period === 'weekly') {
      dmmItems = await fetchWeeklyRanking(fetchCount);
    } else if (period === 'monthly') {
      dmmItems = await fetchMonthlyRanking(fetchCount);
    } else {
      dmmItems = await fetchAllTimeRanking(fetchCount);
    }

    // DMMItemをVideo形式に変換（順位は除外前の DMM の順位のまま）
    const videos = dmmItems
      .map((item, index) => ({ item, rank: index + 1 }))
      .filter(({ item }) => item.imageURL?.large && item.sampleMovieURL?.size_560_360)
      .slice(0, limit)
      .map(({ item, rank }) => convertDMMItemToVideo(item, rank));

    // DMM の API の作品には女優（actress_ids）やサンプルの長さがないため、サイトのデータベースにある作品はそちらの情報を使う
    // （女優ボタンやサンプルの長さが出るように。順位は DMM のランキングのまま）
    let data: Record<string, unknown>[] = videos;
    try {
      const { data: rows, error } = await getSupabaseAdmin()
        .from('videos')
        .select('*')
        .in('dmm_content_id', videos.map((v) => v.dmm_content_id));
      if (error) throw error;
      const byId = new Map((rows ?? []).map((row) => [row.dmm_content_id as string, row]));
      data = videos.map((video) => {
        const row = byId.get(video.dmm_content_id);
        return row ? { ...row, rank_position: video.rank_position } : video;
      });
    } catch (dbError) {
      console.error('[Ranking API] データベースの作品情報で補えませんでした:', dbError);
    }

    console.log(`[Ranking API] Success: ${videos.length} videos for ${period}`);

    return NextResponse.json({
      success: true,
      data,
      period,
      count: videos.length,
    });
  } catch (error) {
    console.error('[Ranking API] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch ranking',
      },
      { status: 500 }
    );
  }
}
