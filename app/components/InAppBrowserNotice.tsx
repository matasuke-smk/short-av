'use client';

// X のアプリ内ブラウザ（iPhone）で FANZA へのボタンを押したときに、先に出す案内。
// X の中で FANZA を開くと、普段使うブラウザ（Safari など）の FANZA のログインが使えない。
// X は Safari への自動の切り替え（x-safari-https）を止めているので（2026-10-09 実機で確認）、
// 画面下の「short-av.com」→「ブラウザで開く」で short-av ごと開き直してもらう。
// URL は今の作品（?v=…）になっているので、開き直した先でも同じ作品が出る。

// X のアプリ内ブラウザ（iPhone）。UA の末尾に「Twitter for iPhone/12.32.1」が付く
export const isXInAppBrowserIOS = () =>
  typeof navigator !== 'undefined' && /iPhone|iPad|iPod/.test(navigator.userAgent) && /Twitter/i.test(navigator.userAgent);

type Props = {
  url: string | null;
  onOpenAnyway: () => void;
  onClose: () => void;
};

export default function InAppBrowserNotice({ url, onOpenAnyway, onClose }: Props) {
  if (!url) return null;

  return (
    <div className="fixed inset-0 z-[200] flex flex-col justify-end bg-black/60" onClick={onClose}>
      <div
        className="mx-auto w-full max-w-md rounded-t-2xl bg-gray-900 px-5 pt-5 pb-2 text-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="text-lg font-bold">ブラウザで開くのがおすすめです</p>
        <p className="mt-1.5 text-sm text-gray-300">ブラウザで開くと、いつもの FANZA のログインのまま購入できます。</p>

        <ol className="mt-4 space-y-2.5 text-sm">
          <li className="flex items-center gap-2">
            <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-blue-600 text-xs font-bold">1</span>
            <span>画面下の</span>
            <span className="rounded-full bg-black px-3 py-1 text-xs font-medium">short-av.com ⋮</span>
            <span>をタップ</span>
          </li>
          <li className="flex items-center gap-2">
            <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-blue-600 text-xs font-bold">2</span>
            <span className="rounded-lg bg-gray-700 px-3 py-1 text-xs font-medium">ブラウザで開く 🌐</span>
            <span>をタップ</span>
          </li>
          <li className="flex items-center gap-2">
            <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-blue-600 text-xs font-bold">3</span>
            <span>同じ作品が開くので、もう一度「詳細はこちら」</span>
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

        {/* X の「short-av.com」の表示（画面の下の中央）を指す */}
        <div className="pointer-events-none mt-3 flex flex-col items-center text-blue-400">
          <span className="text-xs">ここをタップ</span>
          <svg className="h-8 w-8 animate-bounce" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m0 0l-6-6m6 6l6-6" />
          </svg>
        </div>
      </div>
    </div>
  );
}
