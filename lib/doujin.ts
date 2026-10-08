import { fetchDMMProducts, type DMMItem } from '@/lib/dmm-api';
import type { Doujin, DoujinOrder } from '@/lib/doujin-types';

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
