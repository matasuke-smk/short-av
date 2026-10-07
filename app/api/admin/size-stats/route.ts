import { NextRequest, NextResponse } from 'next/server';
import { getSizeStatisticsRows, summarizeForAdmin, summarizeSizeStatistics } from '@/lib/sizeStats';

// 管理画面用（middleware.ts のBasic認証で保護）
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const erectionState = searchParams.get('erectionState') || 'erect';
    const ageGroup = searchParams.get('ageGroup');

    const rows = await getSizeStatisticsRows(erectionState, ageGroup);
    return NextResponse.json({ ...summarizeSizeStatistics(rows, erectionState), admin: summarizeForAdmin(rows, erectionState), rawData: rows });
  } catch (error) {
    console.error('Admin size stats GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
