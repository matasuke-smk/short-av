import type { NextConfig } from 'next';

// 削除・統合した記事 → 転送先の記事（null は記事一覧）
const ARTICLE_REDIRECTS: Record<string, string | null> = {
  // 2026-10-06 に削除
  'penis-traction-complete-guide': 'japanese-penis-size-data',
  'japanese-men-condom-size-data': 'condom-size-guide',
  'av-industry-trends-2024': 'adult-industry-knowledge',
  // 使い方の記事は2本に
  features: 'getting-started',
  'tips-tricks': 'getting-started',
  'smartphone-guide': 'getting-started',
  'pc-usage-guide': 'getting-started',
  'tablet-guide': 'getting-started',
  'data-saving-tips': 'getting-started',
  'best-viewing-environment': 'getting-started',
  'privacy-security': 'faq',
  'safe-browsing': 'faq',
  // FANZA・作品の探し方
  'dmm-smart-buying': 'fanza-save-money',
  'dmm-rental-vs-purchase': 'fanza-save-money',
  'genre-guide': 'how-to-choose-videos',
  'series-guide': 'adult-industry-knowledge',
  'popular-actresses': 'adult-industry-knowledge',
  // 性の知識（まとめた記事）
  'penis-size-satisfaction-truth': 'japanese-penis-size-data',
  'size-matters-less-survey': 'japanese-penis-size-data',
  'penis-enlargement-complete-analysis': 'japanese-penis-size-data',
  'second-round-techniques': 'refractory-period-by-age',
  'quality-over-duration-three-points': 'sex-duration-average-reality',
  'ejaculation-control-mastery': 'premature-ejaculation-solutions',
  'male-grooming-body-hair': 'male-vio-depilation-guide',
  'contraception-proper-usage': 'std-risk-reduction-methods',
  // 性の知識（削除）
  'baldness-attractiveness': null,
  'body-type-female-preference': null,
  'erectile-dysfunction-mid-sex': null,
  'erectile-strength-foods': null,
  'female-dissatisfaction-patterns': 'sex-duration-average-reality',
  'female-orgasm-rate-reality': 'sex-duration-average-reality',
  'female-pleasure-points-gspot-truth': null,
  'first-experience-age-data': null,
  'kissing-technique-difference': null,
  'libido-decline-causes': null,
  'male-infertility-reality': null,
  'male-multiple-orgasms-guide': 'refractory-period-by-age',
  'masturbation-frequency-balance': null,
  'mood-creation-science': null,
  'morning-erection-health': null,
  'morning-erections-health-indicator': null,
  'phimosis-medical-facts': null,
  'phimosis-surgery-truth': null,
  'sauna-and-male-health': null,
  'sexless-marriage-solutions': null,
  'sexual-desire-peak-age': null,
};

const nextConfig: NextConfig = {
  // 画像最適化設定
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'pics.dmm.co.jp',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'pics.dmm.com',
        pathname: '/**',
      },
    ],
    formats: ['image/avif', 'image/webp'],
    minimumCacheTTL: 60 * 60 * 24 * 7, // 7日間キャッシュ
    deviceSizes: [640, 750, 828, 1080, 1200],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
  },

  // パフォーマンス最適化
  compiler: {
    // console.error / warn / info は本番でも残す（Vercelのログで障害を追えるように）
    removeConsole: process.env.NODE_ENV === 'production' ? { exclude: ['error', 'warn', 'info'] } : false,
  },

  // 実験的機能（パフォーマンス改善）
  experimental: {
    optimizePackageImports: ['embla-carousel-react', '@supabase/supabase-js'],
  },

  // www 付きのアクセスの統一と、削除した記事の転送（検索エンジンや外部リンクからの流入を 404 にしない）
  // 作品ページの別名 URL（検索エンジン向けの正規 URL）。/v/作品番号 → /?v=作品番号、/d/作品番号 → 同人誌モード。
  // Next.js は正規 URL のパスが「/」だと ?v= を捨ててトップの URL にしてしまうため、パス型の URL を正規にする。
  // X などで告知してきた /?v= のリンクはそのまま使える
  async rewrites() {
    return [
      { source: '/v/:id', destination: '/?v=:id' },
      { source: '/d/:id', destination: '/?mode=doujin&d=:id' },
    ];
  },
  async redirects() {
    return [
      // www 付きで来たアクセスは short-av.com に統一する（同じページが2つの URL で評価されるのを防ぐ）
      {
        source: '/:path*',
        has: [{ type: 'host' as const, value: 'www.short-av.com' }],
        destination: 'https://short-av.com/:path*',
        permanent: true,
      },
      // 2026-10-07 の記事の整理で、まとめた記事・削除した記事は内容の近い記事へ（近いものがなければ記事一覧へ）
      ...Object.entries(ARTICLE_REDIRECTS).map(([slug, to]) => ({
        source: `/articles/${slug}`,
        destination: to ? `/articles/${to}` : '/articles',
        permanent: true,
      })),
    ];
  },

  // ヘッダーの最適化（キャッシュ制御）
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'X-DNS-Prefetch-Control',
            value: 'on',
          },
          {
            key: 'X-Frame-Options',
            value: 'SAMEORIGIN',
          },
        ],
      },
      {
        source: '/fonts/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
      // 静的アセット（JS、CSS）のキャッシュ
      {
        source: '/_next/static/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
      // 画像のキャッシュ（Vercel経由の画像）
      {
        source: '/_next/image',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=86400, must-revalidate', // 1日キャッシュ
          },
        ],
      },
    ];
  },
};

export default nextConfig;
