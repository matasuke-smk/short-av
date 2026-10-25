import { NextRequest, NextResponse } from 'next/server';
import { runArticleIdeas } from '@/lib/article-ideas';

/**
 * 検索語からの記事のネタ出し（Vercel の定期実行、毎週月曜 日本時間 10:00 = UTC 1:00。vercel.json）
 */
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

export async function GET(request: NextRequest) {
  const auth = request.headers.get('authorization');
  const secrets = [process.env.CRON_SECRET, process.env.REALTIME_CRON_SECRET].filter(Boolean);
  if (!auth || !secrets.some((secret) => auth === `Bearer ${secret}`)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  try {
    const row = await runArticleIdeas();
    return NextResponse.json({ ok: true, week: row.week, ideas: row.ideas.length, yen: row.yen });
  } catch (error) {
    console.error('[article-ideas]', error);
    return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}
