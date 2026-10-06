/**
 * X 投稿（サーバー専用）
 *
 * 管理画面で「投稿すると効果的な作品」を選び、その作品の投稿文を作る。
 * 以前は毎週水曜に1週間分の候補を自動で作っていたが、作品ごとに作る形に変えた。
 */

import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { runReports } from '@/lib/ga-data';
import { countXWeightedLength, getXPostVideoUrl, X_MAX_WEIGHTED_LENGTH } from '@/lib/x-post-text';

// manual = 管理者が選んだ作品（new / ranking / random は以前の毎週の自動作成で使っていた）
export type SlotType = 'new' | 'ranking' | 'random' | 'manual';

// おすすめを出すための集計期間（日）と件数
const RECOMMEND_DAYS = 7;
const RECOMMEND_LIMIT = 20;
const PAGE_SIZE = 1000;

export type VideoRow = {
  dmm_content_id: string;
  title: string;
  thumbnail_url: string | null;
  maker: string | null;
  actress_ids: string[] | null;
};

const eventIs = (value: string) => ({ filter: { fieldName: 'eventName', stringFilter: { value } } });

// GA の作品ID別の件数（作品ID → 件数）
function toCountMap(rows: { dimensions: string[]; metrics: number[] }[]): Map<string, number> {
  return new Map(rows.filter((r) => r.dimensions[0] && r.dimensions[0] !== '(not set)').map((r) => [r.dimensions[0], r.metrics[0]]));
}

/**
 * 直近の作品ごとの反応を Google Analytics から取得する。
 * - plays: サンプル動画の再生回数
 * - swipePlays: そのうち、スワイプして見つけて再生された回数（最初に表示された1本ではない）
 * - clicks: FANZA へのリンクが押された回数
 * GA の鍵が未設定・取得失敗のときは空（ランキングといいねだけで選ぶ）。
 */
async function getGaCounts(days: number) {
  const empty = { plays: new Map<string, number>(), swipePlays: new Map<string, number>(), clicks: new Map<string, number>() };
  try {
    const dateRanges = [{ startDate: `${days - 1}daysAgo`, endDate: 'today' }];
    const dimensions = [{ name: 'customEvent:content_id' }];
    const metrics = [{ name: 'eventCount' }];
    const orderBys = [{ metric: { metricName: 'eventCount' }, desc: true }];
    const [plays, swipePlays, clicks] = await runReports([
      { dateRanges, dimensions, metrics, orderBys, dimensionFilter: eventIs('video_view'), limit: 200 },
      {
        dateRanges,
        dimensions,
        metrics,
        orderBys,
        dimensionFilter: {
          andGroup: {
            expressions: [eventIs('video_view'), { filter: { fieldName: 'customEvent:via', stringFilter: { value: 'スワイプ' } } }],
          },
        },
        limit: 200,
      },
      { dateRanges, dimensions, metrics, orderBys, dimensionFilter: eventIs('dmm_link_click'), limit: 200 },
    ]);
    return { plays: toCountMap(plays), swipePlays: toCountMap(swipePlays), clicks: toCountMap(clicks) };
  } catch (error) {
    console.warn('[x-posts] GA の作品ごとの反応を取得できませんでした:', error);
    return empty;
  }
}

export type RecommendedVideo = {
  dmm_content_id: string;
  title: string;
  thumbnail_url: string | null;
  score: number;
  plays: number;
  swipePlays: number;
  clicks: number;
  likes: number;
  rank: number | null;
};

/**
 * 投稿すると効果的な作品（まだ X で紹介していない作品）を、反応の大きい順に返す。
 * 点数 = FANZA へのリンク × 5 + スワイプ後の再生 × 2 + 再生 × 1 + いいね × 3 + ランキング上位ボーナス（1位 30点〜30位 1点）
 * リンクが押された作品は「買いたくなる」作品、スワイプ後に再生された作品は「目に留まる」作品なので重く数える。
 */
export async function getRecommendedVideos(): Promise<{ days: number; videos: RecommendedVideo[] }> {
  const supabase = getSupabaseAdmin();

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

  const ga = await getGaCounts(RECOMMEND_DAYS);
  const gaIds = [...new Set([...ga.plays.keys(), ...ga.clicks.keys()])].filter((id) => !used.has(id));

  const columns = 'dmm_content_id, title, thumbnail_url, likes_count, rank_position';
  const base = () =>
    supabase
      .from('videos')
      .select(columns)
      .eq('is_active', true)
      .not('thumbnail_url', 'is', null)
      .not('sample_video_url', 'is', null);
  const [gaRes, rankingRes, likedRes] = await Promise.all([
    gaIds.length > 0 ? base().in('dmm_content_id', gaIds) : Promise.resolve({ data: [], error: null }),
    base().not('rank_position', 'is', null).order('rank_position', { ascending: true }).limit(60),
    base().gt('likes_count', 0).order('likes_count', { ascending: false }).limit(60),
  ]);
  for (const res of [gaRes, rankingRes, likedRes]) {
    if (res.error) throw res.error;
  }

  type Row = { dmm_content_id: string; title: string; thumbnail_url: string | null; likes_count: number | null; rank_position: number | null };
  const byId = new Map<string, Row>();
  for (const row of [...(gaRes.data ?? []), ...(rankingRes.data ?? []), ...(likedRes.data ?? [])] as Row[]) {
    if (!used.has(row.dmm_content_id)) byId.set(row.dmm_content_id, row);
  }

  const videos = [...byId.values()].map((row): RecommendedVideo => {
    const plays = ga.plays.get(row.dmm_content_id) ?? 0;
    const swipePlays = ga.swipePlays.get(row.dmm_content_id) ?? 0;
    const clicks = ga.clicks.get(row.dmm_content_id) ?? 0;
    const likes = row.likes_count ?? 0;
    const rank = row.rank_position;
    const rankBonus = rank ? Math.max(0, 31 - rank) : 0;
    return {
      dmm_content_id: row.dmm_content_id,
      title: row.title,
      thumbnail_url: row.thumbnail_url,
      score: clicks * 5 + swipePlays * 2 + plays + likes * 3 + rankBonus,
      plays,
      swipePlays,
      clicks,
      likes,
      rank,
    };
  });
  videos.sort((a, b) => b.score - a.score || (a.rank ?? 999) - (b.rank ?? 999));
  return { days: RECOMMEND_DAYS, videos: videos.filter((v) => v.score > 0).slice(0, RECOMMEND_LIMIT) };
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
