import Link from 'next/link';
import { getAllArticles } from '@/lib/articles';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: '記事一覧 - Short AV',
  description: 'Short AVの使い方や機能について解説した記事一覧です。',
  alternates: {
    canonical: '/articles',
  },
  openGraph: {
    title: '記事一覧 - Short AV',
    description: 'Short AVの使い方や機能について解説した記事一覧です。',
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
    title: '記事一覧 - Short AV',
    description: 'Short AVの使い方や機能について解説した記事一覧です。',
    images: ['/og-image.jpg'],
  },
};

export default function ArticlesPage() {
  const articles = getAllArticles();

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* ヘッダー */}
      <header className="bg-gray-800 border-b border-gray-700 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold">記事一覧</h1>
            <Link
              href="/"
              className="text-gray-400 hover:text-white transition-colors"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </Link>
          </div>
        </div>
      </header>

      {/* コンテンツ */}
      <main className="max-w-4xl mx-auto px-4 py-8">
        <p className="text-gray-400 mb-8">
          Short AVの使い方や便利な機能について解説しています。
        </p>

        {/* 記事一覧 */}
        <div className="space-y-4">
          {articles.map((article) => (
            <Link
              key={article.slug}
              href={`/articles/${article.slug}`}
              className="block bg-gray-800 hover:bg-gray-700 rounded-lg p-6 transition-colors border border-gray-700"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <h2 className="text-xl font-bold mb-2 text-white">
                    {article.title}
                  </h2>
                  <p className="text-gray-400 mb-3">
                    {article.description}
                  </p>
                  <div className="flex items-center gap-4 text-sm text-gray-500">
                    {article.category && (
                      <span className="bg-gray-700 px-2 py-1 rounded text-xs">
                        {article.category}
                      </span>
                    )}
                    <time dateTime={article.publishedAt}>
                      {new Date(article.publishedAt).toLocaleDateString('ja-JP')}
                    </time>
                  </div>
                </div>
                <svg className="w-6 h-6 text-gray-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </div>
            </Link>
          ))}
        </div>

        {/* フッター */}
        <div className="mt-12 text-center">
          <Link
            href="/"
            className="inline-block bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 rounded-lg font-bold transition-colors"
          >
            ホームに戻る
          </Link>
        </div>
      </main>
    </div>
  );
}
