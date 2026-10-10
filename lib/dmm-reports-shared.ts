/**
 * DMM（FANZA）アフィリエイトの実績の型と、貼り付けた表の読み取り・合計（サーバー・画面の両方で使う。サーバー専用の処理は lib/dmm-reports.ts）
 */
export type DmmReportRow = {
  date: string; // YYYY-MM-DD
  clicks: number;
  direct_count: number;
  direct_yen: number;
  category_count: number;
  category_yen: number;
  new_count: number;
  new_yen: number;
};

export const emptyDmmTotals = () => ({ clicks: 0, direct_count: 0, direct_yen: 0, category_count: 0, category_yen: 0, new_count: 0, new_yen: 0, days: 0 });

export function sumDmmReports(rows: DmmReportRow[]) {
  const total = emptyDmmTotals();
  for (const r of rows) {
    total.clicks += r.clicks;
    total.direct_count += r.direct_count;
    total.direct_yen += r.direct_yen;
    total.category_count += r.category_count;
    total.category_yen += r.category_yen;
    total.new_count += r.new_count;
    total.new_yen += r.new_yen;
    total.days += 1;
  }
  return total;
}

/**
 * DMM の管理画面のレポートの表を貼り付けた文字列を日ごとの行に直す。
 * 1行の例: 「2026/10/08	1001	0 件	0円	0 件	0円	0 件	0円	0 件	0円」
 * （日付のあとに クリック・ダイレクト件数・円・カテゴリ件数・円・新規件数・円・合計件数・円 の順。合計は使わない）
 * 日付のない行（見出し・期間合計）は飛ばす
 */
export function parseDmmReportText(text: string): DmmReportRow[] {
  const rows: DmmReportRow[] = [];
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    const m = line.match(/(\d{4})[/.-](\d{1,2})[/.-](\d{1,2})/);
    if (!m) continue;
    const date = `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`;
    const rest = line.slice((m.index ?? 0) + m[0].length);
    const numbers = (rest.replace(/,/g, '').match(/-?\d+/g) ?? []).map((n) => Number(n));
    if (numbers.length < 7) continue;
    const [clicks, direct_count, direct_yen, category_count, category_yen, new_count, new_yen] = numbers;
    rows.push({ date, clicks, direct_count, direct_yen, category_count, category_yen, new_count, new_yen });
  }
  // 同じ日が複数あれば後の行を使う
  const byDate = new Map(rows.map((r) => [r.date, r]));
  return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
}

