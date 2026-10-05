import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

// 抽選対象とする動画の最大件数（人気順の上位から）
const CANDIDATE_LIMIT = 3000;
const DEFAULT_POOL_SIZE = 200;
const MAX_POOL_SIZE = 500;

/**
 * 重み付きランダムサンプリング（Efraimidis-Spirakis法、O(n log n)）
 * ランキング上位ほど選ばれやすいが、下位も選ばれる可能性がある
 */
function weightedRandomSample<T extends { rank_position: number | null }>(
  array: T[],
  sampleSize: number
): T[] {
  return array
    .map((item, index) => {
      // rank_positionがあればそれを使用、なければインデックスベース
      const rank = item.rank_position || (index + 1);
      // ランク1位: 100, 100位: 90, 500位: 50, 1000位以降: 1
      const weight = Math.max(1, 100 - (rank - 1) * 0.1);
      return { item, key: Math.pow(Math.random(), 1 / weight) };
    })
    .sort((a, b) => b.key - a.key)
    .slice(0, sampleSize)
    .map(({ item }) => item);
}

export async function GET(request: NextRequest) {
  const requested = parseInt(request.nextUrl.searchParams.get('limit') || '', 10);
  const limit = Number.isFinite(requested)
    ? Math.min(Math.max(requested, 1), MAX_POOL_SIZE)
    : DEFAULT_POOL_SIZE;

  try {
    // rank_position順で動画を取得（人気順）
    const { data: allVideos, error } = await supabase
      .from('videos')
      .select('*')
      .eq('is_active', true)
      .not('thumbnail_url', 'is', null)
      .not('sample_video_url', 'is', null)
      .order('rank_position', { ascending: true, nullsFirst: false })
      .limit(CANDIDATE_LIMIT);

    if (error) {
      console.error('動画取得エラー:', error);
      return NextResponse.json({ error: 'Database error' }, { status: 500 });
    }

    // 人気動画が出やすいが、隠れた作品も発掘できる
    const pool = weightedRandomSample(allVideos || [], limit);

    return NextResponse.json({ pool });
  } catch (error) {
    console.error('予期しないエラー:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
