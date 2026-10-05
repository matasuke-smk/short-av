'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

const TUTORIAL_KEY = 'short-av-tutorial-shown';

// AgeVerificationGate と同じ形式（ローカル日付の YYYY-MM-DD）
function isAgeVerifiedToday(): boolean {
  const now = new Date();
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  return localStorage.getItem('age_verification_date') === today;
}

interface InitialTutorialProps {
  onDismiss: () => void;
  onShow?: () => void;
}

export default function InitialTutorial({ onDismiss, onShow }: InitialTutorialProps) {
  const [show, setShow] = useState(false);
  // 親の再描画でこの effect が再実行されても、表示（と GA イベント送信）は1回だけにする
  const shownRef = useRef(false);

  const handleDismiss = useCallback(() => {
    localStorage.setItem(TUTORIAL_KEY, 'true');
    setShow(false);
    onDismiss();
  }, [onDismiss]);

  useEffect(() => {
    // チュートリアルを既に見たかチェック
    const hasSeenTutorial = localStorage.getItem(TUTORIAL_KEY);
    if (hasSeenTutorial) return;

    // 年齢確認完了イベントをリスン
    const handleAgeVerified = () => {
      if (shownRef.current || localStorage.getItem(TUTORIAL_KEY)) return;
      shownRef.current = true;
      setShow(true);

      // Google Analytics: チュートリアル表示イベント
      if (onShow) {
        onShow();
      }
    };

    window.addEventListener('age-verified', handleAgeVerified);

    // このコンポーネントの読み込みより先に年齢確認が済んでいると、イベントを取りこぼして表示されなかったため、
    // 読み込み時点で今日の年齢確認が済んでいればすぐに表示する
    if (isAgeVerifiedToday()) handleAgeVerified();

    return () => {
      window.removeEventListener('age-verified', handleAgeVerified);
    };
  }, [onShow]);

  // 自動では消さず、タップ・クリック・キー操作で閉じる（3秒で消えると読み切れなかったため）
  useEffect(() => {
    if (!show) return;
    const onKeyDown = () => handleDismiss();
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [show, handleDismiss]);

  if (!show) return null;

  return (
    <div
      className="fixed inset-0 bg-black/75 z-[9998] flex flex-col items-center justify-center px-6"
      onClick={handleDismiss}
      onTouchMove={handleDismiss}
      onWheel={handleDismiss}
    >
      <div className="flex flex-col items-center gap-10 pointer-events-none text-center">
        {/* メイン: スワイプで次の動画 */}
        <div className="flex flex-col items-center gap-4">
          <div className="relative h-40 w-24 rounded-2xl border-2 border-white/60 overflow-hidden">
            {/* 指（丸）が下から上へ動く */}
            <div className="absolute left-1/2 top-1/2 -ml-5 -mt-5 animate-swipe-hand">
              <div className="w-10 h-10 rounded-full bg-white/90 shadow-lg" />
            </div>
          </div>
          <p className="text-white text-2xl font-bold leading-snug">
            <span className="lg:hidden">上にスワイプで<br />次の動画へ</span>
            <span className="hidden lg:inline">ホイール・↓キーで<br />次の動画へ</span>
          </p>
        </div>

        {/* サブ: タップで再生 */}
        <div className="flex items-center gap-3 bg-white/10 rounded-xl px-5 py-3">
          <svg className="w-7 h-7 text-white" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M8 5v14l11-7z" />
          </svg>
          <p className="text-white text-base">
            <span className="lg:hidden">サムネイルをタップで再生</span>
            <span className="hidden lg:inline">サムネイルをクリックで再生</span>
          </p>
        </div>
      </div>

      {/* 閉じ方（下部） */}
      <div className="absolute bottom-12 left-1/2 -translate-x-1/2 pointer-events-none">
        <p className="text-white/70 text-sm animate-pulse-slow">
          <span className="lg:hidden">タップしてはじめる</span>
          <span className="hidden lg:inline">クリックしてはじめる</span>
        </p>
      </div>
    </div>
  );
}
