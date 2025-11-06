import type { NextConfig } from 'next';

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
    removeConsole: process.env.NODE_ENV === 'production',
  },

  // SWCトランスパイル設定（モダンブラウザ向け最適化）
  swcMinify: true,

  // 実験的機能（パフォーマンス改善）
  experimental: {
    optimizePackageImports: ['embla-carousel-react', '@supabase/supabase-js'],
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
        source: '/_next/image:path*',
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
