/**
 * X 予約投稿ストックの生成（vercel.json で毎週水曜 9:00 JST に実行）
 * 翌日の木曜から次の水曜までの7日分 × 1日3枠を作る。
 */

import { NextResponse } from 'next/server';
import { generateUpcomingWeek } from '@/lib/x-posts';

export const dynamic = 'force-dynamic';

function verifyCronRequest(request: Request): boolean {
  if (process.env.CRON_SECRET) {
    return request.headers.get('authorization') === `Bearer ${process.env.CRON_SECRET}`;
  }
  return process.env.NODE_ENV === 'development';
}

export async function GET(request: Request) {
  if (!verifyCronRequest(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const result = await generateUpcomingWeek();
    console.info('[X posts] 生成完了:', JSON.stringify(result));
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    console.error('[X posts] 生成エラー:', error);
    return NextResponse.json({ success: false, error: 'Failed to generate' }, { status: 500 });
  }
}
