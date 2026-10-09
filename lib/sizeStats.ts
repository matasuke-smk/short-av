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

// 長さの補正の基準（Veale ら 2015年のメタ分析。サイズ比較ツールに載せている値）
export const REFERENCE_LENGTH_MM = { erect: 131, flaccid: 92 } as const;
// 直径の基準（同じメタ分析の周囲 勃起時 11.66cm・通常時 9.31cm を直径に換算）
export const REFERENCE_DIAMETER_MM = { erect: 37.2, flaccid: 29.6 } as const;

// 補正前の値を、基準との中間にするために差し引く量（基準以下なら0）
const halfwayCorrection = (rawAvg: number, reference: number) => Math.max(0, (rawAvg - reference) / 2);

/**
 * 自己申告は実測より大きめに出やすいため、長さの平均を「集めたデータの平均と基準の中間」にする。
 * 差し引く量 = (補正前の平均 − 基準) ÷ 2。補正前の平均が基準以下なら補正しない。DB には入力値のまま保存。
 */
function lengthCorrection(usable: SizeStatisticsRow[], erectionState: string) {
  const reference = erectionState === 'flaccid' ? REFERENCE_LENGTH_MM.flaccid : REFERENCE_LENGTH_MM.erect;
  const rawAvg = usable.length > 0 ? usable.reduce((sum, d) => sum + d.length_mm, 0) / usable.length : 0;
  return { reference, rawAvg, correction: halfwayCorrection(rawAvg, reference) };
}

// 直径も同じく「集めたデータと基準の中間」にする（補正前の平均は IQR 法で外れ値を除いたもの）
function diameterCorrection(usable: SizeStatisticsRow[], erectionState: string) {
  const reference = erectionState === 'flaccid' ? REFERENCE_DIAMETER_MM.flaccid : REFERENCE_DIAMETER_MM.erect;
  const raw = computeRobustStat(usable.map(d => d.diameter_mm));
  return { reference, raw, correction: halfwayCorrection(raw.avg, reference) };
}

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
 * - 長さ: 入力値が LENGTH_RANGE_MM の範囲内のものだけを使い、自己申告分を補正（lengthCorrection）
 * - 直径: IQR法で外れ値を除外し、長さと同じく基準との中間に補正（diameterCorrection）
 * count は長さの平均の計算に使った件数
 */
export function summarizeSizeStatistics(rows: SizeStatisticsRow[], erectionState: string = 'erect') {
  const usable = rows.filter(d => d.length_mm >= LENGTH_RANGE_MM.min && d.length_mm <= LENGTH_RANGE_MM.max);
  if (usable.length === 0) {
    return { count: 0, statistics: null };
  }

  const { correction } = lengthCorrection(usable, erectionState);
  const lengthStat = computeMeanStd(usable.map(d => d.length_mm - correction));
  const diameter = diameterCorrection(usable, erectionState);

  return {
    count: usable.length,
    statistics: {
      avgLength: lengthStat.avg.toFixed(1),
      avgDiameter: (diameter.raw.avg - diameter.correction).toFixed(1),
      stdLength: lengthStat.std.toFixed(1),
      stdDiameter: diameter.raw.std.toFixed(1),
    },
  };
}

/** 管理画面用: 件数の内訳と、長さの補正の中身 */
export function summarizeForAdmin(rows: SizeStatisticsRow[], erectionState: string) {
  const usable = rows.filter(d => d.length_mm >= LENGTH_RANGE_MM.min && d.length_mm <= LENGTH_RANGE_MM.max);
  const { reference, rawAvg, correction } = lengthCorrection(usable, erectionState);
  const diameter = diameterCorrection(usable, erectionState);
  return {
    diameterCorrectionMm: diameter.correction.toFixed(1),
    referenceDiameterMm: diameter.reference,
    rawAvgDiameter: diameter.raw.avg.toFixed(1),
    total: rows.length,
    outOfRange: rows.length - usable.length,
    lengthRangeMm: LENGTH_RANGE_MM,
    correctionMm: correction.toFixed(1),
    referenceLengthMm: reference,
    rawAvgLength: rawAvg.toFixed(1),
  };
}

export async function getSizeStatistics(erectionState: 'erect' | 'flaccid' = 'erect') {
  try {
    return summarizeSizeStatistics(await getSizeStatisticsRows(erectionState), erectionState);
  } catch (error) {
    console.error('Size stats query error:', error);
    return null;
  }
}

export function generateStatsHTML(stats: { count: number; statistics: any } | null): string {
  if (!stats || stats.count === 0) {
    return '<div class="stats-loading">まだデータが収集されていません</div>';
  }

  // 件数は出さない（集まった人数は多くなく、自己申告で測り方もまちまちなため、数字だけが独り歩きしないように。管理画面では実数を見られる）
  const cls = 'class';
  let html = '';
  html += '<div ' + cls + '="stats-item-wide" style="grid-column: 1 / -1;">';
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
