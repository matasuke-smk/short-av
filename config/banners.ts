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
 * サムネイル下・横画面バナーで使用
 * 1082と1083を交互に表示
 */
export const landscapeBannerIds: string[] = [
  '1082_640_200',
  '1083_640_200',
];

/**
 * 縦長バナー（160x600）のバナーID
 * 動画モーダル（横画面時）で使用
 * 1082と1083を交互に表示
 */
export const portraitBannerIds: string[] = [
  '1082_160_600',
  '1083_160_600',
];

/**
 * PC だけで使う商品ウィジェット（DMM アフィリエイトの「ウィジェット作成」で 2026-10-10 に作成。FANZA → 動画 → ビデオ、人気順、固定表示、枠線なし）
 * 右の欄に 300×600、サムネイルの下に 728×90
 */
export const pcWidgets = {
  side: { id: '162f55b36f572321e49be0f8d5fd158a', width: 300, height: 600 },
  bottom: { id: '3fd139a9b5ae691b7660f7f4d28be4ee', width: 728, height: 90 },
} as const;
