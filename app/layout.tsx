import type { Metadata, Viewport } from 'next';
import { Noto_Sans_JP } from 'next/font/google';
import './globals.css';
import AgeVerificationGate from './components/AgeVerificationGate';
import GoogleAnalytics from './components/GoogleAnalytics';
import PWAInstaller from './components/PWAInstaller';

const notoSansJP = Noto_Sans_JP({
  subsets: ['latin'],
  weight: ['400', '500', '700'],
  display: 'swap',
  preload: true,
  variable: '--font-noto-sans-jp',
});

export const metadata: Metadata = {
  title: 'Short AV - DMM動画レビュー＆紹介サイト | スワイプで楽しむ次世代UI',
  description: 'DMM動画を紹介するレビューサイト。縦スワイプで快適に閲覧！SNS感覚で使えるシンプルなUI、いいね機能、高度な検索で好みの作品をすぐに発見。会員登録不要で今すぐ使えます。',
  metadataBase: new URL('https://short-av.com'),
  alternates: {
    canonical: '/',
  },
  openGraph: {
    title: 'Short AV - DMM動画レビュー＆紹介サイト',
    description: 'DMM動画を紹介するレビューサイト。縦スワイプで快適に閲覧！SNS感覚で使えるシンプルなUI、いいね機能、高度な検索で好みの作品をすぐに発見。',
    url: 'https://short-av.com',
    siteName: 'Short AV',
    images: [
      {
        url: '/og-image.jpg',
        width: 1200,
        height: 630,
        alt: 'Short AV - DMMの人気動画をスワイプ操作で楽しめる',
      },
    ],
    locale: 'ja_JP',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Short AV - DMM動画レビュー＆紹介サイト',
    description: 'DMM動画を紹介するレビューサイト。縦スワイプで快適に閲覧！SNS感覚で使えるシンプルなUI、いいね機能、高度な検索で好みの作品をすぐに発見。',
    images: ['/og-image.jpg'],
  },
  verification: {
    google: 'F-asv0z8G7ZwTAzxpXpo2eMwuJloEIX29Blj_IszMMI',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  viewportFit: 'cover',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const organizationSchema = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'Short AV',
    url: 'https://short-av.com',
    logo: 'https://short-av.com/logo.png',
    description: 'DMM動画を紹介するレビューサイト。スワイプ操作で快適に閲覧できる次世代UI',
    sameAs: [
      // SNSアカウントがあれば追加
    ],
  };

  return (
    <html lang="ja" className={notoSansJP.variable}>
      <head>
        {/* PWA設定 */}
        <link rel="manifest" href="/manifest.json" />
        <link rel="apple-touch-icon" href="/icon-192x192.svg" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="theme-color" content="#000000" />

        {/* DMM画像サーバーへの事前接続でLCP改善 */}
        <link rel="dns-prefetch" href="https://pics.dmm.co.jp" />
        <link rel="preconnect" href="https://pics.dmm.co.jp" />
        <link rel="dns-prefetch" href="https://pics.dmm.com" />
        <link rel="preconnect" href="https://pics.dmm.com" />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationSchema) }}
        />
      </head>
      <body className={`${notoSansJP.className} antialiased`}>
        <GoogleAnalytics />
        <AgeVerificationGate />
        {/* <PWAInstaller /> */}
        {children}
      </body>
    </html>
  );
}
