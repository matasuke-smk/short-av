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
  '1277_640_200', // FANZA TV（14日間無料体験・月額550円で2200作品以上見放題）。無料お試し登録の報酬が大きい（2026-10-10 追加）
];

/**
 * 縦長バナー（160x600）のバナーID
 * 動画モーダル（横画面時）で使用
 * 1082と1083を交互に表示
 */
export const portraitBannerIds: string[] = [
  '1082_160_600',
  '1083_160_600',
  '1277_160_600', // FANZA TV
];

/**
 * 「初めての人」向けのリンク（サービス新規の報酬が大きい: 動画の新規購入 2,100円、FANZA TV の無料お試し登録 2,750円。いずれも 2026-10 の報酬UP中の料率）
 * 形式は年齢確認画面のクーポンのリンクと同じ（al.fanza.co.jp）。FANZA TV は tv.dmm.co.jp
 */
export const firstTimeLinks = {
  coupon: 'https://al.fanza.co.jp?lurl=https%3A%2F%2Fwww.dmm.co.jp%2Fdigital%2F-%2Fwelcome-coupon%2F&af_id=matasuke-005&ch=link_tool&ch_id=link',
  fanzaTv: 'https://al.fanza.co.jp?lurl=https%3A%2F%2Ftv.dmm.co.jp%2F&af_id=matasuke-005&ch=link_tool&ch_id=link',
} as const;

/**
 * PC だけで使う商品ウィジェット（DMM アフィリエイトの「ウィジェット作成」で 2026-10-10 に作成。FANZA → 動画 → ビデオ、人気順、固定表示、枠線なし）
 * 右の欄に 300×600（人気順）、サムネイルの下に 728×90（新着順）
 */
export const pcWidgets = {
  side: { id: '162f55b36f572321e49be0f8d5fd158a', width: 300, height: 600 },
  bottom: { id: '3fd139a9b5ae691b7660f7f4d28be4ee', width: 728, height: 90 }, // 新着順（右の人気順と内容がかぶらないよう 10/10 に変更）
} as const;

/**
 * 記事ページの本文の後に出す商品ウィジェット（DMM アフィリエイトで 2026-10-10 に作成）。
 * スマホは 300×250、PC（lg 以上）は本文の幅に合う 728×90、PC の右の余白（xl 以上）は 300×600（rail）。記事の内容に合わせてキーワードを変える。slug が表にない記事は common
 */
export const articleWidgets = {
  common: { sp: 'b9c63e5e116bb21a50c68e22935a7b4e', pc: 'a729d4aafe68b7894a406d3c02a50571', rail: '31a7970d4b7796b14683f4efa704c057', label: 'FANZA の人気作品' },               // 動画 人気順
  bigSize: { sp: '5429dbaae8c80ea02e4619e686404a51', pc: 'ecd91be83a57a36b1cfe7ddb2a8aa73a', rail: '5477478762fd9f2680c96796c10dd6ca', label: '「巨根」の人気作品' },             // 動画 キーワード: 巨根
  condom: { sp: '19349ce5071501477e9a448d5928e607', pc: 'c2cc5537668228610f8f2114442a3998', rail: '9dab3083e77d006e18eb848201919ca5', label: 'FANZA 通販のコンドーム' },         // 通販 大人のおもちゃ キーワード: コンドーム
  premature: { sp: '5a3dcd3463bbec964df6a41078520bd7', pc: '948099a615d5ed904a3fc4791b448927', rail: '4fbfd9bfd84f0b40a31bec7a20a3ede1', label: '早漏対策のグッズ' },             // 通販 大人のおもちゃ キーワード: 早漏
  shaved: { sp: '557c873f2aac26a8bfedd23d10fa2596', pc: '691dde551b8441104013b6e61dde6dde', rail: '5bc943c893c72a3dc0f6bffae3202ed2', label: '「パイパン」の人気作品' },          // 動画 キーワード: パイパン
  slut: { sp: '1b6a0574cf63a6c1997043e9e061e98a', pc: 'd2e5b70138950ab0f55946165d3baf27', rail: 'd7a9b0456e376a602592c63b8f900a5d', label: '「痴女」の人気作品' },                // 動画 キーワード: 痴女
  intimate: { sp: 'ccbc590531a9b91db619e5fae054504e', pc: '6fa0e9c4ea45be51e9854cc0df57ac79', rail: '1536d892c41a455c35a70c383d02ed26', label: '「密着セックス」の人気作品' },   // 動画 キーワード: 密着 セックス
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
