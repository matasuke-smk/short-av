import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const limit = parseInt(searchParams.get('limit') || '20');

  try {
    // シャッフル関数
    function shuffleArray<T>(array: T[]): T[] {
      const shuffled = [...array];
      for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
      }
      return shuffled;
    }

    // レズビアン・ゲイジャンルのIDを取得
    const { data: lgbtGenres } = await supabase
      .from('genres')
      .select('id')
      .or('slug.eq.4013,slug.eq.4060,slug.eq.5062'); // レズビアン、ゲイ、レズキス

    const lgbtGenreIds = lgbtGenres?.map(g => g.id) || [];

    // 多めに動画を取得してシャッフル（完全ランダム化）
    // TODO: 将来的にはいいね数上位から選択する実装に変更予定
    const { data: allVideos, error } = await supabase
      .from('videos')
      .select('*')
      .eq('is_active', true)
      .not('thumbnail_url', 'is', null)
      .not('sample_video_url', 'is', null)
      .limit(10000); // 多めに取得してランダム性を高める

    if (error) {
      console.error('動画取得エラー:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // 同性愛ジャンルを含む動画を除外してシャッフル
    const filteredVideos = allVideos?.filter(video => {
      if (!video.genre_ids || video.genre_ids.length === 0) return true;
      return !lgbtGenreIds.some(lgbtId => (video.genre_ids as string[]).includes(lgbtId));
    }) || [];

    // シャッフルしてプール全体を返す
    const pool = shuffleArray(filteredVideos);

    return NextResponse.json({ pool: pool || [] });
  } catch (error) {
    console.error('予期しないエラー:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
