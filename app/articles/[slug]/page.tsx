import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getArticleBySlug, getAllArticles, getArticleModifiedAt } from '@/lib/articles';
import { renderArticleMarkdown, isInteractiveArticle } from '@/lib/articles/markdown';
import { fillLiveSections } from '@/lib/articles/live';
import { getSizeStatistics, generateStatsHTML } from '@/lib/sizeStats';
import type { Metadata } from 'next';
import ArticleLink, { formatDate } from '../ArticleLink';
import SwipeCta from '../SwipeCta';
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

  const ogImage = article.ogImage ?? '/og-image.jpg';
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

  // 次の記事と前の記事を取得
  const allArticles = getAllArticles();
  const currentIndex = allArticles.findIndex(a => a.slug === slug);
  const nextArticle = currentIndex > 0 ? allArticles[currentIndex - 1] : null;
  const prevArticle = currentIndex < allArticles.length - 1 ? allArticles[currentIndex + 1] : null;

  // HTMLツール記事かどうかを判定（<script>や<style>が含まれている場合）
  const isInteractiveTool = isInteractiveArticle(content);
  // 本文の <!-- live:名前 --> を最新のデータ（作品の一覧・統計）に置き換える
  const bodyHtml = isInteractiveTool ? '' : await fillLiveSections(renderArticleMarkdown(content, article.title));
  const modifiedAt = getArticleModifiedAt(article);
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

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* 構造化データ */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(articleSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }}
      />
      {/* ヘッダー - レスポンシブ対応 */}
      <header className="bg-gray-800 border-b border-gray-700 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 md:px-6 lg:px-8 py-4">
          <div className="flex items-center gap-4">
            <Link
              href="/articles"
              className="text-gray-400 hover:text-white transition-colors"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
            </Link>
            <h1 className="text-lg md:text-xl font-bold line-clamp-1">記事</h1>
          </div>
        </div>
      </header>

      {/* コンテンツ - レスポンシブ対応 */}
      {/* スマホは画面下の固定ボタン（SwipeCta sticky）のぶん下に余白を取る */}
      <main className="max-w-4xl mx-auto px-4 md:px-6 lg:px-8 py-8 md:py-12 pb-28 md:pb-12">
        <article>
          {/* タイトル */}
          <header className="mb-8 md:mb-12">
            <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold mb-4 md:mb-6 leading-tight whitespace-pre-line">
              {article.title}
            </h1>
            {!article.pinned && (
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-gray-400">
                {article.category && (
                  <span className="bg-gray-800 px-3 py-1 rounded">
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
            <p className="mt-4 text-xs md:text-sm text-gray-500">
              ※本ページはプロモーション（広告）を含みます。
            </p>
          </header>

          {/* サイトの本体（スワイプ画面）への導線（上）。記事は検索から来る人の入口なので、本体を先に知らせる */}
          <SwipeCta slug={article.slug} position="top" />

          {/* 本文 - レスポンシブ対応 */}
          <div className="prose prose-invert prose-lg md:prose-xl max-w-none">
            {isInteractiveTool ? (
              /* インタラクティブツールの場合はHTMLをそのまま表示 */
              <div
                className="text-gray-300 leading-relaxed"
                dangerouslySetInnerHTML={{ __html: content }}
              />
            ) : (
              /* 通常の記事の場合はMarkdown処理 */
              <div
                className="space-y-6 md:space-y-8 text-gray-300 leading-relaxed md:leading-loose text-base md:text-lg"
                dangerouslySetInnerHTML={{ __html: bodyHtml }}
              />
            )}
          </div>
        </article>

        {/* サイトの本体への導線（本文の後。人気作の表紙つき） */}
        <SwipeCta slug={article.slug} position="end" videos={ctaVideos} />

        {/* 次の記事/前の記事ナビゲーション */}
        {(nextArticle || prevArticle) && (
          <nav className="mt-12 md:mt-16 pt-8 md:pt-12 border-t border-gray-800">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* 前の記事 */}
              {prevArticle ? (
                <ArticleLink
                  article={prevArticle}
                  className="group bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded-lg p-4 md:p-6 transition-colors"
                >
                  <div className="text-xs md:text-sm text-gray-400 mb-2 flex items-center gap-2">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                    前の記事
                  </div>
                  <div className="text-sm md:text-base font-bold text-white group-hover:text-blue-400 transition-colors line-clamp-2">
                    {prevArticle.title}
                  </div>
                </ArticleLink>
              ) : (
                <div className="hidden md:block"></div>
              )}

              {/* 次の記事 */}
              {nextArticle && (
                <ArticleLink
                  article={nextArticle}
                  className="group bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded-lg p-4 md:p-6 transition-colors md:text-right"
                >
                  <div className="text-xs md:text-sm text-gray-400 mb-2 flex items-center gap-2 md:justify-end">
                    次の記事
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                  <div className="text-sm md:text-base font-bold text-white group-hover:text-blue-400 transition-colors line-clamp-2">
                    {nextArticle.title}
                  </div>
                </ArticleLink>
              )}
            </div>
          </nav>
        )}

        {/* フッター - レスポンシブ対応 */}
        <footer className="mt-8 md:mt-12 pt-8 md:pt-12 border-t border-gray-800">
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/articles"
              className="inline-block bg-gray-800 hover:bg-gray-700 text-white px-8 md:px-10 py-3 md:py-4 rounded-lg font-bold transition-colors text-center text-sm md:text-base"
            >
              記事一覧に戻る
            </Link>
            <Link
              href="/"
              className="inline-block bg-blue-600 hover:bg-blue-700 text-white px-8 md:px-10 py-3 md:py-4 rounded-lg font-bold transition-colors text-center text-sm md:text-base"
            >
              ホームに戻る
            </Link>
          </div>
        </footer>
      </main>
      {/* スマホの画面下の固定ボタン */}
      <SwipeCta slug={article.slug} position="sticky" />
    </div>
  );
}
