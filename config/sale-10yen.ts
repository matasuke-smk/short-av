/**
 * FANZA 10円セール（2026-10-23〜10-30）の特設ページ（app/sale/10yen）の設定（2026-10-27）。
 * 10円の対象作品は回ごとに10本で、FANZA のページでは開いたあとに読み込まれるため自動では拾えない。
 * 運営者が FANZA のページで確かめた作品番号をここに書く（第3弾は 10/28 朝10時から。分かったら items に足す）。
 * 作品ごとのセールの期間・値段は DMM の商品情報 API の campaign・prices で確かめ、期間が終わった作品は自動で出さない
 */
export const SALE_10YEN = {
  name: '10円セール',
  // FANZA のセールのページ（紹介用のリンク。/go を通して開く）
  officialUrl:
    'https://al.fanza.co.jp/?lurl=https%3A%2F%2Fvideo.dmm.co.jp%2Ffeature%2F10yen%2F&af_id=matasuke-005&ch=link_tool&ch_id=link',
  bannerId: '2152_600_500',
  endsAt: '2026-10-30T09:59:59+09:00',
  phases: [
    { label: '第1弾', from: '2026-10-23T10:00:00+09:00', to: '2026-10-26T09:59:59+09:00' },
    { label: '第2弾', from: '2026-10-26T10:00:00+09:00', to: '2026-10-28T09:59:59+09:00' },
    { label: '第3弾', from: '2026-10-28T10:00:00+09:00', to: '2026-10-30T09:59:59+09:00' },
  ],
  // floor: videoa（ビデオ）・videoc（素人）。2026-10-27 第2弾の10本（ユーザーが FANZA のページで確認）
  items: [
    { cid: 'rki00698', floor: 'videoa' },
    { cid: 'sone00229', floor: 'videoa' },
    { cid: 'peep048', floor: 'videoc' },
    { cid: 'smjx016', floor: 'videoc' },
    { cid: 'sivr00389', floor: 'videoa' },
    { cid: 'jur00258', floor: 'videoa' },
    { cid: 'smjs102', floor: 'videoc' },
    { cid: 'smjs169', floor: 'videoc' },
    { cid: 'kavr00380', floor: 'videoa' },
    { cid: 'ebwh00081', floor: 'videoa' },
  ],
} as const;

export const isSale10yenActive = (now = Date.now()) => now < new Date(SALE_10YEN.endsAt).getTime();
