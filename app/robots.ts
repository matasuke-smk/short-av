import { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  const baseUrl = 'https://short-av.com';

  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          '/api/',           // APIエンドポイントをクロール対象外に
          '/*.json',         // JSONファイルを除外
          '/private/',       // プライベートディレクトリ（存在する場合）
          '/test-*',         // テストページを除外
          '/admin/',         // 管理ページを除外
          '/history',        // ユーザー固有の履歴ページを除外
          '/liked',          // ユーザー固有のいいね済みページを除外
        ],
      },
      {
        userAgent: 'GPTBot',  // OpenAI のボット
        disallow: '/',        // AI学習用のクロールを拒否
      },
      {
        userAgent: 'CCBot',   // Common Crawl のボット
        disallow: '/',        // AI学習用のクロールを拒否
      },
      {
        userAgent: 'anthropic-ai',  // Anthropic のボット
        disallow: '/',              // AI学習用のクロールを拒否
      },
      {
        userAgent: 'Google-Extended',  // Google Bard用
        disallow: '/',                  // AI学習用のクロールを拒否
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
