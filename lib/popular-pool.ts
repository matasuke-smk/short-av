import { unstable_cache } from 'next/cache';
import { supabase } from '@/lib/supabase';

/**
 * ホーム（初期表示・ホーム・補充）に出す動画は人気の作品だけ（2026-11-01 ユーザーと決めた形）。
 * 人気の作品 = レビュー30件以上・評価4.0以上、または FANZA の人気ランキングに入っている作品（新作はレビューが少ないため）。
 * 検索・ランキング・女優やジャンルの一覧・4分超・いいね・履歴・作品へのリンクは今までどおり全作品から。
 *
 * Supabase の通信量を抑えるため、10分ごとに作品番号と並べ方に使う項目だけをまとめて取り、
 * 出す作品を選んでから、その作品だけ全部の項目を取る。
 */
export const POPULAR_MIN_REVIEWS = 30;
export const POPULAR_MIN_AVERAGE = 4.0;
// セール中の作品の割合（5本のうち4本。2026-10-31 に決めた8割を人気の作品の中で続ける）
const SALE_SHARE = 0.8;
// 好みの系統（いいね・履歴から割り出した女優・ジャンル）の作品の割合
const PREFERRED_SHARE = 0.6;

type IndexRow = { dmm_content_id: string; campaign_end: string | null; genre_ids: string[] | null; actress_ids: string[] | null };
type Video = { dmm_content_id: string; [key: string]: unknown };

const POPULAR_FILTER = `and(review_count.gte.${POPULAR_MIN_REVIEWS},review_average.gte.${POPULAR_MIN_AVERAGE}),rank_position.not.is.null`;

/** 人気の作品の一覧（作品番号・セールの終わり・ジャンル・女優だけ。10分使い回す） */
export const getPopularIndex = unstable_cache(
  async (): Promise<IndexRow[]> => {
    const rows: IndexRow[] = [];
    for (let from = 0; ; from += 1000) {
      const { data, error } = await supabase
        .from('videos')
        .select('dmm_content_id, campaign_end, genre_ids, actress_ids')
        .eq('is_active', true)
        .not('thumbnail_url', 'is', null)
        .not('sample_video_url', 'is', null)
        .or(POPULAR_FILTER)
        .order('id', { ascending: true })
        .range(from, from + 999);
      if (error) throw error;
      rows.push(...((data ?? []) as IndexRow[]));
      if (!data || data.length < 1000) break;
    }
    return rows;
  },
  ['popular-video-index-v1'],
  { revalidate: 600 },
);

function shuffle<T>(items: T[]): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

/**
 * 人気の作品から size 本を選ぶ（毎回ちがう順）。セール中の作品を8割にし、好み（女優・ジャンル）があればその作品を6割にする。
 * exclude の作品は除く（すでに見せた作品）。全部見終わっていたら重複を許す
 */
export async function pickPopularVideos(size: number, options: { genres?: string[]; actresses?: string[]; exclude?: string[] } = {}): Promise<Video[]> {
  const index = await getPopularIndex();
  const skip = new Set(options.exclude ?? []);
  let candidates = index.filter((r) => !skip.has(r.dmm_content_id));
  if (candidates.length < size) candidates = index;

  const now = Date.now();
  const onSale = (r: IndexRow) => !!r.campaign_end && new Date(r.campaign_end).getTime() > now;
  const genres = new Set(options.genres ?? []);
  const actresses = new Set(options.actresses ?? []);
  const hasPref = genres.size > 0 || actresses.size > 0;
  const preferred = (r: IndexRow) => (r.genre_ids ?? []).some((g) => genres.has(g)) || (r.actress_ids ?? []).some((a) => actresses.has(a));

  // 好みがあれば「好み3・その他2」、なければ「セール4・その他1」で交互に並べる
  const [a, b] = hasPref
    ? [shuffle(candidates.filter(preferred)), shuffle(candidates.filter((r) => !preferred(r)))]
    : [shuffle(candidates.filter(onSale)), shuffle(candidates.filter((r) => !onSale(r)))];
  const share = hasPref ? PREFERRED_SHARE : SALE_SHARE;
  const ids: string[] = [];
  for (let i = 0; ids.length < size && (a.length > 0 || b.length > 0); i++) {
    const takeA = (i % 5) / 5 < share ? a.length > 0 : b.length === 0;
    ids.push((takeA ? a.shift() : b.shift())!.dmm_content_id);
  }
  if (ids.length === 0) return [];

  const { data, error } = await supabase.from('videos').select('*').in('dmm_content_id', ids);
  if (error) throw error;
  const byId = new Map(((data ?? []) as Video[]).map((v) => [v.dmm_content_id, v]));
  return ids.map((id) => byId.get(id)).filter((v): v is Video => !!v);
}
