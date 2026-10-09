import { DMMBlockedError, fetchDMMProducts, type DMMItem } from '@/lib/dmm-api';
import type { Doujin, DoujinFacet, DoujinOrder } from '@/lib/doujin-types';

export { DOUJIN_ORDERS, type Doujin, type DoujinOrder } from '@/lib/doujin-types';

const yen = (value?: string) => {
  const n = Number(String(value ?? '').replace(/[^0-9]/g, ''));
  return Number.isFinite(n) && n > 0 ? n : null;
};

export function toDoujin(item: DMMItem): Doujin | null {
  const samples = item.sampleImageURL?.sample_l?.image ?? [];
  if (samples.length === 0) return null;
  return {
    contentId: item.content_id,
    title: item.title,
    circle: item.iteminfo?.maker?.[0]?.name ?? null,
    price: yen(item.prices?.price),
    listPrice: yen(item.prices?.list_price),
    url: item.affiliateURL,
    cover: item.imageURL?.large ?? item.imageURL?.list ?? samples[0],
    samples,
    genres: (item.iteminfo?.genre ?? []).map((g) => g.name).slice(0, 6),
    genreList: (item.iteminfo?.genre ?? []).map((g) => ({ id: String(g.id), name: g.name })),
    circleId: item.iteminfo?.maker?.[0]?.id !== undefined ? String(item.iteminfo.maker[0].id) : null,
  };
}

/** 同人作品（サンプル画像のあるものだけ。API の結果は1時間キャッシュ） */
export async function fetchDoujin(order: DoujinOrder = 'mix', hits = 30): Promise<Doujin[]> {
  // 人気＋高評価からランダム: 人気上位100冊と評価上位100冊を合わせ（重複は1回）、毎回ちがう順に並べる。サイトの標準
  if (order === 'mix') {
    const [rank, review] = await Promise.all([fetchDoujin('rank', 100), fetchDoujin('review', 100)]);
    const pool = [...new Map([...rank, ...review].map((d) => [d.contentId, d])).values()];
    return shuffle(pool).slice(0, hits);
  }
  const sort = order === 'cheap' ? '-price' : order === 'random' ? 'rank' : (order as 'rank' | 'date' | 'review');
  const data = await fetchDMMProducts({ service: 'doujin', floor: 'digital_doujin', sort, hits: order === 'random' ? 100 : hits });
  const list = (data.result?.items ?? []).map(toDoujin).filter((d): d is Doujin => d !== null);
  if (order !== 'random') return list;
  // 人気上位100件から毎回ちがう組み合わせで選ぶ
  return shuffle(list).slice(0, hits);
}

function shuffle<T>(items: T[]): T[] {
  const list = [...items];
  for (let i = list.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [list[i], list[j]] = [list[j], list[i]];
  }
  return list;
}

/** 作品番号（d_123456）で1冊取る（X の投稿のリンクから来たときに、その作品から見せる）。見つからなければ null */
export async function fetchDoujinById(contentId: string): Promise<Doujin | null> {
  const data = await fetchDMMProducts({ service: 'doujin', floor: 'digital_doujin', cid: contentId, hits: 1 });
  const item = data.result?.items?.find((i) => i.content_id === contentId) ?? data.result?.items?.[0];
  return item ? toDoujin(item) : null;
}

export const DOUJIN_ID_PATTERN = /^d_[0-9a-z_]{1,40}$/;

/** 人気順の同人作品 */
export const fetchPopularDoujin = (hits = 30) => fetchDoujin('rank', hits);

/** 同人誌の検索（キーワード。並べ方は人気・新着・評価） */
export async function searchDoujin(keyword: string, sort: 'rank' | 'date' | 'review' = 'rank', hits = 40): Promise<Doujin[]> {
  const data = await fetchDMMProducts({ service: 'doujin', floor: 'digital_doujin', keyword, sort, hits });
  return (data.result?.items ?? []).map(toDoujin).filter((d): d is Doujin => d !== null);
}

/** 同人誌の人気ランキング。週間・月間は「期間内に発売された作品の人気順」（動画のランキングと同じ考え方） */
export async function rankingDoujin(period: 'weekly' | 'monthly' | 'all', hits = 40): Promise<Doujin[]> {
  const days = period === 'weekly' ? 7 : period === 'monthly' ? 30 : 0;
  // 日付は日単位にして、API の結果のキャッシュが1日のあいだ効くようにする
  const gte = days ? new Date(Date.now() + 9 * 3_600_000 - days * 86_400_000).toISOString().slice(0, 10) + 'T00:00:00' : undefined;
  const data = await fetchDMMProducts({ service: 'doujin', floor: 'digital_doujin', sort: 'rank', hits, ...(gte ? { gte_date: gte } : {}) });
  return (data.result?.items ?? []).map(toDoujin).filter((d): d is Doujin => d !== null);
}

/** 1冊取る。一時的な失敗なら1秒待ってもう一度だけ。DMM に止められているとき（DMMBlockedError）と、見つからない作品（null）はやり直さない */
async function fetchDoujinByIdWithRetry(contentId: string): Promise<Doujin | null> {
  try {
    return await fetchDoujinById(contentId);
  } catch (error) {
    if (error instanceof DMMBlockedError) return null;
    await new Promise((resolve) => setTimeout(resolve, 1000));
    return fetchDoujinById(contentId).catch(() => null);
  }
}

/**
 * 作品番号の一覧から同人誌を取る（いいね・履歴・アクセス解析の表示用。並びは渡した順、見つからないものは除く）
 * 1冊ずつしか問い合わせられない API なので冊数ぶん投げるが、同時に投げる数は fetchDMMProducts 側で抑えている
 * （全冊を同時に投げると DMM に一時停止され、30冊で18〜24冊しか返らなかった）
 */
export async function fetchDoujinByIds(ids: string[]): Promise<Doujin[]> {
  const list = await Promise.all([...new Set(ids)].map(fetchDoujinByIdWithRetry));
  return list.filter((d): d is Doujin => d !== null);
}

const DOUJIN_FLOOR = { service: 'doujin', floor: 'digital_doujin' } as const;

/**
 * 検索の選択肢: 人気上位500冊に付いているジャンル・サークルを、多い順に（API の結果は1時間キャッシュ）
 * FANZA の API には「ジャンルごとの件数」がないため、人気の作品でよく使われている順に並べる
 */
export async function doujinFacets(): Promise<{ genres: DoujinFacet[]; circles: DoujinFacet[] }> {
  const pages = await Promise.all([1, 101, 201, 301, 401].map((offset) => fetchDMMProducts({ ...DOUJIN_FLOOR, sort: 'rank', hits: 100, offset }).catch(() => null)));
  const genres = new Map<string, DoujinFacet>();
  const circles = new Map<string, DoujinFacet>();
  const add = (map: Map<string, DoujinFacet>, id: number | undefined, name: string | undefined) => {
    if (id === undefined || !name) return;
    const key = String(id);
    const prev = map.get(key);
    map.set(key, { id: key, name, count: (prev?.count ?? 0) + 1 });
  };
  for (const page of pages) {
    for (const item of page?.result?.items ?? []) {
      for (const g of item.iteminfo?.genre ?? []) add(genres, g.id, g.name);
      const maker = item.iteminfo?.maker?.[0];
      add(circles, maker?.id, maker?.name);
    }
  }
  const sorted = (map: Map<string, DoujinFacet>) => [...map.values()].sort((a, b) => b.count - a.count);
  // 「男性向け」「成人向け」のようにほぼすべての作品に付くジャンルは、絞り込みにならないので出さない
  const itemCount = pages.reduce((sum, p) => sum + (p?.result?.items?.length ?? 0), 0);
  return { genres: sorted(genres).filter((g) => g.count < itemCount * 0.9), circles: sorted(circles) };
}

const SEARCH_LIMIT = 300; // 動画の検索と同じく人気順の上位300件まで

/**
 * 同人誌の検索（動画の検索と同じ仕様）: タイトルのキーワード、または選んだジャンル（すべてに当てはまる）・サークル。人気順。
 * total は条件に合う作品の総数（FANZA の API の件数）。preview のときは先頭100件だけ取る（件数と絞り込みの候補に使う）
 */
export async function searchDoujinBy(options: { keyword?: string; genreIds?: string[]; circleId?: string; preview?: boolean }): Promise<{ doujin: Doujin[]; total: number }> {
  const articles = [
    ...(options.genreIds ?? []).map((id) => ({ type: 'genre' as const, id })),
    ...(options.circleId ? [{ type: 'maker' as const, id: options.circleId }] : []),
  ];
  const base = { ...DOUJIN_FLOOR, sort: 'rank' as const, hits: 100, ...(options.keyword ? { keyword: options.keyword } : {}), ...(articles.length ? { articles } : {}) };
  const first = await fetchDMMProducts({ ...base, offset: 1 });
  const total = first.result?.total_count ?? 0;
  const pages = [first];
  if (!options.preview && total > 100) {
    const offsets = [101, 201].filter((o) => o <= Math.min(total, SEARCH_LIMIT));
    pages.push(...(await Promise.all(offsets.map((offset) => fetchDMMProducts({ ...base, offset }).catch(() => null)))).filter((p): p is NonNullable<typeof p> => p !== null));
  }
  const doujin = pages.flatMap((p) => (p.result?.items ?? []).map(toDoujin).filter((d): d is Doujin => d !== null));
  return { doujin, total };
}

