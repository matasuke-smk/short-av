import { NextRequest, NextResponse } from 'next/server';
import { aiTextCounts, generateActressIntros, generateVideoDescriptions } from '@/lib/ai-descriptions';
import { isClaudeConfigured } from '@/lib/claude';

// 管理画面「AI 文章」用（middleware.ts の認証で保護）。作品・女優の紹介文を Claude に書かせる
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

export async function GET() {
  try {
    return NextResponse.json({ configured: isClaudeConfigured(), ...(await aiTextCounts()) });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => ({}))) as { kind?: string; limit?: number; dryRun?: boolean };
  const limit = Math.min(60, Math.max(1, Number(body.limit) || 10));
  try {
    const results = body.kind === 'actress' ? await generateActressIntros(limit, !!body.dryRun) : await generateVideoDescriptions(limit, !!body.dryRun);
    const yen = Math.round(results.reduce((a, r) => a + r.yen, 0) * 100) / 100;
    return NextResponse.json({ results, yen, ...(await aiTextCounts()) });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}
