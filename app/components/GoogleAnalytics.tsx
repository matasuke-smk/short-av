'use client';

import Script from 'next/script';

export default function GoogleAnalytics() {
  const measurementId = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;

  // 測定IDが設定されていない場合は何も表示しない
  if (!measurementId) {
    return null;
  }

  return (
    <>
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${measurementId}`}
        strategy="lazyOnload"
      />
      <Script id="google-analytics" strategy="lazyOnload">
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('js', new Date());

          // 運営者の端末からのアクセスを集計から除く（GA の「Internal Traffic」データフィルタで traffic_type=internal を除外している）
          // その端末で一度 ?sav_owner=on を付けて開くと記録され、?sav_owner=off で解除できる
          var internal = false;
          try {
            var url = new URL(window.location.href);
            var owner = url.searchParams.get('sav_owner');
            if (owner === 'on') localStorage.setItem('short-av-internal', '1');
            if (owner === 'off') localStorage.removeItem('short-av-internal');
            if (owner) {
              url.searchParams.delete('sav_owner');
              history.replaceState(history.state, '', url.toString());
            }
            // 管理画面にログインしている端末、本番以外（Vercel のプレビュー・ローカル）からのアクセスも運営者として扱う
            internal = localStorage.getItem('short-av-internal') === '1'
              || document.cookie.split('; ').indexOf('sav_admin_ui=1') >= 0
              || location.hostname !== 'short-av.com';
          } catch (e) {}

          gtag('config', '${measurementId}', internal ? { traffic_type: 'internal' } : {});
        `}
      </Script>
    </>
  );
}
