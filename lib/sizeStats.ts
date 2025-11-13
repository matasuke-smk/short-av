import { supabase } from '@/lib/supabase';

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

    // 統計を計算
    if (data && data.length > 0) {
      const lengths = data.map(d => d.length_mm);
      const diameters = data.map(d => d.diameter_mm);

      const avgLength = lengths.reduce((a, b) => a + b, 0) / lengths.length;
      const avgDiameter = diameters.reduce((a, b) => a + b, 0) / diameters.length;

      // 標準偏差を計算
      const stdLength = Math.sqrt(
        lengths.reduce((sum, val) => sum + Math.pow(val - avgLength, 2), 0) / lengths.length
      );
      const stdDiameter = Math.sqrt(
        diameters.reduce((sum, val) => sum + Math.pow(val - avgDiameter, 2), 0) / diameters.length
      );

      return {
        count: data.length,
        statistics: {
          avgLength: avgLength.toFixed(1),
          avgDiameter: avgDiameter.toFixed(1),
          stdLength: stdLength.toFixed(1),
          stdDiameter: stdDiameter.toFixed(1),
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
  html += '<div ' + cls + '="stats-subvalue">mm（SD: ' + stats.statistics.stdLength + 'mm）</div>';
  html += '</div>';
  html += '<div ' + cls + '="stats-half-item">';
  html += '<div ' + cls + '="stats-label">平均直径</div>';
  html += '<div ' + cls + '="stats-value">' + stats.statistics.avgDiameter + '</div>';
  html += '<div ' + cls + '="stats-subvalue">mm（SD: ' + stats.statistics.stdDiameter + 'mm）</div>';
  html += '</div>';
  html += '</div>';
  html += '</div>';

  return html;
}
