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
      {/* ヘッダー */}
      <header className="bg-gray-800 border-b border-gray-700 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <Link
              href="/articles"
              className="text-gray-400 hover:text-white transition-colors"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
            </Link>
            <h1 className="text-lg font-bold line-clamp-1">記事</h1>
          </div>
        </div>
      </header>

      {/* コンテンツ */}
      <main className="max-w-4xl mx-auto px-4 py-8">
        <article>
          {/* タイトル */}
          <header className="mb-8">
            <h1 className="text-3xl md:text-4xl font-bold mb-4">
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

          {/* 本文 */}
          <div className="prose prose-invert prose-lg max-w-none">
            <div
              className="space-y-6 text-gray-300 leading-relaxed"
              dangerouslySetInnerHTML={{
                __html: article.content
                  .split('\n\n')
                  .map(para => {
                    // 見出し
                    if (para.startsWith('# ')) {
                      return `<h1 class="text-3xl font-bold mt-8 mb-4 text-white">${para.substring(2)}</h1>`;
                    }
                    if (para.startsWith('## ')) {
                      return `<h2 class="text-2xl font-bold mt-6 mb-3 text-white">${para.substring(3)}</h2>`;
                    }
                    if (para.startsWith('### ')) {
                      return `<h3 class="text-xl font-bold mt-4 mb-2 text-white">${para.substring(4)}</h3>`;
                    }
                    // リスト
                    if (para.startsWith('- ')) {
                      const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
                      const items = para.split('\n').map(line => {
                        if (line.startsWith('- ')) {
                          const content = line.substring(2);
                          const withLinks = content.replace(linkRegex, '<a href="$2" class="text-blue-400 hover:text-blue-300 underline">$1</a>');
                          return `<li class="ml-4">${withLinks}</li>`;
                        }
                        return line;
                      }).join('');
                      return `<ul class="list-disc ml-6 space-y-2">${items}</ul>`;
                    }
                    // リンク
                    const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
                    const withLinks = para.replace(linkRegex, '<a href="$2" class="text-blue-400 hover:text-blue-300 underline">$1</a>');

                    // 通常の段落
                    return `<p class="mb-4">${withLinks}</p>`;
                  })
                  .join('')
              }}
            />
          </div>
        </article>

        {/* フッター */}
        <footer className="mt-12 pt-8 border-t border-gray-800">
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/articles"
              className="inline-block bg-gray-800 hover:bg-gray-700 text-white px-8 py-3 rounded-lg font-bold transition-colors text-center"
            >
              記事一覧に戻る
            </Link>
            <Link
              href="/"
              className="inline-block bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 rounded-lg font-bold transition-colors text-center"
            >
              ホームに戻る
            </Link>
          </div>
        </footer>
      </main>
    </div>
  );
}
