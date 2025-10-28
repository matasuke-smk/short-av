'use client';

import { useState, useEffect } from 'react';

const TUTORIAL_KEY = 'short-av-tutorial-shown';

interface InitialTutorialProps {
  onDismiss: () => void;
}

export default function InitialTutorial({ onDismiss }: InitialTutorialProps) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    // チュートリアルを既に見たかチェック
    const hasSeenTutorial = localStorage.getItem(TUTORIAL_KEY);

    if (!hasSeenTutorial) {
      // 年齢確認完了イベントをリスン
      const handleAgeVerified = () => {
        setShow(true);

        // 3秒後に自動で消える
        setTimeout(() => {
          handleDismiss();
        }, 3000);
      };

      window.addEventListener('age-verified', handleAgeVerified);

      return () => {
        window.removeEventListener('age-verified', handleAgeVerified);
      };
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
      {/* 画面中央のコンテンツ */}
      <div className="flex flex-col items-center gap-8 pointer-events-none">
        {/* タップして再生テキスト */}
        <div className="animate-pulse-slow">
          <p className="text-white text-xl font-bold bg-black/70 backdrop-blur-sm rounded-2xl px-8 py-4 text-center leading-relaxed">
            サムネイルを<br />タップして再生
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

      {/* タップして閉じる（下部） */}
      <div className="absolute bottom-12 left-1/2 -translate-x-1/2">
        <p className="text-white/70 text-sm">
          タップして開始
        </p>
      </div>
    </div>
  );
}
