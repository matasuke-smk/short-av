'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  countXWeightedLength,
  getPostFormat,
  setPostFormat,
  X_MAX_WEIGHTED_LENGTH,
  X_POST_FORMAT_LABEL,
  type XPostFormat,
} from '@/lib/x-post-text';

type XPost = {
  id: string;
  slot_at: string;
  slot_type: 'new' | 'ranking' | 'random' | 'manual';
  dmm_content_id: string;
  title: string;
  thumbnail_url: string | null;
  text: string;
  status: 'pending' | 'scheduled' | 'skipped';
};

const SLOT_LABEL: Record<XPost['slot_type'], string> = {
  new: '新着',
  ranking: 'ランキング',
  random: 'ランダム',
  manual: '手動で選択',
};

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

type RecommendedVideo = {
  dmm_content_id: string;
  title: string;
  thumbnail_url: string | null;
  plays: number;
  swipePlays: number;
  clicks: number;
  likes: number;
  rank: number | null;
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

// おすすめの作品1件（「投稿文を作る」で本文を作り、コピー → X に貼り付け →「紹介済みにする」）
function RecommendedCard({ video, onPosted }: { video: RecommendedVideo; onPosted: () => void }) {
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
    if (response.ok) onPosted();
    else setStatus('記録できませんでした');
  }

  const reasons = [
    video.clicks > 0 && `FANZA へ ${video.clicks}回`,
    video.swipePlays > 0 && `スワイプ後に再生 ${video.swipePlays}回`,
    video.plays > 0 && `再生 ${video.plays}回`,
    video.likes > 0 && `いいね ${video.likes}`,
    video.rank && `ランキング ${video.rank}位`,
  ].filter(Boolean) as string[];
  const length = text ? countXWeightedLength(text) : 0;

  return (
    <div className="bg-gray-800 rounded-lg p-3">
      <div className="flex gap-3">
        {video.thumbnail_url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={video.thumbnail_url} alt="" className="w-24 md:w-32 rounded object-cover self-start" loading="lazy" />
        )}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold line-clamp-2">{video.title}</p>
          <div className="flex flex-wrap gap-1 mt-1.5">
            {reasons.map((reason) => (
              <span key={reason} className="text-[11px] bg-gray-700 text-gray-200 rounded px-1.5 py-0.5">{reason}</span>
            ))}
          </div>
          {text === null && (
            <button onClick={compose} className="mt-2 bg-blue-600 hover:bg-blue-500 rounded px-3 py-1.5 text-sm font-bold">
              投稿文を作る
            </button>
          )}
        </div>
      </div>

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
          </div>
        </div>
      )}
      {status && <p className="text-xs text-yellow-300 mt-2">{status}</p>}
    </div>
  );
}

function formatSlot(iso: string): string {
  return new Date(iso).toLocaleString('ja-JP', {
    timeZone: 'Asia/Tokyo',
    month: 'numeric',
    day: 'numeric',
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function XPostsAdminPage() {
  const [posts, setPosts] = useState<XPost[]>([]);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [recommended, setRecommended] = useState<RecommendedVideo[] | null>(null);
  const [recommendDays, setRecommendDays] = useState(7);
  const [recommendError, setRecommendError] = useState('');

  const fetchPosts = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/admin/x-posts');
      if (!response.ok) throw new Error();
      const data = await response.json();
      setPosts(data.posts);
      setDrafts(Object.fromEntries(data.posts.map((p: XPost) => [p.id, p.text])));
    } catch {
      setMessage('読み込みに失敗しました');
    } finally {
      setLoading(false);
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
    fetchPosts();
    fetchRecommended();
  }, [fetchPosts, fetchRecommended]);

  // 紹介済みにした作品を一覧から外し、下の「紹介した作品」に出す
  function markPosted(contentId: string) {
    setRecommended((prev) => prev?.filter((v) => v.dmm_content_id !== contentId) ?? prev);
    fetchPosts();
  }

  async function update(id: string, body: { text?: string; status?: XPost['status'] }) {
    const response = await fetch(`/api/admin/x-posts/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!response.ok) {
      setMessage('保存に失敗しました');
      return false;
    }
    return true;
  }

  async function saveText(post: XPost) {
    if (drafts[post.id] === post.text) return;
    if (await update(post.id, { text: drafts[post.id] })) {
      setPosts((prev) => prev.map((p) => (p.id === post.id ? { ...p, text: drafts[post.id] } : p)));
    }
  }

  async function setStatus(post: XPost, status: XPost['status']) {
    if (!(await update(post.id, { status }))) return;
    if (status === 'skipped') {
      setPosts((prev) => prev.filter((p) => p.id !== post.id));
    } else {
      setPosts((prev) => prev.map((p) => (p.id === post.id ? { ...p, status } : p)));
    }
  }

  async function changeFormat(post: XPost, format: XPostFormat) {
    const current = drafts[post.id] ?? post.text;
    const next = setPostFormat(current, format);
    if (next === current) return;
    setDrafts((prev) => ({ ...prev, [post.id]: next }));
    if (await update(post.id, { text: next })) {
      setPosts((prev) => prev.map((p) => (p.id === post.id ? { ...p, text: next } : p)));
    }
  }

  // 本文をクリップボードにコピーする（X の投稿画面に貼り付けて使う）
  // 以前は X の投稿画面を開いていたが、スマホでは X アプリ内のブラウザで開いてうまく動かなかった
  async function copyText(post: XPost) {
    // 計測用パラメータが無い URL（機能追加前に作った候補）にも付けてからコピーする
    const current = drafts[post.id] ?? post.text;
    const finalText = setPostFormat(current, getPostFormat(current));
    if (finalText !== post.text) {
      setDrafts((prev) => ({ ...prev, [post.id]: finalText }));
      if (await update(post.id, { text: finalText })) {
        setPosts((prev) => prev.map((p) => (p.id === post.id ? { ...p, text: finalText } : p)));
      }
    }
    await copyToClipboard(finalText);
    setCopiedId(post.id);
    setTimeout(() => setCopiedId((id) => (id === post.id ? null : id)), 3000);
  }

  const pendingCount = posts.filter((p) => p.status === 'pending').length;

  return (
    <div className="min-h-screen bg-gray-900 text-white p-4 md:p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-2xl md:text-3xl font-bold mb-2">X 投稿</h1>

        <section className="mb-10">
          <h2 className="text-xl font-bold mb-1">投稿すると効果的な作品</h2>
          <p className="text-gray-400 text-sm mb-4">
            直近{recommendDays}日間の反応（FANZA へのリンク・スワイプ後の再生・再生・いいね）とランキングから、まだ紹介していない作品を反応の大きい順に表示しています。
            「投稿文を作る」→「本文をコピー」→ X に貼り付けて投稿・予約 →「紹介済みにする」の順で進めてください。紹介済みにした作品は、この一覧に出なくなります。
          </p>
          {recommendError ? (
            <div className="text-red-400 text-sm">{recommendError}</div>
          ) : recommended === null ? (
            <div className="text-gray-400 text-sm">読み込み中...</div>
          ) : recommended.length === 0 ? (
            <div className="bg-gray-800 rounded-lg p-6 text-center text-gray-400 text-sm">いまおすすめできる作品はありません。</div>
          ) : (
            <div className="grid md:grid-cols-2 gap-3">
              {recommended.map((video) => (
                <RecommendedCard key={video.dmm_content_id} video={video} onPosted={() => markPosted(video.dmm_content_id)} />
              ))}
            </div>
          )}
        </section>

        <h2 className="text-xl font-bold mb-1">ストック・紹介した作品</h2>
        <p className="text-gray-400 text-sm mb-4">
          紹介済みにした作品と、以前の毎週の自動作成で作った候補です（前日以降の分）。
          画像を添付する場合は、先に投稿形式を「画像4枚」にしてから「本文をコピー」を押してください（効果測定のため）。
        </p>
        <div className="flex flex-wrap items-center gap-3 mb-4">
          <span className="text-gray-300 text-sm">未予約: {pendingCount}件</span>
          {message && <span className="text-yellow-300 text-sm">{message}</span>}
        </div>

        {loading ? (
          <div className="text-gray-400">読み込み中...</div>
        ) : posts.length === 0 ? (
          <div className="bg-gray-800 rounded-lg p-8 text-center text-gray-400">
            まだありません。
          </div>
        ) : (
          <div className="space-y-4">
            {posts.map((post) => {
              const text = drafts[post.id] ?? post.text;
              const length = countXWeightedLength(text);
              const scheduled = post.status === 'scheduled';
              return (
                <div
                  key={post.id}
                  className={`rounded-lg p-4 ${scheduled ? 'bg-gray-800/50 opacity-60' : 'bg-gray-800'}`}
                >
                  <div className="flex flex-wrap items-center gap-2 mb-3">
                    <span className="text-lg font-bold">{formatSlot(post.slot_at)}</span>
                    <span className="text-xs bg-gray-700 px-2 py-0.5 rounded">{SLOT_LABEL[post.slot_type]}</span>
                    {scheduled && <span className="text-xs bg-green-700 px-2 py-0.5 rounded">予約済み</span>}
                    <div className="ml-auto flex items-center gap-1 text-xs" title="Google Analytics で効果を比べるため、リンクの utm_content に入ります">
                      <span className="text-gray-400">投稿形式:</span>
                      {(Object.keys(X_POST_FORMAT_LABEL) as XPostFormat[]).map((format) => (
                        <button
                          key={format}
                          onClick={() => changeFormat(post, format)}
                          disabled={scheduled}
                          className={`px-2 py-0.5 rounded ${getPostFormat(text) === format ? 'bg-blue-600' : 'bg-gray-700 hover:bg-gray-600'}`}
                        >
                          {X_POST_FORMAT_LABEL[format]}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="flex flex-col md:flex-row gap-4">
                    {post.thumbnail_url && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={post.thumbnail_url} alt={post.title} className="w-full md:w-40 rounded object-cover" />
                    )}
                    <div className="flex-1 min-w-0">
                      <textarea
                        value={text}
                        onChange={(e) => setDrafts((prev) => ({ ...prev, [post.id]: e.target.value }))}
                        onBlur={() => saveText(post)}
                        rows={8}
                        disabled={scheduled}
                        className="w-full bg-gray-900 text-white text-sm p-2 rounded border border-gray-700"
                      />
                      <div className={`text-xs mt-1 ${length > X_MAX_WEIGHTED_LENGTH ? 'text-red-400' : 'text-gray-400'}`}>
                        {length} / {X_MAX_WEIGHTED_LENGTH}
                      </div>
                    </div>
                  </div>

                  {!scheduled && (
                    <div className="mt-3">
                      <SampleImagePicker
                        contentId={post.dmm_content_id}
                        text={text}
                        onUseImages={() => changeFormat(post, 'img4')}
                      />
                    </div>
                  )}

                  <div className="flex flex-wrap gap-2 mt-3">
                    {scheduled ? (
                      <button
                        onClick={() => setStatus(post, 'pending')}
                        className="bg-gray-700 hover:bg-gray-600 px-3 py-1.5 rounded text-sm"
                      >
                        未予約に戻す
                      </button>
                    ) : (
                      <>
                        <button
                          onClick={() => copyText(post)}
                          disabled={length > X_MAX_WEIGHTED_LENGTH}
                          className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 px-3 py-1.5 rounded text-sm font-bold"
                        >
                          {copiedId === post.id ? 'コピーしました' : '本文をコピー'}
                        </button>
                        <button
                          onClick={() => setStatus(post, 'scheduled')}
                          className="bg-green-700 hover:bg-green-600 px-3 py-1.5 rounded text-sm"
                        >
                          予約済みにする
                        </button>
                        <button
                          onClick={() => setStatus(post, 'skipped')}
                          className="bg-gray-700 hover:bg-gray-600 px-3 py-1.5 rounded text-sm"
                          title="この候補を外します（作品はまたおすすめに出るようになります）"
                        >
                          スキップ
                        </button>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
