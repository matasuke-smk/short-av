import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * いいね（likes.video_id）の ID 形式の扱い
 *
 * 以前は画面によって videos.id（UUID）と dmm_content_id（DMM の作品ID）のどちらかが保存されていたため、
 * 今後は dmm_content_id に統一し、読み込み時は両方を受け付けて dmm_content_id に読み替える。
 */

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(id: string): boolean {
  return UUID_PATTERN.test(id);
}

/**
 * UUID を dmm_content_id に読み替えた対応表を返す（UUID 以外はそのまま）
 */
export async function toContentIds(supabase: SupabaseClient, ids: string[]): Promise<Map<string, string>> {
  const result = new Map<string, string>();
  const uuids = ids.filter(isUuid);
  for (const id of ids) {
    if (!isUuid(id)) result.set(id, id);
  }
  if (uuids.length > 0) {
    const { data, error } = await supabase.from('videos').select('id, dmm_content_id').in('id', uuids);
    if (error) throw error;
    for (const row of data ?? []) result.set(row.id, row.dmm_content_id);
  }
  return result;
}

/**
 * ある作品を指す可能性のある video_id の候補（dmm_content_id と、DB にあればその UUID）
 */
export async function getVideoIdCandidates(
  supabase: SupabaseClient,
  videoId: string,
): Promise<{ contentId: string; candidates: string[] }> {
  if (isUuid(videoId)) {
    const { data, error } = await supabase.from('videos').select('dmm_content_id').eq('id', videoId).maybeSingle();
    if (error) throw error;
    const contentId = data?.dmm_content_id ?? videoId;
    return { contentId, candidates: [...new Set([contentId, videoId])] };
  }

  const { data, error } = await supabase.from('videos').select('id').eq('dmm_content_id', videoId);
  if (error) throw error;
  return { contentId: videoId, candidates: [videoId, ...(data ?? []).map((row) => row.id as string)] };
}
