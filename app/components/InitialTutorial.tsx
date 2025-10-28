'use client';

import { useState, useEffect } from 'react';

const TUTORIAL_KEY = 'short-av-tutorial-shown';

interface InitialTutorialProps {
  onDismiss: () => void;
}

export default function InitialTutorial({ onDismiss }: InitialTutorialProps) {
  const [show, setShow] = useState(false);
  const [thumbnailCenter, setThumbnailCenter] = useState<number | null>(null);

  useEffect(() => {
    // チュートリアルを既に見たかチェック
    const hasSeenTutorial = localStorage.getItem(TUTORIAL_KEY);

    if (!hasSeenTutorial) {
      setShow(true);

      // サムネイル要素の位置を計算
      const calculateThumbnailCenter = () => {
        // aspect-[4/3]のサムネイルコンテナを探す
        const thumbnailElement = document.querySelector('.aspect-\\[4\\/3\\]');
        if (thumbnailElement) {
          const rect = thumbnailElement.getBoundingClientRect();
          const center = rect.top + rect.height / 2;
          setThumbnailCenter(center);
        }
      };

      // DOM読み込み後に計算
      setTimeout(calculateThumbnailCenter, 100);

      // 3秒後に自動で消える
      const timer = setTimeout(() => {
        handleDismiss();
      }, 3000);

      return () => clearTimeout(timer);
    }
  }, []);

  const handleDismiss = () => {
    localStorage.setItem(TUTORIAL_KEY, 'true');
    setShow(false);
    onDismiss();
  };

  if (!show) return null;

  return (
    <div
      className="fixed inset-0 bg-black/60 z-[9998] flex items-center justify-center"
      onClick={handleDismiss}
    >
      {/* タップして再生（サムネイル中央） */}
      <div
        className="absolute left-1/2 -translate-x-1/2 pointer-events-none"
        style={{
          top: thumbnailCenter ? `${thumbnailCenter}px` : '22%',
          transform: 'translate(-50%, -50%)'
        }}
      >
        <div className="flex flex-col items-center gap-6">
          {/* タップして再生テキスト */}
          <div className="animate-pulse-slow">
            <p className="text-white text-lg font-bold bg-black/70 backdrop-blur-sm rounded-full px-6 py-2 whitespace-nowrap">
              タップして再生
            </p>
          </div>

          {/* スワイプアップアイコン（下から上にモーション） */}
          <div className="animate-swipe-up">
            <img
              src="/swipe-up.png"
              alt="Swipe up"
              className="w-48 h-48 opacity-90"
            />
          </div>
        </div>
      </div>

      {/* タップして閉じる（下部） */}
      <div className="absolute bottom-12 left-1/2 -translate-x-1/2">
        <p className="text-white/70 text-sm">
          タップして開始
        </p>
      </div>
    </div>
  );
}
