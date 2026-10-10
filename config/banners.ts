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
 * 右の欄に 300×600（人気順）、サムネイルの下に 728×90（新着順）
 */
export const pcWidgets = {
  side: { id: '162f55b36f572321e49be0f8d5fd158a', width: 300, height: 600 },
  bottom: { id: '3fd139a9b5ae691b7660f7f4d28be4ee', width: 728, height: 90 }, // 新着順（右の人気順と内容がかぶらないよう 10/10 に変更）
} as const;

/**
 * 記事ページの本文の後に出す商品ウィジェット（300×250、スマホ表示可。DMM アフィリエイトで 2026-10-10 に作成）。
 * 記事の内容に合わせてキーワードを変える。slug がこの表にない記事は common
 */
export const articleWidgets = {
  common: { id: 'b9c63e5e116bb21a50c68e22935a7b4e', label: 'FANZA の人気作品' },               // 動画 人気順
  bigSize: { id: '5429dbaae8c80ea02e4619e686404a51', label: '「巨根」の人気作品' },             // 動画 キーワード: 巨根
  condom: { id: '19349ce5071501477e9a448d5928e607', label: 'FANZA 通販のコンドーム' },         // 通販 大人のおもちゃ キーワード: コンドーム
  premature: { id: '5a3dcd3463bbec964df6a41078520bd7', label: '早漏対策のグッズ' },             // 通販 大人のおもちゃ キーワード: 早漏
  shaved: { id: '557c873f2aac26a8bfedd23d10fa2596', label: '「パイパン」の人気作品' },          // 動画 キーワード: パイパン
  slut: { id: '1b6a0574cf63a6c1997043e9e061e98a', label: '「痴女」の人気作品' },                // 動画 キーワード: 痴女
  intimate: { id: 'ccbc590531a9b91db619e5fae054504e', label: '「密着セックス」の人気作品' },   // 動画 キーワード: 密着 セックス
} as const;

export const articleWidgetBySlug: Record<string, keyof typeof articleWidgets> = {
  'size-comparison-tool': 'bigSize',
  'japanese-penis-size-data': 'bigSize',
  'av-actors-vs-average-men': 'bigSize',
  'size-statistics-report': 'bigSize',
  'condom-size-guide': 'condom',
  'std-risk-reduction-methods': 'condom',
  'premature-ejaculation-solutions': 'premature',
  'male-vio-depilation-guide': 'shaved',
  'refractory-period-by-age': 'slut',
  'sex-duration-average-reality': 'intimate',
};
