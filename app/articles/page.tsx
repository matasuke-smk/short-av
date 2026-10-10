import Link from 'next/link';
import { getAllArticles, getArticleModifiedAt, getArticleEyecatch } from '@/lib/articles';
import ArticleLink from './ArticleLink';
import SwipeBanner from './SwipeBanner';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: '記事一覧 - Short AV使い方完全ガイド',
  description: 'Short AV の使い方（スワイプ・検索・いいね・履歴）、FANZA で安く買う方法と購入の流れ、サンプル動画の長い作品や今週の人気作の一覧、サイズ比較ツールなど男性の体と性の知識まで。FANZA のサンプル動画を楽しむための記事をまとめています。',
  alternates: {
    canonical: '/articles',
  },
  openGraph: {
    title: '記事一覧 - Short AV使い方完全ガイド',
    description: 'Short AV の使い方、FANZA で安く買う方法、サンプル動画の長い作品や人気作の一覧、サイズ比較ツールなど男性の体と性の知識の記事をまとめています。',
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
    description: 'Short AV の使い方、FANZA で安く買う方法、サンプル動画の長い作品や人気作の一覧、サイズ比較ツールなど男性の体と性の知識の記事をまとめています。',
    images: ['/og-image.jpg'],
  },
};

const dateLabel = (iso: string) => {
  const d = new Date(iso);
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
};

// ページネーションなし：全記事を1ページに出す（クローラーが全記事をたどれるように）
// 見た目は note のような白地・余白多め・罫線だけの一覧（色付きのカードは使わない）
export default async function ArticlesPage() {
  // ちんこ偏差値チェッカー（pinned）が先頭、以降は公開日の新しい順
  const articles = getAllArticles();

  return (
    <div className="min-h-screen bg-white text-gray-900">
      <header className="bg-white/95 backdrop-blur border-b border-gray-100 sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-5 md:px-8 py-3 flex items-center justify-between">
          <h1 className="text-base font-bold">記事</h1>
          <Link href="/" className="text-sm font-bold tracking-wide text-gray-900">Short AV</Link>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-5 md:px-8 py-8 md:py-12">
        {/* サイトの本体（スワイプ画面）への誘導バナー */}
        <SwipeBanner place="list" />

        <p className="mt-8 md:mt-10 text-gray-700 text-base md:text-lg leading-relaxed">
          Short AV の使い方、FANZA で安く買う方法、男性の体と性の知識について書いています。
        </p>
        <p className="mt-2 mb-6 md:mb-8 text-xs text-gray-400">
          ※本ページはプロモーション（広告）を含みます。
        </p>

        <div className="divide-y divide-gray-100 border-t border-b border-gray-100">
          {articles.map((article) => (
            <ArticleLink
              key={article.slug}
              article={article}
              className="group block py-5 md:py-7"
            >
              <div className="flex items-start justify-between gap-4 md:gap-8">
                <div className="min-w-0 flex-1">
                  {article.pinned && (
                    <p className="text-xs font-bold text-gray-500 mb-2">ツール</p>
                  )}
                  <h2 className="text-lg md:text-2xl font-bold leading-snug text-gray-900 group-hover:text-gray-600 transition-colors whitespace-pre-line">
                    {article.title}
                  </h2>
                  <p className="mt-2 text-sm md:text-base text-gray-500 leading-relaxed line-clamp-2">
                    {article.description}
                  </p>
                  {!article.pinned && (
                    <div className="mt-3 flex items-center gap-3 text-xs text-gray-400">
                      {article.category && <span>{article.category}</span>}
                      <time dateTime={getArticleModifiedAt(article)}>
                        {dateLabel(getArticleModifiedAt(article))}
                        {article.updatedAt && article.updatedAt !== article.publishedAt && ' 更新'}
                      </time>
                    </div>
                  )}
                </div>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={getArticleEyecatch(article)}
                  alt=""
                  loading="lazy"
                  width={1200}
                  height={630}
                  className="w-24 md:w-44 aspect-[1200/630] rounded-lg object-cover flex-shrink-0 group-hover:opacity-90 transition-opacity"
                />
              </div>
            </ArticleLink>
          ))}
        </div>

        <p className="text-center mt-6 text-xs text-gray-400">
          全{articles.length}件
        </p>

        <div className="mt-10 md:mt-14 text-center">
          <Link
            href="/"
            className="inline-block bg-gray-900 hover:bg-gray-700 text-white px-8 py-3 rounded-full font-bold transition-colors text-sm"
          >
            スワイプ画面を開く
          </Link>
        </div>
      </main>
    </div>
  );
}
