// 外れ値に強い統計計算（IQR法による外れ値除去）
// 多数のユーザーがそれぞれ極端な値を投稿しても、平均・標準偏差が汚染されにくくする

export interface RobustStat {
  avg: number;
  std: number;
  n: number; // 集計に使用した件数（外れ値除去後）
}

// 分位点（線形補間）
function quantile(sorted: number[], p: number): number {
  if (sorted.length === 1) return sorted[0];
  const idx = (sorted.length - 1) * p;
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sorted[lo];
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo);
}

// IQR法で外れ値を除いた配列を返す（[Q1-1.5*IQR, Q3+1.5*IQR] の範囲のみ採用）
// 四分位数は極端値の影響を受けにくいため、汚染されたデータでも安定して外れ値を除去できる
export function removeOutliers(values: number[]): number[] {
  if (values.length < 4) return values; // データが少なすぎる場合はそのまま
  const sorted = [...values].sort((a, b) => a - b);
  const q1 = quantile(sorted, 0.25);
  const q3 = quantile(sorted, 0.75);
  const iqr = q3 - q1;
  const lower = q1 - 1.5 * iqr;
  const upper = q3 + 1.5 * iqr;
  const filtered = sorted.filter((v) => v >= lower && v <= upper);
  return filtered.length > 0 ? filtered : sorted;
}

// 外れ値除去後の平均・標準偏差を計算
export function computeRobustStat(values: number[]): RobustStat {
  const filtered = removeOutliers(values);
  const n = filtered.length;
  const avg = filtered.reduce((a, b) => a + b, 0) / n;
  const std = Math.sqrt(
    filtered.reduce((sum, v) => sum + Math.pow(v - avg, 2), 0) / n
  );
  return { avg, std, n };
}
