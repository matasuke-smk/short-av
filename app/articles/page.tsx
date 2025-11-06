import Link from 'next/link';
import { getAllArticles } from '@/lib/articles';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: '記事一覧 - Short AV使い方完全ガイド',
  description: 'Short AVの使い方、便利な機能、検索のコツ、セキュリティ対策、男性の健康・性生活に関する情報まで徹底解説！初心者から上級者まで役立つ60以上の記事で、DMMの動画をもっと快適に楽しめます。',
  alternates: {
    canonical: '/articles',
  },
  openGraph: {
    title: '記事一覧 - Short AV使い方完全ガイド',
    description: 'Short AVの使い方、便利な機能、検索のコツ、セキュリティ対策、男性の健康・性生活に関する情報まで徹底解説！60以上の充実した記事を掲載。',
    url: 'https://short-av.com/articles',
    siteName: 'Short AV',
    images: [
      {
        url: '/og-image.jpg',
        width: 1200,
        height: 630,
        alt: 'Short AV 記事一覧',
      },
    ],
    locale: 'ja_JP',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: '記事一覧 - Short AV使い方完全ガイド',
    description: 'Short AVの使い方、便利な機能、検索のコツ、セキュリティ対策、男性の健康・性生活に関する情報まで徹底解説！60以上の充実した記事を掲載。',
    images: ['/og-image.jpg'],
  },
};

// ページネーション削除：全記事を1ページに表示してクローラビリティを向上
export default async function ArticlesPage() {
  const rawArticles = getAllArticles();

  // size-comparison-toolを先頭に固定
  const toolArticle = rawArticles.find(a => a.slug === 'size-comparison-tool');
  const otherArticles = rawArticles.filter(a => a.slug !== 'size-comparison-tool');
  const allArticles = toolArticle ? [toolArticle, ...otherArticles] : rawArticles;

  // 全記事を表示（SEO改善のため）
  const articles = allArticles;

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* ヘッダー - レスポンシブ対応 */}
      <header className="bg-gray-800 border-b border-gray-700 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 md:px-6 lg:px-8 py-4 md:py-5">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl md:text-3xl font-bold">記事一覧</h1>
            <Link
              href="/"
              className="text-gray-400 hover:text-white transition-colors"
            >
              <svg className="w-6 h-6 md:w-7 md:h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </Link>
          </div>
        </div>
      </header>

      {/* コンテンツ - レスポンシブ対応 */}
      <main className="max-w-4xl mx-auto px-4 md:px-6 lg:px-8 py-8 md:py-12">
        <p className="text-gray-400 mb-8 md:mb-10 text-base md:text-lg">
          Short AVの使い方や便利な機能について解説しています。
        </p>

        {/* 記事一覧 - レスポンシブ対応 */}
        <div className="space-y-4 md:space-y-5">
          {articles.map((article) => (
            <Link
              key={article.slug}
              href={`/articles/${article.slug}`}
              className="block bg-gray-800 hover:bg-gray-700 rounded-lg p-6 md:p-8 transition-colors border border-gray-700"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <h2 className="text-xl md:text-2xl font-bold mb-2 md:mb-3 text-white whitespace-pre-line">
                    {article.title}
                  </h2>
                  <p className="text-gray-400 mb-3 md:mb-4 text-sm md:text-base">
                    {article.description}
                  </p>
                  {article.slug !== 'size-comparison-tool' && (
                    <div className="flex items-center gap-4 text-sm md:text-base text-gray-500">
                      {article.category && (
                        <span className="bg-gray-700 px-2 md:px-3 py-1 rounded text-xs md:text-sm">
                          {article.category}
                        </span>
                      )}
                      <time dateTime={article.publishedAt}>
                        {new Date(article.publishedAt).toLocaleDateString('ja-JP')}
                      </time>
                    </div>
                  )}
                </div>
                <svg className="w-6 h-6 md:w-7 md:h-7 text-gray-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </div>
            </Link>
          ))}
        </div>

        {/* 記事総数表示 */}
        <div className="text-center mt-8 text-sm text-gray-500">
          全{allArticles.length}件の記事
        </div>

        {/* フッター - レスポンシブ対応 */}
        <div className="mt-12 md:mt-16 text-center">
          <Link
            href="/"
            className="inline-block bg-blue-600 hover:bg-blue-700 text-white px-8 md:px-10 py-3 md:py-4 rounded-lg font-bold transition-colors text-sm md:text-base"
          >
            ホームに戻る
          </Link>
        </div>
      </main>
    </div>
  );
}
