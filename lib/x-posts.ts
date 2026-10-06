/**
 * X 予約投稿ストックの生成（サーバー専用）
 *
 * 毎週水曜に、翌日（木曜）から次の水曜までの7日分 × 1日3枠の投稿候補を作る。
 * 既に有効な候補がある枠は作らないため、何度実行しても重複しない（スキップした枠だけ作り直される）。
 */

import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { runReports } from '@/lib/ga-data';
import { countXWeightedLength, getXPostVideoUrl, X_MAX_WEIGHTED_LENGTH } from '@/lib/x-post-text';

// manual = サイトを見ながら管理者が選んだ作品（自動作成の枠には使わない）
export type SlotType = 'new' | 'ranking' | 'random' | 'manual';

// 投稿枠（日本時間）
export const DAILY_SLOTS: { hour: number; type: SlotType }[] = [
  { hour: 12, type: 'new' },
  { hour: 18, type: 'ranking' },
  { hour: 22, type: 'random' },
];

const DAYS_PER_WEEK = 7;
const JST_OFFSET_MS = 9 * 60 * 60 * 1000;
// 各枠タイプで選ぶ候補の母数
const CANDIDATE_POOL = 200;
// スワイプした先で再生された回数を数える期間（日）
const SWIPE_PLAY_DAYS = 28;
const PAGE_SIZE = 1000;

export type VideoRow = {
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

// 重み付きで1つ選ぶ（重みが大きいほど選ばれやすい）
function pickWeighted<T>(items: T[], weight: (item: T) => number): T | undefined {
  const total = items.reduce((sum, item) => sum + weight(item), 0);
  if (total <= 0) return pickRandom(items);
  let r = Math.random() * total;
  for (const item of items) {
    r -= weight(item);
    if (r < 0) return item;
  }
  return items[items.length - 1];
}

/**
 * スワイプした先で再生された回数（作品ID → 回数）を Google Analytics から取得する。
 * 最初に表示された1本ではなく、スワイプして見つけて再生された作品だけを数える（video_view の via が「スワイプ」）。
 * GA の鍵が未設定・取得失敗のときは空（従来どおりの選び方になる）。
 */
async function getSwipePlayCounts(): Promise<Map<string, number>> {
  try {
    const [rows] = await runReports([
      {
        dateRanges: [{ startDate: `${SWIPE_PLAY_DAYS}daysAgo`, endDate: 'today' }],
        dimensions: [{ name: 'customEvent:content_id' }],
        metrics: [{ name: 'eventCount' }],
        dimensionFilter: {
          andGroup: {
            expressions: [
              { filter: { fieldName: 'eventName', stringFilter: { value: 'video_view' } } },
              { filter: { fieldName: 'customEvent:via', stringFilter: { value: 'スワイプ' } } },
            ],
          },
        },
        orderBys: [{ metric: { metricName: 'eventCount' }, desc: true }],
        limit: 300,
      },
    ]);
    return new Map(rows.filter((r) => r.dimensions[0] && r.dimensions[0] !== '(not set)').map((r) => [r.dimensions[0], r.metrics[0]]));
  } catch (error) {
    console.warn('[x-posts] スワイプ後の再生回数を取得できませんでした:', error);
    return new Map();
  }
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

  // 一度でも紹介した作品は除外（スキップしたものは除く）。1000 行上限で切れないようページを分けて取得
  const used = new Set<string>();
  for (let offset = 0; ; offset += PAGE_SIZE) {
    const { data, error } = await supabase
      .from('x_posts')
      .select('dmm_content_id')
      .neq('status', 'skipped')
      .order('id', { ascending: true })
      .range(offset, offset + PAGE_SIZE - 1);
    if (error) throw error;
    for (const r of data ?? []) used.add(r.dmm_content_id as string);
    if (!data || data.length < PAGE_SIZE) break;
  }

  const swipePlays = await getSwipePlayCounts();

  const columns = 'dmm_content_id, title, thumbnail_url, maker, actress_ids';
  const base = () =>
    supabase
      .from('videos')
      .select(columns)
      .eq('is_active', true)
      .not('thumbnail_url', 'is', null)
      .not('sample_video_url', 'is', null);

  const swipeIds = [...swipePlays.keys()].filter((id) => !used.has(id));
  const [newRes, rankingRes, randomRes, swipeRes] = await Promise.all([
    base().order('release_date', { ascending: false, nullsFirst: false }).limit(CANDIDATE_POOL),
    base().not('rank_position', 'is', null).order('rank_position', { ascending: true }).limit(CANDIDATE_POOL),
    // 並び順を指定しない limit だと毎回ほぼ同じ行が返るため、全作品からランダムに取る RPC を使う
    supabase.rpc('get_random_videos_all', { p_limit: CANDIDATE_POOL * 5 }),
    swipeIds.length > 0 ? base().in('dmm_content_id', swipeIds) : Promise.resolve({ data: [], error: null }),
  ]);
  for (const res of [newRes, rankingRes, randomRes, swipeRes]) {
    if (res.error) throw res.error;
  }
  const pools: Record<SlotType, VideoRow[]> = {
    new: (newRes.data ?? []) as VideoRow[],
    ranking: (rankingRes.data ?? []) as VideoRow[],
    random: (randomRes.data ?? []) as VideoRow[],
    manual: [],
  };

  const swipePool = (swipeRes.data ?? []) as VideoRow[];
  // スワイプした先でよく再生された作品ほど選ばれやすくする（再生されていない作品も選ばれうる）
  const plays = (v: VideoRow) => swipePlays.get(v.dmm_content_id) ?? 0;
  const weight = (v: VideoRow) => 1 + plays(v) * 5;

  // 枠ごとに未使用の作品を選ぶ
  // - 新着・人気ランキング枠: 各候補の上位30件から、スワイプ後の再生が多い作品を優先
  // - おすすめ枠: スワイプした先で再生された作品から、再生回数に応じて選ぶ（データがなければランダム）
  // 候補が尽きたらランダム枠の母数から補う
  const picks: { slot: (typeof targets)[number]; video: VideoRow }[] = [];
  for (const slot of targets) {
    const available = (pool: VideoRow[]) => pool.filter((v) => !used.has(v.dmm_content_id));
    const video =
      slot.type === 'random'
        ? pickWeighted(available(swipePool), plays) ?? pickRandom(available(pools.random))
        : pickWeighted(available(pools[slot.type]).slice(0, 30), weight) ?? pickRandom(available(pools.random));
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

/**
 * 管理者がサイトで選んだ作品の投稿文を作る（/api/admin/x-posts/compose）
 * alreadyPosted: すでに紹介済み（スキップ以外の候補がある）か
 */
export async function composeForVideo(contentId: string) {
  const supabase = getSupabaseAdmin();
  const { data: video, error } = await supabase
    .from('videos')
    .select('dmm_content_id, title, thumbnail_url, maker, actress_ids')
    .eq('dmm_content_id', contentId)
    .maybeSingle();
  if (error) throw error;
  if (!video) return null;

  const actressIds = (video.actress_ids ?? []) as string[];
  const [{ data: actresses }, { count }] = await Promise.all([
    actressIds.length > 0
      ? supabase.from('actresses').select('id, name').in('id', actressIds)
      : Promise.resolve({ data: [] as { id: string; name: string }[] }),
    supabase.from('x_posts').select('id', { count: 'exact', head: true }).eq('dmm_content_id', contentId).neq('status', 'skipped'),
  ]);
  const nameById = new Map((actresses ?? []).map((a) => [a.id as string, a.name as string]));
  const names = actressIds.map((id) => nameById.get(id)).filter(Boolean) as string[];

  return {
    video: video as VideoRow,
    text: buildPostText(video as VideoRow, names, 'manual'),
    alreadyPosted: (count ?? 0) > 0,
  };
}
