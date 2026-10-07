import { after, NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { maybeRecordGaRealtime } from '@/lib/ga-realtime';

const DEFAULT_POOL_SIZE = 200;
const MAX_POOL_SIZE = 500;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
// 好みの系統の作品の割合（残りは全作品からランダム。好みだけにすると新しい系統に出会えなくなるため）
const PREFERRED_SHARE = 0.6;

const idsParam = (value: string | null) =>
  (value ?? '').split(',').map((id) => id.trim()).filter((id) => UUID_PATTERN.test(id)).slice(0, 10);

function shuffle<T>(items: T[]): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

type Video = { dmm_content_id: string; [key: string]: unknown };

/**
 * スワイプ画面の補充用に、全作品からランダムに取得する（初期表示と同じ RPC）
 * 以前は人気順の上位を取ってから重み付き抽選していたが、PostgREST の 1000 行上限で候補が切れ、
 * 順位のない作品は DB 内部の並びで選ばれていたため、毎回ほぼ同じ約900本からしか出なかった。
 *
 * genres / actresses（好みのジャンル・女優の ID、カンマ区切り。端末のいいね・履歴から lib/preferences.ts が割り出す）を
 * 渡すと、そのどれかに当てはまる作品を約6割、残りを全作品からのランダムにして、好みの作品が3、その他が2の割合で交互に並べる。
 */
export async function GET(request: NextRequest) {
  // サイトが使われている間、10分おきに GA のリアルタイムを記録する（アクセス解析の「今日」の遅れを補う。応答の後に実行）
  after(() => maybeRecordGaRealtime().catch((error) => console.error('[videos] GA realtime record:', error?.message ?? error)));
  const { searchParams } = request.nextUrl;
  const requested = parseInt(searchParams.get('limit') || '', 10);
  const limit = Number.isFinite(requested)
    ? Math.min(Math.max(requested, 1), MAX_POOL_SIZE)
    : DEFAULT_POOL_SIZE;
  const genres = idsParam(searchParams.get('genres'));
  const actresses = idsParam(searchParams.get('actresses'));

  try {
    const { data, error } = await supabase.rpc('get_random_videos_all', { p_limit: limit });
    if (error) {
      console.error('動画取得エラー:', error);
      return NextResponse.json({ error: 'Database error' }, { status: 500 });
    }
    const randomPool = (data ?? []) as Video[];
    if (genres.length === 0 && actresses.length === 0) return NextResponse.json({ pool: randomPool });

    // 好みの系統の作品（当てはまる作品の中から、ランダムな位置の連続した範囲を取ってシャッフルする）
    const conditions = [
      genres.length > 0 ? `genre_ids.ov.{${genres.join(',')}}` : null,
      actresses.length > 0 ? `actress_ids.ov.{${actresses.join(',')}}` : null,
    ].filter(Boolean).join(',');
    const preferredQuery = () =>
      supabase
        .from('videos')
        .select('*', { count: 'exact' })
        .eq('is_active', true)
        .not('thumbnail_url', 'is', null)
        .not('sample_video_url', 'is', null)
        .or(conditions);
    const wanted = Math.round(limit * PREFERRED_SHARE);
    let preferred: Video[] = [];
    const { count } = await preferredQuery().range(0, 0);
    if (count && count > 0) {
      const offset = Math.floor(Math.random() * Math.max(1, count - wanted * 2));
      const { data: rows, error: prefError } = await preferredQuery()
        .order('id', { ascending: true })
        .range(offset, offset + wanted * 2 - 1);
      if (prefError) console.error('好みの作品の取得エラー:', prefError);
      preferred = shuffle((rows ?? []) as Video[]).slice(0, wanted);
    }

    // 好みの作品3、その他2の割合で交互に並べる（同じ作品は1回だけ）
    const seen = new Set(preferred.map((v) => v.dmm_content_id));
    const others = randomPool.filter((v) => !seen.has(v.dmm_content_id));
    const pool: Video[] = [];
    for (let i = 0; pool.length < limit && (preferred.length > 0 || others.length > 0); i++) {
      const takePreferred = i % 5 < 3 ? preferred.length > 0 : others.length === 0;
      pool.push((takePreferred ? preferred.shift() : others.shift())!);
    }
    return NextResponse.json({ pool });
  } catch (error) {
    console.error('予期しないエラー:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
