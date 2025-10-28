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
      setShow(true);

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
      {/* スワイプアニメーション（中央） */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="flex flex-col items-center gap-8">
          {/* 上矢印（アニメーション） */}
          <div className="animate-bounce-slow">
            <svg className="w-16 h-16 text-white opacity-90" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 15l7-7 7 7" />
            </svg>
          </div>

          {/* スワイプテキスト */}
          <div className="bg-black/70 backdrop-blur-sm rounded-2xl px-8 py-4">
            <p className="text-white text-xl font-bold text-center whitespace-nowrap">
              スワイプして閲覧
            </p>
          </div>

          {/* 下矢印（アニメーション） */}
          <div className="animate-bounce-slow" style={{ animationDelay: '0.5s' }}>
            <svg className="w-16 h-16 text-white opacity-90" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </div>
      </div>

      {/* タップして再生（サムネイル位置に配置） */}
      <div className="absolute top-[calc(50%-8rem)] left-1/2 -translate-x-1/2 pointer-events-none">
        <div className="flex items-center gap-3 bg-black/70 backdrop-blur-sm rounded-full px-6 py-4 animate-pulse-slow">
          <svg className="w-8 h-8 text-white" fill="currentColor" viewBox="0 0 24 24">
            <path d="M8 5v14l11-7z"/>
          </svg>
          <p className="text-white text-lg font-bold whitespace-nowrap">
            タップして再生
          </p>
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
