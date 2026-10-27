import { MetadataRoute } from 'next';

// 一般の検索エンジン向けに閉じるページ（管理画面・API・利用者ごとのページ）
const DISALLOW = [
  '/api/',           // APIエンドポイントをクロール対象外に
  '/go',             // FANZA への転送（lib/go-link.ts）。ロボットにたどらせない（2026-10-27）
  '/*.json',         // JSONファイルを除外
  '/private/',       // プライベートディレクトリ（存在する場合）
  '/test-*',         // テストページを除外
  '/admin/',         // 管理ページを除外
  '/history',        // ユーザー固有の履歴ページを除外
  '/liked',          // ユーザー固有のいいね済みページを除外
];

/**
 * AI の「検索・回答」に使われるボット（学習用ではない）は、一般の検索エンジンと同じ範囲で明示的に許可する（2026-10-24）。
 * ChatGPT からの訪問が 10/16 ごろから増えていて（4週間で約190セッション、滞在5分・15ページ）、この流れを伸ばすため。
 * robots.txt は「いちばん具体的に当てはまる User-Agent の組だけ」を読むボットが多いので、
 * 「*」で許可していても、ここに名前を挙げて同じ内容を書いておく（GPTBot など学習用のボットは引き続き拒否）
 */
const AI_SEARCH_BOTS = [
  'OAI-SearchBot',    // ChatGPT の検索（回答に出すサイトを集める）
  'ChatGPT-User',     // ChatGPT が回答のためにその場でページを読む
  'PerplexityBot',
  'Perplexity-User',
  'Claude-SearchBot',
  'Claude-User',
  'DuckAssistBot',
  'Applebot',
];

export default function robots(): MetadataRoute.Robots {
  const baseUrl = 'https://short-av.com';

  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: DISALLOW,
      },
      ...AI_SEARCH_BOTS.map((userAgent) => ({ userAgent, allow: '/', disallow: DISALLOW })),
      {
        userAgent: 'GPTBot',  // OpenAI のボット
        disallow: '/',        // AI学習用のクロールを拒否
      },
      {
        userAgent: 'CCBot',   // Common Crawl のボット
        disallow: '/',        // AI学習用のクロールを拒否
      },
      {
        userAgent: 'anthropic-ai',  // Anthropic のボット（古い名前。今は ClaudeBot）
        disallow: '/',              // AI学習用のクロールを拒否
      },
      {
        userAgent: 'ClaudeBot',  // Anthropic の学習用（2026-10-24〜25 の6時間で 428 回。Claude-User・Claude-SearchBot は許可のまま）
        disallow: '/',
      },
      {
        userAgent: 'meta-externalagent',  // Meta（Facebook）の AI 学習用（同じ6時間で 2,548 回。女優ページの作品ごとの URL を片っ端に読み、トップを毎回描画させていた）
        disallow: '/',
      },
      {
        userAgent: 'meta-webindexer',  // Meta AI の検索用（10/27 に1時間で約480回。/go の禁止も守らず開いていた。人の訪問は0。Meta のアプリのリンクのカードは facebookexternalhit なので影響しない）
        disallow: '/',
      },
      {
        userAgent: 'Amazonbot',  // Amazon の AI の学習などに使う（10/25 28回 → 10/27 約3,900回。Amazon からの人の訪問は0。Alexa+ は性的な内容を出さない方針。2026-10-27 拒否）
        disallow: '/',
      },
      {
        userAgent: 'Google-Extended',  // Google Bard用
        disallow: '/',                  // AI学習用のクロールを拒否
      },
    ],
    sitemap: [`${baseUrl}/sitemap.xml`, `${baseUrl}/sitemap-videos.xml`],
  };
}
