import Link from 'next/link';
import BrowseLinks from './BrowseLinks';
import type { ReactNode } from 'react';
import { CONTACT_FORM_URL } from '@/config/site';
import type { DoujinDetail } from '@/lib/doujin-pages';
import DoujinBuyLink from './DoujinBuyLink';
import { goHref } from '@/lib/go-link';

/**
 * 同人誌の作品ごと・サークルごとのページ（サーバーで描画。検索エンジンが中身を読めるように）。
 * 作品ページはサンプル画像を縦に並べ、最後に購入のリンク（DoujinBuyLink）。サークルのページからはスワイプ画面でまとめて読める
 */
const yen = (n: number | null) => (n ? `${n.toLocaleString('ja-JP')}円` : null);
const ymd = (s: string | null) => (s ? s.replace(/-/g, '/') : null);

export function Shell({ children, back = { href: '/?mode=doujin', label: '同人誌のスワイプ画面へ' } }: { children: ReactNode; back?: { href: string; label: string } }) {
  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <header className="sticky top-0 z-10 bg-gray-950/95 backdrop-blur-sm border-b border-gray-800">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center gap-3">
          <Link href={back.href} prefetch={false} className="text-gray-400 hover:text-white transition-colors" aria-label={back.label}>
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <Link href="/" prefetch={false} className="font-extrabold tracking-wide">Short AV</Link>
          <span className="ml-auto bg-yellow-400 text-black px-1.5 py-0.5 rounded text-[10px] font-bold">PR</span>
        </div>
      </header>
      <main className="max-w-5xl mx-auto px-4 py-5">{children}</main>
      <footer className="border-t border-gray-800 mt-10">
        <div className="max-w-5xl mx-auto px-4 py-6">
          <BrowseLinks className="mb-4" />
          <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs text-gray-500 whitespace-nowrap">
            <Link href="/articles" prefetch={false} className="hover:text-gray-400 underline">記事一覧</Link>
            <Link href="/privacy" prefetch={false} className="hover:text-gray-400 underline">プライバシーポリシー</Link>
            <Link href="/terms" prefetch={false} className="hover:text-gray-400 underline">利用規約</Link>
            <a href={CONTACT_FORM_URL} target="_blank" rel="noopener noreferrer" className="hover:text-gray-400 underline">お問い合わせ</a>
          </div>
          <p className="text-center text-xs text-gray-600 mt-4">
            Powered by <a href="https://affiliate.dmm.com/api/" target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:text-blue-400">FANZA Webサービス</a>
          </p>
        </div>
      </footer>
    </div>
  );
}

function ReadButton({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      prefetch={false}
      className="mt-4 flex items-center justify-center gap-2 w-full sm:w-auto sm:inline-flex rounded-xl bg-pink-600 hover:bg-pink-500 px-6 py-3 font-bold transition-colors"
    >
      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24" aria-hidden><path d="M8 5v14l11-7z" /></svg>
      {label}
    </Link>
  );
}

export function WorkGrid({ works }: { works: DoujinDetail[] }) {
  return (
    <ul className="mt-3 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
      {works.map((w) => (
        <li key={w.contentId}>
          <Link href={`/doujin/${encodeURIComponent(w.contentId)}`} prefetch={false} className="group block">
            <div className="aspect-[3/4] overflow-hidden rounded-lg bg-gray-800">
              {/* eslint-disable-next-line @next/next/no-img-element -- FANZA の表紙をそのまま表示する */}
              <img src={w.cover} alt={w.title} loading="lazy" className="w-full h-full object-cover transition-transform duration-200 group-hover:scale-105" />
            </div>
            <p className="mt-1.5 text-xs leading-snug line-clamp-2 text-gray-200 group-hover:text-white">{w.title}</p>
            {w.price && <p className="mt-0.5 text-[11px] text-gray-500">{yen(w.price)}</p>}
          </Link>
        </li>
      ))}
    </ul>
  );
}

/** 作品ごとのページ */
export function DoujinWorkPage({ work, related }: { work: DoujinDetail; related: DoujinDetail[] }) {
  const facts = [
    work.pages ? `${work.pages}ページ` : null,
    work.date ? `発売日 ${ymd(work.date)}` : null,
    work.price ? (work.listPrice && work.listPrice > work.price ? `${yen(work.price)}（セール中・通常 ${yen(work.listPrice)}）` : yen(work.price)) : null,
    work.reviewAverage && work.reviewCount > 0 ? `評価 ★${work.reviewAverage.toFixed(1)}（${work.reviewCount}件）` : null,
  ].filter(Boolean);
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'Book',
    name: work.title,
    image: work.cover,
    ...(work.circle ? { author: { '@type': 'Organization', name: work.circle } } : {}),
    ...(work.pages ? { numberOfPages: work.pages } : {}),
    ...(work.date ? { datePublished: work.date } : {}),
    ...(work.genres.length ? { genre: work.genres } : {}),
  };

  return (
    <Shell>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }} />
      <p className="text-xs text-pink-300 font-bold">無料サンプル・試し読み</p>
      <h1 className="mt-1 text-xl sm:text-2xl font-bold leading-snug">{work.title}</h1>
      {work.circle && (
        <p className="mt-2 text-sm text-gray-300">
          サークル:{' '}
          {work.circleId ? (
            <Link href={`/circle/${work.circleId}`} prefetch={false} className="text-blue-400 hover:text-blue-300 underline">{work.circle}</Link>
          ) : (
            work.circle
          )}
        </p>
      )}
      {facts.length > 0 && <p className="mt-1 text-xs text-gray-400">{facts.join('・')}</p>}
      <p className="mt-3 text-sm text-gray-300 leading-relaxed">
        「{work.title}」のサンプル画像{work.samples.length}枚を、会員登録なしで無料で試し読みできます。下にそのまま並べています。
      </p>
      {/* 表紙とサンプル画像を縦に並べ、そのまま下へ読み進められるようにする。最後に購入のリンク */}
      <div className="mt-5 mx-auto max-w-2xl space-y-3">
        {[work.cover, ...work.samples.filter((s) => s !== work.cover)].map((src, i) => (
          // eslint-disable-next-line @next/next/no-img-element -- FANZA のサンプル画像をそのまま表示する
          <img key={src} src={src} alt={i === 0 ? `${work.title} 表紙` : `${work.title} サンプル${i}`} loading={i < 2 ? 'eager' : 'lazy'} className="block w-full h-auto rounded-lg bg-gray-800" />
        ))}
        <div className="rounded-xl bg-gray-900 p-4 text-center">
          <p className="font-bold">サンプルはここまでです</p>
          <p className="mt-1 text-sm text-gray-300">
            全部読むには購入が必要です
            {(work.pages || work.price) && (
              <span className="whitespace-nowrap">（{[work.pages ? `全${work.pages}ページ` : null, yen(work.price)].filter(Boolean).join('・')}）</span>
            )}
          </p>
          <DoujinBuyLink contentId={work.contentId} url={goHref(work.url) ?? work.url} title={work.title} circle={work.circle} label="FANZA で続きを読む" />
        </div>
      </div>

      {work.genres.length > 0 && (
        <section className="mt-8">
          <h2 className="text-base font-bold">ジャンル</h2>
          <ul className="mt-2 flex flex-wrap gap-2">
            {work.genres.map((g) => (
              <li key={g} className="rounded-full bg-gray-800 px-3 py-1.5 text-sm">{g}</li>
            ))}
          </ul>
        </section>
      )}

      {related.length > 0 && (
        <section className="mt-8">
          <h2 className="text-base font-bold">{work.circle ? `${work.circle}のほかの作品` : 'ほかの作品'}</h2>
          <WorkGrid works={related} />
        </section>
      )}

      {/* ページのいちばん下: 無断公開サイトについて */}
      <section className="mt-10 rounded-xl bg-gray-900 p-4 text-sm text-gray-300 leading-relaxed">
        <h2 className="text-base font-bold text-white">無断で公開しているサイトについて</h2>
        <p className="mt-2">
          作品を無断でアップロードしているサイトは著作権の侵害で、ダウンロードすると違法になる場合があります。ウイルスや詐欺広告の被害も多く報告されています。作者を応援するためにも、正規の販売サイトで読むのがおすすめです。
        </p>
      </section>
    </Shell>
  );
}

/** サークルごとのページ */
export function CirclePage({ name, total, works }: { name: string; total: number; works: DoujinDetail[] }) {
  const ids = works.slice(0, 30).map((w) => w.contentId);
  return (
    <Shell>
      <h1 className="text-xl sm:text-2xl font-bold">
        {name}の同人誌
        <span className="ml-2 text-base font-normal text-gray-400">（{total}作品）</span>
      </h1>
      <p className="mt-2 text-sm text-gray-300 leading-relaxed">
        サークル「{name}」の作品の無料サンプルを、会員登録なしで試し読みできます。人気の順に並べています。
      </p>
      {ids.length > 0 && <ReadButton href={`/?mode=doujin&d=${encodeURIComponent(ids[0])}&list=${ids.map(encodeURIComponent).join(',')}`} label="スワイプで全部試し読み" />}
      <WorkGrid works={works} />
      {total > works.length && <p className="mt-3 text-xs text-gray-500">人気の上位{works.length}作品を表示しています。</p>}
    </Shell>
  );
}

/** 同人誌の一覧ページ（/doujin）: 人気の作品と、人気のサークル */
export function DoujinIndexPage({ works }: { works: DoujinDetail[] }) {
  const circles = [...new Map(works.filter((w) => w.circle && w.circleId).map((w) => [w.circleId, w.circle as string])).entries()];
  return (
    <Shell>
      <h1 className="text-xl sm:text-2xl font-bold">人気の同人誌 無料サンプル・試し読み</h1>
      <p className="mt-2 text-sm text-gray-300 leading-relaxed">
        FANZA 同人で人気の同人誌{works.length}作品のサンプルを、会員登録なしで無料で試し読みできます。人気の順に並べています。
      </p>
      <ReadButton href="/?mode=doujin" label="スワイプで次々と試し読み" />
      <WorkGrid works={works} />
      {circles.length > 0 && (
        <section className="mt-8">
          <h2 className="text-base font-bold">人気のサークル</h2>
          <ul className="mt-3 flex flex-wrap gap-2">
            {circles.map(([id, name]) => (
              <li key={id}>
                <Link href={`/circle/${id}`} prefetch={false} className="inline-block rounded-full bg-gray-800 hover:bg-gray-700 px-3 py-1.5 text-sm transition-colors">{name}</Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </Shell>
  );
}
