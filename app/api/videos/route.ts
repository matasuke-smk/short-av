import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

const DEFAULT_POOL_SIZE = 200;
const MAX_POOL_SIZE = 500;

/**
 * スワイプ画面の補充用に、全作品からランダムに取得する（初期表示と同じ RPC）
 * 以前は人気順の上位を取ってから重み付き抽選していたが、PostgREST の 1000 行上限で候補が切れ、
 * 順位のない作品は DB 内部の並びで選ばれていたため、毎回ほぼ同じ約900本からしか出なかった。
 */
export async function GET(request: NextRequest) {
  const requested = parseInt(request.nextUrl.searchParams.get('limit') || '', 10);
  const limit = Number.isFinite(requested)
    ? Math.min(Math.max(requested, 1), MAX_POOL_SIZE)
    : DEFAULT_POOL_SIZE;

  try {
    const { data, error } = await supabase.rpc('get_random_videos_all', { p_limit: limit });

    if (error) {
      console.error('動画取得エラー:', error);
      return NextResponse.json({ error: 'Database error' }, { status: 500 });
    }

    return NextResponse.json({ pool: data ?? [] });
  } catch (error) {
    console.error('予期しないエラー:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
