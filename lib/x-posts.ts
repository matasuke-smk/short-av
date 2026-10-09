/**
 * X 投稿（サーバー専用）
 *
 * 管理画面で「投稿すると効果的な作品」を選び、その作品の投稿文を作る。
 * 以前は毎週水曜に1週間分の候補を自動で作っていたが、作品ごとに作る形に変えた。
 */

import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { importVideoFromDmm } from '@/lib/video-import';
import { runReports } from '@/lib/ga-data';
import { toContentIds } from '@/lib/likes';
import { getAdminUserIds } from '@/lib/admin-users';
import { EXTRA_LONG_SAMPLE_SECONDS, LONG_SAMPLE_SECONDS } from '@/config/site';
import { BROWSER_HINT, countXWeightedLength, getXPostVideoUrl, X_MAX_WEIGHTED_LENGTH } from '@/lib/x-post-text';

// manual = 管理者が選んだ作品（new / ranking / random は以前の毎週の自動作成で使っていた）
export type SlotType = 'new' | 'ranking' | 'random' | 'manual';

// おすすめを出すための集計期間（日）と件数
const RECOMMEND_DAYS = 7;
// X から来た人の反応（前回の投稿の効果）を数える期間（日）
const X_RESULT_DAYS = 28;
// 紹介した作品を「効果的」の候補に戻すまでの間隔（日）。戻ったときも見出しは通常のもの
export const REPOST_INTERVAL_DAYS = 14;
const RECOMMEND_LIMIT = 20;
const PAGE_SIZE = 1000;

export type VideoRow = {
  dmm_content_id: string;
  title: string;
  thumbnail_url: string | null;
  maker: string | null;
  actress_ids: string[] | null;
  rank_position?: number | null;
  release_date?: string | null;
  sample_seconds?: number | null;
};

// 見出し（1行目）。同じ見出しが続くと X で単調になるため、作品に合うものと汎用のものから毎回選ぶ
const GENERIC_HEADINGS = [
  '【今日のおすすめ】',
  '【注目作品】',
  '【運営イチオシ】',
  '【まずはサンプルで】',
  '【見逃し注意】',
  '【気になったらサンプルを】',
];
const NEW_RELEASE_DAYS = 14;

const pick = <T,>(items: T[]): T => items[Math.floor(Math.random() * items.length)];

// サンプルの長さの書き方。見出しは端数を「超え・半・近く」で表し、本文は正確な「n分m秒」
// 見出し用のサンプルの長さ。四捨五入すると実際より長く見えることがあるため、端数は自然な言い方にする
// 例: 4:05 → 4分 / 4:12 → 4分超え / 4:31 → 4分半 / 9:58 → 10分近く
const aboutMinutes = (seconds: number) => {
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  if (rest < 10) return `${minutes}分`;
  if (rest < 25) return `${minutes}分超え`;
  if (rest < 45) return `${minutes}分半`;
  return `${minutes + 1}分近く`;
};
const exactLength = (seconds: number) => `${Math.floor(seconds / 60)}分${seconds % 60 ? `${seconds % 60}秒` : ''}`;

/** 作品の情報（順位・発売日・サンプルの長さ）に合う見出しを優先しつつ、毎回ランダムに選ぶ */
export function pickHeading(video: VideoRow): string {
  // サンプル4分以上は長尺であることをいちばんの売りにする（見出しは必ず長尺のもの）
  if (video.sample_seconds && video.sample_seconds >= EXTRA_LONG_SAMPLE_SECONDS) {
    const minutes = aboutMinutes(video.sample_seconds);
    return pick([`【サンプル${minutes}】`, `【サンプル動画 ${minutes}】`, `【無料サンプル${minutes}】`]);
  }
  const specific: string[] = [];
  if (video.rank_position && video.rank_position <= 30) specific.push(`【人気ランキング${video.rank_position}位】`);
  if (video.release_date) {
    const days = (Date.now() - new Date(video.release_date).getTime()) / 86_400_000;
    if (days >= 0 && days <= NEW_RELEASE_DAYS) specific.push('【新作】', '【新作をチェック】');
  }
  if (video.sample_seconds && video.sample_seconds >= LONG_SAMPLE_SECONDS) {
    specific.push(`【サンプル動画 ${aboutMinutes(video.sample_seconds)}】`);
  }
  // 作品に合う見出しがあれば半分の確率でそちらを使う
  return specific.length > 0 && Math.random() < 0.5 ? pick(specific) : pick(GENERIC_HEADINGS);
}

const eventIs = (value: string) => ({ filter: { fieldName: 'eventName', stringFilter: { value } } });

// GA の作品ID別の件数（作品ID → 件数）
function toCountMap(rows: { dimensions: string[]; metrics: number[] }[]): Map<string, number> {
  return new Map(rows.filter((r) => r.dimensions[0] && r.dimensions[0] !== '(not set)').map((r) => [r.dimensions[0], r.metrics[0]]));
}

// X の投稿リンク（utm_source=x）から来た訪問に絞る条件
const fromX = { filter: { fieldName: 'sessionSource', stringFilter: { value: 'x' } } };

/**
 * 直近の作品ごとの反応を Google Analytics から取得する。
 * - plays: サンプル動画の再生回数
 * - swipePlays: そのうち、スワイプして見つけて再生された回数（最初に表示された1本ではない）
 * - clicks: FANZA へのリンクが押された回数
 * - xPlays / xClicks: X の投稿から来た人による再生・FANZA へのリンク（前回紹介したときの効果）
 * GA の鍵が未設定・取得失敗のときは空（ランキングといいねだけで選ぶ）。
 */
async function getGaCounts(days: number) {
  const empty = {
    plays: new Map<string, number>(),
    swipePlays: new Map<string, number>(),
    clicks: new Map<string, number>(),
    xPlays: new Map<string, number>(),
    xClicks: new Map<string, number>(),
  };
  try {
    const dateRanges = [{ startDate: `${days - 1}daysAgo`, endDate: 'today' }];
    const xDateRanges = [{ startDate: `${X_RESULT_DAYS - 1}daysAgo`, endDate: 'today' }];
    const dimensions = [{ name: 'customEvent:content_id' }];
    const metrics = [{ name: 'eventCount' }];
    const orderBys = [{ metric: { metricName: 'eventCount' }, desc: true }];
    const [plays, swipePlays, clicks, xPlays, xClicks] = await runReports([
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
      { dateRanges: xDateRanges, dimensions, metrics, orderBys, dimensionFilter: { andGroup: { expressions: [eventIs('video_view'), fromX] } }, limit: 200 },
      { dateRanges: xDateRanges, dimensions, metrics, orderBys, dimensionFilter: { andGroup: { expressions: [eventIs('dmm_link_click'), fromX] } }, limit: 200 },
    ]);
    return {
      plays: toCountMap(plays),
      swipePlays: toCountMap(swipePlays),
      clicks: toCountMap(clicks),
      xPlays: toCountMap(xPlays),
      xClicks: toCountMap(xClicks),
    };
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
  xPlays: number;
  xClicks: number;
  postedCount: number; // これまでに紹介した回数
  lastPostedAt: string | null; // 前回紹介した日時
  sampleSeconds: number | null; // サンプル動画の長さ（秒。分からなければ null）
};

/**
 * 紹介済みの作品の履歴（作品ID → 回数・最後に紹介した日時）と、
 * 直近（REPOST_INTERVAL_DAYS 日以内）に紹介した・紹介予定の作品（おすすめから外す）
 */
async function getPostHistory() {
  const supabase = getSupabaseAdmin();
  const cutoff = Date.now() - REPOST_INTERVAL_DAYS * 86_400_000;
  const history = new Map<string, { count: number; lastAt: string }>();
  const used = new Set<string>();
  // 1000 行上限で切れないようページを分けて取得
  for (let offset = 0; ; offset += PAGE_SIZE) {
    const { data, error } = await supabase
      .from('x_posts')
      .select('dmm_content_id, slot_at, status')
      .neq('status', 'skipped')
      .order('id', { ascending: true })
      .range(offset, offset + PAGE_SIZE - 1);
    if (error) throw error;
    for (const r of data ?? []) {
      const id = r.dmm_content_id as string;
      const at = r.slot_at as string;
      // 間隔内の投稿・予約・未予約のストックがあれば、まだ出さない
      if (new Date(at).getTime() >= cutoff) used.add(id);
      // 未予約のまま過ぎたストックは実際には投稿していないので、回数に数えない
      if (r.status === 'scheduled') {
        const prev = history.get(id);
        const later = prev && new Date(prev.lastAt).getTime() > new Date(at).getTime();
        history.set(id, { count: (prev?.count ?? 0) + 1, lastAt: later ? prev.lastAt : at });
      }
    }
    if (!data || data.length < PAGE_SIZE) break;
  }
  return { history, used };
}

/**
 * 作品ごとのいいね数（運営者＝管理画面を開いた端末のいいねを除く）。
 * videos.likes_count は運営者のいいねも含むため、おすすめの点数にはこちらを使う。
 */
async function getLikeCountsExcludingAdmin(): Promise<Map<string, number>> {
  const supabase = getSupabaseAdmin();
  const adminIds = new Set(await getAdminUserIds());
  const rows: { video_id: string; user_identifier: string }[] = [];
  // 1000 行上限で切れないようページを分けて取得
  for (let offset = 0; ; offset += PAGE_SIZE) {
    const { data, error } = await supabase
      .from('likes')
      .select('video_id, user_identifier')
      .order('id', { ascending: true })
      .range(offset, offset + PAGE_SIZE - 1);
    if (error) throw error;
    rows.push(...((data ?? []) as { video_id: string; user_identifier: string }[]));
    if (!data || data.length < PAGE_SIZE) break;
  }
  const others = rows.filter((row) => !adminIds.has(row.user_identifier));
  // 旧形式（UUID）のいいねも dmm_content_id にまとめる
  const contentIds = await toContentIds(supabase, [...new Set(others.map((row) => row.video_id))]);
  const counts = new Map<string, number>();
  for (const row of others) {
    const id = contentIds.get(row.video_id);
    if (id) counts.set(id, (counts.get(id) ?? 0) + 1);
  }
  return counts;
}

/**
 * 投稿すると効果的な作品を、反応の大きい順に返す。
 * 紹介してから REPOST_INTERVAL_DAYS 日は出さず、その後はもう一度候補に入る。
 * 点数 = FANZA へのリンク × 5 + スワイプ後の再生 × 2 + 再生 × 1 + いいね × 3 + ランキング上位ボーナス（1位 30点〜30位 1点）
 *      + X から来た人の FANZA へのリンク × 10 + X から来た人の再生 × 3（前回の紹介で反応があった作品を優先）
 * リンクが押された作品は「買いたくなる」作品、スワイプ後に再生された作品は「目に留まる」作品なので重く数える。
 */
export async function getRecommendedVideos(): Promise<{ days: number; videos: RecommendedVideo[] }> {
  const supabase = getSupabaseAdmin();

  const [{ history, used }, ga, likeCounts] = await Promise.all([getPostHistory(), getGaCounts(RECOMMEND_DAYS), getLikeCountsExcludingAdmin()]);
  // いいねの多い作品（運営者を除く）の上位60件も候補に入れる
  const likedIds = [...likeCounts].sort((a, b) => b[1] - a[1]).slice(0, 60).map(([id]) => id);
  const gaIds = [...new Set([...ga.plays.keys(), ...ga.clicks.keys(), ...ga.xPlays.keys(), ...ga.xClicks.keys()])].filter(
    (id) => !used.has(id),
  );

  const columns = 'dmm_content_id, title, thumbnail_url, rank_position, sample_seconds';
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
    likedIds.length > 0 ? base().in('dmm_content_id', likedIds) : Promise.resolve({ data: [], error: null }),
  ]);
  for (const res of [gaRes, rankingRes, likedRes]) {
    if (res.error) throw res.error;
  }

  type Row = { dmm_content_id: string; title: string; thumbnail_url: string | null; rank_position: number | null; sample_seconds: number | null };
  const byId = new Map<string, Row>();
  for (const row of [...(gaRes.data ?? []), ...(rankingRes.data ?? []), ...(likedRes.data ?? [])] as Row[]) {
    if (!used.has(row.dmm_content_id)) byId.set(row.dmm_content_id, row);
  }

  const videos = [...byId.values()].map((row): RecommendedVideo => {
    const plays = ga.plays.get(row.dmm_content_id) ?? 0;
    const swipePlays = ga.swipePlays.get(row.dmm_content_id) ?? 0;
    const clicks = ga.clicks.get(row.dmm_content_id) ?? 0;
    const likes = likeCounts.get(row.dmm_content_id) ?? 0;
    const rank = row.rank_position;
    const rankBonus = rank ? Math.max(0, 31 - rank) : 0;
    const xPlays = ga.xPlays.get(row.dmm_content_id) ?? 0;
    const xClicks = ga.xClicks.get(row.dmm_content_id) ?? 0;
    const posted = history.get(row.dmm_content_id);
    return {
      dmm_content_id: row.dmm_content_id,
      title: row.title,
      thumbnail_url: row.thumbnail_url,
      sampleSeconds: row.sample_seconds && row.sample_seconds > 0 ? row.sample_seconds : null,
      score: clicks * 5 + swipePlays * 2 + plays + likes * 3 + rankBonus + xClicks * 10 + xPlays * 3,
      plays,
      swipePlays,
      clicks,
      likes,
      rank,
      xPlays,
      xClicks,
      postedCount: posted?.count ?? 0,
      lastPostedAt: posted?.lastAt ?? null,
    };
  });
  videos.sort((a, b) => b.score - a.score || (a.rank ?? 999) - (b.rank ?? 999));
  return { days: RECOMMEND_DAYS, videos: videos.filter((v) => v.score > 0).slice(0, RECOMMEND_LIMIT) };
}

export type LikedVideo = Omit<RecommendedVideo, 'score'> & { likedAt: string };

/**
 * 管理者がサイトでいいねした作品（新しい順）。いいねしたら X で紹介したい作品として一覧に出す。
 * 紹介済みでも外さず、紹介した回数・前回の日時を付けて返す。
 */
export async function getLikedVideos(userId: string): Promise<{ days: number; videos: LikedVideo[] }> {
  const supabase = getSupabaseAdmin();
  const { data: likes, error } = await supabase
    .from('likes')
    .select('video_id, created_at')
    .eq('user_identifier', userId)
    .order('created_at', { ascending: false })
    .limit(PAGE_SIZE);
  if (error) throw error;

  // 旧形式（UUID）のいいねも dmm_content_id に読み替え、同じ作品は新しいいいねだけ残す
  const contentIdMap = await toContentIds(supabase, (likes ?? []).map((like) => like.video_id as string));
  const likedAt = new Map<string, string>();
  for (const like of likes ?? []) {
    const id = contentIdMap.get(like.video_id as string);
    if (id && !likedAt.has(id)) likedAt.set(id, like.created_at as string);
  }
  const ids = [...likedAt.keys()];
  if (ids.length === 0) return { days: RECOMMEND_DAYS, videos: [] };

  type Row = { dmm_content_id: string; title: string; thumbnail_url: string | null; rank_position: number | null; sample_seconds: number | null };
  const rows: Row[] = [];
  for (let i = 0; i < ids.length; i += 100) {
    const { data, error: videoError } = await supabase
      .from('videos')
      .select('dmm_content_id, title, thumbnail_url, rank_position, sample_seconds')
      .eq('is_active', true)
      .in('dmm_content_id', ids.slice(i, i + 100));
    if (videoError) throw videoError;
    rows.push(...((data ?? []) as Row[]));
  }

  const [{ history }, ga, likeCounts] = await Promise.all([getPostHistory(), getGaCounts(RECOMMEND_DAYS), getLikeCountsExcludingAdmin()]);
  // 同じ作品番号の作品がデータベースに複数あっても、一覧には1回だけ出す
  const uniqueRows = [...new Map(rows.map((row) => [row.dmm_content_id, row])).values()];
  const videos = uniqueRows.map((row): LikedVideo => {
    const posted = history.get(row.dmm_content_id);
    return {
      dmm_content_id: row.dmm_content_id,
      title: row.title,
      thumbnail_url: row.thumbnail_url,
      sampleSeconds: row.sample_seconds && row.sample_seconds > 0 ? row.sample_seconds : null,
      plays: ga.plays.get(row.dmm_content_id) ?? 0,
      swipePlays: ga.swipePlays.get(row.dmm_content_id) ?? 0,
      clicks: ga.clicks.get(row.dmm_content_id) ?? 0,
      likes: likeCounts.get(row.dmm_content_id) ?? 0,
      rank: row.rank_position,
      xPlays: ga.xPlays.get(row.dmm_content_id) ?? 0,
      xClicks: ga.xClicks.get(row.dmm_content_id) ?? 0,
      postedCount: posted?.count ?? 0,
      lastPostedAt: posted?.lastAt ?? null,
      likedAt: likedAt.get(row.dmm_content_id)!,
    };
  });
  videos.sort((a, b) => b.likedAt.localeCompare(a.likedAt));
  return { days: RECOMMEND_DAYS, videos };
}

export function buildPostText(video: VideoRow, actressNames: string[], type: SlotType): string {
  const url = getXPostVideoUrl(video.dmm_content_id, 'card');
  const actress = actressNames.slice(0, 2).join('・');
  const heading =
    type === 'new' ? '【新着作品】' : type === 'ranking' ? '【人気ランキング作品】' : pickHeading(video);

  const build = (title: string) =>
    [
      heading,
      title,
      actress ? `出演: ${actress}` : video.maker ? `メーカー: ${video.maker}` : '',
      '',
      video.sample_seconds && video.sample_seconds >= EXTRA_LONG_SAMPLE_SECONDS
        ? `${exactLength(video.sample_seconds)}の長尺サンプル動画はこちら👇`
        : 'サンプル動画はこちら👇',
      url,
      BROWSER_HINT,
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
 * alreadyPosted: 直近（REPOST_INTERVAL_DAYS 日以内）に紹介済み、または紹介予定のストックがあるか
 */
export async function composeForVideo(contentId: string) {
  const supabase = getSupabaseAdmin();
  const select = () =>
    supabase
      .from('videos')
      .select('dmm_content_id, title, thumbnail_url, maker, actress_ids, rank_position, release_date, sample_seconds')
      .eq('dmm_content_id', contentId)
      .maybeSingle();
  let { data: video, error } = await select();
  if (error) throw error;
  // 人気ランキングの作品は DMM から直接表示していてデータベースに無いことがある。
  // そのまま投稿すると URL を開いた人に「掲載が終了しました」と出るので、DMM から取得してデータベースに入れてから作る
  if (!video && (await importVideoFromDmm(supabase, contentId))) {
    ({ data: video, error } = await select());
    if (error) throw error;
  }
  if (!video) return null;

  const actressIds = (video.actress_ids ?? []) as string[];
  const [{ data: actresses }, { data: posts, error: postsError }] = await Promise.all([
    actressIds.length > 0
      ? supabase.from('actresses').select('id, name').in('id', actressIds)
      : Promise.resolve({ data: [] as { id: string; name: string }[] }),
    supabase.from('x_posts').select('slot_at, status').eq('dmm_content_id', contentId).neq('status', 'skipped'),
  ]);
  if (postsError) throw postsError;
  const cutoff = Date.now() - REPOST_INTERVAL_DAYS * 86_400_000;
  const alreadyPosted = (posts ?? []).some((p) => new Date(p.slot_at as string).getTime() >= cutoff);
  const nameById = new Map((actresses ?? []).map((a) => [a.id as string, a.name as string]));
  const names = actressIds.map((id) => nameById.get(id)).filter(Boolean) as string[];

  return {
    video: video as VideoRow,
    text: buildPostText(video as VideoRow, names, 'manual'),
    alreadyPosted,
  };
}
