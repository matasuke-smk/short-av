'use client';

import { useCallback, useEffect, useState } from 'react';
import type { Doujin } from '@/lib/doujin-types';
import { getUserId } from '@/lib/user-id';
import { buildDoujinPostText as buildText, countXWeightedLength, X_MAX_WEIGHTED_LENGTH } from '@/lib/x-post-text';

type DoujinItem = Doujin & {
  postedCount: number;
  lastPostedAt: string | null;
  likedAt?: string | null;
  views?: number;
  completes?: number;
  clicks?: number;
  rank?: number | null;
};

const yen = (n: number) => `¥${n.toLocaleString('ja-JP')}`;
const shortDate = (iso: string) => {
  const d = new Date(iso);
  return `${d.getMonth() + 1}/${d.getDate()}`;
};

async function copyToClipboard(text: string) {
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
}

function DoujinCard({ doujin, onChanged }: { doujin: DoujinItem; onChanged: () => void }) {
  const [text, setText] = useState<string | null>(null);
  const [heading, setHeading] = useState(0);
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);
  const length = text ? countXWeightedLength(text) : 0;

  async function record() {
    if (!text) return;
    setBusy(true);
    const response = await fetch('/api/admin/x-posts/doujin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contentId: doujin.contentId, text }),
    });
    setBusy(false);
    if (response.ok) {
      setText(null);
      setStatus('紹介済みにしました（投稿をやめたときは「取り消す」）');
      onChanged();
    } else {
      setStatus('記録できませんでした');
    }
  }

  async function undo() {
    setBusy(true);
    const response = await fetch('/api/admin/x-posts/undo', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contentId: doujin.contentId }),
    });
    setBusy(false);
    setStatus(response.ok ? '紹介済みを取り消しました' : '取り消せませんでした');
    if (response.ok) onChanged();
  }

  return (
    <div className="bg-gray-800 rounded-lg overflow-hidden">
      <div className="flex gap-3 p-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={doujin.cover} alt="" className="w-24 flex-shrink-0 rounded object-contain self-start" />
        <div className="min-w-0 flex-1">
          {doujin.postedCount > 0 && (
            <p className="text-[11px] text-orange-300">
              紹介済み {doujin.postedCount}回（前回 {doujin.lastPostedAt ? shortDate(doujin.lastPostedAt) : '-'}）
              <button onClick={undo} disabled={busy} className="ml-2 underline text-gray-300 hover:text-white disabled:opacity-50">
                取り消す
              </button>
            </p>
          )}
          {doujin.likedAt && <p className="text-[11px] text-pink-300">♥ {shortDate(doujin.likedAt)} にいいね</p>}
          <p className="text-sm font-bold line-clamp-3">{doujin.title}</p>
          {(() => {
            const reasons = [
              (doujin.clicks ?? 0) > 0 && `FANZA へ ${doujin.clicks}回`,
              (doujin.completes ?? 0) > 0 && `最後まで ${doujin.completes}回`,
              (doujin.views ?? 0) > 0 && `表示 ${doujin.views}回`,
              doujin.rank && `人気 ${doujin.rank}位`,
            ].filter(Boolean) as string[];
            return reasons.length > 0 ? (
              <div className="flex flex-wrap gap-1 mt-1">
                {reasons.map((r) => (
                  <span key={r} className="text-[11px] bg-gray-700 text-gray-200 rounded px-1.5 py-0.5">
                    {r}
                  </span>
                ))}
              </div>
            ) : null;
          })()}
          <p className="mt-1 text-xs text-gray-400">
            {doujin.circle ?? ''} ・ サンプル {doujin.samples.length}ページ
            {doujin.price !== null && ` ・ ${yen(doujin.price)}`}
          </p>
          <a
            href={`/?mode=doujin&d=${doujin.contentId}`}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-1 inline-block text-xs text-blue-300 underline"
          >
            リンク先の画面を見る
          </a>
        </div>
      </div>
      <div className="px-3 pb-3">
        {text === null ? (
          <button onClick={() => setText(buildText(doujin, heading))} className="w-full bg-blue-600 hover:bg-blue-500 rounded px-3 py-2 text-sm font-bold">
            投稿文を作る
          </button>
        ) : (
          <>
            <textarea value={text} onChange={(e) => setText(e.target.value)} rows={9} className="w-full bg-gray-900 text-white text-sm p-2 rounded border border-gray-700" />
            <div className={`text-xs mt-1 ${length > X_MAX_WEIGHTED_LENGTH ? 'text-red-400' : 'text-gray-400'}`}>
              {length} / {X_MAX_WEIGHTED_LENGTH}
            </div>
            <div className="flex flex-wrap gap-2 mt-2">
              <button
                onClick={async () => {
                  await copyToClipboard(text);
                  setStatus('コピーしました。X に貼り付けて投稿・予約したら「紹介済みにする」を押してください');
                }}
                disabled={length > X_MAX_WEIGHTED_LENGTH}
                className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 px-3 py-1.5 rounded text-sm font-bold"
              >
                本文をコピー
              </button>
              <button onClick={record} disabled={busy} className="bg-green-700 hover:bg-green-600 disabled:opacity-50 px-3 py-1.5 rounded text-sm">
                紹介済みにする
              </button>
              <button
                onClick={() => {
                  const next = heading + 1;
                  setHeading(next);
                  setText((t) => (t === null ? t : [buildText(doujin, next).split('\n')[0], ...t.split('\n').slice(1)].join('\n')));
                }}
                className="ml-auto text-xs text-gray-400 hover:text-gray-200 underline"
              >
                別の見出しにする
              </button>
            </div>
          </>
        )}
        {status && <p className="text-xs text-yellow-300 mt-2">{status}</p>}
      </div>
    </div>
  );
}

/** X 投稿の「同人誌」: いいねした同人誌 / おすすめの同人誌から投稿文を作る */
export default function DoujinPosts({ list: listKind }: { list: 'liked' | 'recommended' }) {
  const [list, setList] = useState<DoujinItem[] | null>(null);
  const [error, setError] = useState('');

  const load = useCallback(() => {
    fetch(listKind === 'liked' ? `/api/admin/x-posts/doujin?list=liked&userId=${encodeURIComponent(getUserId())}` : '/api/admin/x-posts/doujin?list=recommended')
      .then((r) => r.json())
      .then((d) => (d.error ? setError(d.error) : setList(d.doujin)))
      .catch(() => setError('読み込めませんでした'));
  }, [listKind]);
  useEffect(load, [load]);

  if (error) return <div className="text-red-400 text-sm">{error}</div>;
  if (list === null) return <div className="text-gray-400 text-sm">読み込み中...</div>;
  if (list.length === 0)
    return (
      <div className="bg-gray-800 rounded-lg p-6 text-center text-gray-400 text-sm">
        {listKind === 'liked' ? 'まだいいねした同人誌はありません。「サイトを開く」で同人誌の ♡ を押すと、ここに並びます。' : 'いまおすすめできる同人誌はありません。'}
      </div>
    );
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      {list.map((d) => (
        <DoujinCard key={d.contentId} doujin={d} onChanged={load} />
      ))}
    </div>
  );
}
