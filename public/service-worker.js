// Service Worker Version
const VERSION = '1.0.0';
const CACHE_NAME = `short-av-v${VERSION}`;

// キャッシュするファイル
const urlsToCache = [
  '/',
  '/offline.html',
  '/manifest.json',
  '/icon-192x192.png',
  '/icon-512x512.png'
];

// インストール時の処理
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('Opened cache');
        return cache.addAll(urlsToCache);
      })
      .then(() => {
        self.skipWaiting();
      })
  );
});

// アクティベート時の処理
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      self.clients.claim();
    })
  );
});

// フェッチ時の処理
self.addEventListener('fetch', (event) => {
  // APIリクエストはキャッシュしない
  if (event.request.url.includes('/api/') ||
      event.request.url.includes('supabase') ||
      event.request.url.includes('dmm')) {
    return;
  }

  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        // キャッシュがあればそれを返す
        if (response) {
          return response;
        }

        // ネットワークリクエストを実行
        return fetch(event.request).then((response) => {
          // 正常なレスポンスでない場合はそのまま返す
          if (!response || response.status !== 200 || response.type !== 'basic') {
            return response;
          }

          // レスポンスをキャッシュに追加
          const responseToCache = response.clone();
          caches.open(CACHE_NAME)
            .then((cache) => {
              // 画像とCSSはキャッシュする
              if (event.request.url.match(/\.(jpg|jpeg|png|gif|webp|css|js)$/)) {
                cache.put(event.request, responseToCache);
              }
            });

          return response;
        });
      })
      .catch(() => {
        // オフライン時の処理
        if (event.request.destination === 'document') {
          return caches.match('/offline.html');
        }
      })
  );
});

// バックグラウンド同期
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-likes') {
    event.waitUntil(syncLikes());
  }
});

// プッシュ通知受信（将来の実装用）
self.addEventListener('push', (event) => {
  const options = {
    body: event.data ? event.data.text() : '新着動画があります',
    icon: '/icon-192x192.png',
    badge: '/icon-192x192.png',
    vibrate: [200, 100, 200],
    data: {
      dateOfArrival: Date.now(),
      primaryKey: 1
    }
  };

  event.waitUntil(
    self.registration.showNotification('Short AV', options)
  );
});

// 通知クリック時の処理
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    clients.openWindow('/')
  );
});

// いいねの同期処理
async function syncLikes() {
  // ローカルストレージのいいねデータをサーバーと同期
  // 実装はSupabase APIを使用
  console.log('Syncing likes...');
}