/**
 * X 予約投稿ストックの生成（サーバー専用）
 *
 * 毎週水曜に、翌日（木曜）から次の水曜までの7日分 × 1日3枠の投稿候補を作る。
 * 既に有効な候補がある枠は作らないため、何度実行しても重複しない（スキップした枠だけ作り直される）。
 */

import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { countXWeightedLength, getXPostVideoUrl, X_MAX_WEIGHTED_LENGTH } from '@/lib/x-post-text';

export type SlotType = 'new' | 'ranking' | 'random';

// 投稿枠（日本時間）
export const DAILY_SLOTS: { hour: number; type: SlotType }[] = [
  { hour: 12, type: 'new' },
  { hour: 18, type: 'ranking' },
  { hour: 22, type: 'random' },
];

const DAYS_PER_WEEK = 7;
const JST_OFFSET_MS = 9 * 60 * 60 * 1000;
// 同じ作品を再び紹介しない期間
const REUSE_COOLDOWN_DAYS = 90;
// 各枠タイプで選ぶ候補の母数
const CANDIDATE_POOL = 200;

type VideoRow = {
  dmm_content_id: string;
  title: string;
  thumbnail_url: string | null;
  maker: string | null;
  actress_ids: string[] | null;
};

/**
 * 生成対象の枠（UTC の Date）を返す。開始は「今日（日本時間）より後の最初の木曜」。
 */
export function getUpcomingWeekSlots(now = new Date()): { slotAt: Date; type: SlotType }[] {
  const jstNow = new Date(now.getTime() + JST_OFFSET_MS);
  const daysUntilThursday = ((4 - jstNow.getUTCDay() + 7) % 7) || 7;
  const startY = jstNow.getUTCFullYear();
  const startM = jstNow.getUTCMonth();
  const startD = jstNow.getUTCDate() + daysUntilThursday;

  const slots: { slotAt: Date; type: SlotType }[] = [];
  for (let day = 0; day < DAYS_PER_WEEK; day++) {
    for (const { hour, type } of DAILY_SLOTS) {
      // 日本時間の hour 時 = UTC の hour - 9 時
      slots.push({ slotAt: new Date(Date.UTC(startY, startM, startD + day, hour - 9)), type });
    }
  }
  return slots;
}

function pickRandom<T>(items: T[]): T | undefined {
  return items[Math.floor(Math.random() * items.length)];
}

export function buildPostText(video: VideoRow, actressNames: string[], type: SlotType): string {
  const url = getXPostVideoUrl(video.dmm_content_id, 'card');
  const actress = actressNames.slice(0, 2).join('・');
  const heading =
    type === 'new' ? '【新着作品】' : type === 'ranking' ? '【人気ランキング作品】' : '【今日のおすすめ】';

  const build = (title: string) =>
    [
      heading,
      title,
      actress ? `出演: ${actress}` : video.maker ? `メーカー: ${video.maker}` : '',
      '',
      'サンプル動画はこちら👇',
      url,
      '',
      '#PR #FANZA',
    ]
      .filter((line, i, arr) => line !== '' || arr[i - 1] !== '')
      .join('\n');

  // 280 を超える場合はタイトルを切り詰める
  let title = video.title;
  let text = build(title);
  while (countXWeightedLength(text) > X_MAX_WEIGHTED_LENGTH && title.length > 10) {
    title = `${[...title].slice(0, -5).join('')}…`;
    text = build(title);
  }
  return text;
}

export async function generateUpcomingWeek(now = new Date()) {
  const supabase = getSupabaseAdmin();
  const slots = getUpcomingWeekSlots(now);

  // 既に有効な候補がある枠は除外
  const { data: existing, error: existingError } = await supabase
    .from('x_posts')
    .select('slot_at')
    .neq('status', 'skipped')
    .gte('slot_at', slots[0].slotAt.toISOString())
    .lte('slot_at', slots[slots.length - 1].slotAt.toISOString());
  if (existingError) throw existingError;
  const filled = new Set((existing ?? []).map((r) => new Date(r.slot_at).getTime()));
  const targets = slots.filter((s) => !filled.has(s.slotAt.getTime()));
  if (targets.length === 0) return { created: 0, slots: slots.length };

  // 最近紹介した作品は除外
  const cooldownFrom = new Date(now.getTime() - REUSE_COOLDOWN_DAYS * 86_400_000).toISOString();
  const { data: recent, error: recentError } = await supabase
    .from('x_posts')
    .select('dmm_content_id')
    .neq('status', 'skipped')
    .gte('slot_at', cooldownFrom);
  if (recentError) throw recentError;
  const used = new Set((recent ?? []).map((r) => r.dmm_content_id as string));

  const columns = 'dmm_content_id, title, thumbnail_url, maker, actress_ids';
  const base = () =>
    supabase
      .from('videos')
      .select(columns)
      .eq('is_active', true)
      .not('thumbnail_url', 'is', null)
      .not('sample_video_url', 'is', null);

  const [newRes, rankingRes, randomRes] = await Promise.all([
    base().order('release_date', { ascending: false, nullsFirst: false }).limit(CANDIDATE_POOL),
    base().not('rank_position', 'is', null).order('rank_position', { ascending: true }).limit(CANDIDATE_POOL),
    // 並び順を指定しない limit だと毎回ほぼ同じ行が返るため、全作品からランダムに取る RPC を使う
    supabase.rpc('get_random_videos_all', { p_limit: CANDIDATE_POOL * 5 }),
  ]);
  for (const res of [newRes, rankingRes, randomRes]) {
    if (res.error) throw res.error;
  }
  const pools: Record<SlotType, VideoRow[]> = {
    new: (newRes.data ?? []) as VideoRow[],
    ranking: (rankingRes.data ?? []) as VideoRow[],
    random: (randomRes.data ?? []) as VideoRow[],
  };

  // 枠ごとに未使用の作品を選ぶ（候補が尽きたらランダム枠の母数から補う）
  const picks: { slot: (typeof targets)[number]; video: VideoRow }[] = [];
  for (const slot of targets) {
    const available = (pool: VideoRow[]) => pool.filter((v) => !used.has(v.dmm_content_id));
    const video = pickRandom(available(pools[slot.type]).slice(0, 30)) ?? pickRandom(available(pools.random));
    if (!video) continue;
    used.add(video.dmm_content_id);
    picks.push({ slot, video });
  }

  // 出演者名をまとめて取得
  const actressIds = [...new Set(picks.flatMap((p) => p.video.actress_ids ?? []))];
  const actressNameById = new Map<string, string>();
  if (actressIds.length > 0) {
    const { data, error } = await supabase.from('actresses').select('id, name').in('id', actressIds);
    if (error) throw error;
    for (const a of data ?? []) actressNameById.set(a.id, a.name);
  }

  const rows = picks.map(({ slot, video }) => ({
    slot_at: slot.slotAt.toISOString(),
    slot_type: slot.type,
    dmm_content_id: video.dmm_content_id,
    title: video.title,
    thumbnail_url: video.thumbnail_url,
    text: buildPostText(
      video,
      (video.actress_ids ?? []).map((id) => actressNameById.get(id)).filter(Boolean) as string[],
      slot.type,
    ),
  }));

  if (rows.length > 0) {
    const { error } = await supabase.from('x_posts').insert(rows);
    if (error) throw error;
  }

  return { created: rows.length, slots: slots.length };
}
