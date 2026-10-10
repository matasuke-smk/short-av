import { getSupabaseAdmin } from '@/lib/supabase-admin';
import type { DmmReportRow } from '@/lib/dmm-reports-shared';

export { parseDmmReportText, sumDmmReports, emptyDmmTotals, type DmmReportRow } from '@/lib/dmm-reports-shared';

/**
 * DMM（FANZA）アフィリエイトの実績（sql/015_dmm_reports.sql）。
 * レポートは API で取れないので、管理画面のレポートの表を貼り付けて日ごとに保存する（サーバー専用）
 */
/** 直近 days 日の記録（日付の新しい順） */
export async function getDmmReports(days = 35): Promise<DmmReportRow[]> {
  const since = new Date(Date.now() + 9 * 3_600_000 - days * 86_400_000).toISOString().slice(0, 10);
  const { data, error } = await getSupabaseAdmin()
    .from('dmm_reports')
    .select('date, clicks, direct_count, direct_yen, category_count, category_yen, new_count, new_yen')
    .gte('date', since)
    .order('date', { ascending: false });
  if (error) throw error;
  return (data ?? []) as DmmReportRow[];
}

export async function upsertDmmReports(rows: DmmReportRow[]): Promise<number> {
  if (rows.length === 0) return 0;
  const { error } = await getSupabaseAdmin()
    .from('dmm_reports')
    .upsert(rows.map((r) => ({ ...r, updated_at: new Date().toISOString() })), { onConflict: 'date' });
  if (error) throw error;
  return rows.length;
}
