import { fetchDMMProducts, type DMMItem } from '@/lib/dmm-api';

/**
 * FANZA 同人（service=doujin, floor=digital_doujin）の作品
 * - サンプル画像は sampleImageURL.sample_l だけが返る（4〜10枚ほど。sample_s・立ち読みはない）
 * - 画像は doujin-assets.dmm.co.jp。縦長の漫画（1000x1412 など）と横長の CG 集が混ざる
 */
export type Doujin = {
  contentId: string;
  title: string;
  circle: string | null; // サークル名（API ではメーカー）
  price: number | null; // 販売価格（セール中はセール価格）
  listPrice: number | null; // 定価（セール中のみ price と異なる）
  url: string; // アフィリエイトリンク
  cover: string; // 表紙
  samples: string[]; // サンプル画像（大）
  genres: string[];
};

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

/** 人気順の同人作品（サンプル画像のあるものだけ。API の結果は1時間キャッシュ） */
export async function fetchPopularDoujin(hits = 30): Promise<Doujin[]> {
  const data = await fetchDMMProducts({ service: 'doujin', floor: 'digital_doujin', sort: 'rank', hits });
  return (data.result?.items ?? []).map(toDoujin).filter((d): d is Doujin => d !== null);
}
