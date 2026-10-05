'use client';

import { useCallback, useEffect, useState } from 'react';
import { buildXIntentUrl, countXWeightedLength, X_MAX_WEIGHTED_LENGTH } from '@/lib/x-post-text';

type XPost = {
  id: string;
  slot_at: string;
  slot_type: 'new' | 'ranking' | 'random';
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
};

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
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

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

  useEffect(() => {
    fetchPosts();
  }, [fetchPosts]);

  async function generate() {
    setBusy(true);
    setMessage('');
    try {
      const response = await fetch('/api/admin/x-posts', { method: 'POST' });
      if (!response.ok) throw new Error();
      const data = await response.json();
      setMessage(data.created > 0 ? `${data.created}件の候補を作成しました` : '作成が必要な枠はありません');
      await fetchPosts();
    } catch {
      setMessage('作成に失敗しました');
    } finally {
      setBusy(false);
    }
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

  async function openInX(post: XPost) {
    await saveText(post);
    window.open(buildXIntentUrl(drafts[post.id]), '_blank', 'noopener');
  }

  const pendingCount = posts.filter((p) => p.status === 'pending').length;

  return (
    <div className="min-h-screen bg-gray-900 text-white p-4 md:p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-2xl md:text-3xl font-bold mb-2">X 予約投稿ストック</h1>
        <p className="text-gray-400 text-sm mb-6">
          毎週水曜 9時に翌日（木曜）から1週間分の候補が自動で作られます。
          「X で開く」→ X の投稿画面で表示中の日時に予約 →「予約済みにする」の順で進めてください。
        </p>

        <div className="flex flex-wrap items-center gap-3 mb-6">
          <button
            onClick={generate}
            disabled={busy}
            className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 px-4 py-2 rounded font-bold"
          >
            {busy ? '作成中...' : '1週間分を作成（空き枠のみ）'}
          </button>
          <span className="text-gray-300 text-sm">未予約: {pendingCount}件</span>
          {message && <span className="text-yellow-300 text-sm">{message}</span>}
        </div>

        {loading ? (
          <div className="text-gray-400">読み込み中...</div>
        ) : posts.length === 0 ? (
          <div className="bg-gray-800 rounded-lg p-8 text-center text-gray-400">
            候補がありません。「1週間分を作成」を押してください。
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
                          onClick={() => openInX(post)}
                          disabled={length > X_MAX_WEIGHTED_LENGTH}
                          className="bg-black border border-gray-600 hover:bg-gray-950 disabled:opacity-50 px-3 py-1.5 rounded text-sm font-bold"
                        >
                          X で開く
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
                          title="この候補を外します。もう一度「1週間分を作成」を押すと、この枠に別の作品が入ります"
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
