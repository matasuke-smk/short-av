import { NextRequest, NextResponse } from 'next/server';
import {
  fetchWeeklyRanking,
  fetchMonthlyRanking,
  fetchAllTimeRanking,
  convertDMMItemToVideo,
} from '@/lib/dmm-api';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const period = searchParams.get('period') || 'all'; // weekly, monthly, all
    const limit = parseInt(searchParams.get('limit') || '20');

    console.log(`[Ranking API] Fetching ${period} ranking, limit: ${limit}`);

    let dmmItems;

    // DMM APIから期間別ランキングを取得
    if (period === 'weekly') {
      dmmItems = await fetchWeeklyRanking(limit);
    } else if (period === 'monthly') {
      dmmItems = await fetchMonthlyRanking(limit);
    } else {
      dmmItems = await fetchAllTimeRanking(limit);
    }

    // DMMItemをVideo形式に変換
    const videos = dmmItems.map((item, index) =>
      convertDMMItemToVideo(item, index + 1)
    );

    console.log(`[Ranking API] Success: ${videos.length} videos for ${period}`);

    return NextResponse.json({
      success: true,
      data: videos,
      period,
      count: videos.length,
    });
  } catch (error) {
    console.error('[Ranking API] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch ranking',
      },
      { status: 500 }
    );
  }
}
