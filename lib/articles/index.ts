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

/** 記事のアイキャッチ画像（記事一覧・記事ページの見出し・OG 画像に使う）。専用の OG 画像がある記事はそれ、なければ docs/eyecatch/build.js で生成したもの */
export function getArticleEyecatch(article: Article): string {
  return article.ogImage ?? `/eyecatch/${article.slug}.png`;
}
