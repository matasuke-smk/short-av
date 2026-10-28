import type { Metadata } from 'next';
import Link from 'next/link';
import DMMBanner from '@/app/components/DMMBanner';
import { SALE_10YEN, isSale10yenActive } from '@/config/sale-10yen';
import { goHref } from '@/lib/go-link';
import { loadSaleWorks } from '@/lib/sale-10yen';
import SaleWorkCard from './SaleWorkCard';

// 作品の情報は DMM の商品情報 API から。1時間ごとに作り直す（セールの回が変わったら作品が入れ替わる）
export const revalidate = 3600;

const title = 'FANZA 10円セールの対象作品とサンプル動画（10/30 朝まで） | Short AV';
const description =
  'FANZA の10円セール（2026年10月23日〜30日朝9:59、3回に分けて開催）の対象作品のサンプル動画をまとめて見られるページです。日程、1回10作品の仕組み、買い方（無料のアカウント登録→ログイン→チェックして購入）も紹介します。';

// リンクカードの画像: FANZA のセールのページの第3弾の画像（p.dmm.co.jp/p/ds/lp/10yen20261023/pic_mv_03_pc.jpg、1280x420）を
// 左右のコインの飾り（x 190〜1100 の外側）を切って 1200 幅に広げ、上下を背景の色で足して 1200x630 にしたもの（ユーザーの判断で公式画像を使用）。
// 2026-10-28 に大きく写る形に替えたとき、X が古い画像を覚えているのを避けるため名前を v2 にした
const SALE_OG_IMAGE = '/og-sale-10yen-v2.jpg';

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: '/sale/10yen' },
  openGraph: { title, description, siteName: 'Short AV', locale: 'ja_JP', type: 'website', images: [{ url: SALE_OG_IMAGE, width: 1200, height: 630, alt: 'FANZA 10円セール 第3弾 10/30（金）朝9:59まで' }] },
  // X のリンクカード（layout の twitter をそのまま使うとサイト全体の題名・画像になるため、ここで上書き。2026-10-28）
  twitter: { card: 'summary_large_image', title, description, images: [SALE_OG_IMAGE] },
};

const fmt = (iso: string) => {
  const d = new Date(new Date(iso).getTime() + 9 * 3_600_000);
  const w = '日月火水木金土'[d.getUTCDay()];
  return `${d.getUTCMonth() + 1}/${d.getUTCDate()}（${w}）${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`;
};

/**
 * FANZA 10円セールの特設ページ（2026-10-27）。対象作品のサンプル動画をここでまとめて再生でき、FANZA の作品ページへ進める。
 * 対象作品は config/sale-10yen.ts（運営者が FANZA のページで確かめた作品番号）。セールが終わったら終了の表示だけにする
 */
export default async function Sale10yenPage() {
  const now = Date.now();
  const active = isSale10yenActive(now);
  const works = active ? await loadSaleWorks(now) : [];
  const current = SALE_10YEN.phases.find((p) => now >= new Date(p.from).getTime() && now <= new Date(p.to).getTime());
  const next = SALE_10YEN.phases.find((p) => new Date(p.from).getTime() > now);
  const officialHref = goHref(SALE_10YEN.officialUrl) ?? SALE_10YEN.officialUrl;

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <header className="sticky top-0 z-10 border-b border-gray-800 bg-gray-950/95 backdrop-blur-sm">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-3">
          <Link href="/" className="text-gray-400 transition-colors hover:text-white" aria-label="ホームへ">
            <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <Link href="/" className="font-extrabold tracking-wide">Short AV</Link>
          <span className="ml-auto rounded bg-yellow-400 px-1.5 py-0.5 text-[10px] font-bold text-black">PR</span>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-5">
        <h1 className="text-xl font-bold sm:text-2xl">FANZA 10円セールの対象作品とサンプル動画</h1>
        {active ? (
          <p className="mt-2 text-sm leading-relaxed text-gray-300">
            FANZA で、対象の作品が1本10円で買える「10円セール」を開催中です（{fmt(SALE_10YEN.endsAt)} まで）。
            {current ? `いまは${current.label}（${fmt(current.to)} まで）の対象作品です。` : ''}
            サンプル動画を見て、気に入った作品を FANZA で買えます。値段は FANZA の作品ページで確かめてください。
          </p>
        ) : (
          <p className="mt-3 rounded-lg border border-gray-700 bg-gray-900 px-4 py-3 text-sm text-gray-300">
            10円セールは {fmt(SALE_10YEN.endsAt)} に終了しました。ほかの作品のサンプルは、<Link href="/" className="underline">トップのスワイプ画面</Link>や
            <Link href="/long-samples" className="underline">サンプル動画が長い作品一覧</Link>から見られます。
          </p>
        )}

        {active && (
          <>
            <div className="mx-auto mt-4 w-full max-w-[600px] overflow-hidden rounded-xl">
              <DMMBanner bannerId={SALE_10YEN.bannerId} className="w-full" />
            </div>

            <section className="mt-6">
              <h2 className="text-lg font-bold">{current ? `${current.label}の対象作品` : '対象作品'}<span className="ml-2 text-sm font-normal text-gray-400">{works.length}本</span></h2>
              {works.length === 0 ? (
                <p className="mt-2 text-sm text-gray-400">
                  いまの回の対象作品を準備中です。
                  {next ? `${next.label}は ${fmt(next.from)} から始まります。` : ''}
                  対象作品は <a href={officialHref} target="_blank" rel="noopener noreferrer sponsored" className="underline">FANZA の10円セールのページ</a> で確かめられます。
                </p>
              ) : (
                <ul className="mt-3 grid gap-4 sm:grid-cols-2">
                  {works.map((w, i) => (
                    <SaleWorkCard
                      key={w.cid}
                      cid={w.cid}
                      title={w.title}
                      image={w.image}
                      href={goHref(w.url) ?? w.url}
                      price={w.price}
                      hasSample={w.hasSample}
                      actresses={w.actresses}
                      index={i}
                    />
                  ))}
                </ul>
              )}
            </section>
          </>
        )}

        <section className="mt-10 space-y-3 text-sm leading-relaxed text-gray-300">
          <h2 className="text-lg font-bold text-white">10円セールのしくみ</h2>
          <ul className="list-disc space-y-1 pl-5">
            {SALE_10YEN.phases.map((p) => (
              <li key={p.label}>
                {p.label}：{fmt(p.from)} 〜 {fmt(p.to)}
              </li>
            ))}
          </ul>
          <p>1回の対象は10作品です。FANZA のセールのページでは、後半の5作品は「おすすめ作品を押すと開放される」仕組みになっています。</p>

          <h2 className="pt-4 text-lg font-bold text-white">買い方</h2>
          <ol className="list-decimal space-y-1 pl-5">
            <li>FANZA（DMM）で無料のアカウントを作る（作ってある人はログイン）</li>
            <li>欲しい作品にチェックを入れて、カートに入れる（まとめて入れることもできる）</li>
            <li>支払い方法を選んで購入し、マイライブラリで見る</li>
          </ol>
          <p>
            くわしい手順は <Link href="/articles/dmm-guide" className="underline">FANZAで作品を買うまでの流れ</Link> にまとめています。見放題で見たい人は、
            <Link href="/articles/fanza-tv-guide" className="underline">FANZA TV（月額550円・初回14日間無料）</Link> もあります。
          </p>
          <a
            href={officialHref}
            target="_blank"
            rel="noopener noreferrer sponsored"
            className="mt-2 flex items-center justify-center rounded-xl bg-blue-600 py-3 font-bold text-white hover:bg-blue-500"
          >
            FANZA の10円セールのページを見る
          </a>
        </section>
      </main>
    </div>
  );
}
