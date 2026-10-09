'use client';

// X 投稿タブの作品カードの上に出す「投稿済み」の帯（サイトの「X投稿文」ボタンの「X 投稿済み」と同じ緑）。
// 以前は小さなオレンジの文字だけで、紹介済みかどうかが一覧で見分けにくかった
export default function PostedBar({ count, lastPostedAt, busy, onUndo }: { count: number; lastPostedAt: string | null; busy: boolean; onUndo: () => void }) {
  const date = lastPostedAt ? new Date(lastPostedAt).toLocaleDateString('ja-JP', { timeZone: 'Asia/Tokyo', month: 'numeric', day: 'numeric' }) : '-';
  return (
    <div className="flex items-center gap-2 bg-emerald-700 px-3 py-1.5 text-sm font-bold text-white">
      <span>✓ 投稿済み {date}{count > 1 ? `（${count}回）` : ''}</span>
      <button onClick={onUndo} disabled={busy} className="ml-auto text-xs font-normal underline text-emerald-100 hover:text-white disabled:opacity-50">
        取り消す
      </button>
    </div>
  );
}
