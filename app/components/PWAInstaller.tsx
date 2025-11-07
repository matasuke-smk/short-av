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
  const [debugInfo, setDebugInfo] = useState<string[]>([]);

  useEffect(() => {
    // デバッグ情報を追加
    const debug: string[] = [];

    // スタンドアロンモードかチェック
    const standalone = window.matchMedia('(display-mode: standalone)').matches ||
                      (window.navigator as any).standalone ||
                      document.referrer.includes('android-app://');
    setIsStandalone(standalone);

    if (standalone) {
      debug.push('App is running in standalone mode');
      console.log('PWA: Already running as installed app');
      return;
    }

    // iOS検出
    const isIOSDevice = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
    setIsIOS(isIOSDevice);
    debug.push(`Device: ${isIOSDevice ? 'iOS' : 'Other'}`);

    // Service Workerの登録
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/service-worker.js')
        .then((registration) => {
          debug.push('Service Worker registered successfully');
          console.log('Service Worker registered:', registration);
        })
        .catch((error) => {
          debug.push(`Service Worker registration failed: ${error.message}`);
          console.error('Service Worker registration failed:', error);
        });
    } else {
      debug.push('Service Worker not supported');
    }

    // ローカルストレージチェック
    const isInstalled = localStorage.getItem('pwa-installed');
    const isDismissed = localStorage.getItem('pwa-install-dismissed');

    if (isInstalled) {
      debug.push('App marked as installed in localStorage');
    }

    if (isDismissed) {
      const dismissedTime = new Date(parseInt(isDismissed));
      debug.push(`Banner dismissed at: ${dismissedTime.toLocaleString()}`);

      // 1日後に再表示（テスト用に短縮）
      const oneDayAgo = Date.now() - (24 * 60 * 60 * 1000);
      if (parseInt(isDismissed) < oneDayAgo) {
        localStorage.removeItem('pwa-install-dismissed');
        debug.push('Dismissed timeout expired, showing banner again');
      }
    }

    setDebugInfo(debug);

    // iOSの場合は手動インストール案内を表示
    if (isIOSDevice) {
      if (!isInstalled && !isDismissed) {
        setTimeout(() => {
          setShowInstallBanner(true);
          console.log('PWA: Showing iOS install instructions');
        }, 2000); // 2秒後に表示
      }
      return;
    }

    // インストールプロンプトイベントをキャッチ
    const handleBeforeInstallPrompt = (e: Event) => {
      console.log('PWA: beforeinstallprompt fired');
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);

      if (!isInstalled && !isDismissed) {
        setShowInstallBanner(true);
        debug.push('Install prompt captured, showing banner');
      }
    };

    // アプリがインストールされたとき
    const handleAppInstalled = () => {
      console.log('PWA: App installed');
      localStorage.setItem('pwa-installed', 'true');
      setShowInstallBanner(false);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    // 手動でバナーを表示（テスト用）- 5秒後に条件チェック
    setTimeout(() => {
      if (!deferredPrompt && !isInstalled && !isDismissed && !isIOSDevice) {
        console.log('PWA: No install prompt detected, showing manual install option');
        setShowInstallBanner(true);
      }
    }, 5000);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const handleInstall = async () => {
    if (isIOS) {
      // iOSの場合は手順を表示
      alert('iOSでのインストール方法:\n1. Safari下部の共有ボタンをタップ\n2. 「ホーム画面に追加」を選択\n3. 「追加」をタップ');
      return;
    }

    if (!deferredPrompt) {
      // プロンプトがない場合は手動インストール案内
      alert('インストール方法:\n1. ブラウザのメニューを開く\n2. 「アプリをインストール」または「ホーム画面に追加」を選択');
      return;
    }

    // インストールプロンプトを表示
    deferredPrompt.prompt();

    // ユーザーの選択を待つ
    const { outcome } = await deferredPrompt.userChoice;

    if (outcome === 'accepted') {
      console.log('User accepted the install prompt');
      setShowInstallBanner(false);
      localStorage.setItem('pwa-installed', 'true');
    } else {
      console.log('User dismissed the install prompt');
    }

    setDeferredPrompt(null);
  };

  const handleDismiss = () => {
    setShowInstallBanner(false);
    localStorage.setItem('pwa-install-dismissed', Date.now().toString());
  };

  // デバッグモード（開発環境のみ）
  const showDebug = process.env.NODE_ENV === 'development';

  if (isStandalone) {
    return null; // 既にアプリとして実行中
  }

  if (!showInstallBanner) {
    // デバッグ用: コンソールに情報を出力
    if (showDebug && debugInfo.length > 0) {
      console.log('PWA Debug Info:', debugInfo);
    }
    return null;
  }

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

      {/* デバッグ情報（開発環境のみ） */}
      {showDebug && debugInfo.length > 0 && (
        <div className="mt-3 pt-3 border-t border-gray-700">
          <p className="text-xs text-gray-500">Debug Info:</p>
          {debugInfo.map((info, i) => (
            <p key={i} className="text-xs text-gray-500">{info}</p>
          ))}
        </div>
      )}
    </div>
  );
}