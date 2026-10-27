import { Suspense } from 'react';
import type { Metadata } from 'next';
import { supabase } from '@/lib/supabase';
import { getCachedRandomPool, shuffle } from '@/lib/random-pool';
import { getVideoByContentId } from '@/lib/video-by-content-id';
import { getCatalogPage, type CatalogKind } from '@/lib/catalog';
import VideoSwiper from './components/VideoSwiper';
import { generateVideoSchema } from '@/lib/video-schema';
import { getVideoUrl } from '@/lib/x-post-text';
import { buildVideoDescription, getVideoNames, type VideoSeoRow } from '@/lib/video-seo';
import { DOUJIN_ID_PATTERN, fetchDoujin, fetchDoujinById, fetchDoujinByIds, type Doujin } from '@/lib/doujin';
import { goHref } from '@/lib/go-link';

// 動的レンダリング：毎回新しいランダム動画を表示
// revalidate = 0 により、キャッシュせず毎回サーバー側で動画を取得
export const revalidate = 0;

// ?v=作品ID で開かれた場合は、SNS のリンクカードにその作品のタイトルとサムネイルを出す
export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<{ v?: string | string[]; mode?: string | string[]; d?: string | string[] }>;
}): Promise<Metadata> {
  const { v, mode, d } = await searchParams;
  // 同人誌のリンク（X の投稿から）: リンクカードに同人誌の表紙と作品名を出す
  if (mode === 'doujin' && typeof d === 'string' && DOUJIN_ID_PATTERN.test(d)) {
    const doujin = await fetchDoujinById(d).catch(() => null);
    if (!doujin) return {};
    const title = `${doujin.title} | Short AV`;
    const description = '同人誌のサンプルをスワイプで試し読み。Short AV';
    return {
      title,
      description,
      // 正規の URL は同人誌の作品ページ（app/doujin/[id]。サンプルを縦に並べたページ）
      alternates: { canonical: `/doujin/${encodeURIComponent(d)}` },
      openGraph: { title, description, siteName: 'Short AV', images: [{ url: doujin.cover, alt: doujin.title }], locale: 'ja_JP', type: 'website' },
      twitter: { card: 'summary_large_image', title, description, images: [doujin.cover] },
    };
  }
  const contentId = typeof v === 'string' ? v : undefined;
  if (!contentId || contentId.length > 64) return {};

  const video = (await getVideoByContentId(contentId).catch(() => null)) as VideoSeoRow | null;
  if (!video?.thumbnail_url) return {};

  const title = `${video.title} | Short AV`;
  // 作品名で検索されたときに当たるよう、出演・ジャンル・メーカー・発売日・サンプルの長さを説明文に入れる。
  // Claude が書いた紹介文（ai_description、sql/019）があればそちらを優先する（2026-10-25）
  const aiRaw = (video as unknown as { ai_description?: unknown }).ai_description;
  const ai = typeof aiRaw === 'string' ? aiRaw : '';
  const description = ai ? (ai.length > 160 ? `${ai.slice(0, 157)}…` : ai) : buildVideoDescription(video, await getVideoNames(video));
  const images = [{ url: video.thumbnail_url, alt: video.title }];

  return {
    title,
    description,
    // 作品ごとに別のページとして登録されるよう、正規の URL は作品の別名 URL（/v/作品番号）にする。
    // /?v= のままだと Next.js がパス「/」の検索文字列を捨ててトップの URL になる（next.config.ts の rewrites を参照）
    alternates: { canonical: `/v/${encodeURIComponent(contentId)}` },
    openGraph: {
      title,
      description,
      url: getVideoUrl(contentId),
      siteName: 'Short AV',
      images,
      locale: 'ja_JP',
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [video.thumbnail_url],
    },
  };
}

// サイト全体の構造化データ（WebSite）。AI や検索エンジンに「何のサイトか」を伝える（2026-10-24）
const websiteSchema = {
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  name: 'Short AV',
  alternateName: 'ショートAV',
  url: 'https://short-av.com',
  inLanguage: 'ja',
  description:
    'FANZA（DMM）のサンプル動画を無料・会員登録不要で、縦スワイプで次々と見られるサイト。サンプルが3分以上・4分以上の作品だけに絞る検索、女優・ジャンル別のページ、同人誌の試し読みも。',
  isFamilyFriendly: false,
  publisher: { '@type': 'Organization', name: 'Short AV', url: 'https://short-av.com' },
};

// トップページのよくある質問（FAQPage）。ChatGPT などの AI がトップページを読んで答えに使うため、
// サイトでできることを質問と答えの形で書いておく（2026-10-27。ChatGPT が回答のために読むのはほぼトップページだった）
const TOP_FAQ: { q: string; a: string }[] = [
  { q: 'Short AV とは何ですか？', a: 'FANZA（DMM）のアダルト動画のサンプルを、スマホの縦スワイプで次々と見られる日本語のサイトです。サンプルは FANZA 公式のプレイヤーで再生します（18歳以上）。' },
  { q: '料金や会員登録は必要ですか？', a: '無料で、会員登録やログインも不要です。いいね・履歴はブラウザに保存されます。' },
  { q: 'サンプル動画が長い作品だけを見られますか？', a: '見られます。毎日サンプルの長さを調べていて、サンプルが4分以上・3分以上の作品だけに絞って見られます（https://short-av.com/long-samples）。' },
  { q: '女優やジャンルから探せますか？', a: '探せます。女優ごと（https://short-av.com/actress）・ジャンルごと（https://short-av.com/genre）のページ、人気ランキング（https://short-av.com/ranking）、キーワード検索があります。FANZA 同人の試し読み（https://short-av.com/doujin）もあります。' },
  { q: '本編を見るにはどうすればいいですか？', a: '作品の「FANZA で見る」から FANZA の公式サイトへ進み、購入するか、月額の見放題 FANZA TV で見ます。' },
  { q: 'FANZA の作品を安く見る方法は？', a: '月額550円（税込）の見放題 FANZA TV（初回14日間無料）を使うか、初回購入向けのクーポンやセールを使う方法があります。詳しくは https://short-av.com/articles/fanza-tv-guide と https://short-av.com/articles/fanza-save-money にまとめています。' },
];
const topFaqSchema = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: TOP_FAQ.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })),
};

// ?v= の作品IDとして受け付ける形式
const VIDEO_PARAM_PATTERN = /^[0-9a-z_]{1,64}$/;

// 同人誌（人気＋高評価からランダム）。doujinId があればその作品を先頭にする。取れなくても動画は表示する
// doujinIds（管理画面のアクセス解析の「作品ごと」から開いたとき）があれば、その作品だけを渡した順に
async function loadDoujin(doujinId?: string, doujinIds?: string[]): Promise<Doujin[]> {
  try {
    if (doujinIds) return await fetchDoujinByIds(doujinIds);
    const [list, target] = await Promise.all([fetchDoujin('mix', 40), doujinId ? fetchDoujinById(doujinId) : Promise.resolve(null)]);
    return target ? [target, ...list.filter((d) => d.contentId !== target.contentId)] : list;
  } catch (error) {
    console.error('同人誌の取得エラー:', error);
    return [];
  }
}

async function VideoList({ targetId, doujinId, doujinMode = false, doujinIds, catalog }: { targetId?: string; doujinId?: string; doujinMode?: boolean; doujinIds?: string[]; catalog?: { kind: CatalogKind; slug: string } }) {
  const doujinPromise = loadDoujin(doujinId, doujinIds);
  // データベースから直接ランダムに取得（高速かつ全動画が対象）
  // プールサイズ。1人あたりのスワイプは平均2〜3回なので、200本（約260KB）を毎回データベースから取ると
  // Supabase の通信量（Egress）の大半になっていた。足りなくなったら /api/videos で補充する
  const poolSize = 40;
  const displaySize = 20; // 初期表示件数

  let fetchError = null;
  let videosAll = null;

  // まずRPC関数を使用してランダム取得を試みる
  // （以前は存在しない get_random_videos を呼んでいたため、毎回フォールバックの「同じ200本」になっていた）
  try {
    // 10分ごとにまとめて取った 200 本（lib/random-pool.ts）から、開くたびにランダムに選ぶ（Supabase の通信量を抑えるため）
    videosAll = shuffle(await getCachedRandomPool()).slice(0, poolSize);
  } catch (error) {
    console.log('RPC関数が存在しない可能性があります。フォールバックを使用します。');
  }

  // RPC関数が存在しない場合のフォールバック
  if (!videosAll) {
    const { data, error } = await supabase
      .from('videos')
      .select('*')
      .eq('is_active', true)
      .not('thumbnail_url', 'is', null)
      .not('sample_video_url', 'is', null)
      .limit(poolSize);

    videosAll = data;
    if (error) fetchError = error;

    // フォールバック時はJavaScriptでシャッフル
    if (videosAll) {
      const shuffled = [...videosAll];
      for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
      }
      videosAll = shuffled;
    }
  }

  // プールを作成
  let videoPool = videosAll || [];

  // ?v= で作品が指定された場合は、サーバー側で先頭に入れておく。
  // クライアント側で後から探すと、スワイプ画面の初期化（URL の書き換え）と競合して別の動画に戻ることがあった。
  let linkNotice: string | undefined;
  if (targetId) {
    // 作品の情報は1時間使い回す（lib/video-by-content-id.ts）。掲載終了・サンプルなしはここで判定する
    const found = await getVideoByContentId(targetId).catch(() => null);
    const target = found && found.is_active && found.sample_video_url ? found : null;
    if (target) {
      videoPool = [target, ...videoPool.filter((v: { dmm_content_id: string }) => v.dmm_content_id !== targetId)];
    } else {
      linkNotice = 'お探しの作品は掲載が終了しました。ほかの作品をお楽しみください。';
    }
  }

  // &actress= / &genre=: 女優・ジャンルのページの「スワイプで全部見る」から来たとき、その作品だけを並べる（ページと同じ順。押した作品から始める）
  let isFiniteList = false;
  if (catalog) {
    const page = await getCatalogPage(catalog.kind, catalog.slug).catch(() => null);
    if (page && page.videos.length > 0) {
      const start = Math.max(0, page.videos.findIndex((x) => x.dmm_content_id === targetId));
      videoPool = [...page.videos.slice(start), ...page.videos.slice(0, start)];
      isFiniteList = true;
    }
  }

  // プールから最初の20件を表示用として取り出す
  const videos = videoPool.slice(0, displaySize);

  const error = fetchError;

  if (error) {
    console.error('動画取得エラー:', error);
    return (
      <main className="min-h-screen flex items-center justify-center p-8 bg-gray-900">
        <div className="text-center">
          <h1 className="text-3xl font-bold mb-6 text-white">エラーが発生しました</h1>
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-red-800">動画データの取得に失敗しました。</p>
          </div>
        </div>
      </main>
    );
  }

  if (!videos || videos.length === 0) {
    return (
      <main className="min-h-screen flex items-center justify-center p-8 bg-gray-900">
        <div className="text-center">
          <h1 className="text-3xl font-bold mb-6 text-white">Short AV</h1>
          <p className="text-gray-400 text-lg mb-4">
            まだ動画データがありません。
          </p>
          <code className="bg-gray-800 text-blue-400 px-4 py-2 rounded inline-block">
            npm run sync:dmm
          </code>
          <p className="text-gray-500 text-sm mt-2">
            を実行してデータを同期してください。
          </p>
        </div>
      </main>
    );
  }

  // 最初に表示する作品の構造化データ（?v= 指定時はその作品）。説明文・出演・ジャンル・長さを足す
  const firstVideoSchema = generateVideoSchema(videos[0]);
  // Claude が書いた紹介文（ai_description、sql/019）。構造化データの説明文と、?v= のときの sr-only の本文に使う（2026-10-25）
  const firstAiRaw = videos[0] ? (videos[0] as unknown as { ai_description?: unknown }).ai_description : undefined;
  const firstAi = typeof firstAiRaw === 'string' ? firstAiRaw : '';
  if (firstVideoSchema && videos[0]) {
    const first = videos[0];
    const names = await getVideoNames(first);
    firstVideoSchema.description = firstAi || buildVideoDescription(first as VideoSeoRow, names);
    if (names.actresses.length > 0) firstVideoSchema.actor = names.actresses.map((name) => ({ '@type': 'Person', name }));
    if (names.genres.length > 0) firstVideoSchema.genre = names.genres;
    if (first.sample_seconds && first.sample_seconds > 0) firstVideoSchema.duration = `PT${Math.floor(first.sample_seconds / 60)}M${first.sample_seconds % 60}S`;
  }

  // URLパラメータの処理はクライアント側（VideoSwiper）で行う
  const doujinList = await doujinPromise;
  // アクセス解析の「作品ごと」から開いたときは、その一覧の同人誌だけをスワイプで見る（動画は挟まない）
  const doujinOnly = !!doujinIds && doujinList.length > 0;
  return (
    <>
      {/* ページの見出しと説明（画面には出さない。スワイプ画面には見出しがないため、検索エンジン・AI・読み上げ用。Bing の推奨）。
          ロボットが読むトップの本文は作品名の羅列だけだったので、「何ができるサイトか」と主なページへの道筋を短く書いておく（2026-10-24） */}
      <h1 className="sr-only">DMM（FANZA）動画のサンプルを縦スワイプで次々と見られる Short AV</h1>
      <p className="sr-only">
        Short AV は、FANZA（DMM）のアダルト動画のサンプルを無料・会員登録不要で、スマホの縦スワイプで次々と見られるサイトです（18歳以上）。
        サンプルが3分以上・4分以上の作品だけに絞る検索、女優やジャンルごとのページ、人気ランキング、同人誌の試し読みがあります。
        本編の購入や見放題は FANZA の公式サイトで行います。
      </p>
      {/* よくある質問（画面には出さない。AI・検索エンジン・読み上げ用。上の FAQPage と同じ内容。2026-10-27） */}
      <section className="sr-only" aria-label="よくある質問">
        <h2>よくある質問</h2>
        <dl>
          {TOP_FAQ.map((f) => (
            <div key={f.q}>
              <dt>{f.q}</dt>
              <dd>{f.a}</dd>
            </div>
          ))}
        </dl>
      </section>
      <nav className="sr-only" aria-label="主なページ">
        <ul>
          <li><a href="/long-samples">サンプル動画が長い作品一覧（4分以上・3分以上）</a></li>
          <li><a href="/actress">女優から探す</a></li>
          <li><a href="/genre">ジャンルから探す</a></li>
          <li><a href="/ranking">人気ランキング</a></li>
          <li><a href="/doujin">同人誌の試し読み</a></li>
          <li><a href="/articles/getting-started">使い方</a></li>
          <li><a href="/articles/faq">よくある質問</a></li>
          <li><a href="/articles">記事一覧</a></li>
        </ul>
      </nav>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteSchema) }}
      />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(topFaqSchema) }} />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(firstVideoSchema) }}
      />
      {/* ?v= で開かれた作品の紹介文（Claude が書いたもの。画面には出さない。検索エンジン・AI 向けの独自の文章。2026-10-25） */}
      {targetId && firstAi && <p className="sr-only">{firstAi}</p>}
      <VideoSwiper
        // FANZA の紹介リンクは /go を通した形で渡す（ページに埋め込まれるデータをロボットが読んでたどらないように。lib/go-link.ts、2026-10-27）
        videos={videos.map((v) => ({ ...v, dmm_product_url: goHref(v.dmm_product_url) ?? v.dmm_product_url }))}
        videoPool={videoPool.map((v) => ({ ...v, dmm_product_url: goHref(v.dmm_product_url) ?? v.dmm_product_url }))}
        linkNotice={linkNotice}
        doujinList={doujinList.map((d) => ({ ...d, url: goHref(d.url) ?? d.url }))}
        doujinMode={doujinMode}
        doujinOnly={doujinOnly}
        isFiniteList={isFiniteList}
        startIndex={doujinOnly ? Math.max(0, doujinList.findIndex((d) => d.contentId === doujinId)) : 0}
      />
    </>
  );
}

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ v?: string | string[]; mode?: string | string[]; d?: string | string[]; list?: string | string[]; actress?: string | string[]; genre?: string | string[] }>;
}) {
  const { v, mode, d, list, actress, genre } = await searchParams;
  // &actress=女優番号 / &genre=ジャンル番号: 女優・ジャンルのページから来たとき、その作品だけを並べる
  const catalog = typeof actress === 'string' && /^\d{1,10}$/.test(actress) ? { kind: 'actress' as const, slug: actress } : typeof genre === 'string' && /^\d{1,10}$/.test(genre) ? { kind: 'genre' as const, slug: genre } : undefined;
  const targetId = typeof v === 'string' && VIDEO_PARAM_PATTERN.test(v) ? v : undefined;
  // ?mode=doujin&d=作品番号: 同人誌中心の画面（X の同人誌の投稿から。その回だけ）
  const doujinMode = mode === 'doujin';
  const doujinId = doujinMode && typeof d === 'string' && DOUJIN_ID_PATTERN.test(d) ? d : undefined;
  // &list=作品番号,作品番号,…: 管理画面のアクセス解析（同人誌の「作品ごと」）から開いたとき、その作品だけを並べる（最大30冊）
  const listIds = doujinMode && typeof list === 'string' ? list.split(',').filter((id) => DOUJIN_ID_PATTERN.test(id)).slice(0, 30) : [];
  const doujinIds = listIds.length > 0 ? listIds : undefined;

  return (
    <>
      <Suspense fallback={<div className="min-h-screen bg-black" />}>
        <VideoList targetId={targetId} doujinId={doujinId} doujinMode={doujinMode} doujinIds={doujinIds} catalog={catalog} />
      </Suspense>
    </>
  );
}
