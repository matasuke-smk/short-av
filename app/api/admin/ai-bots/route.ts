import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

// 管理画面「AI の読み取り」用（middleware.ts の認証で保護）。sql/018 の ai_bot_hits を集計する
export const dynamic = 'force-dynamic';

const KEEP_DAYS = 60;

type Hit = { at: string; bot: string; path: string; referer: string | null };

function count(rows: { key: string }[]) {
  const map = new Map<string, number>();
  for (const r of rows) map.set(r.key, (map.get(r.key) ?? 0) + 1);
  return [...map.entries()].sort((a, b) => b[1] - a[1]).map(([key, n]) => ({ key, n }));
}

export async function GET(request: Request) {
  const days = Math.min(90, Math.max(1, Number(new URL(request.url).searchParams.get('days')) || 28));
  const supabase = getSupabaseAdmin();
  // 古い記録を消す（60日より前）。失敗しても表示は続ける
  await supabase.from('ai_bot_hits').delete().lt('at', new Date(Date.now() - KEEP_DAYS * 86_400_000).toISOString()).then(() => undefined, () => undefined);

  const since = new Date(Date.now() - days * 86_400_000).toISOString();
  const { data, error } = await supabase
    .from('ai_bot_hits')
    .select('at, bot, path, referer')
    .gte('at', since)
    .order('at', { ascending: false })
    .limit(5000);
  if (error) {
    // 表がまだ無い（sql/018 未実行）ときはその旨を返す
    return NextResponse.json({ error: error.message, missingTable: /ai_bot_hits/.test(error.message) }, { status: 500 });
  }
  const hits = (data ?? []) as Hit[];
  // 日本時間の日付ごとの回数（グラフ用）
  const byDate = count(hits.map((h) => ({ key: new Date(new Date(h.at).getTime() + 9 * 3_600_000).toISOString().slice(0, 10) }))).sort((a, b) => a.key.localeCompare(b.key));
  return NextResponse.json({
    days,
    total: hits.length,
    bots: count(hits.map((h) => ({ key: h.bot }))),
    paths: count(hits.map((h) => ({ key: h.path.split('?')[0] }))).slice(0, 40),
    // ChatGPT が「回答のために読んだ」ページ（ChatGPT-User）だけのページ別。紹介に使われているページがこれ
    chatgptPaths: count(hits.filter((h) => h.bot === 'ChatGPT-User').map((h) => ({ key: h.path.split('?')[0] }))).slice(0, 40),
    byDate,
    recent: hits.slice(0, 60),
  });
}
