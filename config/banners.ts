/**
 * アフィリエイトバナー設定
 *
 * バナーURLはDMMアフィリエイト管理画面から取得してください
 * https://affiliate.dmm.com/
 */

export interface BannerConfig {
  url: string;
  alt: string;
  width: number;
  height: number;
}

/**
 * 横長バナー（640x200）
 * サムネイル横・動画モーダル（横向き）で使用
 */
export const landscapeBanners: BannerConfig[] = [
  {
    url: 'https://pics.dmm.com/af/a_digital_500off01/640_200.jpg',
    alt: '初回購入限定！500円OFF！',
    width: 640,
    height: 200,
  },
  // TODO: 追加のバナーURLをここに追加してください
  // {
  //   url: 'https://pics.dmm.com/af/...',
  //   alt: 'バナーの説明',
  //   width: 640,
  //   height: 200,
  // },
];

/**
 * 縦長バナー（300x250）
 * 動画モーダル（縦向き）で使用
 */
export const portraitBanners: BannerConfig[] = [
  {
    url: 'https://pics.dmm.com/af/a_digital_500off01/300_250.jpg',
    alt: '初回購入限定！500円OFF！',
    width: 300,
    height: 250,
  },
  // TODO: 追加のバナーURLをここに追加してください
  // {
  //   url: 'https://pics.dmm.com/af/...',
  //   alt: 'バナーの説明',
  //   width: 300,
  //   height: 250,
  // },
];
