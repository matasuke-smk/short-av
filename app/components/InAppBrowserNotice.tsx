'use client';

import { createPortal } from 'react-dom';

// X などのアプリ内ブラウザで FANZA へのボタンを押したときに、先に出す案内。
// 10/8 の FANZA へのクリックの約9割がアプリ内ブラウザ（iPhone の X が 481回、Android の WebView が 93回 / 642回）で、成約が0件だった。
// X の中で FANZA を開くと、普段使うブラウザ（Safari など）の FANZA のログインが使えない。
// X は Safari への自動の切り替え（x-safari-https）を止めているので（2026-10-09 実機で確認）、
// 画面下の「short-av.com」→「ブラウザで開く」で short-av ごと開き直してもらう。
// URL は今の作品（?v=…）になっているので、開き直した先でも同じ作品が出る。

// 案内の間だけアドレスに付ける目印。「ブラウザで開く」で開き直された回数を数える（VideoSwiper）
export const INAPP_REOPEN_PARAM = 'inapp';

// 案内を出すアプリ内ブラウザ。ios: X のアプリ内（UA の末尾に「Twitter for iPhone/12.32.1」が付く）、
// android: アプリ内の WebView（UA に「; wv)」が付く。X の Android も WebView だった。GA の「Android Webview」）。それ以外は null
// Android は以前 intent:// で普段のブラウザへの自動の切り替えを試していたが、X が拒否して赤いエラーを出すだけだったので 2026-10-09 にやめた
export type InAppPlatform = 'ios' | 'android';
export const inAppPlatform = (): InAppPlatform | null => {
  if (typeof navigator === 'undefined') return null;
  const ua = navigator.userAgent;
  if (/iPhone|iPad|iPod/.test(ua) && /Twitter/i.test(ua)) return 'ios';
  if (/Android/.test(ua) && /; wv\)/.test(ua)) return 'android';
  return null;
};

type Props = {
  url: string | null;
  platform: InAppPlatform;
  buttonLabel: string; // 手順3で「もう一度押して」と書くボタンの名前
  onOpenAnyway: () => void;
  onClose: () => void;
};

export default function InAppBrowserNotice({ url, platform, buttonLabel, onOpenAnyway, onClose }: Props) {
  if (!url) return null;

  // 再生画面などの上にも出るよう、body の直下に出す
  return createPortal(
    <div className="fixed inset-0 z-[200] flex flex-col justify-end bg-black/60" onClick={onClose}>
      <div
        // Android の X は画面下の「short-av.com ⋮」のバーがページの上に重なる（約50px。iPhone はバーがページの外側）ので、
        // 矢印がバーに隠れないよう下の余白を広げる（2026-10-10 Android の実機で矢印が見切れていた。4.5rem では矢印1つ分あきすぎたので 3rem）
        className={`mx-auto w-full max-w-md rounded-t-2xl bg-gray-900 px-5 pt-5 text-white shadow-2xl ${platform === 'ios' ? 'pb-2' : 'pb-[calc(env(safe-area-inset-bottom)+3rem)]'}`}
        onClick={(e) => e.stopPropagation()}
      >
        <p className="text-lg font-bold">ブラウザで開くのがおすすめです</p>
        <p className="mt-1.5 text-sm text-gray-300">ブラウザで開くと、いつもの FANZA のログインのまま購入できます。</p>

        <ol className="mt-4 space-y-2.5 text-sm">
          {/* iPhone・Android とも X のアプリ内ブラウザは画面下に「short-av.com ⋮」があり、そのメニューに「ブラウザで開く」がある（Android は 2026-10-09 のスクショで確認） */}
          <li className="flex items-center gap-2">
            <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-blue-600 text-xs font-bold">1</span>
            <span>画面下の</span>
            <span className="rounded-full bg-black px-3 py-1 text-xs font-medium">short-av.com ⋮</span>
            <span>をタップ</span>
          </li>
          <li className="flex items-center gap-2">
            <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-blue-600 text-xs font-bold">2</span>
            <span className="rounded-lg bg-gray-700 px-3 py-1 text-xs font-medium">{platform === 'ios' ? 'ブラウザで開く 🌐' : 'ブラウザで開く'}</span>
            <span>をタップ{platform === 'android' && <span className="text-gray-400">（「Chrome で開く」の場合も）</span>}</span>
          </li>
          <li className="flex items-center gap-2">
            <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-blue-600 text-xs font-bold">3</span>
            <span>同じ作品が開くので、もう一度「{buttonLabel}」</span>
          </li>
        </ol>

        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer sponsored"
          onClick={onOpenAnyway}
          className="mt-5 block w-full rounded-xl border border-gray-600 py-3 text-center text-sm font-bold text-gray-200 active:scale-95"
        >
          このまま FANZA を開く
        </a>

        {/* 画面下の中央の「short-av.com」を指す */}
        <div className="pointer-events-none mt-3 flex flex-col items-center text-blue-400">
          <span className="text-xs">ここをタップ</span>
          {/* 跳ねる動きは上に高さの25%（8px）動くので、その分の余白（mt-2）を取って文字に重ならないようにする */}
          <svg className="mt-2 h-8 w-8 animate-bounce" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m0 0l-6-6m6 6l6-6" />
          </svg>
        </div>
      </div>
    </div>,
    document.body,
  );
}
