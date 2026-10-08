'use client';

import { useEffect, useState } from 'react';
import { buildDoujinPostText, countXWeightedLength, X_MAX_WEIGHTED_LENGTH } from '@/lib/x-post-text';
import type { Doujin } from '@/lib/doujin-types';

/**
 * 管理者がサイトを見ながら、表示中の作品の X 投稿文を作るボタン
 * 管理画面にログインした端末（目印の cookie がある）にだけ表示する。投稿文の作成と記録の API は管理者の認証で保護している。
 */
// doujin: 表示中が同人誌のとき（投稿文はその場で作り、記録は同人誌用の API）
export default function AdminXCompose({ contentId, doujin }: { contentId?: string; doujin?: Doujin }) {
  const [isAdmin, setIsAdmin] = useState(false);
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [alreadyPosted, setAlreadyPosted] = useState(false);
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setIsAdmin(document.cookie.split('; ').includes('sav_admin_ui=1'));
  }, []);

  if (!isAdmin || !contentId) return null;

  async function compose() {
    setOpen(true);
    if (doujin) {
      setText(buildDoujinPostText(doujin, 0));
      setAlreadyPosted(false);
      setStatus('');
      return;
    }
    setStatus('作成中...');
    setText('');
    const response = await fetch(`/api/admin/x-posts/compose?contentId=${encodeURIComponent(contentId!)}`);
    const data = await response.json().catch(() => null);
    if (!response.ok) {
      setStatus(response.status === 401 ? '管理画面のログインが切れています。管理画面でログインし直してください' : data?.error ?? '作成できませんでした');
      return;
    }
    setText(data.text);
    setAlreadyPosted(data.alreadyPosted);
    setStatus('');
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const area = document.createElement('textarea');
      area.value = text;
      document.body.appendChild(area);
      area.select();
      document.execCommand('copy');
      area.remove();
    }
    setStatus('コピーしました。X に貼り付けて投稿してください');
  }

  async function record() {
    setBusy(true);
    const response = await fetch(doujin ? '/api/admin/x-posts/doujin' : '/api/admin/x-posts/compose', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contentId, text }),
    });
    setBusy(false);
    if (response.ok) {
      setAlreadyPosted(true);
      setStatus('紹介済みとして記録しました（2週間は「おすすめ」に出なくなります）');
    } else {
      setStatus('記録できませんでした');
    }
  }

  // 「紹介済みにする」の取り消し（投稿をやめたとき）。いちばん新しい紹介の記録だけを取り消す
  async function undo() {
    setBusy(true);
    const response = await fetch('/api/admin/x-posts/undo', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contentId }),
    });
    setBusy(false);
    if (response.ok) {
      setAlreadyPosted(false);
      setStatus('紹介済みを取り消しました');
    } else {
      setStatus('取り消せませんでした');
    }
  }

  const length = countXWeightedLength(text);

  return (
    <>
      <button
        onClick={compose}
        className="fixed top-[calc(env(safe-area-inset-top)+3.25rem)] left-2 z-[70] bg-black/80 border border-gray-600 text-white text-xs font-bold rounded-full px-3 py-1.5 shadow-lg"
      >
        X投稿文
      </button>

      {open && (
        <div className="fixed inset-0 z-[80] bg-black/70 flex items-end md:items-center justify-center p-2" onClick={() => setOpen(false)}>
          <div className="w-full max-w-lg bg-gray-900 border border-gray-700 rounded-xl p-4 text-white" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-2">
              <h2 className="font-bold">X 投稿文（管理者用）</h2>
              <button onClick={() => setOpen(false)} className="text-gray-400 text-sm">閉じる</button>
            </div>
            {alreadyPosted && (
              <p className="text-xs text-yellow-300 mb-2">
                この作品は直近2週間以内に紹介済みです
                <button onClick={undo} disabled={busy} className="ml-2 underline text-gray-300 hover:text-white disabled:opacity-50">
                  取り消す
                </button>
              </p>
            )}
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={9}
              className="w-full bg-gray-800 border border-gray-700 rounded p-2 text-sm"
            />
            <div className={`text-xs mt-1 ${length > X_MAX_WEIGHTED_LENGTH ? 'text-red-400' : 'text-gray-400'}`}>
              {length} / {X_MAX_WEIGHTED_LENGTH}
            </div>
            <div className="flex flex-wrap gap-2 mt-3">
              <button onClick={copy} disabled={!text} className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 rounded px-3 py-2 text-sm font-bold">
                本文をコピー
              </button>
              <button onClick={record} disabled={!text || busy || alreadyPosted} className="bg-gray-700 hover:bg-gray-600 disabled:opacity-50 rounded px-3 py-2 text-sm">
                紹介済みにする
              </button>
            </div>
            {status && <p className="text-xs text-gray-300 mt-2">{status}</p>}
          </div>
        </div>
      )}
    </>
  );
}
