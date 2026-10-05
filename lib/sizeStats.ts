import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { computeRobustStat } from '@/lib/robustStats';

export type SizeStatisticsRow = {
  id: number;
  length_mm: number;
  diameter_mm: number;
  erection_state: string;
  age_group: string | null;
  created_at: string;
};

/**
 * サイズ統計の生データを取得（サーバー専用）
 * user_identifier はいいね履歴と紐付けられるため、絶対に返さない
 */
export async function getSizeStatisticsRows(
  erectionState: string = 'erect',
  ageGroup?: string | null,
): Promise<SizeStatisticsRow[]> {
  let query = getSupabaseAdmin()
    .from('size_statistics')
    .select('id, length_mm, diameter_mm, erection_state, age_group, created_at')
    .eq('erection_state', erectionState)
    .order('created_at', { ascending: false });

  if (ageGroup) {
    query = query.eq('age_group', ageGroup);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}

/**
 * 生データから集計値を計算（外れ値はIQR法で除外し、平均・標準偏差の汚染を防ぐ）
 */
export function summarizeSizeStatistics(rows: SizeStatisticsRow[]) {
  if (rows.length === 0) {
    return { count: 0, statistics: null };
  }

  const lengthStat = computeRobustStat(rows.map(d => d.length_mm));
  const diameterStat = computeRobustStat(rows.map(d => d.diameter_mm));

  return {
    count: rows.length,
    statistics: {
      avgLength: lengthStat.avg.toFixed(1),
      avgDiameter: diameterStat.avg.toFixed(1),
      stdLength: lengthStat.std.toFixed(1),
      stdDiameter: diameterStat.std.toFixed(1),
    },
  };
}

export async function getSizeStatistics(erectionState: 'erect' | 'flaccid' = 'erect') {
  try {
    return summarizeSizeStatistics(await getSizeStatisticsRows(erectionState));
  } catch (error) {
    console.error('Size stats query error:', error);
    return null;
  }
}

export function generateStatsHTML(stats: { count: number; statistics: any } | null): string {
  if (!stats || stats.count === 0) {
    return '<div class="stats-loading">まだデータが収集されていません</div>';
  }

  const cls = 'class';
  let html = '';
  html += '<div ' + cls + '="stats-item">';
  html += '<div ' + cls + '="stats-label">データ件数</div>';
  html += '<div ' + cls + '="stats-value">' + stats.count + '</div>';
  html += '<div ' + cls + '="stats-subvalue">人</div>';
  html += '</div>';

  html += '<div ' + cls + '="stats-item-wide">';
  html += '<div ' + cls + '="stats-double-container">';
  html += '<div ' + cls + '="stats-half-item">';
  html += '<div ' + cls + '="stats-label">平均長さ</div>';
  html += '<div ' + cls + '="stats-value">' + stats.statistics.avgLength + '</div>';
  html += '<div ' + cls + '="stats-subvalue">mm（標準偏差: ' + stats.statistics.stdLength + 'mm）</div>';
  html += '</div>';
  html += '<div ' + cls + '="stats-half-item">';
  html += '<div ' + cls + '="stats-label">平均直径</div>';
  html += '<div ' + cls + '="stats-value">' + stats.statistics.avgDiameter + '</div>';
  html += '<div ' + cls + '="stats-subvalue">mm（標準偏差: ' + stats.statistics.stdDiameter + 'mm）</div>';
  html += '</div>';
  html += '</div>';
  html += '</div>';

  return html;
}
