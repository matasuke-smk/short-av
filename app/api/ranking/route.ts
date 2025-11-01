import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const period = searchParams.get('period') || 'all'; // weekly, monthly, all
    const limit = parseInt(searchParams.get('limit') || '100');

    // 期間の開始日時を計算
    let startDate: string | null = null;
    const now = new Date();

    if (period === 'weekly') {
      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      startDate = weekAgo.toISOString();
    } else if (period === 'monthly') {
      const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      startDate = monthAgo.toISOString();
    }

    // 期間別いいね数を集計してランキングを取得
    let query = `
      SELECT
        v.*,
        COUNT(l.id) as period_likes_count
      FROM videos v
      LEFT JOIN likes l ON v.id = l.video_id
    `;

    if (startDate) {
      query += ` AND l.created_at >= '${startDate}'`;
    }

    query += `
      WHERE v.is_active = true
        AND v.thumbnail_url IS NOT NULL
        AND v.sample_video_url IS NOT NULL
      GROUP BY v.id
      ORDER BY period_likes_count DESC, v.likes_count DESC
      LIMIT ${limit}
    `;

    const { data, error } = await supabase.rpc('get_ranking_by_period', {
      period_start: startDate,
      result_limit: limit
    });

    if (error) {
      // RPCが存在しない場合は、クライアント側で集計
      console.error('RPC error, falling back to client-side aggregation:', error);

      // 全動画を取得
      const { data: videos, error: videosError } = await supabase
        .from('videos')
        .select('*')
        .eq('is_active', true)
        .not('thumbnail_url', 'is', null)
        .not('sample_video_url', 'is', null);

      if (videosError) throw videosError;

      // 期間内のいいねを取得
      let likesQuery = supabase
        .from('likes')
        .select('video_id');

      if (startDate) {
        likesQuery = likesQuery.gte('created_at', startDate);
      }

      const { data: likes, error: likesError } = await likesQuery;

      if (likesError) throw likesError;

      // video_idごとにいいね数をカウント
      const likesCount = new Map<string, number>();
      likes?.forEach((like) => {
        const count = likesCount.get(like.video_id) || 0;
        likesCount.set(like.video_id, count + 1);
      });

      // 動画にperiod_likes_countを追加してソート
      const rankedVideos = (videos || [])
        .map((video) => ({
          ...video,
          period_likes_count: likesCount.get(video.id) || 0,
        }))
        .sort((a, b) => {
          // 期間内いいね数で比較、同じなら総いいね数で比較
          if (b.period_likes_count !== a.period_likes_count) {
            return b.period_likes_count - a.period_likes_count;
          }
          return (b.likes_count || 0) - (a.likes_count || 0);
        })
        .slice(0, limit);

      return NextResponse.json({
        success: true,
        data: rankedVideos,
        period,
      });
    }

    return NextResponse.json({
      success: true,
      data,
      period,
    });
  } catch (error) {
    console.error('Ranking API error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch ranking' },
      { status: 500 }
    );
  }
}
