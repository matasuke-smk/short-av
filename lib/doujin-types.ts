// 同人の型と並べ方（画面側からも読むため、DMM の API を呼ぶ lib/doujin.ts とは分ける）

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

// 並べ方（管理画面の「同人テスト」で切り替えて比べる）
export const DOUJIN_ORDERS = {
  rank: '人気順',
  date: '新着順',
  review: '評価順',
  cheap: '安い順',
  random: '人気上位からランダム',
} as const;
export type DoujinOrder = keyof typeof DOUJIN_ORDERS;

