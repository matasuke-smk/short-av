import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
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
    // 画像の最適化設定
    formats: ['image/avif', 'image/webp'],
    minimumCacheTTL: 60 * 60 * 24 * 7, // 7日間キャッシュ
  },
};

export default nextConfig;
