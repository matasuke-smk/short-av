import { NextResponse } from 'next/server';
import { runDailySummary } from '@/lib/daily-summary';

// 管理画面用（middleware.ts の認証で保護）。今朝の要約をその場で作り直す（FANZA 実績を更新したあとなど。2026-10-26）
export const dynamic = 'force-dynamic';
export const maxDuration = 120;

export async function POST() {
  try {
    const result = await runDailySummary();
    return NextResponse.json({ ok: true, item: { date: result.date, summary: result.summary, yen: result.yen, created_at: new Date().toISOString() } });
  } catch (error) {
    console.error('[admin/daily-summary]', error);
    return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}
