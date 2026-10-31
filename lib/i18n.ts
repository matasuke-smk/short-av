'use client';

import { useEffect, useState } from 'react';

/**
 * スワイプ画面のボタンなどの表示言語（ブラウザの言語設定で決める。国ではない）。
 * 2026-10-12 の GA（直近7日）: 日本語 2.9万人に対し、中国語 5千・インドネシア語 2.4千・タイ語 2.4千・英語 2.1千・韓国語 550人。
 * 上の5言語＋英語（それ以外の言語）に訳す。作品名・説明文（DMM のデータ）と記事は日本語のまま。
 * サーバーでは日本語で描画し、ブラウザで言語が分かってから切り替える（描画の食い違いを避けるため）
 */
export type Lang = 'ja' | 'en' | 'zhHant' | 'zhHans' | 'id' | 'th' | 'ko';

type Entry = Record<Lang, string>;

const DICT = {
  // 「動画｜同人誌」の切り替え
  modeVideo: { ja: '動画', en: 'Videos', zhHant: '影片', zhHans: '视频', id: 'Video', th: 'วิดีโอ', ko: '동영상' },
  modeDoujin: { ja: '同人誌', en: 'Doujin', zhHant: '同人誌', zhHans: '同人志', id: 'Doujin', th: 'โดจิน', ko: '동인지' },
  modeToggle: { ja: '動画と同人誌の切り替え', en: 'Switch between videos and doujin', zhHant: '切換影片與同人誌', zhHans: '切换视频与同人志', id: 'Beralih video dan doujin', th: 'สลับวิดีโอและโดจิน', ko: '동영상/동인지 전환' },
  // 下・左のボタン
  search: { ja: '検索', en: 'Search', zhHant: '搜尋', zhHans: '搜索', id: 'Cari', th: 'ค้นหา', ko: '검색' },
  ranking: { ja: '人気', en: 'Popular', zhHant: '熱門', zhHans: '热门', id: 'Populer', th: 'ยอดนิยม', ko: '인기' },
  home: { ja: 'ホーム', en: 'Home', zhHant: '首頁', zhHans: '首页', id: 'Beranda', th: 'หน้าแรก', ko: '홈' },
  likedList: { ja: 'いいね一覧', en: 'Liked', zhHant: '收藏', zhHans: '收藏', id: 'Disukai', th: 'ที่ถูกใจ', ko: '좋아요 목록' },
  saved: { ja: '保存', en: 'Saved', zhHant: '收藏', zhHans: '收藏', id: 'Simpanan', th: 'ที่บันทึก', ko: '보관함' },
  longSample4: { ja: '4分以上', en: '4min+', zhHant: '4分鐘以上', zhHans: '4分钟以上', id: '4mnt+', th: '4 นาที+', ko: '4분 이상' },
  longSampleNow: { ja: 'サンプル4分以上の作品', en: 'Samples 4min+', zhHant: '試看4分鐘以上', zhHans: '试看4分钟以上', id: 'Sampel 4mnt+', th: 'ตัวอย่าง 4 นาที+', ko: '샘플 4분 이상' },
  worksUnit: { ja: '本', en: '', zhHant: '部', zhHans: '部', id: '', th: '', ko: '편' },
  backToAll: { ja: 'すべての作品に戻る', en: 'Back to all', zhHant: '返回全部', zhHans: '返回全部', id: 'Kembali', th: 'กลับ', ko: '전체로' },
  likedShort: { ja: 'いいね', en: 'Liked', zhHant: '收藏', zhHans: '收藏', id: 'Disukai', th: 'ที่ถูกใจ', ko: '좋아요' },
  history: { ja: '履歴', en: 'History', zhHant: '紀錄', zhHans: '记录', id: 'Riwayat', th: 'ประวัติ', ko: '기록' },
  articles: { ja: '記事', en: 'Articles', zhHant: '文章', zhHans: '文章', id: 'Artikel', th: 'บทความ', ko: '기사' },
  articlesAria: { ja: '記事を読む', en: 'Read articles', zhHant: '閱讀文章', zhHans: '阅读文章', id: 'Baca artikel', th: 'อ่านบทความ', ko: '기사 읽기' },
  like: { ja: 'いいね', en: 'Like', zhHant: '讚', zhHans: '赞', id: 'Suka', th: 'ถูกใจ', ko: '좋아요' },
  liked: { ja: 'いいね済み', en: 'Liked', zhHant: '已讚', zhHans: '已赞', id: 'Disukai', th: 'ถูกใจแล้ว', ko: '좋아요 함' },
  actressOfWork: { ja: 'この作品の女優', en: 'Actress', zhHant: '本作女優', zhHans: '本作女优', id: 'Aktris', th: 'นักแสดง', ko: '출연 배우' },
  actress: { ja: '女優', en: 'Actress', zhHant: '女優', zhHans: '女优', id: 'Aktris', th: 'นักแสดง', ko: '배우' },
  details: { ja: '詳細はこちら', en: 'Details', zhHant: '查看詳情', zhHans: '查看详情', id: 'Detail', th: 'ดูรายละเอียด', ko: '자세히 보기' },
  // 作品の操作の行・作品詳細・メニュー（2026-10-31）
  workDetails: { ja: '作品詳細', en: 'Details', zhHant: '作品詳情', zhHans: '作品详情', id: 'Detail', th: 'รายละเอียด', ko: '작품 정보' },
  noActressInfo: { ja: '女優情報なし', en: 'No cast info', zhHant: '無女優資訊', zhHans: '无女优信息', id: 'Tanpa info', th: 'ไม่มีข้อมูล', ko: '배우 정보 없음' },
  andOthers: { ja: 'ほか', en: '+', zhHant: '等', zhHans: '等', id: 'dkk', th: 'และอื่นๆ', ko: '외' },
  menu: { ja: 'メニュー', en: 'Menu', zhHant: '選單', zhHans: '菜单', id: 'Menu', th: 'เมนู', ko: '메뉴' },
  maker: { ja: 'メーカー', en: 'Studio', zhHant: '片商', zhHans: '片商', id: 'Studio', th: 'ค่าย', ko: '제작사' },
  label: { ja: 'レーベル', en: 'Label', zhHant: '廠牌', zhHans: '厂牌', id: 'Label', th: 'ค่ายย่อย', ko: '레이블' },
  series: { ja: 'シリーズ', en: 'Series', zhHant: '系列', zhHans: '系列', id: 'Seri', th: 'ซีรีส์', ko: '시리즈' },
  releaseDate: { ja: '発売日', en: 'Released', zhHant: '發售日', zhHans: '发售日', id: 'Rilis', th: 'วันวางจำหน่าย', ko: '발매일' },
  sampleLength: { ja: 'サンプル', en: 'Sample', zhHant: '試看', zhHans: '试看', id: 'Sampel', th: 'ตัวอย่าง', ko: '샘플' },
  cast: { ja: '出演', en: 'Cast', zhHant: '演出', zhHans: '演出', id: 'Pemeran', th: 'นักแสดง', ko: '출연' },
  genres: { ja: 'ジャンル', en: 'Genres', zhHant: '類型', zhHans: '类型', id: 'Genre', th: 'ประเภท', ko: '장르' },
  moreWorks: { ja: 'ほかの作品', en: 'More works', zhHant: '其他作品', zhHans: '其他作品', id: 'Karya lain', th: 'ผลงานอื่น', ko: '다른 작품' },
  seeWorks: { ja: '出演作を見る', en: 'See works', zhHant: '查看作品', zhHans: '查看作品', id: 'Lihat karya', th: 'ดูผลงาน', ko: '작품 보기' },
  viewOnFanza: { ja: 'FANZA で見る', en: 'View on FANZA', zhHant: '在 FANZA 觀看', zhHans: '在 FANZA 观看', id: 'Lihat di FANZA', th: 'ดูที่ FANZA', ko: 'FANZA에서 보기' },
  reviewsUnit: { ja: '件', en: '', zhHant: '則', zhHans: '条', id: '', th: '', ko: '건' },
  privacy: { ja: 'プライバシーポリシー', en: 'Privacy policy', zhHant: '隱私權政策', zhHans: '隐私政策', id: 'Kebijakan privasi', th: 'นโยบายความเป็นส่วนตัว', ko: '개인정보 처리방침' },
  terms: { ja: '利用規約', en: 'Terms', zhHant: '使用條款', zhHans: '使用条款', id: 'Ketentuan', th: 'ข้อกำหนด', ko: '이용약관' },
  contact: { ja: 'お問い合わせ', en: 'Contact', zhHant: '聯絡我們', zhHans: '联系我们', id: 'Kontak', th: 'ติดต่อ', ko: '문의' },
  dlsiteSearch: { ja: 'DLsite で探す', en: 'Find on DLsite', zhHant: '在 DLsite 搜尋', zhHans: '在 DLsite 搜索', id: 'Cari di DLsite', th: 'ค้นหาใน DLsite', ko: 'DLsite에서 찾기' },
  // 操作の案内
  swipeNextVideo: { ja: '上にスワイプで次の動画', en: 'Swipe up for the next video', zhHant: '上滑看下一部', zhHans: '上滑看下一部', id: 'Geser ke atas untuk video berikutnya', th: 'ปัดขึ้นเพื่อดูวิดีโอถัดไป', ko: '위로 스와이프하면 다음 동영상' },
  wheelNextVideo: { ja: 'ホイール・↓キーで次の動画', en: 'Scroll or press ↓ for the next video', zhHant: '滾輪或 ↓ 鍵看下一部', zhHans: '滚轮或 ↓ 键看下一部', id: 'Scroll atau tekan ↓ untuk video berikutnya', th: 'เลื่อนเมาส์หรือกด ↓ เพื่อดูวิดีโอถัดไป', ko: '휠 또는 ↓ 키로 다음 동영상' },
  sampleEnd: { ja: 'サンプルはここまで', en: 'End of sample', zhHant: '試看到此結束', zhHans: '试看到此结束', id: 'Sampel selesai', th: 'ตัวอย่างจบแล้ว', ko: '샘플 끝' },
  close: { ja: '閉じる', en: 'Close', zhHant: '關閉', zhHans: '关闭', id: 'Tutup', th: 'ปิด', ko: '닫기' },
  swipeNextWork: { ja: '↑ 上にスワイプで次の作品', en: '↑ Swipe up for the next title', zhHant: '↑ 上滑看下一部作品', zhHans: '↑ 上滑看下一部作品', id: '↑ Geser ke atas untuk judul berikutnya', th: '↑ ปัดขึ้นเพื่อดูเรื่องถัดไป', ko: '↑ 위로 스와이프하면 다음 작품' },
  keyNextWork: { ja: '↓ キーかホイールで次の作品', en: '↓ key or scroll for the next title', zhHant: '↓ 鍵或滾輪看下一部作品', zhHans: '↓ 键或滚轮看下一部作品', id: 'Tekan ↓ atau scroll untuk judul berikutnya', th: 'กด ↓ หรือเลื่อนเมาส์เพื่อดูเรื่องถัดไป', ko: '↓ 키 또는 휠로 다음 작품' },
  prevWork: { ja: '前の作品', en: 'Previous', zhHant: '上一部', zhHans: '上一部', id: 'Sebelumnya', th: 'ก่อนหน้า', ko: '이전' },
  nextWork: { ja: '次の作品', en: 'Next', zhHant: '下一部', zhHans: '下一部', id: 'Berikutnya', th: 'ถัดไป', ko: '다음' },
  navKeyHint: { ja: 'マウスのホイールや\n↑↓ キーでも送れます', en: 'You can also scroll or use the ↑↓ keys', zhHant: '也可用滑鼠滾輪或 ↑↓ 鍵切換', zhHans: '也可用鼠标滚轮或 ↑↓ 键切换', id: 'Bisa juga scroll atau tombol ↑↓', th: 'เลื่อนเมาส์หรือกดปุ่ม ↑↓ ก็ได้', ko: '마우스 휠이나 ↑↓ 키로도 넘길 수 있어요' },
  loading: { ja: '読み込み中...', en: 'Loading...', zhHant: '載入中...', zhHans: '加载中...', id: 'Memuat...', th: 'กำลังโหลด...', ko: '불러오는 중...' },
  endTitle: { ja: 'これで最後です', en: "That's all", zhHant: '已經是最後了', zhHans: '已经是最后了', id: 'Itu saja', th: 'หมดแล้ว', ko: '마지막입니다' },
  endBody: { ja: 'このリストの動画はすべて表示しました', en: "You've seen every video in this list", zhHant: '這個列表的影片已全部顯示', zhHans: '这个列表的视频已全部显示', id: 'Semua video di daftar ini sudah ditampilkan', th: 'แสดงวิดีโอในรายการนี้ครบแล้ว', ko: '이 목록의 동영상을 모두 봤습니다' },
  noVideos: { ja: '動画がありません', en: 'No videos', zhHant: '沒有影片', zhHans: '没有视频', id: 'Tidak ada video', th: 'ไม่มีวิดีโอ', ko: '동영상이 없습니다' },
  fullVideo: { ja: 'フル動画はこちら', en: 'Watch the full video', zhHant: '觀看完整影片', zhHans: '观看完整视频', id: 'Tonton video lengkap', th: 'ดูวิดีโอเต็ม', ko: '전체 동영상 보기' },
  tapToClose: { ja: '画面をタップで閉じる', en: 'Tap the screen to close', zhHant: '點一下畫面關閉', zhHans: '点一下画面关闭', id: 'Ketuk layar untuk menutup', th: 'แตะหน้าจอเพื่อปิด', ko: '화면을 탭하면 닫힙니다' },
  // 年齢確認
  ageDesc1: { ja: 'FANZA の人気作のサンプル動画を', en: 'Free sample videos of popular FANZA titles —', zhHant: 'FANZA 熱門作品的試看影片', zhHans: 'FANZA 热门作品的试看视频', id: 'Video sampel judul populer FANZA', th: 'วิดีโอตัวอย่างเรื่องดังจาก FANZA', ko: 'FANZA 인기작 샘플 동영상을' },
  ageDesc2: { ja: '縦スワイプで次々と（無料・登録不要）', en: 'just swipe up (free, no sign-up)', zhHant: '上下滑動連續觀看（免費・免註冊）', zhHans: '上下滑动连续观看（免费・免注册）', id: 'tinggal geser ke atas (gratis, tanpa daftar)', th: 'ปัดขึ้นดูต่อได้เลย (ฟรี ไม่ต้องสมัคร)', ko: '세로 스와이프로 계속 (무료・가입 불필요)' },
  ageQuestion: { ja: '18歳以上ですか？', en: 'Are you 18 or older?', zhHant: '您已滿 18 歲嗎？', zhHans: '您已满 18 岁吗？', id: 'Apakah Anda berusia 18 tahun ke atas?', th: 'คุณอายุ 18 ปีขึ้นไปหรือไม่?', ko: '18세 이상입니까?' },
  ageYes: { ja: 'はい、18歳以上です', en: "Yes, I'm 18 or older", zhHant: '是，我已滿 18 歲', zhHans: '是，我已满 18 岁', id: 'Ya, saya 18 tahun ke atas', th: 'ใช่ ฉันอายุ 18 ปีขึ้นไป', ko: '네, 18세 이상입니다' },
  ageNo: { ja: 'いいえ', en: 'No', zhHant: '否', zhHans: '否', id: 'Tidak', th: 'ไม่ใช่', ko: '아니요' },
  ageFirstFanza: { ja: 'FANZA が初めてなら', en: 'New to FANZA?', zhHant: '第一次使用 FANZA？', zhHans: '第一次使用 FANZA？', id: 'Baru di FANZA?', th: 'ใช้ FANZA ครั้งแรก?', ko: 'FANZA가 처음이라면' },
  ageAdNote: { ja: '※ アフィリエイト広告を掲載しています', en: '* This site contains affiliate ads', zhHant: '※ 本站含有聯盟廣告', zhHans: '※ 本站含有联盟广告', id: '* Situs ini memuat iklan afiliasi', th: '* เว็บไซต์นี้มีโฆษณาแบบพันธมิตร', ko: '※ 제휴 광고가 포함되어 있습니다' },
  // FANZA の「初めての人」向けリンク（日本の訪問者だけに出す）
  ftCoupon: { ja: 'FANZA が初めてなら 500円OFF', en: '¥500 off your first FANZA purchase', zhHant: '首次使用 FANZA 折抵 500 日圓', zhHans: '首次使用 FANZA 立减 500 日元', id: 'Diskon ¥500 untuk pembelian pertama di FANZA', th: 'ลด 500 เยนสำหรับการซื้อครั้งแรกบน FANZA', ko: 'FANZA 첫 구매 500엔 할인' },
  ftTv: { ja: '見放題で見るなら FANZA TV（14日間無料）', en: 'Unlimited viewing with FANZA TV (14-day free trial)', zhHant: 'FANZA TV 無限暢看（14 天免費）', zhHans: 'FANZA TV 无限畅看（14 天免费）', id: 'Nonton sepuasnya di FANZA TV (gratis 14 hari)', th: 'ดูไม่จำกัดกับ FANZA TV (ฟรี 14 วัน)', ko: 'FANZA TV 무제한 시청 (14일 무료)' },
  // 再生
  continueFull: { ja: '続きを本編で見る', en: 'Watch the full video', zhHant: '觀看完整影片', zhHans: '观看完整视频', id: 'Tonton video lengkap', th: 'ดูวิดีโอฉบับเต็ม', ko: '본편 보기' },
  sampleBadge: { ja: 'サンプル', en: 'Sample', zhHant: '試看', zhHans: '试看', id: 'Sampel', th: 'ตัวอย่าง', ko: '샘플' },
  playerLoading: { ja: '読み込み中…', en: 'Loading…', zhHant: '載入中…', zhHans: '加载中…', id: 'Memuat…', th: 'กำลังโหลด…', ko: '불러오는 중…' },
  tapToPlay: { ja: 'タップでサンプル再生', en: 'Tap to play sample', zhHant: '點擊播放試看', zhHans: '点击播放试看', id: 'Ketuk untuk putar sampel', th: 'แตะเพื่อเล่นตัวอย่าง', ko: '탭하여 샘플 재생' },
  // 最初の案内
  tutSwipe1: { ja: '上にスワイプで', en: 'Swipe up for', zhHant: '向上滑動', zhHans: '向上滑动', id: 'Geser ke atas untuk', th: 'ปัดขึ้นเพื่อดู', ko: '위로 스와이프하면' },
  tutSwipe2: { ja: '次の動画へ', en: 'the next video', zhHant: '看下一部', zhHans: '看下一部', id: 'video berikutnya', th: 'วิดีโอถัดไป', ko: '다음 동영상' },
  tutWheel1: { ja: 'ホイール・↓キーで', en: 'Scroll or press ↓ for', zhHant: '滾輪或 ↓ 鍵', zhHans: '滚轮或 ↓ 键', id: 'Scroll atau tekan ↓ untuk', th: 'เลื่อนเมาส์หรือกด ↓ เพื่อดู', ko: '휠 또는 ↓ 키로' },
  tutTapPlay: { ja: '中央の▶をタップで再生', en: 'Tap ▶ in the center to play', zhHant: '點擊中央的 ▶ 播放', zhHans: '点击中央的 ▶ 播放', id: 'Ketuk ▶ di tengah untuk memutar', th: 'แตะ ▶ ตรงกลางเพื่อเล่น', ko: '가운데 ▶를 탭하면 재생' },
  tutClickPlay: { ja: '中央の▶をクリックで再生', en: 'Click ▶ in the center to play', zhHant: '點擊中央的 ▶ 播放', zhHans: '点击中央的 ▶ 播放', id: 'Klik ▶ di tengah untuk memutar', th: 'คลิก ▶ ตรงกลางเพื่อเล่น', ko: '가운데 ▶를 클릭하면 재생' },
  tutTapStart: { ja: 'タップしてはじめる', en: 'Tap to start', zhHant: '點一下開始', zhHans: '点一下开始', id: 'Ketuk untuk mulai', th: 'แตะเพื่อเริ่ม', ko: '탭하여 시작' },
  tutClickStart: { ja: 'クリックしてはじめる', en: 'Click to start', zhHant: '點擊開始', zhHans: '点击开始', id: 'Klik untuk mulai', th: 'คลิกเพื่อเริ่ม', ko: '클릭하여 시작' },
  // 同人誌
  djPurchasePage: { ja: '購入ページ', en: 'Buy', zhHant: '購買頁', zhHans: '购买页', id: 'Beli', th: 'หน้าซื้อ', ko: '구매' },
  djPrevPage: { ja: '前のページ', en: 'Previous page', zhHant: '上一頁', zhHans: '上一页', id: 'Halaman sebelumnya', th: 'หน้าก่อนหน้า', ko: '이전 페이지' },
  djNextPage: { ja: '次のページ', en: 'Next page', zhHant: '下一頁', zhHans: '下一页', id: 'Halaman berikutnya', th: 'หน้าถัดไป', ko: '다음 페이지' },
  djIntro: { ja: '📖 同人誌のサンプルが読めます', en: '📖 Read a free doujin sample', zhHant: '📖 可以試閱同人誌', zhHans: '📖 可以试读同人志', id: '📖 Baca sampel doujin gratis', th: '📖 อ่านตัวอย่างโดจินได้ฟรี', ko: '📖 동인지 샘플을 읽을 수 있습니다' },
  djSwipeLeft: { ja: '← 左にスワイプ', en: '← Swipe left', zhHant: '← 向左滑', zhHans: '← 向左滑', id: '← Geser ke kiri', th: '← ปัดซ้าย', ko: '← 왼쪽으로 스와이프' },
  djFlip: { ja: 'でページをめくる（全{n}ページ）', en: 'to turn pages ({n} pages)', zhHant: '翻頁（共 {n} 頁）', zhHans: '翻页（共 {n} 页）', id: 'untuk membalik halaman ({n} halaman)', th: 'เพื่อพลิกหน้า (ทั้งหมด {n} หน้า)', ko: '하여 페이지 넘기기 (전 {n}페이지)' },
  djIntroSub: { ja: '最後まで読むと価格と購入ボタン。読まずに次へは上にスワイプ', en: 'Read to the end for the buy button. Swipe up to skip', zhHant: '讀到最後會出現購買按鈕。上滑可跳過', zhHans: '读到最后会出现购买按钮。上滑可跳过', id: 'Baca sampai akhir untuk tombol beli. Geser ke atas untuk lewati', th: 'อ่านจนจบเพื่อดูปุ่มซื้อ ปัดขึ้นเพื่อข้าม', ko: '끝까지 읽으면 구매 버튼. 건너뛰려면 위로 스와이프' },
  djCheckPrice: { ja: '次のページで価格をチェック →', en: 'Buy button on the next page →', zhHant: '下一頁有購買按鈕 →', zhHans: '下一页有购买按钮 →', id: 'Tombol beli di halaman berikutnya →', th: 'ปุ่มซื้ออยู่หน้าถัดไป →', ko: '다음 페이지에 구매 버튼 →' },
  djSampleEnd: { ja: 'サンプルはここまで（全{n}ページ）', en: 'End of sample ({n} pages)', zhHant: '試閱到此結束（共 {n} 頁）', zhHans: '试读到此结束（共 {n} 页）', id: 'Sampel selesai ({n} halaman)', th: 'ตัวอย่างจบแล้ว (ทั้งหมด {n} หน้า)', ko: '샘플 끝 (전 {n}페이지)' },
  djFanza: { ja: 'FANZA で続きを読む', en: 'Continue reading on FANZA', zhHant: '在 FANZA 繼續閱讀', zhHans: '在 FANZA 继续阅读', id: 'Lanjut baca di FANZA', th: 'อ่านต่อที่ FANZA', ko: 'FANZA에서 계속 읽기' },
  djNextVideo: { ja: '↑ 上にスワイプで次の動画へ', en: '↑ Swipe up for the next video', zhHant: '↑ 上滑看下一部', zhHans: '↑ 上滑看下一部', id: '↑ Geser ke atas untuk video berikutnya', th: '↑ ปัดขึ้นเพื่อดูวิดีโอถัดไป', ko: '↑ 위로 스와이프하면 다음 동영상' },
} satisfies Record<string, Entry>;

export type TextKey = keyof typeof DICT;

function detect(): Lang {
  // 開発中の確認用: ?lang=en のように言語を指定できる（本番では無効）
  if (process.env.NODE_ENV !== 'production') {
    // スワイプ画面はすぐアドレスを書き換えるので、iframe の name（例: name="lang=th"）でも指定できる
    const forced = (new URLSearchParams(window.location.search).get('lang') ?? window.name.match(/lang=(\w+)/)?.[1] ?? null) as Lang | null;
    if (forced && forced in DICT.home) return forced;
  }
  const langs = navigator.languages?.length ? navigator.languages : [navigator.language];
  for (const raw of langs) {
    const tag = (raw || '').toLowerCase();
    if (tag.startsWith('ja')) return 'ja';
    if (tag.startsWith('zh')) return /hant|tw|hk|mo/.test(tag) ? 'zhHant' : 'zhHans';
    if (tag.startsWith('id') || tag.startsWith('in')) return 'id';
    if (tag.startsWith('th')) return 'th';
    if (tag.startsWith('ko')) return 'ko';
    if (tag.startsWith('en')) return 'en';
  }
  return 'en';
}

let cached: Lang | null = null;

/**
 * 表示言語の文言を返す関数。最初の描画はいつも日本語（サーバーと同じ）で、表示のあとにブラウザの言語へ切り替わる。
 * 初期値に言語を入れると、後から描画される部分（Suspense の中）で最初から外国語になり、サーバーの日本語と食い違っていた。
 * useSyncExternalStore（サーバー用の値を日本語にする形）は、表示のあとに切り替わらなかった（2026-10-12 に確認）
 */
export function useT() {
  const [lang, setLang] = useState<Lang>('ja');
  useEffect(() => {
    cached ??= detect();
    setLang(cached);
  }, []);
  const t = (key: TextKey, vars?: Record<string, string | number>) => {
    let s: string = DICT[key][lang] ?? DICT[key].ja;
    if (vars) for (const [k, v] of Object.entries(vars)) s = s.replace(`{${k}}`, String(v));
    return s;
  };
  return { t, lang };
}
