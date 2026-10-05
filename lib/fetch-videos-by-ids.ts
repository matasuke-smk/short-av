import { supabase } from '@/lib/supabase';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
// PostgREST の URL 長・1000件上限に収まるよう分割して問い合わせる
const CHUNK_SIZE = 100;

/**
 * 動画 ID の一覧（dmm_content_id。旧形式の videos.id（UUID）が混ざっていてもよい）から、
 * 掲載中の動画を入力の順番どおりに取得する。同じ作品は1件にまとめ、見つからない ID は除く。
 */
export async function fetchVideosByIds<T extends { id: string; dmm_content_id: string }>(
  ids: string[],
  columns = '*',
): Promise<T[]> {
  const uuids = ids.filter((id) => UUID_PATTERN.test(id));
  const contentIds = ids.filter((id) => !UUID_PATTERN.test(id));

  const byKey = new Map<string, T>();
  const query = async (column: 'id' | 'dmm_content_id', values: string[]) => {
    for (let i = 0; i < values.length; i += CHUNK_SIZE) {
      const { data, error } = await supabase
        .from('videos')
        .select(columns)
        .in(column, values.slice(i, i + CHUNK_SIZE))
        .eq('is_active', true);
      if (error) throw error;
      for (const row of (data ?? []) as unknown as T[]) {
        byKey.set(row.id, row);
        byKey.set(row.dmm_content_id, row);
      }
    }
  };
  await query('id', uuids);
  await query('dmm_content_id', contentIds);

  const seen = new Set<string>();
  const result: T[] = [];
  for (const id of ids) {
    const video = byKey.get(id);
    if (!video || seen.has(video.dmm_content_id)) continue;
    seen.add(video.dmm_content_id);
    result.push(video);
  }
  return result;
}
