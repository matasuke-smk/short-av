/**
 * アフィリエイトバナー設定（DMMウィジェット方式）
 *
 * バナーIDはDMMアフィリエイト管理画面から取得してください
 * https://affiliate.dmm.com/
 *
 * 使用形式：
 * <ins class="widget-banner"></ins>
 * <script src="https://widget-view.dmm.co.jp/js/banner_placement.js?affiliate_id=matasuke-005&banner_id=BANNER_ID"></script>
 */

/**
 * 横長バナー（640x200）のバナーID
 * サムネイル横・動画モーダル（横向き）で使用
 */
export const landscapeBannerIds: string[] = [
  '1082_640_200', // 初回購入限定！500円OFF！
  '1083_640_200',
  '374_640_200',
  '1321_640_200',
  '602_640_200',
  '377_640_200',
  '373_640_200',
  '192_640_200',
];

/**
 * 縦長バナー（160x600）のバナーID
 * 動画モーダル（横画面時）で使用
 */
export const portraitBannerIds: string[] = [
  '1082_160_600',
  '1083_160_600',
  '1321_160_600',
];
