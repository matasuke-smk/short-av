import Link from 'next/link';
import BrowseLinks from './BrowseLinks';
import { CONTACT_FORM_URL } from '@/config/site';
import { generateVideoListSchema } from '@/lib/video-schema';
import type { CatalogEntry, CatalogKind, CatalogVideo } from '@/lib/catalog';
import type { Database } from '@/lib/supabase';

type Video = Database['public']['Tables']['videos']['Row'];

const sampleLength = (s: number | null) => (s && s > 0 ? `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}` : null);

/**
 * 女優ごと・ジャンルごとのページ（サーバーで描画。検索エンジンが中身を読めるように）。
 * 作品の表紙を並べ、押すとその作品からいつものスワイプ画面で再生する（&actress= / &genre= でその作品だけを並べる）
 */
export default function CatalogPage({
  kind,
  name,
  slug,
  total,
  videos,
  related,
  aiIntro = null,
}: {
  kind: CatalogKind;
  name: string;
  slug: string;
  total: number;
  videos: CatalogVideo[];
  related: CatalogEntry[];
  /** Claude が書いた紹介文（女優のみ。sql/019）。あれば定型の説明の前に出す */
  aiIntro?: string | null;
}) {
  const param = kind === 'actress' ? 'actress' : 'genre';
  const swipeHref = (cid: string) => `/?v=${encodeURIComponent(cid)}&${param}=${encodeURIComponent(slug)}`;
  const heading = kind === 'actress' ? `${name}のサンプル動画` : `${name}のサンプル動画`;
  const intro =
    kind === 'actress'
      ? `${name}の出演作${total}本のサンプル動画を、縦スワイプで次々と無料で見られます（会員登録不要）。新しい順に並べています。`
      : `「${name}」の人気作${total}本のサンプル動画を、縦スワイプで次々と無料で見られます（会員登録不要）。人気の順に並べています。`;
  const relatedTitle = kind === 'actress' ? 'よく出ているジャンル' : 'このジャンルによく出ている女優';
  const relatedBase = kind === 'actress' ? '/genre/' : '/actress/';

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(generateVideoListSchema(videos.slice(0, 20) as unknown as Video[])) }} />
      <header className="sticky top-0 z-10 bg-gray-950/95 backdrop-blur-sm border-b border-gray-800">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center gap-3">
          <Link href="/" className="text-gray-400 hover:text-white transition-colors" aria-label="ホームへ">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <Link href="/" className="font-extrabold tracking-wide">Short AV</Link>
          <span className="ml-auto bg-yellow-400 text-black px-1.5 py-0.5 rounded text-[10px] font-bold">PR</span>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-5">
        <h1 className="text-xl sm:text-2xl font-bold">
          {heading}
          <span className="ml-2 text-base font-normal text-gray-400">（{total}本）</span>
        </h1>
        {aiIntro && <p className="mt-2 text-sm text-gray-200 leading-relaxed">{aiIntro}</p>}
        <p className={`${aiIntro ? 'mt-1 text-gray-400' : 'mt-2 text-gray-300'} text-sm leading-relaxed`}>{intro}</p>

        {videos[0] && (
          <Link
            href={swipeHref(videos[0].dmm_content_id)}
            prefetch={false}
            className="mt-4 flex items-center justify-center gap-2 w-full sm:w-auto sm:inline-flex rounded-xl bg-blue-600 hover:bg-blue-500 px-6 py-3 font-bold transition-colors"
          >
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24" aria-hidden><path d="M8 5v14l11-7z" /></svg>
            スワイプで全部見る
          </Link>
        )}

        <ul className="mt-5 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {videos.map((v) => (
            <li key={v.id}>
              <Link href={swipeHref(v.dmm_content_id)} prefetch={false} className="group block">
                <div className="relative aspect-[3/2] overflow-hidden rounded-lg bg-gray-800">
                  {/* eslint-disable-next-line @next/next/no-img-element -- FANZA の表紙をそのまま表示する */}
                  <img src={v.thumbnail_url} alt={v.title} loading="lazy" className="w-full h-full object-cover transition-transform duration-200 group-hover:scale-105" />
                  {sampleLength(v.sample_seconds) && (
                    <span className="absolute bottom-1 right-1 rounded bg-black/75 px-1.5 py-0.5 text-[10px] font-bold">▶ {sampleLength(v.sample_seconds)}</span>
                  )}
                </div>
                <p className="mt-1.5 text-xs leading-snug line-clamp-2 text-gray-200 group-hover:text-white">{v.title}</p>
                {(v.maker || v.release_date) && (
                  <p className="mt-0.5 text-[11px] text-gray-500 truncate">
                    {[v.maker, v.release_date ? v.release_date.slice(0, 10).replace(/-/g, '/') : null].filter(Boolean).join('・')}
                  </p>
                )}
              </Link>
            </li>
          ))}
        </ul>
        {total > videos.length && <p className="mt-3 text-xs text-gray-500">ほかの作品は「スワイプで全部見る」や検索から見られます。</p>}

        {related.length > 0 && (
          <section className="mt-8">
            <h2 className="text-base font-bold">{relatedTitle}</h2>
            <ul className="mt-3 flex flex-wrap gap-2">
              {related.map((r) => (
                <li key={r.slug}>
                  <Link href={`${relatedBase}${r.slug}`} prefetch={false} className="inline-block rounded-full bg-gray-800 hover:bg-gray-700 px-3 py-1.5 text-sm transition-colors">
                    {r.name}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}
      </main>

      <footer className="border-t border-gray-800 mt-10">
        <div className="max-w-6xl mx-auto px-4 py-6">
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
