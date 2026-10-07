import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { computeMeanStd, computeRobustStat } from '@/lib/robustStats';

export type SizeStatisticsRow = {
  id: number;
  length_mm: number;
  diameter_mm: number;
  erection_state: string;
  age_group: string | null;
  created_at: string;
};

// 平均の計算に含める長さの範囲（入力値そのもので判定）。この範囲外は測り方の誤りや冗談の可能性が高い
export const LENGTH_RANGE_MM = { min: 100, max: 170 } as const;
// 自己申告は実測より大きめに出やすいため、平均の計算時に長さから一律に差し引く量（DB には入力値のまま保存）
export const SELF_REPORT_CORRECTION_MM = 5;

// 比較用の基準（Veale ら 2015年のメタ分析。サイズ比較ツールに載せている値）
export const REFERENCE_LENGTH_MM = { erect: 131, flaccid: 92 } as const;

const PAGE_SIZE = 1000;

/**
 * サイズ統計の生データを取得（サーバー専用）
 * user_identifier / ip_hash は他の情報と紐付けられるため、絶対に返さない
 */
export async function getSizeStatisticsRows(
  erectionState: string = 'erect',
  ageGroup?: string | null,
): Promise<SizeStatisticsRow[]> {
  // PostgREST の 1000 行上限で切れないよう、id 順にページを分けて全件取得する
  const rows: SizeStatisticsRow[] = [];
  for (let offset = 0; ; offset += PAGE_SIZE) {
    let query = getSupabaseAdmin()
      .from('size_statistics')
      .select('id, length_mm, diameter_mm, erection_state, age_group, created_at')
      .eq('erection_state', erectionState)
      .order('id', { ascending: false })
      .range(offset, offset + PAGE_SIZE - 1);
    if (ageGroup) {
      query = query.eq('age_group', ageGroup);
    }

    const { data, error } = await query;
    if (error) throw error;
    rows.push(...(data ?? []));
    if (!data || data.length < PAGE_SIZE) break;
  }
  return rows;
}

/**
 * 生データから集計値を計算
 * - 長さ: 入力値が LENGTH_RANGE_MM の範囲内のものだけを使い、自己申告分を補正（SELF_REPORT_CORRECTION_MM を差し引く）
 * - 直径: IQR法で外れ値を除外
 * count は長さの平均の計算に使った件数
 */
export function summarizeSizeStatistics(rows: SizeStatisticsRow[]) {
  const usable = rows.filter(d => d.length_mm >= LENGTH_RANGE_MM.min && d.length_mm <= LENGTH_RANGE_MM.max);
  if (usable.length === 0) {
    return { count: 0, statistics: null };
  }

  const lengthStat = computeMeanStd(usable.map(d => d.length_mm - SELF_REPORT_CORRECTION_MM));
  const diameterStat = computeRobustStat(usable.map(d => d.diameter_mm));

  return {
    count: usable.length,
    statistics: {
      avgLength: lengthStat.avg.toFixed(1),
      avgDiameter: diameterStat.avg.toFixed(1),
      stdLength: lengthStat.std.toFixed(1),
      stdDiameter: diameterStat.std.toFixed(1),
    },
  };
}

/**
 * 管理画面用: 件数の内訳と、長さの補正の比較
 * - 今の補正: 一律 SELF_REPORT_CORRECTION_MM を差し引く
 * - 中間案: 補正前の平均と基準（REFERENCE_LENGTH_MM）の中間を平均にする（差し引く量 = 差の半分。基準より小さければ補正しない）
 */
export function summarizeForAdmin(rows: SizeStatisticsRow[], erectionState: string) {
  const usable = rows.filter(d => d.length_mm >= LENGTH_RANGE_MM.min && d.length_mm <= LENGTH_RANGE_MM.max);
  const reference = erectionState === 'flaccid' ? REFERENCE_LENGTH_MM.flaccid : REFERENCE_LENGTH_MM.erect;
  const rawAvg = usable.length > 0 ? usable.reduce((sum, d) => sum + d.length_mm, 0) / usable.length : null;
  const midpointCorrection = rawAvg === null ? null : Math.max(0, (rawAvg - reference) / 2);
  return {
    total: rows.length,
    outOfRange: rows.length - usable.length,
    lengthRangeMm: LENGTH_RANGE_MM,
    correctionMm: SELF_REPORT_CORRECTION_MM,
    referenceLengthMm: reference,
    rawAvgLength: rawAvg === null ? null : rawAvg.toFixed(1),
    midpointCorrectionMm: midpointCorrection === null ? null : midpointCorrection.toFixed(1),
    midpointAvgLength: rawAvg === null || midpointCorrection === null ? null : (rawAvg - midpointCorrection).toFixed(1),
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
  html += '<div ' + cls + '="stats-label">集計に使った件数</div>';
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

  // 集計方法の注記（範囲と補正量は定数から出す）
  html += '<p style="grid-column: 1 / -1; font-size: 0.75rem; color: #9ca3af; margin: 0.5rem 0 0;">'
    + '※長さ ' + LENGTH_RANGE_MM.min / 10 + '〜' + LENGTH_RANGE_MM.max / 10 + 'cm の入力のみ集計し、'
    + '自己申告は大きめに出やすいため長さから ' + SELF_REPORT_CORRECTION_MM + 'mm 差し引いています。'
    + '</p>';

  return html;
}
