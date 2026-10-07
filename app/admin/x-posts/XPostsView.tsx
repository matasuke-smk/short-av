'use client';

import { useCallback, useEffect, useState } from 'react';
import { getUserId } from '@/lib/user-id';
import {
  countXWeightedLength,
  getPostFormat,
  setPostFormat,
  X_MAX_WEIGHTED_LENGTH,
} from '@/lib/x-post-text';

const MAX_IMAGES = 4;

// 画像は別ドメイン（pics.dmm.co.jp）のため、同一オリジンの中継 API 経由で取得する
function proxiedImageUrl(url: string): string {
  return `/api/admin/x-posts/image-download?url=${encodeURIComponent(url)}`;
}

async function fetchImageFile(url: string): Promise<File> {
  const response = await fetch(proxiedImageUrl(url));
  if (!response.ok) throw new Error('image fetch failed');
  const blob = await response.blob();
  return new File([blob], url.split('/').pop() ?? 'image.jpg', { type: 'image/jpeg' });
}

// クリップボードは PNG しか受け付けないため変換する
async function toPngBlob(file: Blob): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const canvas = document.createElement('canvas');
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0);
  return new Promise((resolve, reject) =>
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('toBlob failed'))), 'image/png'),
  );
}

/**
 * 作品のサンプル画像から X に添付する画像（最大4枚）を選び、
 * PC ではクリップボードへのコピー（X の投稿画面で Ctrl+V）、スマホでは共有メニューで X アプリへ送る。
 * X アカウントが DMM アフィリエイトの運営サイトとして承認されてから使うこと。
 */
function SampleImagePicker({
  contentId,
  text,
  onUseImages,
}: {
  contentId: string;
  text: string;
  onUseImages: () => void; // 画像を使ったら投稿形式を「画像4枚」に切り替える
}) {
  const [open, setOpen] = useState(false);
  const [images, setImages] = useState<string[] | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [files, setFiles] = useState<Record<string, File>>({});
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');
  const [canShareFiles, setCanShareFiles] = useState(false);

  useEffect(() => {
    try {
      const probe = new File([new Blob()], 'probe.jpg', { type: 'image/jpeg' });
      setCanShareFiles(typeof navigator.canShare === 'function' && navigator.canShare({ files: [probe] }));
    } catch {
      setCanShareFiles(false);
    }
  }, []);

  // 共有メニューはボタン操作の直後でないと開けないため、選択中の画像は先に読み込んでおく
  useEffect(() => {
    const missing = selected.filter((url) => !files[url]);
    if (missing.length === 0) return;
    let cancelled = false;
    Promise.all(missing.map(async (url) => [url, await fetchImageFile(url)] as const))
      .then((entries) => {
        if (!cancelled) setFiles((prev) => ({ ...prev, ...Object.fromEntries(entries) }));
      })
      .catch(() => {
        if (!cancelled) setError('画像の読み込みに失敗しました');
      });
    return () => {
      cancelled = true;
    };
  }, [selected, files]);

  async function load() {
    setOpen(true);
    if (images) return;
    try {
      const response = await fetch(`/api/admin/x-posts/sample-images?cid=${encodeURIComponent(contentId)}`);
      if (!response.ok) throw new Error();
      const data = await response.json();
      setImages(data.images);
      setSelected(data.images.slice(0, MAX_IMAGES));
    } catch {
      setError('サンプル画像を取得できませんでした');
    }
  }

  function toggle(url: string) {
    setSelected((prev) => {
      if (prev.includes(url)) return prev.filter((u) => u !== url);
      if (prev.length >= MAX_IMAGES) return prev;
      return [...prev, url];
    });
  }

  async function copy(url: string, index: number) {
    setStatus('');
    onUseImages();
    try {
      const file = files[url] ?? (await fetchImageFile(url));
      // Safari 対策で Promise のまま渡す
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': toPngBlob(file) })]);
      setStatus(`画像${index + 1}をコピーしました。X の投稿画面で Ctrl+V で貼り付けてください`);
    } catch {
      setStatus('コピーできませんでした（ブラウザがクリップボードへの画像コピーに対応していない可能性があります）');
    }
  }

  const ready = selected.length > 0 && selected.every((url) => files[url]);

  async function share() {
    setStatus('');
    try {
      onUseImages();
      await navigator.share({ text: setPostFormat(text, 'img4'), files: selected.map((url) => files[url]) });
    } catch (e) {
      if ((e as Error).name !== 'AbortError') setStatus('共有できませんでした');
    }
  }

  async function download() {
    onUseImages();
    for (const url of selected) {
      const link = document.createElement('a');
      link.href = proxiedImageUrl(url);
      link.download = '';
      document.body.appendChild(link);
      link.click();
      link.remove();
      // 連続ダウンロードがブラウザにブロックされないよう少し間を空ける
      await new Promise((resolve) => setTimeout(resolve, 400));
    }
  }

  if (!open) {
    return (
      <button onClick={load} className="text-sm text-blue-300 hover:text-blue-200 underline">
        添付用のサンプル画像を表示
      </button>
    );
  }

  return (
    <div className="mt-2 bg-gray-900 rounded p-3">
      {error ? (
        <div className="text-red-400 text-sm">{error}</div>
      ) : !images ? (
        <div className="text-gray-400 text-sm">読み込み中...</div>
      ) : images.length === 0 ? (
        <div className="text-gray-400 text-sm">この作品にはサンプル画像がありません</div>
      ) : (
        <>
          <div className="text-xs text-gray-400 mb-2">
            添付する画像をクリックで選択（最大{MAX_IMAGES}枚・選んだ順に番号）。
            DMM アフィリエイトで X アカウントが承認されてから使ってください。
          </div>
          <div className="grid grid-cols-3 md:grid-cols-5 gap-2">
            {images.map((url) => {
              const order = selected.indexOf(url);
              return (
                <button
                  key={url}
                  onClick={() => toggle(url)}
                  className={`relative rounded overflow-hidden border-2 ${order >= 0 ? 'border-blue-500' : 'border-transparent opacity-60'}`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={url} alt="" className="w-full aspect-[3/2] object-cover" loading="lazy" />
                  {order >= 0 && (
                    <span className="absolute top-1 left-1 bg-blue-600 text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
                      {order + 1}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          <div className="flex flex-wrap items-center gap-2 mt-3">
            {canShareFiles && (
              <button
                onClick={share}
                disabled={!ready}
                className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 px-3 py-1.5 rounded text-sm font-bold"
              >
                {ready ? `本文と画像${selected.length}枚を共有（X アプリへ）` : '画像を準備中...'}
              </button>
            )}
            {selected.map((url, i) => (
              <button
                key={url}
                onClick={() => copy(url, i)}
                className="bg-gray-700 hover:bg-gray-600 px-3 py-1.5 rounded text-sm"
              >
                画像{i + 1}をコピー
              </button>
            ))}
            <button onClick={download} className="text-xs text-gray-400 hover:text-gray-200 underline">
              ダウンロード
            </button>
          </div>
          {status && <div className="text-xs text-yellow-300 mt-2">{status}</div>}
        </>
      )}
    </div>
  );
}

type VideoItem = {
  dmm_content_id: string;
  title: string;
  thumbnail_url: string | null;
  plays: number;
  swipePlays: number;
  clicks: number;
  likes: number;
  rank: number | null;
  xPlays: number;
  xClicks: number;
  postedCount: number;
  lastPostedAt: string | null;
  likedAt?: string; // 「いいね」タブのみ
};

async function copyToClipboard(text: string) {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    // クリップボード API が使えないブラウザ向け
    const area = document.createElement('textarea');
    area.value = text;
    document.body.appendChild(area);
    area.select();
    document.execCommand('copy');
    area.remove();
  }
}

const shortDate = (iso: string) =>
  new Date(iso).toLocaleDateString('ja-JP', { timeZone: 'Asia/Tokyo', month: 'numeric', day: 'numeric' });

// 作品1件（「投稿文を作る」で本文を作り、コピー → X に貼り付け →「紹介済みにする」）
// サムネイルは X での反応を左右するため、カードの幅いっぱいに大きく表示する
function VideoCard({ video, onPosted, onUndone }: { video: VideoItem; onPosted: () => void; onUndone: () => void }) {
  const [text, setText] = useState<string | null>(null);
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);

  async function compose() {
    setStatus('作成中...');
    const response = await fetch(`/api/admin/x-posts/compose?contentId=${encodeURIComponent(video.dmm_content_id)}`);
    const data = await response.json().catch(() => null);
    if (!response.ok) {
      setStatus(data?.error ?? '作成できませんでした');
      return;
    }
    setText(data.text);
    setStatus('');
  }

  // 計測用パラメータ（投稿形式）を付けた本文
  const finalText = () => (text ? setPostFormat(text, getPostFormat(text)) : '');

  // 1行目（【…】の見出し）だけを作り直した文面のものに差し替える
  async function rerollHeading() {
    if (text === null) return;
    const current = text.split('\n')[0];
    for (let i = 0; i < 5; i++) {
      const response = await fetch(`/api/admin/x-posts/compose?contentId=${encodeURIComponent(video.dmm_content_id)}`);
      const data = await response.json().catch(() => null);
      if (!response.ok || !data?.text) return;
      const heading = (data.text as string).split('\n')[0];
      if (heading !== current || i === 4) {
        setText((t) => (t === null ? t : [heading, ...t.split('\n').slice(1)].join('\n')));
        return;
      }
    }
  }

  async function copy() {
    await copyToClipboard(finalText());
    setStatus('コピーしました。X に貼り付けて投稿・予約したら「紹介済みにする」を押してください');
  }

  async function record() {
    setBusy(true);
    const response = await fetch('/api/admin/x-posts/compose', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contentId: video.dmm_content_id, text: finalText() }),
    });
    setBusy(false);
    if (response.ok) {
      setText(null);
      setStatus('紹介済みにしました（投稿をやめたときは「取り消す」）');
      onPosted();
    } else {
      setStatus('記録できませんでした');
    }
  }

  // 「紹介済みにする」を取り消す（投稿をやめたとき）。いちばん新しい紹介の記録だけを取り消す
  async function undo() {
    setBusy(true);
    const response = await fetch('/api/admin/x-posts/undo', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contentId: video.dmm_content_id }),
    });
    setBusy(false);
    if (response.ok) {
      setStatus('紹介済みを取り消しました');
      onUndone();
    } else {
      setStatus('取り消せませんでした');
    }
  }

  const reasons = [
    video.xClicks > 0 && `X から FANZA へ ${video.xClicks}回`,
    video.xPlays > 0 && `X から来て再生 ${video.xPlays}回`,
    video.clicks > 0 && `FANZA へ ${video.clicks}回`,
    video.swipePlays > 0 && `スワイプ後に再生 ${video.swipePlays}回`,
    video.plays > 0 && `再生 ${video.plays}回`,
    video.likes > 0 && `いいね ${video.likes}`,
    video.rank && `ランキング ${video.rank}位`,
  ].filter(Boolean) as string[];
  const length = text ? countXWeightedLength(text) : 0;

  return (
    <div className="bg-gray-800 rounded-lg overflow-hidden">
      {video.thumbnail_url && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={video.thumbnail_url} alt={video.title} className="w-full h-auto bg-black" loading="lazy" />
      )}
      <div className="p-3">
        <div className="flex flex-wrap gap-x-2 gap-y-1 mb-1 text-[11px]">
          {video.likedAt && <span className="text-pink-300">♥ {shortDate(video.likedAt)} にいいね</span>}
          {video.postedCount > 0 ? (
            <span className="text-orange-300">
              紹介済み {video.postedCount}回（前回 {video.lastPostedAt ? shortDate(video.lastPostedAt) : '-'}）
              <button onClick={undo} disabled={busy} className="ml-2 underline text-gray-300 hover:text-white disabled:opacity-50">
                取り消す
              </button>
            </span>
          ) : (
            video.likedAt && <span className="text-gray-400">未紹介</span>
          )}
        </div>
        <p className="text-sm font-bold">{video.title}</p>
        {reasons.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1.5">
            {reasons.map((reason) => (
              <span key={reason} className="text-[11px] bg-gray-700 text-gray-200 rounded px-1.5 py-0.5">{reason}</span>
            ))}
          </div>
        )}
        {text === null && (
          <button onClick={compose} className="mt-3 w-full bg-blue-600 hover:bg-blue-500 rounded px-3 py-2 text-sm font-bold">
            投稿文を作る
          </button>
        )}

        {text !== null && (
          <div className="mt-3">
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={8}
              className="w-full bg-gray-900 text-white text-sm p-2 rounded border border-gray-700"
            />
            <div className={`text-xs mt-1 ${length > X_MAX_WEIGHTED_LENGTH ? 'text-red-400' : 'text-gray-400'}`}>
              {length} / {X_MAX_WEIGHTED_LENGTH}
            </div>
            <div className="mt-2">
              <SampleImagePicker
                contentId={video.dmm_content_id}
                text={text}
                onUseImages={() => setText((t) => (t === null ? t : setPostFormat(t, 'img4')))}
              />
            </div>
            <div className="flex flex-wrap gap-2 mt-3">
              <button
                onClick={copy}
                disabled={length > X_MAX_WEIGHTED_LENGTH}
                className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 px-3 py-1.5 rounded text-sm font-bold"
              >
                本文をコピー
              </button>
              <button
                onClick={record}
                disabled={busy}
                className="bg-green-700 hover:bg-green-600 disabled:opacity-50 px-3 py-1.5 rounded text-sm"
              >
                紹介済みにする
              </button>
              <button
                onClick={rerollHeading}
                className="ml-auto text-xs text-gray-400 hover:text-gray-200 underline"
                title="1行目の見出しだけを別のものに変えます（編集した本文はそのまま）"
              >
                別の見出しにする
              </button>
            </div>
          </div>
        )}
        {status && <p className="text-xs text-yellow-300 mt-2">{status}</p>}
      </div>
    </div>
  );
}

const LIST_TABS = [
  { key: 'liked', label: 'いいね' },
  { key: 'recommended', label: '効果的' },
] as const;
type ListTab = (typeof LIST_TABS)[number]['key'];
const LIST_TAB_KEY = 'sav_admin_x_tab';

export default function XPostsAdminPage() {
  const [listTab, setListTab] = useState<ListTab>('liked');
  const [liked, setLiked] = useState<VideoItem[] | null>(null);
  const [likedError, setLikedError] = useState('');
  const [recommended, setRecommended] = useState<VideoItem[] | null>(null);
  const [recommendDays, setRecommendDays] = useState(7);
  const [recommendError, setRecommendError] = useState('');

  const fetchLiked = useCallback(async () => {
    setLikedError('');
    try {
      // 「サイトを開く」で見たサイトと同じ端末のいいね（ユーザーIDは同じ localStorage を使う）
      const response = await fetch(`/api/admin/x-posts/liked?userId=${encodeURIComponent(getUserId())}`);
      if (!response.ok) throw new Error();
      const data = await response.json();
      setLiked(data.videos);
    } catch {
      setLikedError('いいねした作品を読み込めませんでした');
    }
  }, []);

  const fetchRecommended = useCallback(async () => {
    setRecommendError('');
    try {
      const response = await fetch('/api/admin/x-posts/recommend');
      if (!response.ok) throw new Error();
      const data = await response.json();
      setRecommended(data.videos);
      setRecommendDays(data.days);
    } catch {
      setRecommendError('おすすめの作品を読み込めませんでした');
    }
  }, []);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(LIST_TAB_KEY);
      if (saved === 'liked' || saved === 'recommended') setListTab(saved);
    } catch {
      // localStorage が使えなければ「いいね」を開く
    }
    fetchLiked();
    fetchRecommended();
  }, [fetchLiked, fetchRecommended]);

  const selectTab = (key: ListTab) => {
    setListTab(key);
    try {
      localStorage.setItem(LIST_TAB_KEY, key);
    } catch {
      // 保存できなくても切り替えはできる
    }
  };

  // 紹介済みにした作品: どちらの一覧でも紹介済みの表示にする（「効果的」からは次に読み込んだときに外れる。
  // その場で消さないのは、投稿をやめたときにすぐ「取り消す」を押せるようにするため）
  function markPosted(contentId: string) {
    const now = new Date().toISOString();
    const update = (prev: VideoItem[] | null) =>
      prev?.map((v) => (v.dmm_content_id === contentId ? { ...v, postedCount: v.postedCount + 1, lastPostedAt: now } : v)) ?? prev;
    setRecommended(update);
    setLiked(update);
  }

  // 取り消したら、紹介の回数・前回の日付を正しく出すため両方の一覧を読み込み直す
  function markUndone() {
    fetchLiked();
    fetchRecommended();
  }

  const list = listTab === 'liked' ? liked : recommended;
  const error = listTab === 'liked' ? likedError : recommendError;

  return (
    <div className="min-h-screen bg-gray-900 text-white p-4 md:p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-2xl md:text-3xl font-bold mb-3">X 投稿</h1>

        <div className="flex gap-2 mb-3">
          {LIST_TABS.map(({ key, label }) => {
            const count = key === 'liked' ? liked?.length : recommended?.length;
            return (
              <button
                key={key}
                type="button"
                onClick={() => selectTab(key)}
                className={`flex-1 sm:flex-none px-5 py-2 rounded-lg text-sm font-bold ${listTab === key ? 'bg-blue-600' : 'bg-gray-800 text-gray-300 hover:bg-gray-700'}`}
              >
                {label}
                {count !== undefined && <span className="ml-1 font-normal opacity-80">{count}</span>}
              </button>
            );
          })}
        </div>

        <p className="text-gray-400 text-sm mb-4">
          {listTab === 'liked'
            ? '「サイトを開く」でいいねした作品です（この端末でのいいね・新しい順）。紹介済みにしても一覧に残ります。'
            : `直近${recommendDays}日間の反応（FANZA へのリンク・スワイプ後の再生・再生・いいね）とランキングから、反応の大きい順に表示しています。紹介済みにした作品は2週間この一覧に出ず、その後また候補に戻ります（投稿をやめたときは「取り消す」）。`}
          {' '}「投稿文を作る」→「本文をコピー」→ X に貼り付けて投稿・予約 →「紹介済みにする」の順で進めてください。
        </p>

        {error ? (
          <div className="text-red-400 text-sm">{error}</div>
        ) : list === null ? (
          <div className="text-gray-400 text-sm">読み込み中...</div>
        ) : list.length === 0 ? (
          <div className="bg-gray-800 rounded-lg p-6 text-center text-gray-400 text-sm">
            {listTab === 'liked'
              ? 'まだいいねした作品はありません。上の「サイトを開く」で作品の ♡ を押すと、ここに並びます。'
              : 'いまおすすめできる作品はありません。'}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {list.map((video) => (
              <VideoCard
                key={`${listTab}-${video.dmm_content_id}`}
                video={video}
                onPosted={() => markPosted(video.dmm_content_id)}
                onUndone={markUndone}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
