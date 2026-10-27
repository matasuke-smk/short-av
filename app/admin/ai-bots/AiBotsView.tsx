'use client';

import { useEffect, useState } from 'react';

type Count = { key: string; n: number };
type Data = {
  days: number;
  total: number;
  bots: Count[];
  paths: Count[];
  chatgptPaths: Count[];
  byDate: Count[];
  recent: { at: string; bot: string; path: string; referer: string | null }[];
};

const RANGES = [
  { days: 1, label: '今日〜昨日' },
  { days: 7, label: '7日間' },
  { days: 28, label: '28日間' },
] as const;

// ボットの名前の説明（何をしに来たか）
const BOT_NOTE: Record<string, string> = {
  'OAI-SearchBot': 'ChatGPT の検索用（回答に出すサイトを集める）',
  'ChatGPT-User': 'ChatGPT が回答のためにその場で読んだ',
  GPTBot: 'OpenAI の学習用（robots.txt で拒否中）',
  PerplexityBot: 'Perplexity の検索用',
  'Perplexity-User': 'Perplexity が回答のために読んだ',
  'Claude-SearchBot': 'Claude の検索用',
  'Claude-User': 'Claude が回答のために読んだ',
  ClaudeBot: 'Anthropic の学習用',
  'Google-Extended': 'Google の AI 学習用（拒否中）',
  DuckAssistBot: 'DuckDuckGo の AI 用',
  Amazonbot: 'Amazon（Alexa）用',
  'meta-externalagent': 'Meta の AI 用',
  'meta-webindexer': 'Meta（Facebook）の検索・AI 用（robots.txt を守らず /go を開く）',
  Bytespider: 'ByteDance（TikTok）の AI 用',
};

const fmtTime = (iso: string) => new Date(iso).toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });

/**
 * AI のボット（ChatGPT など）がどのページを読んだか（sql/018 ai_bot_hits、middleware.ts で記録）。
 * ChatGPT からの訪問を伸ばすため、どのページが回答に使われているかを見る（2026-10-24）
 */
export default function AiBotsView() {
  const [days, setDays] = useState<number>(7);
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    setData(null);
    setError('');
    fetch(`/api/admin/ai-bots?days=${days}`)
      .then(async (r) => {
        const json = await r.json().catch(() => null);
        if (!r.ok) throw new Error(json?.missingTable ? '記録の表がまだありません（sql/018_ai_bot_hits.sql を本番で実行してください）' : json?.error ?? '取得できませんでした');
        return json as Data;
      })
      .then(setData)
      .catch((e: Error) => setError(e.message));
  }, [days]);

  const max = Math.max(1, ...(data?.byDate.map((d) => d.n) ?? [1]));
  const card = 'bg-gray-800 rounded-lg p-3 md:p-4';
  const row = 'flex items-center justify-between gap-3 py-1.5 border-b border-gray-700/60 text-sm';

  return (
    <main className="min-h-screen bg-gray-900 text-white px-2 py-3 md:p-6">
      <div className="max-w-5xl mx-auto space-y-4">
        <section className={card}>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-lg md:text-xl font-bold mr-auto">AI の読み取り</h1>
            {RANGES.map((r) => (
              <button
                key={r.days}
                type="button"
                onClick={() => setDays(r.days)}
                className={`px-3 py-1.5 rounded-lg text-sm ${days === r.days ? 'bg-blue-600 font-bold' : 'bg-gray-700 hover:bg-gray-600'}`}
              >
                {r.label}
              </button>
            ))}
          </div>
          <p className="text-xs text-gray-400 mt-2">
            ChatGPT などの AI のロボットがサイトのどのページを読んだかの記録です。「ChatGPT-User」は ChatGPT が回答を作るためにその場で読んだページなので、ここに出るページが紹介に使われています。
          </p>
          {error && <p className="mt-3 text-sm text-yellow-300">{error}</p>}
          {!data && !error && <p className="mt-3 text-sm text-gray-400">読み込んでいます…</p>}
          {data && (
            <>
              <p className="mt-3 text-2xl font-bold">
                {data.total.toLocaleString()}
                <span className="ml-1 text-sm font-normal text-gray-400">回（{data.days}日間）</span>
              </p>
              {data.byDate.length > 0 && (
                <div className="mt-3 flex items-end gap-1 h-20">
                  {data.byDate.map((d) => (
                    <div key={d.key} className="flex-1 flex flex-col items-center justify-end h-full" title={`${d.key}: ${d.n}回`}>
                      <div className="w-full bg-blue-500 rounded-t" style={{ height: `${Math.max(2, (d.n / max) * 100)}%` }} />
                      <span className="text-[9px] text-gray-500 mt-0.5">{d.key.slice(5).replace('-', '/')}</span>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </section>

        {data && (
          <div className="grid gap-4 md:grid-cols-2">
            <section className={card}>
              <h2 className="font-bold">ボットごと</h2>
              {data.bots.length === 0 && <p className="mt-2 text-sm text-gray-400">まだ記録がありません</p>}
              {data.bots.map((b) => (
                <div key={b.key} className={row}>
                  <div className="min-w-0">
                    <div className="font-mono text-xs md:text-sm truncate">{b.key}</div>
                    {BOT_NOTE[b.key] && <div className="text-[11px] text-gray-500">{BOT_NOTE[b.key]}</div>}
                  </div>
                  <div className="font-bold tabular-nums">{b.n.toLocaleString()}</div>
                </div>
              ))}
            </section>
            <section className={card}>
              <h2 className="font-bold">ChatGPT が回答のために読んだページ</h2>
              <p className="text-[11px] text-gray-500 mt-0.5">ChatGPT-User のみ。紹介に使われているページ</p>
              {data.chatgptPaths.length === 0 && <p className="mt-2 text-sm text-gray-400">まだ記録がありません</p>}
              {data.chatgptPaths.map((p) => (
                <div key={p.key} className={row}>
                  <a href={p.key} target="_blank" rel="noopener noreferrer" className="font-mono text-xs md:text-sm truncate text-blue-300 hover:underline">{p.key}</a>
                  <div className="font-bold tabular-nums">{p.n.toLocaleString()}</div>
                </div>
              ))}
            </section>
            <section className={card}>
              <h2 className="font-bold">ページごと（すべてのボット）</h2>
              {data.paths.map((p) => (
                <div key={p.key} className={row}>
                  <a href={p.key} target="_blank" rel="noopener noreferrer" className="font-mono text-xs md:text-sm truncate text-blue-300 hover:underline">{p.key}</a>
                  <div className="font-bold tabular-nums">{p.n.toLocaleString()}</div>
                </div>
              ))}
            </section>
            <section className={card}>
              <h2 className="font-bold">最近の記録</h2>
              {data.recent.map((h, i) => (
                <div key={i} className="py-1.5 border-b border-gray-700/60 text-xs">
                  <span className="text-gray-400 tabular-nums">{fmtTime(h.at)}</span>
                  <span className="ml-2 font-mono text-gray-300">{h.bot}</span>
                  <div className="font-mono text-blue-300 truncate">{h.path}</div>
                </div>
              ))}
            </section>
          </div>
        )}
      </div>
    </main>
  );
}
