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
  rawData: Array<{
    id: number;
    length_mm: number;
    diameter_mm: number;
    erection_state: string;
    age_group: string | null;
    created_at: string;
  }>;
}

export default function SizeStatsAdminPage() {
  const [stats, setStats] = useState<SizeStatistics | null>(null);
  const [loading, setLoading] = useState(true);
  const [erectionState, setErectionState] = useState('erect');
  const [ageGroup, setAgeGroup] = useState('');

  useEffect(() => {
    fetchStats();
  }, [erectionState, ageGroup]);

  async function fetchStats() {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        erectionState,
        ...(ageGroup && { ageGroup }),
      });

      const response = await fetch(`/api/size-stats?${params}`);
      if (response.ok) {
        const data = await response.json();
        setStats(data);
      }
    } catch (error) {
      console.error('Error fetching stats:', error);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white p-8">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold mb-8">サイズ統計ダッシュボード</h1>

        {/* フィルター */}
        <div className="bg-gray-800 rounded-lg p-6 mb-8">
          <h2 className="text-xl font-bold mb-4">フィルター</h2>
          <div className="flex gap-4 flex-wrap">
            <div>
              <label className="block text-sm text-gray-400 mb-2">測定時の状態</label>
              <select
                value={erectionState}
                onChange={(e) => setErectionState(e.target.value)}
                className="bg-gray-700 text-white px-4 py-2 rounded"
              >
                <option value="erect">勃起時</option>
                <option value="flaccid">通常時</option>
              </select>
            </div>

            <div>
              <label className="block text-sm text-gray-400 mb-2">年齢層</label>
              <select
                value={ageGroup}
                onChange={(e) => setAgeGroup(e.target.value)}
                className="bg-gray-700 text-white px-4 py-2 rounded"
              >
                <option value="">全年齢</option>
                <option value="20s">20代</option>
                <option value="30s">30代</option>
                <option value="40s">40代</option>
                <option value="50s">50代以上</option>
              </select>
            </div>
          </div>
        </div>

        {/* 統計サマリー */}
        {loading ? (
          <div className="text-center py-12">
            <div className="text-gray-400">読み込み中...</div>
          </div>
        ) : stats && stats.statistics ? (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
              <div className="bg-gray-800 rounded-lg p-6">
                <div className="text-gray-400 text-sm mb-2">データ件数</div>
                <div className="text-3xl font-bold">{stats.count}</div>
              </div>

              <div className="bg-gray-800 rounded-lg p-6">
                <div className="text-gray-400 text-sm mb-2">平均長さ</div>
                <div className="text-3xl font-bold">{stats.statistics.avgLength}mm</div>
                <div className="text-gray-500 text-sm">({(parseFloat(stats.statistics.avgLength) / 10).toFixed(1)}cm)</div>
              </div>

              <div className="bg-gray-800 rounded-lg p-6">
                <div className="text-gray-400 text-sm mb-2">平均直径</div>
                <div className="text-3xl font-bold">{stats.statistics.avgDiameter}mm</div>
              </div>

              <div className="bg-gray-800 rounded-lg p-6">
                <div className="text-gray-400 text-sm mb-2">標準偏差</div>
                <div className="text-lg">
                  <div>長さ: {stats.statistics.stdLength}mm</div>
                  <div>直径: {stats.statistics.stdDiameter}mm</div>
                </div>
              </div>
            </div>

            {/* 生データテーブル */}
            <div className="bg-gray-800 rounded-lg p-6">
              <h2 className="text-xl font-bold mb-4">収集データ</h2>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-700">
                      <th className="text-left py-3 px-4">ID</th>
                      <th className="text-left py-3 px-4">長さ(mm)</th>
                      <th className="text-left py-3 px-4">直径(mm)</th>
                      <th className="text-left py-3 px-4">状態</th>
                      <th className="text-left py-3 px-4">年齢層</th>
                      <th className="text-left py-3 px-4">登録日時</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stats.rawData.map((item) => (
                      <tr key={item.id} className="border-b border-gray-700">
                        <td className="py-3 px-4">{item.id}</td>
                        <td className="py-3 px-4">{item.length_mm}</td>
                        <td className="py-3 px-4">{item.diameter_mm}</td>
                        <td className="py-3 px-4">
                          {item.erection_state === 'erect' ? '勃起時' : '通常時'}
                        </td>
                        <td className="py-3 px-4">{item.age_group || '-'}</td>
                        <td className="py-3 px-4">
                          {new Date(item.created_at).toLocaleString('ja-JP')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        ) : (
          <div className="bg-gray-800 rounded-lg p-12 text-center">
            <div className="text-gray-400">データがありません</div>
          </div>
        )}
      </div>
    </div>
  );
}
