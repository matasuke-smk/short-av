'use client';

import { useState, useEffect } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export default function PWAInstaller() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showInstallBanner, setShowInstallBanner] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);

  useEffect(() => {
    console.log('PWA: Component mounted');

    // スタンドアロンモードかチェック
    const standalone = window.matchMedia('(display-mode: standalone)').matches ||
                      (window.navigator as any).standalone ||
                      document.referrer.includes('android-app://');
    setIsStandalone(standalone);

    if (standalone) {
      console.log('PWA: Already running in standalone mode');
      return;
    }

    // iOS検出
    const isIOSDevice = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
    setIsIOS(isIOSDevice);
    console.log('PWA: Device type:', isIOSDevice ? 'iOS' : 'Other');

    // Service Workerの登録
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/service-worker.js')
        .then((registration) => {
          console.log('PWA: Service Worker registered successfully', registration);
        })
        .catch((error) => {
          console.error('PWA: Service Worker registration failed:', error);
        });
    } else {
      console.log('PWA: Service Worker not supported');
    }

    // localStorageをクリア（デバッグ用）
    const clearStorage = () => {
      localStorage.removeItem('pwa-installed');
      localStorage.removeItem('pwa-install-dismissed');
      console.log('PWA: LocalStorage cleared');
    };

    // URLパラメータでデバッグモード
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('pwa-debug') === 'true') {
      clearStorage();
      console.log('PWA: Debug mode enabled - showing banner immediately');
      setShowInstallBanner(true);
      return;
    }

    // ローカルストレージチェック
    const isInstalled = localStorage.getItem('pwa-installed');
    const isDismissed = localStorage.getItem('pwa-install-dismissed');

    if (isInstalled) {
      console.log('PWA: App already installed (localStorage)');
      return;
    }

    if (isDismissed) {
      const dismissedTime = parseInt(isDismissed);
      const oneHourAgo = Date.now() - (60 * 60 * 1000); // 1時間後に再表示

      if (dismissedTime > oneHourAgo) {
        console.log('PWA: Banner was dismissed recently');
        return;
      } else {
        localStorage.removeItem('pwa-install-dismissed');
        console.log('PWA: Dismissed timeout expired');
      }
    }

    // インストールプロンプトイベントをキャッチ
    const handleBeforeInstallPrompt = (e: Event) => {
      console.log('PWA: beforeinstallprompt event fired!');
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setShowInstallBanner(true);
    };

    // アプリがインストールされたとき
    const handleAppInstalled = () => {
      console.log('PWA: App was installed');
      localStorage.setItem('pwa-installed', 'true');
      setShowInstallBanner(false);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    // 3秒後に強制表示（イベントが発火しない場合）
    const timer = setTimeout(() => {
      if (!showInstallBanner && !isInstalled && !isDismissed) {
        console.log('PWA: Showing banner after 3 seconds (fallback)');
        setShowInstallBanner(true);
      }
    }, 3000);

    return () => {
      clearTimeout(timer);
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const handleInstall = async () => {
    console.log('PWA: Install button clicked');

    if (isIOS) {
      // iOSの場合は手順を表示
      alert('ホーム画面への追加方法:\n\n1. Safari下部の共有ボタン（□↑）をタップ\n2. 「ホーム画面に追加」を選択\n3. 「追加」をタップ');
      return;
    }

    if (!deferredPrompt) {
      // プロンプトがない場合は手動インストール案内
      alert('ホーム画面への追加方法:\n\n【Chrome】\n1. 右上の「⋮」メニューをタップ\n2. 「ホーム画面に追加」を選択\n\n【その他のブラウザ】\nブラウザのメニューから「ホーム画面に追加」を選択してください');
      return;
    }

    try {
      // インストールプロンプトを表示
      await deferredPrompt.prompt();

      // ユーザーの選択を待つ
      const { outcome } = await deferredPrompt.userChoice;

      if (outcome === 'accepted') {
        console.log('PWA: User accepted the install prompt');
        localStorage.setItem('pwa-installed', 'true');
      } else {
        console.log('PWA: User dismissed the install prompt');
      }

      setShowInstallBanner(false);
      setDeferredPrompt(null);
    } catch (error) {
      console.error('PWA: Error showing install prompt:', error);
    }
  };

  const handleDismiss = () => {
    console.log('PWA: User dismissed banner');
    setShowInstallBanner(false);
    localStorage.setItem('pwa-install-dismissed', Date.now().toString());
  };

  // スタンドアロンモードの場合は非表示
  if (isStandalone) {
    return null;
  }

  // バナーを表示しない場合
  if (!showInstallBanner) {
    return (
      <div style={{ position: 'fixed', bottom: 10, right: 10, fontSize: '10px', color: '#666', zIndex: 9999 }}>
        PWA: Ready
      </div>
    );
  }

  // バナーを表示
  return (
    <div className="fixed bottom-20 left-4 right-4 md:left-auto md:right-4 md:w-96 bg-gray-900 border border-gray-700 rounded-xl p-4 shadow-2xl z-50">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <h3 className="text-white font-semibold mb-1">
            ホーム画面に追加
          </h3>
          <p className="text-gray-400 text-sm">
            {isIOS
              ? 'Safariの共有ボタンから追加できます'
              : 'アプリのように素早くアクセスできます'
            }
          </p>
        </div>
        <button
          onClick={handleDismiss}
          className="text-gray-500 hover:text-gray-300 ml-2"
          aria-label="閉じる"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div className="mt-3 flex gap-2">
        <button
          onClick={handleInstall}
          className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded-lg font-medium transition-colors"
        >
          ホームに追加
        </button>
        <button
          onClick={handleDismiss}
          className="flex-1 bg-gray-700 hover:bg-gray-600 text-white py-2 px-4 rounded-lg font-medium transition-colors"
        >
          後で
        </button>
      </div>
    </div>
  );
}