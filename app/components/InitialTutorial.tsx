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
      {/* スワイプジェスチャー（指アイコンで上下に動く） */}
      <div className="absolute right-8 top-[40%] pointer-events-none">
        <div className="animate-swipe-gesture">
          {/* 指アイコン */}
          <svg className="w-12 h-12 text-white opacity-90" fill="currentColor" viewBox="0 0 24 24">
            <path d="M13.5 2C13.5 1.17 12.83 0.5 12 0.5C11.17 0.5 10.5 1.17 10.5 2V10.5H9.5V5C9.5 4.17 8.83 3.5 8 3.5C7.17 3.5 6.5 4.17 6.5 5V10.5H5.5V7C5.5 6.17 4.83 5.5 4 5.5C3.17 5.5 2.5 6.17 2.5 7V15C2.5 19.14 5.86 22.5 10 22.5H13C17.14 22.5 20.5 19.14 20.5 15V8C20.5 7.17 19.83 6.5 19 6.5C18.17 6.5 17.5 7.17 17.5 8V10.5H16.5V4C16.5 3.17 15.83 2.5 15 2.5C14.17 2.5 13.5 3.17 13.5 4V2Z"/>
          </svg>
        </div>
      </div>

      {/* タップして再生（サムネイル中央 - 画面上部1/3あたり） */}
      <div className="absolute top-[30%] left-1/2 -translate-x-1/2 pointer-events-none">
        <div className="animate-pulse-slow">
          <p className="text-white text-xl font-bold bg-black/70 backdrop-blur-sm rounded-full px-8 py-3">
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
