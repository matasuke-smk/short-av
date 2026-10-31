import type { Metadata, Viewport } from 'next';
import './globals.css';
import AgeVerificationGate from './components/AgeVerificationGate';
import GoogleAnalytics from './components/GoogleAnalytics';
import PWAInstaller from './components/PWAInstaller';
import AdminUserSync from './components/AdminUserSync';


export const metadata: Metadata = {
  // ChatGPT に「サンプルが長い作品を探す方法」を聞くと「FANZA にその機能は無い」と答え、縦スワイプのサイトとしては
  // 似たサイトが紹介されていた（2026-10-31 に試した）。ほかに無い「長いサンプルだけ」を先頭に出す。以前は「レビュー」「次世代UI」
  title: 'Short AV｜FANZAのサンプル動画が4分以上・3分以上の作品だけを縦スワイプで無料視聴',
  description: 'FANZA（DMM）のサンプル動画が4分以上・3分以上ある作品だけを選んで、スマホの縦スワイプで次々と見られる無料サイト。毎日サンプルの長さを測って記録。会員登録不要。女優・ジャンル別のページ、同人誌の試し読みも。',
  metadataBase: new URL('https://short-av.com'),
  // ホーム画面に追加したときの設定。管理画面（app/admin/layout.tsx）では別のものに差し替える
  manifest: '/manifest.json',
  alternates: {
    canonical: '/',
  },
  openGraph: {
    title: 'Short AV｜サンプルが長いFANZA作品だけを縦スワイプで',
    description: 'FANZA（DMM）のサンプル動画が4分以上・3分以上ある作品だけを選んで、スマホの縦スワイプで次々と見られる無料サイト。毎日サンプルの長さを測って記録。会員登録不要。女優・ジャンル別のページ、同人誌の試し読みも。',
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
    title: 'Short AV｜サンプルが長いFANZA作品だけを縦スワイプで',
    description: 'FANZA（DMM）のサンプル動画が4分以上・3分以上ある作品だけを選んで、スマホの縦スワイプで次々と見られる無料サイト。毎日サンプルの長さを測って記録。会員登録不要。女優・ジャンル別のページ、同人誌の試し読みも。',
    images: ['/og-image.jpg'],
  },
  verification: {
    google: 'F-asv0z8G7ZwTAzxpXpo2eMwuJloEIX29Blj_IszMMI',
    // JuicyAds（海外からの訪問者向けの広告）のサイト確認（2026-10-11）
    other: { 'juicyads-site-verification': '059e695d70fa9ebe73a4b44b0fc1bb2a' },
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
    description: 'FANZA（DMM）のサンプル動画が長い作品だけを縦スワイプで見られる無料サイト（会員登録不要）',
    sameAs: [
      // SNSアカウントがあれば追加
    ],
  };

  return (
    <html lang="ja">
      <head>
        <GoogleAnalytics />
        {/* PWA設定 */}
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
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
      <body className="antialiased">
        <AgeVerificationGate />
        <AdminUserSync />
        {/* <PWAInstaller /> */}
        {children}
      </body>
    </html>
  );
}
