export interface Article {
  slug: string;
  title: string;
  description: string;
  content: string;
  publishedAt: string;
  /** 内容を見直した日（なければ publishedAt を使う） */
  updatedAt?: string;
  category?: string;
  /** 記事一覧の最上部に固定する */
  pinned?: boolean;
  /** この記事専用の OG 画像（X などのリンクカード）。なければサイト共通の /og-image.jpg */
  ogImage?: string;
}
