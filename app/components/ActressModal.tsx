'use client';

import { useActresses, worksOf, type ActressInfo } from '@/lib/useActresses';

/**
 * 出演女優の一覧（女優が2人以上の作品で顔を押したとき）。顔写真・名前・Short AV にある出演作の数を、作品の多い順に並べる。
 * 女優を押すと、その女優の詳細（ActressDetailSheet）を開く（2026-10-31。以前は名前だけの一覧で、押すとすぐその女優の作品に切り替えていた）
 */
interface ActressModalProps {
  isOpen: boolean;
  onClose: () => void;
  actressIds: string[];
  onActressSelect: (actress: ActressInfo) => void;
  title: string;
}

export default function ActressModal({ isOpen, onClose, actressIds, onActressSelect, title }: ActressModalProps) {
  const actresses = useActresses(isOpen ? actressIds : null);
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/80 sm:items-center" onClick={onClose}>
      <div className="flex max-h-[80vh] w-full flex-col rounded-t-2xl bg-gray-900 sm:max-w-lg lg:max-w-xl sm:rounded-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-gray-700 p-4">
          <h2 className="text-lg font-bold text-white">{title}</h2>
          <button onClick={onClose} className="p-2 text-gray-400 transition-colors hover:text-white" aria-label="閉じる">
            <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-3">
          {actresses === null ? (
            <div className="py-12 text-center text-gray-400">読み込み中...</div>
          ) : actresses.length === 0 ? (
            <div className="py-12 text-center text-gray-400">出演女優情報がありません</div>
          ) : (
            <div className="space-y-2">
              {actresses.map((a) => {
                const n = worksOf(a.id);
                return (
                  <button
                    key={a.id}
                    onClick={() => {
                      onActressSelect(a);
                      onClose();
                    }}
                    className="flex w-full items-center gap-3 rounded-xl bg-gray-800 p-3 text-left text-white transition-colors hover:bg-gray-700 active:scale-[0.99]"
                  >
                    <span className="relative h-14 w-14 flex-shrink-0 rounded-full border-2 border-violet-400 bg-gray-700 bg-cover bg-center" style={a.image ? { backgroundImage: `url(${a.image})` } : undefined}>
                      {!a.image && (
                        <svg className="absolute inset-0 m-auto h-6 w-6 text-violet-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                        </svg>
                      )}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-base font-bold">{a.name}</span>
                      {n != null && <span className="text-xs text-gray-400">出演作 {n}本</span>}
                    </span>
                    <svg className="h-5 w-5 flex-shrink-0 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
