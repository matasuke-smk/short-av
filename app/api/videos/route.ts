import { NextRequest, NextResponse } from 'next/server';
import { pickPopularVideos } from '@/lib/popular-pool';

// 1本あたり約1.3KB。補充1回あたりの Supabase の通信量を抑えるため少なめにする
const DEFAULT_POOL_SIZE = 60;
const MAX_POOL_SIZE = 100;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const idsParam = (value: string | null) =>
  (value ?? '').split(',').map((id) => id.trim()).filter((id) => UUID_PATTERN.test(id)).slice(0, 10);

/**
 * スワイプ画面の補充用（初期表示と同じく、人気の作品だけから選ぶ。2026-11-01）。
 * genres / actresses（好みのジャンル・女優の ID、カンマ区切り。端末のいいね・履歴から lib/preferences.ts が割り出す）を
 * 渡すと、そのどれかに当てはまる人気の作品を約6割にして、好みの作品が3、その他が2の割合で交互に並べる。
 */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const requested = parseInt(searchParams.get('limit') || '', 10);
  const limit = Number.isFinite(requested)
    ? Math.min(Math.max(requested, 1), MAX_POOL_SIZE)
    : DEFAULT_POOL_SIZE;
  const genres = idsParam(searchParams.get('genres'));
  const actresses = idsParam(searchParams.get('actresses'));

  try {
    // 人気の作品だけから選ぶ（lib/popular-pool.ts。2026-11-01）。好みがなければセール8割、好みがあれば好みの作品6割
    return NextResponse.json({ pool: await pickPopularVideos(limit, { genres, actresses }) });
  } catch (error) {
    console.error('補充の取得エラー:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
