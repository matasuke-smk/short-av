import type { Metadata } from 'next';
import { productCode } from '@/lib/product-code';
import Link from 'next/link';
import BrowseLinks from '@/app/components/BrowseLinks';
import { CONTACT_FORM_URL, EXTRA_LONG_SAMPLE_SECONDS, LONG_SAMPLE_SECONDS } from '@/config/site';
import { supabase, type Database } from '@/lib/supabase';
import { generateVideoListSchema } from '@/lib/video-schema';

type Video = Database['public']['Tables']['videos']['Row'];
type Row = Pick<Video, 'id' | 'dmm_content_id' | 'title' | 'thumbnail_url' | 'sample_seconds' | 'maker' | 'release_date' | 'rank_position'>;

// サンプルの長さは1日1回調べて記録しているので、1時間ごとに作り直せば十分
export const revalidate = 3600;

const EXTRA_MIN = EXTRA_LONG_SAMPLE_SECONDS / 60; // 4
const LONG_MIN = LONG_SAMPLE_SECONDS / 60; // 3

const title = `サンプル動画が長い作品一覧（${EXTRA_MIN}分以上・${LONG_MIN}分以上） | Short AV`;
const description = `FANZA のサンプル動画が${EXTRA_MIN}分以上ある作品を長い順に、${LONG_MIN}分以上の人気作も一覧にしました。Short AV が毎日サンプルの長さを調べて更新。無料・会員登録不要で、押すとそのままスワイプ画面で見られます。`;

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: '/long-samples' },
  openGraph: { title, description, siteName: 'Short AV', locale: 'ja_JP', type: 'website' },
};

const sampleLength = (s: number | null) => (s && s > 0 ? `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}` : null);
const COLUMNS = 'id, dmm_content_id, title, thumbnail_url, sample_seconds, maker, release_date, rank_position';

async function load() {
  const base = () => supabase.from('videos').select(COLUMNS).eq('is_active', true).not('thumbnail_url', 'is', null).not('sample_video_url', 'is', null);
  const [extra, long, extraCount, longCount] = await Promise.all([
    // 4分以上: 長い順にすべて（2026-10 時点で約140本）
    base().gte('sample_seconds', EXTRA_LONG_SAMPLE_SECONDS).order('sample_seconds', { ascending: false }).order('id').limit(300),
    // 3分以上4分未満: 人気順（DMM の順位がある作品）の上位
    base().gte('sample_seconds', LONG_SAMPLE_SECONDS).lt('sample_seconds', EXTRA_LONG_SAMPLE_SECONDS).not('rank_position', 'is', null).order('rank_position', { ascending: true }).order('id').limit(60),
    supabase.from('videos').select('id', { count: 'exact', head: true }).eq('is_active', true).gte('sample_seconds', EXTRA_LONG_SAMPLE_SECONDS),
    supabase.from('videos').select('id', { count: 'exact', head: true }).eq('is_active', true).gte('sample_seconds', LONG_SAMPLE_SECONDS),
  ]);
  return {
    extra: (extra.data ?? []) as Row[],
    long: (long.data ?? []) as Row[],
    extraCount: extraCount.count ?? 0,
    longCount: longCount.count ?? 0,
  };
}

function VideoGrid({ videos, badge }: { videos: Row[]; badge: (v: Row, i: number) => string | null }) {
  if (videos.length === 0) return <p className="mt-3 text-sm text-gray-400">いま表示できる作品がありません。時間をおいてもう一度ご覧ください。</p>;
  return (
    <ul className="mt-4 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
      {videos.map((v, i) => (
        <li key={v.id}>
          <Link href={`/?v=${encodeURIComponent(v.dmm_content_id)}`} prefetch={false} className="group block">
            <div className="relative aspect-[3/2] overflow-hidden rounded-lg bg-gray-800">
              {/* eslint-disable-next-line @next/next/no-img-element -- FANZA の表紙をそのまま表示する */}
              <img src={v.thumbnail_url} alt={v.title} loading={i < 8 ? 'eager' : 'lazy'} className="w-full h-full object-cover transition-transform duration-200 group-hover:scale-105" />
              {badge(v, i) && <span className="absolute bottom-1 right-1 rounded bg-black/75 px-1.5 py-0.5 text-[10px] font-bold">{badge(v, i)}</span>}
            </div>
            <p className="mt-1.5 text-xs leading-snug line-clamp-2 text-gray-200 group-hover:text-white">{v.title}</p>
            {(v.maker || v.release_date) && (
              <p className="mt-0.5 text-[11px] text-gray-500 truncate">
                {[productCode(v.dmm_content_id), v.maker, v.release_date ? v.release_date.slice(0, 10).replace(/-/g, '/') : null].filter(Boolean).join('・')}
              </p>
            )}
          </Link>
        </li>
      ))}
    </ul>
  );
}

/**
 * サンプル動画が長い作品の一覧（サーバーで描画。検索エンジンや AI が中身を読めるように）。
 * ChatGPT から来た人がサイトの中で「サンプル動画3分以上・4分以上」を一番よく検索していたので、
 * その答えになるページを用意した（2026-10-24）。記事「サンプル動画が4分以上ある作品一覧」は使い方の説明、こちらは一覧そのもの
 */
export default async function LongSamplesPage() {
  const { extra, long, extraCount, longCount } = await load();
  const schema = generateVideoListSchema(extra.slice(0, 20) as unknown as Video[]);

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }} />
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
        <h1 className="text-xl sm:text-2xl font-bold">サンプル動画が長い作品一覧</h1>
        <p className="mt-2 text-sm text-gray-300 leading-relaxed">
          FANZA のサンプル動画は作品によって数十秒から10分近くまで長さが違います。Short AV は毎日サンプルの長さを調べて記録していて、
          いま{EXTRA_MIN}分以上の作品が{extraCount.toLocaleString()}本、{LONG_MIN}分以上が{longCount.toLocaleString()}本あります。
          表紙を押すと、そのままスワイプ画面でサンプルを無料で見られます（会員登録不要）。
        </p>
        <p className="mt-2 text-xs text-gray-500">
          スワイプ画面の検索でも「サンプル動画{LONG_MIN}分以上」「{EXTRA_MIN}分以上」を選ぶと同じように絞り込めます。発売されたばかりの作品は長さがまだ分かっていないことがあります。
        </p>

        {extra[0] && (
          <Link
            href={`/?v=${encodeURIComponent(extra[0].dmm_content_id)}`}
            prefetch={false}
            className="mt-4 flex items-center justify-center gap-2 w-full sm:w-auto sm:inline-flex rounded-xl bg-blue-600 hover:bg-blue-500 px-6 py-3 font-bold transition-colors"
          >
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24" aria-hidden><path d="M8 5v14l11-7z" /></svg>
            いちばん長いサンプルから見る
          </Link>
        )}

        <section className="mt-8">
          <h2 className="text-lg font-bold">
            {EXTRA_MIN}分以上の作品（長い順）
            <span className="ml-2 text-sm font-normal text-gray-400">{extra.length}本</span>
          </h2>
          <VideoGrid videos={extra} badge={(v) => (sampleLength(v.sample_seconds) ? `▶ ${sampleLength(v.sample_seconds)}` : null)} />
        </section>

        <section className="mt-10">
          <h2 className="text-lg font-bold">
            {LONG_MIN}分以上の人気作
            <span className="ml-2 text-sm font-normal text-gray-400">人気順・{long.length}本</span>
          </h2>
          <p className="mt-1 text-xs text-gray-500">サンプルが{LONG_MIN}分以上{EXTRA_MIN}分未満の作品のうち、FANZA で人気の順に並べています。</p>
          <VideoGrid videos={long} badge={(v) => (sampleLength(v.sample_seconds) ? `▶ ${sampleLength(v.sample_seconds)}` : null)} />
        </section>

        <section className="mt-10 text-sm text-gray-300 leading-relaxed">
          <h2 className="text-base font-bold text-white">サンプルが長いと何がいいのか</h2>
          <p className="mt-2">
            買う前に中身をしっかり確かめられます。パッケージとタイトルだけでは雰囲気や女優の表情、カメラワークが好みに合うか分かりませんが、
            4分あれば作品の流れがだいたいつかめます。詳しくは
            <Link href="/articles/long-sample-videos" prefetch={false} className="underline text-blue-300 hover:text-blue-200">記事「サンプル動画が4分以上ある作品一覧」</Link>
            と<Link href="/articles/fanza-save-money" prefetch={false} className="underline text-blue-300 hover:text-blue-200">FANZA で安く買う方法</Link>をどうぞ。
          </p>
        </section>
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
