import { NextRequest, NextResponse } from 'next/server';
import { getDmmReports, parseDmmReportText, upsertDmmReports } from '@/lib/dmm-reports';

// 管理画面用（middleware.ts の認証で保護）。DMM アフィリエイトの実績の読み書き
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    return NextResponse.json({ rows: await getDmmReports(60) });
  } catch (error) {
    console.error('[dmm-reports] 取得エラー:', error);
    return NextResponse.json({ error: '取得できませんでした。sql/015_dmm_reports.sql は実行済みですか' }, { status: 500 });
  }
}

// 貼り付けた表（text）を日ごとに保存する
export async function POST(request: NextRequest) {
  try {
    const body = (await request.json().catch(() => null)) as { text?: string } | null;
    const rows = parseDmmReportText(body?.text ?? '');
    if (rows.length === 0) return NextResponse.json({ error: '日付とクリック数の行が見つかりませんでした' }, { status: 400 });
    const saved = await upsertDmmReports(rows);
    return NextResponse.json({ saved, dates: rows.map((r) => r.date), rows: await getDmmReports(60) });
  } catch (error) {
    console.error('[dmm-reports] 保存エラー:', error);
    return NextResponse.json({ error: '保存できませんでした。sql/015_dmm_reports.sql は実行済みですか' }, { status: 500 });
  }
}
