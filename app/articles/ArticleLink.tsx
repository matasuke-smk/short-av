import Link from 'next/link';
import type { ReactNode } from 'react';
import type { Article } from '@/lib/articles';
import { isInteractiveArticle } from '@/lib/articles/markdown';

/**
 * 記事へのリンク
 * ツール記事（サイズ比較ツール）は本文の <script> がクライアント遷移では実行されないため、通常のページ遷移にする
 */
export default function ArticleLink({
  article,
  className,
  children,
}: {
  article: Article;
  className?: string;
  children: ReactNode;
}) {
  const href = `/articles/${article.slug}`;
  if (isInteractiveArticle(article.content)) {
    return <a href={href} className={className}>{children}</a>;
  }
  return <Link href={href} className={className}>{children}</Link>;
}

export function formatDate(date: string): string {
  return new Date(date).toLocaleDateString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric' });
}
