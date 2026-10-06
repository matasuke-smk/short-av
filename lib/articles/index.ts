import { articles } from './registry';
import type { Article } from './types';

export type { Article } from './types';

/** 最終更新日（更新日がなければ公開日） */
export function getArticleModifiedAt(article: Article): string {
  return article.updatedAt ?? article.publishedAt;
}

export function getArticleBySlug(slug: string): Article | undefined {
  return articles.find(article => article.slug === slug);
}

export function getAllArticles(): Article[] {
  // 固定記事を先頭に、それ以外は公開日の新しい順（同日は slug 順で安定させる）
  return [...articles].sort((a, b) => {
    if (!!a.pinned !== !!b.pinned) return a.pinned ? -1 : 1;
    const byDate = new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime();
    return byDate !== 0 ? byDate : a.slug.localeCompare(b.slug);
  });
}
