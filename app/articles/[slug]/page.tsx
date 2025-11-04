import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getArticleBySlug, getAllArticles } from '@/lib/articles';
import type { Metadata } from 'next';

type Props = {
  params: Promise<{ slug: string }>;
};

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
          url: '/og-image.jpg',
          width: 1200,
          height: 630,
          alt: article.title,
        },
      ],
      locale: 'ja_JP',
      type: 'article',
      publishedTime: article.publishedAt,
      modifiedTime: article.publishedAt,
      authors: ['Short AV'],
    },
    twitter: {
      card: 'summary_large_image',
      title: `${article.title} - Short AV`,
      description: article.description,
      images: ['/og-image.jpg'],
    },
  };
}

export default async function ArticlePage({ params }: Props) {
  const { slug } = await params;
  const article = getArticleBySlug(slug);

  if (!article) {
    notFound();
  }

  // 次の記事と前の記事を取得
  const allArticles = getAllArticles();
  const currentIndex = allArticles.findIndex(a => a.slug === slug);
  const nextArticle = currentIndex > 0 ? allArticles[currentIndex - 1] : null;
  const prevArticle = currentIndex < allArticles.length - 1 ? allArticles[currentIndex + 1] : null;

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
    dateModified: article.publishedAt,
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
      <main className="max-w-4xl mx-auto px-4 md:px-6 lg:px-8 py-8 md:py-12">
        <article>
          {/* タイトル */}
          <header className="mb-8 md:mb-12">
            <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold mb-4 md:mb-6 leading-tight">
              {article.title}
            </h1>
            <div className="flex items-center gap-4 text-sm text-gray-400">
              {article.category && (
                <span className="bg-gray-800 px-3 py-1 rounded">
                  {article.category}
                </span>
              )}
              <time dateTime={article.publishedAt}>
                {new Date(article.publishedAt).toLocaleDateString('ja-JP', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric'
                })}
              </time>
            </div>
          </header>

          {/* 本文 - レスポンシブ対応 */}
          <div className="prose prose-invert prose-lg md:prose-xl max-w-none">
            <div
              className="space-y-6 md:space-y-8 text-gray-300 leading-relaxed md:leading-loose text-base md:text-lg"
              dangerouslySetInnerHTML={{
                __html: article.content
                  .split('\n\n')
                  .map(para => {
                    // 見出し
                    if (para.startsWith('# ')) {
                      return `<h1 class="text-2xl md:text-3xl font-bold mt-8 mb-4 text-white">${para.substring(2)}</h1>`;
                    }
                    if (para.startsWith('## ')) {
                      return `<h2 class="text-xl md:text-2xl font-bold mt-6 mb-3 text-white">${para.substring(3)}</h2>`;
                    }
                    if (para.startsWith('### ')) {
                      return `<h3 class="text-lg md:text-xl font-bold mt-4 mb-2 text-white">${para.substring(4)}</h3>`;
                    }

                    // 表（Markdown table）をカード形式に変換
                    if (para.includes('|') && para.split('\n').length > 2) {
                      const lines = para.split('\n').filter(line => line.trim());
                      if (lines.length >= 2 && lines[1].includes('---')) {
                        const headers = lines[0].split('|').map(h => h.trim()).filter(h => h);
                        const rows = lines.slice(2).map(line =>
                          line.split('|').map(cell => cell.trim()).filter(cell => cell !== '')
                        );

                        // カード形式でレンダリング（スマホに最適）
                        let cardsHTML = '<div class="space-y-4 my-6">';
                        rows.forEach((row, index) => {
                          cardsHTML += '<div class="bg-gray-800 border border-gray-700 rounded-lg p-4 hover:border-gray-600 transition-colors">';
                          row.forEach((cell, cellIndex) => {
                            if (cellIndex < headers.length) {
                              const header = headers[cellIndex].replace(/\*\*(.+?)\*\*/g, '$1');
                              let processed = cell.replace(/\*\*(.+?)\*\*/g, '<strong class="font-bold text-white">$1</strong>');
                              processed = processed.replace(/<br>/g, '<br class="my-1">');

                              // 最初の項目は大きく表示
                              if (cellIndex === 0) {
                                cardsHTML += `<div class="text-lg font-bold text-white mb-3 pb-3 border-b border-gray-700">${processed}</div>`;
                              } else {
                                cardsHTML += `<div class="flex justify-between items-start py-2 border-b border-gray-700/50 last:border-0">`;
                                cardsHTML += `<span class="text-sm text-gray-400 font-medium">${header}</span>`;
                                cardsHTML += `<span class="text-sm text-gray-200 text-right ml-4">${processed}</span>`;
                                cardsHTML += `</div>`;
                              }
                            }
                          });
                          cardsHTML += '</div>';
                        });
                        cardsHTML += '</div>';
                        return cardsHTML;
                      }
                    }

                    // リスト
                    if (para.startsWith('- ')) {
                      const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
                      const items = para.split('\n').map(line => {
                        if (line.startsWith('- ')) {
                          let content = line.substring(2);
                          content = content.replace(/\*\*(.+?)\*\*/g, '<strong class="font-bold text-white">$1</strong>');
                          const withLinks = content.replace(linkRegex, '<a href="$2" class="text-blue-400 hover:text-blue-300 underline">$1</a>');
                          return `<li class="ml-4">${withLinks}</li>`;
                        }
                        return line;
                      }).join('');
                      return `<ul class="list-disc ml-6 space-y-2">${items}</ul>`;
                    }

                    // 通常の段落 - 太字とリンクを処理
                    let processed = para.replace(/\*\*(.+?)\*\*/g, '<strong class="font-bold text-white">$1</strong>');
                    const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
                    processed = processed.replace(linkRegex, '<a href="$2" class="text-blue-400 hover:text-blue-300 underline">$1</a>');

                    return `<p class="mb-4">${processed}</p>`;
                  })
                  .join('')
              }}
            />
          </div>
        </article>

        {/* 次の記事/前の記事ナビゲーション */}
        {(nextArticle || prevArticle) && (
          <nav className="mt-12 md:mt-16 pt-8 md:pt-12 border-t border-gray-800">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* 前の記事 */}
              {prevArticle ? (
                <Link
                  href={`/articles/${prevArticle.slug}`}
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
                </Link>
              ) : (
                <div className="hidden md:block"></div>
              )}

              {/* 次の記事 */}
              {nextArticle && (
                <Link
                  href={`/articles/${nextArticle.slug}`}
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
                </Link>
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
    </div>
  );
}
