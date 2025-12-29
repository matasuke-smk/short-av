import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const limit = parseInt(searchParams.get('limit') || '20');

  try {
    /**
     * 重み付きランダムサンプリング
     * ランキング上位ほど選ばれやすいが、下位も選ばれる可能性がある
     */
    function weightedRandomSample<T extends { rank_position: number | null }>(
      array: T[],
      sampleSize: number
    ): T[] {
      const result: T[] = [];
      const available = [...array];

      // 各動画に重みスコアを付与
      const weighted = available.map((item, index) => {
        // rank_positionがあればそれを使用、なければインデックスベース
        const rank = item.rank_position || (index + 1);

        // 重みスコア計算
        // ランク1位: 100, 10位: 90, 100位: 50, 500位: 10, 1000位: 5, それ以降: 1
        const weight = Math.max(1, 100 - (rank - 1) * 0.1);

        return { item, weight };
      });

      // サンプルサイズ分だけ選択
      for (let i = 0; i < Math.min(sampleSize, weighted.length); i++) {
        if (weighted.length === 0) break;

        // 総重みを計算
        const totalWeight = weighted.reduce((sum, w) => sum + w.weight, 0);

        // ランダム値を生成
        let random = Math.random() * totalWeight;

        // 累積重みから選択
        let selectedIndex = 0;
        for (let j = 0; j < weighted.length; j++) {
          random -= weighted[j].weight;
          if (random <= 0) {
            selectedIndex = j;
            break;
          }
        }

        // 選択した動画を結果に追加
        result.push(weighted[selectedIndex].item);

        // 選択した動画を候補から除外
        weighted.splice(selectedIndex, 1);
      }

      return result;
    }

    // レズビアン・ゲイジャンルのIDを取得
    const { data: lgbtGenres } = await supabase
      .from('genres')
      .select('id')
      .or('slug.eq.4013,slug.eq.4060,slug.eq.5062'); // レズビアン、ゲイ、レズキス

    const lgbtGenreIds = lgbtGenres?.map(g => g.id) || [];

    // rank_position順で動画を取得（人気順）
    // 大量に取得して重み付きランダムサンプリング
    const { data: allVideos, error } = await supabase
      .from('videos')
      .select('*')
      .eq('is_active', true)
      .not('thumbnail_url', 'is', null)
      .not('sample_video_url', 'is', null)
      .order('rank_position', { ascending: true, nullsLast: true })
      .limit(10000); // 大量に取得

    if (error) {
      console.error('動画取得エラー:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // 同性愛ジャンルを含む動画を除外
    const filteredVideos = allVideos?.filter(video => {
      if (!video.genre_ids || video.genre_ids.length === 0) return true;
      return !lgbtGenreIds.some(lgbtId => (video.genre_ids as string[]).includes(lgbtId));
    }) || [];

    console.log(`[Videos API] Filtered videos: ${filteredVideos.length}`);

    // 重み付きランダムサンプリング
    // 人気動画が出やすいが、隠れた作品も発掘できる
    const pool = weightedRandomSample(filteredVideos, filteredVideos.length);

    console.log(`[Videos API] Weighted random pool created: ${pool.length} videos`);

    return NextResponse.json({ pool: pool || [] });
  } catch (error) {
    console.error('予期しないエラー:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
