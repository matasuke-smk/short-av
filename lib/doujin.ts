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
  // 人気＋評価: 人気順と評価順を1冊ずつ交互に並べる（同じ作品は1回だけ）
  if (order === 'mix') {
    const [rank, review] = await Promise.all([fetchDoujin('rank', hits), fetchDoujin('review', hits)]);
    const seen = new Set<string>();
    const mixed: Doujin[] = [];
    for (let i = 0; i < Math.max(rank.length, review.length); i++) {
      for (const d of [rank[i], review[i]]) {
        if (d && !seen.has(d.contentId)) {
          seen.add(d.contentId);
          mixed.push(d);
        }
      }
    }
    return mixed.slice(0, hits);
  }
  const sort = order === 'cheap' ? '-price' : order === 'random' ? 'rank' : (order as 'rank' | 'date' | 'review');
  const data = await fetchDMMProducts({ service: 'doujin', floor: 'digital_doujin', sort, hits: order === 'random' ? 100 : hits });
  const list = (data.result?.items ?? []).map(toDoujin).filter((d): d is Doujin => d !== null);
  if (order !== 'random') return list;
  // 人気上位100件から毎回ちがう組み合わせで選ぶ
  for (let i = list.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [list[i], list[j]] = [list[j], list[i]];
  }
  return list.slice(0, hits);
}

/** 人気順の同人作品 */
export const fetchPopularDoujin = (hits = 30) => fetchDoujin('rank', hits);
