import { NextResponse } from 'next/server';
import { getArticleIdeas, runArticleIdeas } from '@/lib/article-ideas';
import { isClaudeConfigured } from '@/lib/claude';
import { withDoneMarks } from '@/lib/article-ideas-done';

// 管理画面「男のからだ研究室」の「記事のネタ」用（middleware.ts の認証で保護）
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

export async function GET() {
  // 記事にした・加筆したネタに印（done[i] = 日付 or null）を付けて返す（2026-10-27）
  return NextResponse.json({ configured: isClaudeConfigured(), rows: await withDoneMarks(await getArticleIdeas()) });
}

/** いま作り直す（その週の回を上書き） */
export async function POST() {
  try {
    const row = await runArticleIdeas();
    return NextResponse.json({ row, rows: await withDoneMarks(await getArticleIdeas()) });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}
