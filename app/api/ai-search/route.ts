import { NextRequest, NextResponse } from 'next/server';
import { parseSearchQuery } from '@/lib/ai-search';
import { getClientIp } from '@/lib/request-info';

/**
 * 利用者向け: 言葉を検索の条件に変える。POST { q }
 * 乱用対策: 1つの IP から 1 分に 12 回まで（サーバーの記憶に残す簡易なもの）。q は 60 文字まで
 */
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

const hits = new Map<string, number[]>();
function allowed(ip: string): boolean {
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < 60_000);
  if (recent.length >= 12) return false;
  recent.push(now);
  hits.set(ip, recent);
  if (hits.size > 5000) hits.clear();
  return true;
}

export async function POST(request: NextRequest) {
  const ip = getClientIp(request) || 'unknown';
  if (!allowed(ip)) return NextResponse.json({ error: '少し待ってからもう一度お試しください' }, { status: 429 });
  const { q } = (await request.json().catch(() => ({}))) as { q?: unknown };
  const text = typeof q === 'string' ? q.replace(/\s+/g, ' ').trim().slice(0, 60) : '';
  if (!text) return NextResponse.json({ error: '言葉を入れてください' }, { status: 400 });
  try {
    const filters = await parseSearchQuery(text);
    if (!filters) return NextResponse.json({ error: 'いまは使えません' }, { status: 503 });
    return NextResponse.json(filters);
  } catch (error) {
    console.error('[ai-search]', error);
    return NextResponse.json({ error: '読み取れませんでした' }, { status: 500 });
  }
}
