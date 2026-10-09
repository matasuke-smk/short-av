// GA はページの <head> で読み込む（app/layout.tsx）。以前は next/script の afterInteractive で、
// 画面の準備（hydration）が終わってから読み込んでいたため、それより前に閉じた人（X のアプリ内ブラウザで多い）が記録されず、
// X の投稿のリンクのクリック数より訪問が大幅に少なく出ていた（2026-10-09）
export default function GoogleAnalytics() {
  const measurementId = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;

  // 測定IDが設定されていない場合は何も表示しない
  if (!measurementId) {
    return null;
  }

  const config = `
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
            // （以前は short-av.com 以外をすべて除外していたため、www.short-av.com から来た利用者まで除外していた）
            internal = localStorage.getItem('short-av-internal') === '1'
              || document.cookie.split('; ').indexOf('sav_admin_ui=1') >= 0
              || /\\.vercel\\.app$|^localhost$|^127\\.0\\.0\\.1$/.test(location.hostname);
          } catch (e) {}

          gtag('config', '${measurementId}', internal ? { traffic_type: 'internal' } : {});
`;

  return (
    <>
      <script async src={`https://www.googletagmanager.com/gtag/js?id=${measurementId}`} />
      <script id="google-analytics" dangerouslySetInnerHTML={{ __html: config }} />
    </>
  );
}
