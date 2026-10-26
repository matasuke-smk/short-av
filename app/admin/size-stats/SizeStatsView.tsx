'use client';

import { useEffect, useState } from 'react';

interface SizeStatistics {
  count: number;
  statistics: {
    avgLength: string;
    avgDiameter: string;
    stdLength: string;
    stdDiameter: string;
  } | null;
  admin: {
    total: number;
    outOfRange: number;
    lengthRangeMm: { min: number; max: number };
    correctionMm: string;
    referenceLengthMm: number;
    rawAvgLength: string;
    diameterCorrectionMm: string;
    referenceDiameterMm: number;
    rawAvgDiameter: string;
  };
  rawData: Array<{
    id: number;
    length_mm: number;
    diameter_mm: number;
    erection_state: string;
    age_group: string | null;
    created_at: string;
  }>;
}

/**
 * サイズ統計（管理画面）。2026-10-26: PC はスクロールせずに見られるよう、左に数字と補正、右に収集データ（表の中だけスクロール）。
 * フィルター（測定時の状態・年齢層）はユーザーが使っていないのでなくした（サイトに出しているのと同じ「勃起時・全年齢」で集計）
 */
export default function SizeStatsAdminPage() {
  const [stats, setStats] = useState<SizeStatistics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const response = await fetch('/api/admin/size-stats?erectionState=erect');
        if (response.ok) setStats(await response.json());
      } catch (error) {
        console.error('Error fetching stats:', error);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <div className="min-h-screen lg:h-[100dvh] lg:min-h-0 lg:flex lg:flex-col bg-gray-900 text-white px-3 py-4 md:p-6 lg:px-5 lg:py-4">
      <h1 className="text-xl md:text-2xl font-bold mb-4 lg:mb-3">サイズ統計</h1>

      {loading ? (
        <div className="text-center py-12 text-gray-400">読み込み中...</div>
      ) : stats && stats.statistics ? (
        <div className="lg:flex-1 lg:min-h-0 lg:grid lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] lg:gap-4">
          {/* 左: 数字と補正、その下に長さの分布と1日の登録数（2026-10-26。空いていた所を埋める） */}
          <div className="lg:overflow-hidden lg:min-h-0 lg:flex lg:flex-col">
            <div className="grid grid-cols-2 gap-3 mb-3">
              <div className="bg-gray-800 rounded-lg p-3">
                <div className="text-gray-400 text-xs mb-1">平均に使った件数</div>
                <div className="text-2xl font-bold">{stats.count}<span className="ml-0.5 text-sm font-normal text-gray-400">件</span></div>
                <div className="text-gray-500 text-xs mt-1">
                  勃起時・{stats.admin.lengthRangeMm.min / 10}〜{stats.admin.lengthRangeMm.max / 10}cm
                </div>
                <div className="text-gray-400 text-xs mt-1">登録 全{stats.admin.total}件（範囲外 {stats.admin.outOfRange}件）</div>
              </div>

              <div className="bg-gray-800 rounded-lg p-3">
                <div className="text-gray-400 text-xs mb-1">標準偏差</div>
                <div className="text-sm leading-relaxed">
                  <div>長さ: <span className="font-bold">{stats.statistics.stdLength}mm</span></div>
                  <div>直径: <span className="font-bold">{stats.statistics.stdDiameter}mm</span></div>
                </div>
              </div>

              <div className="bg-gray-800 rounded-lg p-3">
                <div className="text-gray-400 text-xs mb-1">平均長さ（公開中）</div>
                <div className="text-2xl font-bold">{stats.statistics.avgLength}<span className="ml-0.5 text-sm font-normal text-gray-400">mm</span></div>
                <div className="text-gray-500 text-xs mt-1">{(parseFloat(stats.statistics.avgLength) / 10).toFixed(1)}cm・補正 −{stats.admin.correctionMm}mm</div>
              </div>

              <div className="bg-gray-800 rounded-lg p-3">
                <div className="text-gray-400 text-xs mb-1">平均直径（公開中）</div>
                <div className="text-2xl font-bold">{stats.statistics.avgDiameter}<span className="ml-0.5 text-sm font-normal text-gray-400">mm</span></div>
                <div className="text-gray-500 text-xs mt-1">補正 −{stats.admin.diameterCorrectionMm}mm</div>
              </div>
            </div>

            {/* 長さ・直径の補正 */}
            <div className="bg-gray-800 rounded-lg p-3 mb-3">
              <h2 className="text-base font-bold mb-1">長さ・直径の補正</h2>
              {/* 説明は押すと開く（PC で1画面に収めるため） */}
              <details className="mb-2 text-xs text-gray-400">
                <summary className="cursor-pointer">補正のしかた</summary>
              <p className="mt-1 leading-relaxed">
                自己申告は大きめに出やすいため、平均を「集めたデータの平均と基準の中間」にしています（差し引く量 = 差の半分。補正前が基準以下なら補正なし）。
                基準は Veale ら（2015年）の平均（サイズ比較ツールに載せている値。直径は周囲から換算）。サイトには補正の説明は出していません。
              </p>
              </details>
              <table className="w-full text-sm">
                <thead className="text-gray-400">
                  <tr className="border-b border-gray-700">
                    <th className="text-left py-2 pr-4 font-normal"></th>
                    <th className="text-right py-2 px-2 font-normal">長さ</th>
                    <th className="text-right py-2 pl-2 font-normal">直径</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-gray-700">
                    <td className="py-1.5 pr-2">補正前の平均</td>
                    <td className="text-right px-2">{stats.admin.rawAvgLength}mm</td>
                    <td className="text-right pl-2">{stats.admin.rawAvgDiameter}mm</td>
                  </tr>
                  <tr className="border-b border-gray-700">
                    <td className="py-1.5 pr-2 text-gray-400">基準</td>
                    <td className="text-right px-2 text-gray-400">{stats.admin.referenceLengthMm}mm</td>
                    <td className="text-right pl-2 text-gray-400">{stats.admin.referenceDiameterMm}mm</td>
                  </tr>
                  <tr className="border-b border-gray-700">
                    <td className="py-1.5 pr-2">差し引く量</td>
                    <td className="text-right px-2">{stats.admin.correctionMm}mm</td>
                    <td className="text-right pl-2">{stats.admin.diameterCorrectionMm}mm</td>
                  </tr>
                  <tr className="bg-blue-900/20">
                    <td className="py-1.5 pr-2">補正後の平均<span className="ml-1 text-xs text-blue-300">公開中</span></td>
                    <td className="text-right px-2">{stats.statistics.avgLength}mm</td>
                    <td className="text-right pl-2">{stats.statistics.avgDiameter}mm</td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* 残りの高さをグラフが使い、左右の下の端がそろう（画面の高さに合わせて自動でグラフの高さが変わる） */}
            <div className="grid grid-cols-2 gap-3 mb-4 lg:mb-0 lg:flex-1 lg:min-h-0">
              <LengthHistogram rows={stats.rawData} range={stats.admin.lengthRangeMm} avgMm={parseFloat(stats.statistics.avgLength)} />
              <DailyRegistrations rows={stats.rawData} />
            </div>
          </div>

          {/* 右: 収集データ（PC は表の中だけスクロール） */}
          <div className="bg-gray-800 rounded-lg p-4 lg:min-h-0 lg:h-full lg:flex lg:flex-col">
            <h2 className="text-base font-bold mb-2">
              収集データ<span className="ml-2 text-xs font-normal text-gray-400">{stats.rawData.length}件（新しい順）</span>
            </h2>
            <div className="overflow-x-auto lg:overflow-y-auto lg:flex-1 lg:min-h-0">
              <table className="w-full text-sm whitespace-nowrap">
                <thead className="sticky top-0 bg-gray-800 text-gray-400">
                  <tr className="border-b border-gray-700">
                    <th className="text-left py-2 px-3 font-normal">ID</th>
                    <th className="text-right py-2 px-3 font-normal">長さ(mm)</th>
                    <th className="text-right py-2 px-3 font-normal">直径(mm)</th>
                    <th className="text-left py-2 px-3 font-normal">年齢層</th>
                    <th className="text-left py-2 px-3 font-normal">登録日時</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.rawData.map((item) => (
                    <tr key={item.id} className="border-b border-gray-700">
                      <td className="py-2 px-3 text-gray-400">{item.id}</td>
                      <td className="py-2 px-3 text-right">{item.length_mm}</td>
                      <td className="py-2 px-3 text-right">{item.diameter_mm}</td>
                      <td className="py-2 px-3">{item.age_group || '-'}</td>
                      <td className="py-2 px-3 text-gray-400">{new Date(item.created_at).toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-gray-800 rounded-lg p-12 text-center text-gray-400">データがありません</div>
      )}
    </div>
  );
}

type Row = SizeStatistics['rawData'][number];

/** 縦棒のグラフ（高さは箱いっぱい。highlight の棒だけ色を変える） */
function Bars({ title, note, bars, highlight }: { title: string; note: string; bars: { label: string; tick: string; value: number }[]; highlight?: number }) {
  const max = Math.max(...bars.map((b) => b.value), 1);
  return (
    <div className="bg-gray-800 rounded-lg p-3 flex flex-col min-h-[10rem] lg:min-h-0">
      <h2 className="text-sm font-bold">{title}</h2>
      <p className="text-[11px] text-gray-400 mb-2">{note}</p>
      <div className="flex-1 min-h-[5rem] lg:min-h-0 flex items-end gap-[2px]">
        {bars.map((b, i) => (
          <div key={b.label} className="flex-1 h-full flex items-end" title={`${b.label}: ${b.value}件`}>
            <div className={`w-full rounded-t ${i === highlight ? 'bg-amber-400' : 'bg-blue-500'}`} style={{ height: `${(b.value / max) * 100}%`, minHeight: b.value > 0 ? 2 : 0 }} />
          </div>
        ))}
      </div>
      <div className="flex gap-[2px] mt-1 text-[10px] text-gray-500">
        {bars.map((b) => (
          <span key={b.label} className="flex-1 text-center">{b.tick}</span>
        ))}
      </div>
    </div>
  );
}

/** 長さの分布（1cm ごと。8cm 未満と 22cm 以上はまとめる）。公開中の平均が入る棒を黄色に */
function LengthHistogram({ rows, range, avgMm }: { rows: Row[]; range: { min: number; max: number }; avgMm: number }) {
  const from = 8;
  const to = 22;
  const inRange = rows.filter((r) => r.length_mm >= range.min && r.length_mm <= range.max);
  const bins = Array.from({ length: to - from + 2 }, (_, i) => ({ cm: from - 1 + i, value: 0 }));
  for (const r of inRange) {
    const cm = Math.floor(r.length_mm / 10);
    const i = Math.min(Math.max(cm - (from - 1), 0), bins.length - 1);
    bins[i].value++;
  }
  const avgIndex = Math.min(Math.max(Math.floor(avgMm / 10) - (from - 1), 0), bins.length - 1);
  return (
    <Bars
      title="長さの分布"
      note={`1cm ごとの件数（${inRange.length}件）。黄色は公開中の平均が入る所`}
      highlight={avgIndex}
      bars={bins.map((b, i) => ({
        label: i === 0 ? `${from}cm 未満` : i === bins.length - 1 ? `${to}cm 以上` : `${b.cm}cm台`,
        tick: i === 0 ? `<${from}` : i === bins.length - 1 ? `${to}+` : b.cm % 2 === 0 ? String(b.cm) : '',
        value: b.value,
      }))}
    />
  );
}

/** 1日の登録数（直近28日・日本時間）。サイズ比較ツールがどれくらい使われているか */
function DailyRegistrations({ rows }: { rows: Row[] }) {
  const day = (t: number) => new Date(t + 9 * 3_600_000).toISOString().slice(0, 10);
  const counts = new Map<string, number>();
  for (const r of rows) counts.set(day(new Date(r.created_at).getTime()), (counts.get(day(new Date(r.created_at).getTime())) ?? 0) + 1);
  const days = Array.from({ length: 28 }, (_, i) => day(Date.now() - (27 - i) * 86_400_000));
  const total = days.reduce((a, d) => a + (counts.get(d) ?? 0), 0);
  return (
    <Bars
      title="1日の登録数"
      note={`直近28日（合計 ${total}件・1日平均 ${(total / 28).toFixed(1)}件）`}
      highlight={27}
      bars={days.map((d, i) => ({ label: `${Number(d.slice(5, 7))}/${Number(d.slice(8, 10))}`, tick: i % 7 === 0 || i === 27 ? `${Number(d.slice(5, 7))}/${Number(d.slice(8, 10))}` : '', value: counts.get(d) ?? 0 }))}
    />
  );
}
