import { supabase } from '@/lib/supabase';
import { computeRobustStat } from '@/lib/robustStats';

export async function getSizeStatistics(erectionState: 'erect' | 'flaccid' = 'erect') {
  try {
    const { data, error } = await supabase
      .from('size_statistics')
      .select('*')
      .eq('erection_state', erectionState);

    if (error) {
      console.error('Size stats query error:', error);
      return null;
    }

    // 統計を計算（外れ値はIQR法で除外し、平均・標準偏差の汚染を防ぐ）
    if (data && data.length > 0) {
      const lengthStat = computeRobustStat(data.map(d => d.length_mm));
      const diameterStat = computeRobustStat(data.map(d => d.diameter_mm));

      return {
        count: data.length,
        statistics: {
          avgLength: lengthStat.avg.toFixed(1),
          avgDiameter: diameterStat.avg.toFixed(1),
          stdLength: lengthStat.std.toFixed(1),
          stdDiameter: diameterStat.std.toFixed(1),
        },
      };
    }

    return {
      count: 0,
      statistics: null,
    };
  } catch (error) {
    console.error('Size stats GET error:', error);
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
