import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getArticleBySlug, getAllArticles, getArticleModifiedAt, getArticleEyecatch } from '@/lib/articles';
import { renderArticleMarkdown, isInteractiveArticle, extractToc } from '@/lib/articles/markdown';
import { fillLiveSections } from '@/lib/articles/live';
import { getSizeStatistics, generateStatsHTML } from '@/lib/sizeStats';
import type { Metadata } from 'next';
import ArticleLink, { formatDate } from '../ArticleLink';
import SwipeCta from '../SwipeCta';
import ArticleWidget from '../ArticleWidget';
import { getCtaVideos } from '@/lib/articles/cta-videos';

type Props = {
  params: Promise<{ slug: string }>;
};

// size-comparison-toolページは常に最新のデータを表示するため、キャッシュを無効化
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function generateStaticParams() {
  const articles = getAllArticles();
  return articles.map((article) => ({
    slug: article.slug,
  }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const article = getArticleBySlug(slug);

  if (!article) {
    return {
      title: '記事が見つかりません - Short AV',
    };
  }

  const ogImage = getArticleEyecatch(article);
  return {
    title: `${article.title} - Short AV`,
    description: article.description,
    alternates: {
      canonical: `/articles/${article.slug}`,
    },
    openGraph: {
      title: `${article.title} - Short AV`,
      description: article.description,
      url: `https://short-av.com/articles/${article.slug}`,
      siteName: 'Short AV',
      images: [
        {
          url: ogImage,
          width: 1200,
          height: 630,
          alt: article.title,
        },
      ],
      locale: 'ja_JP',
      type: 'article',
      publishedTime: article.publishedAt,
      modifiedTime: getArticleModifiedAt(article),
      authors: ['Short AV'],
    },
    twitter: {
      card: 'summary_large_image',
      title: `${article.title} - Short AV`,
      description: article.description,
      images: [ogImage],
    },
  };
}

export default async function ArticlePage({ params }: Props) {
  const { slug } = await params;
  const article = getArticleBySlug(slug);

  if (!article) {
    notFound();
  }

  // size-comparison-toolの場合、サーバーサイドで統計データを取得してHTMLに埋め込む
  let content = article.content;
  if (slug === 'size-comparison-tool') {
    const stats = await getSizeStatistics('erect');
    const statsHTML = generateStatsHTML(stats);
    // 「データを読み込み中...」のプレースホルダーを実際のデータに置き換える
    content = content.replace(
      '<div class="stats-loading">データを読み込み中...</div>',
      statsHTML
    );
  }

  const allArticles = getAllArticles();

  // HTMLツール記事かどうかを判定（<script>や<style>が含まれている場合）
  const isInteractiveTool = isInteractiveArticle(content);
  // 本文の <!-- live:名前 --> を最新のデータ（作品の一覧・統計）に置き換える
  const bodyHtml = isInteractiveTool ? '' : await fillLiveSections(renderArticleMarkdown(content, article.title));
  const modifiedAt = getArticleModifiedAt(article);
  // 目次（h2 が2つ以上あるときだけ出す）
  const toc = isInteractiveTool ? [] : extractToc(bodyHtml);
  // 関連記事（同じ分類を先に、足りなければ新しい順で3件）
  const related = [
    ...allArticles.filter((a) => a.slug !== slug && a.category === article.category),
    ...allArticles.filter((a) => a.slug !== slug && a.category !== article.category),
  ].slice(0, 3);
  // 本文の下の導線に出す人気作（表紙3枚）
  const ctaVideos = await getCtaVideos();

  // Article構造化データ
  const articleSchema = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: article.title,
    description: article.description,
    author: {
      '@type': 'Organization',
      name: 'Short AV',
    },
    publisher: {
      '@type': 'Organization',
      name: 'Short AV',
      logo: {
        '@type': 'ImageObject',
        url: 'https://short-av.com/logo.png',
      },
    },
    datePublished: article.publishedAt,
    dateModified: getArticleModifiedAt(article),
    mainEntityOfPage: {
      '@type': 'WebPage',
      '@id': `https://short-av.com/articles/${article.slug}`,
    },
  };

  // BreadcrumbList構造化データ
  const breadcrumbSchema = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      {
        '@type': 'ListItem',
        position: 1,
        name: 'ホーム',
        item: 'https://short-av.com',
      },
      {
        '@type': 'ListItem',
        position: 2,
        name: '記事一覧',
        item: 'https://short-av.com/articles',
      },
      {
        '@type': 'ListItem',
        position: 3,
        name: article.title,
        item: `https://short-av.com/articles/${article.slug}`,
      },
    ],
  };

  // よくある質問の構造化データ（記事に faq があるときだけ）
  const faqSchema = article.faq && article.faq.length > 0
    ? {
        '@context': 'https://schema.org',
        '@type': 'FAQPage',
        mainEntity: article.faq.map((item) => ({
          '@type': 'Question',
          name: item.q,
          acceptedAnswer: { '@type': 'Answer', text: item.a },
        })),
      }
    : null;

  return (
    <div className="min-h-screen bg-white text-gray-900">
      {/* 構造化データ */}
      {faqSchema && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }} />}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(articleSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }}
      />
      {/* ヘッダー - レスポンシブ対応 */}
      <header className="bg-white/95 backdrop-blur border-b border-gray-100 sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-5 md:px-8 py-3 flex items-center justify-between">
          <Link href="/articles" className="flex items-center gap-2 text-gray-500 hover:text-gray-900 transition-colors text-sm">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            記事一覧
          </Link>
          <Link href="/" className="text-sm font-bold tracking-wide text-gray-900">Short AV</Link>
        </div>
      </header>

      {/* コンテンツ - レスポンシブ対応 */}
      {/* スマホは画面下の固定ボタン（SwipeCta sticky）のぶん下に余白を取る */}
      <main className="max-w-3xl mx-auto px-5 md:px-8 py-10 md:py-16 pb-28 md:pb-16">
        <article>
          {/* タイトル */}
          <header className="mb-10 md:mb-12">
            <h1 className="text-2xl md:text-4xl font-bold mb-4 md:mb-5 leading-snug md:leading-tight tracking-tight whitespace-pre-line">
              {article.title}
            </h1>
            {!article.pinned && (
              <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-sm text-gray-500">
                {article.category && (
                  <span className="text-gray-700">
                    {article.category}
                  </span>
                )}
                <span>
                  公開日 <time dateTime={article.publishedAt}>{formatDate(article.publishedAt)}</time>
                </span>
                {modifiedAt !== article.publishedAt && (
                  <span>
                    更新日 <time dateTime={modifiedAt}>{formatDate(modifiedAt)}</time>
                  </span>
                )}
              </div>
            )}
            {/* ステルスマーケティング規制（2023年10月〜）への対応として、全記事に広告表記を出す */}
            <p className="mt-3 text-xs text-gray-400">
              ※本ページはプロモーション（広告）を含みます。
            </p>
          </header>

          {/* 目次 */}
          {toc.length >= 2 && (
            <nav aria-label="目次" className="mb-10 rounded-xl bg-gray-50 border border-gray-100 px-5 py-4 md:px-6 md:py-5">
              <p className="text-sm font-bold text-gray-900 mb-3">目次</p>
              <ol className="space-y-2 text-sm md:text-[15px] text-gray-700">
                {toc.map((item, i) => (
                  <li key={item.id} className="flex gap-3">
                    <span className="text-gray-400 tabular-nums w-5 flex-shrink-0 text-right">{i + 1}.</span>
                    <a href={`#${item.id}`} className="hover:text-gray-900 hover:underline underline-offset-4">{item.text}</a>
                  </li>
                ))}
              </ol>
            </nav>
          )}

          {/* 本文 - レスポンシブ対応 */}
          <div className="max-w-none">
            {isInteractiveTool ? (
              /* インタラクティブツールの場合はHTMLをそのまま表示 */
              <div
                className="text-gray-800 leading-relaxed"
                dangerouslySetInnerHTML={{ __html: content }}
              />
            ) : (
              /* 通常の記事の場合はMarkdown処理 */
              <div
                className="space-y-6 md:space-y-8 text-gray-800 leading-[1.9] md:leading-[2] text-base md:text-lg"
                dangerouslySetInnerHTML={{ __html: bodyHtml }}
              />
            )}
          </div>
        </article>

        {/* サイトの本体（スワイプ画面）への導線（画像バナー。本文を読み終えた位置） */}
        <div className="mt-12">
          <SwipeCta slug={article.slug} position="top" />
        </div>

        {/* 記事の内容に合った FANZA の商品ウィジェット（本文の後） */}
        <ArticleWidget slug={article.slug} />

        {/* サイトの本体への導線（本文の後。人気作の表紙つき） */}
        <SwipeCta slug={article.slug} position="end" videos={ctaVideos} />

        {/* 関連記事（アイキャッチつき） */}
        {related.length > 0 && (
          <nav className="mt-12 md:mt-16 pt-8 md:pt-10 border-t border-gray-100">
            <h2 className="text-lg md:text-xl font-bold text-gray-900 mb-5">関連記事</h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 md:gap-6">
              {related.map((item) => (
                <ArticleLink key={item.slug} article={item} className="group block">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={getArticleEyecatch(item)} alt="" loading="lazy" width={1200} height={630} className="w-full aspect-[1200/630] rounded-xl object-cover group-hover:opacity-90 transition-opacity" />
                  <p className="mt-3 text-sm md:text-[15px] font-bold leading-snug text-gray-900 group-hover:text-gray-600 transition-colors line-clamp-2 whitespace-pre-line">{item.title}</p>
                  {item.category && <p className="mt-1 text-xs text-gray-400">{item.category}</p>}
                </ArticleLink>
              ))}
            </div>
          </nav>
        )}

        {/* フッター - レスポンシブ対応 */}
        <footer className="mt-8 md:mt-12 pt-8 md:pt-10 border-t border-gray-100">
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link
              href="/articles"
              className="inline-block border border-gray-300 hover:bg-gray-50 text-gray-900 px-8 py-3 rounded-full font-bold transition-colors text-center text-sm"
            >
              記事一覧に戻る
            </Link>
            <Link
              href="/"
              className="inline-block bg-gray-900 hover:bg-gray-700 text-white px-8 py-3 rounded-full font-bold transition-colors text-center text-sm"
            >
              スワイプ画面を開く
            </Link>
          </div>
        </footer>
      </main>
      {/* スマホの画面下の固定ボタン */}
      <SwipeCta slug={article.slug} position="sticky" />
    </div>
  );
}
