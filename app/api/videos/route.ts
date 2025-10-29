import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const offset = parseInt(searchParams.get('offset') || '0');
  const limit = parseInt(searchParams.get('limit') || '20');

  try {
    // レズビアン・ゲイジャンルのIDを取得
    const { data: lgbtGenres } = await supabase
      .from('genres')
      .select('id')
      .or('slug.eq.4013,slug.eq.1017,slug.eq.5062'); // レズビアン、ゲイ、レズキス

    const lgbtGenreIds = lgbtGenres?.map(g => g.id) || [];

    // 全動画を取得
    const { data: allVideos, error } = await supabase
      .from('videos')
      .select('*')
      .eq('is_active', true)
      .not('thumbnail_url', 'is', null)
      .not('sample_video_url', 'is', null)
      .order('rank_position', { ascending: true })
      .limit(1000);

    if (error) {
      console.error('動画取得エラー:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // 同性愛ジャンルを含む動画を除外
    const filteredVideos = allVideos?.filter(video => {
      if (!video.genre_ids || video.genre_ids.length === 0) return true;
      return !lgbtGenreIds.some(lgbtId => (video.genre_ids as string[]).includes(lgbtId));
    }) || [];

    // オフセットとリミットを適用
    const videos = filteredVideos.slice(offset, offset + limit);

    return NextResponse.json({ videos: videos || [] });
  } catch (error) {
    console.error('予期しないエラー:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
