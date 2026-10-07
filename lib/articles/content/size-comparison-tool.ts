import type { Article } from '../types';

export const article: Article = {
  slug: 'size-comparison-tool',
  title: 'ペニスサイズ比較ツール - 研究データの平均値と比べる目安',
  description: '勃起時の長さと太さを入力すると、日本人の目安値や Veale ら（2015年）のメタ分析の平均値と比べたおおよその位置を表示するツール。結果は統計上の目安で、医学的な診断ではありません。',
  content: `
<script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js"></script>

<p style="color: #d1d5db; margin-bottom: 1rem;">勃起時の長さと太さを入力すると、日本人の目安値や海外の研究データの平均値と比べたおおよその位置を確認できます。結果は統計上の目安で、医学的な診断ではありません。</p>

<p style="color: #d1d5db; margin-bottom: 1.5rem;">「統計を計算する」を押すと、入力した長さ・太さ（直径）・年齢層（任意）と、ブラウザごとの匿名ID がサーバーに送信・保存され、匿名の統計データとして利用されます。氏名やメールアドレスなどの入力はありません。詳しくは<a href="/privacy" style="color: #60a5fa; text-decoration: underline;">プライバシーポリシー</a>をご覧ください。</p>

<!-- 収集された統計データ表示 -->
<div id="collectedStats" class="collected-stats-card">
  <div class="stats-header">
    <h3>📊 このツールに集まったデータ（勃起時・自己申告）</h3>
  </div>
  <div id="statsContent" class="stats-content">
    <div class="stats-loading">データを読み込み中...</div>
  </div>
</div>

<style>
.size-tool-container {
  max-width: 800px;
  margin: 0 auto;
  padding: 0;
}

.tool-card {
  background: #1f2937;
  border: 1px solid #374151;
  border-radius: 10px;
  padding: 16px;
  margin-bottom: 16px;
}

.tool-card h3 {
  color: #fff;
  font-size: 1.1rem;
  margin-bottom: 16px;
  font-weight: bold;
}

.form-group {
  margin-bottom: 20px;
}

.form-label {
  display: block;
  color: #d1d5db;
  font-size: 0.95rem;
  margin-bottom: 8px;
  font-weight: 500;
}

.form-input {
  width: 100%;
  padding: 12px;
  background: #111827;
  border: 1px solid #374151;
  border-radius: 8px;
  color: #fff;
  font-size: 1rem;
  box-sizing: border-box;
}

.form-input:focus {
  outline: none;
  border-color: #3b82f6;
}

.radio-group {
  display: flex;
  gap: 16px;
  flex-wrap: wrap;
}

.radio-label {
  display: flex;
  align-items: center;
  color: #d1d5db;
  cursor: pointer;
}

.radio-label input {
  margin-right: 8px;
  width: 18px;
  height: 18px;
  cursor: pointer;
}

.btn-calculate {
  width: 100%;
  padding: 14px;
  background: #3b82f6;
  color: #fff;
  border: none;
  border-radius: 8px;
  font-size: 1.1rem;
  font-weight: bold;
  cursor: pointer;
  transition: background 0.2s;
}

.btn-calculate:hover {
  background: #2563eb;
}

.btn-calculate:active {
  transform: scale(0.98);
}

.result-hidden {
  display: none;
}

.result-card {
  background: linear-gradient(135deg, #1e3a8a 0%, #1e40af 100%);
  border: 1px solid #3b82f6;
  border-radius: 10px;
  padding: 16px;
  margin-bottom: 16px;
}

.result-title {
  color: #fff;
  font-size: 1.2rem;
  font-weight: bold;
  margin-bottom: 12px;
  text-align: center;
}

.stat-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
  margin-bottom: 20px;
}

.stat-item {
  background: rgba(255, 255, 255, 0.1);
  padding: 16px;
  border-radius: 8px;
  text-align: center;
}

.stat-item-double {
  background: rgba(255, 255, 255, 0.1);
  padding: 16px;
  border-radius: 8px;
}

.stat-double-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
  margin-top: 12px;
}

.stat-half {
  text-align: center;
  padding: 8px;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 6px;
}

.stat-label {
  color: #93c5fd;
  font-size: 0.95rem;
  margin-bottom: 8px;
  font-weight: bold;
  text-align: center;
}

.stat-sublabel {
  color: #93c5fd;
  font-size: 0.75rem;
  margin-bottom: 6px;
}

.stat-value {
  color: #fff;
  font-size: 1.5rem;
  font-weight: bold;
}

.rank-badge {
  background: rgba(255, 255, 255, 0.15);
  padding: 12px;
  border-radius: 6px;
  text-align: center;
  margin-bottom: 12px;
}

.rank-badge-large {
  color: #fbbf24;
  font-size: 1.5rem;
  font-weight: bold;
  margin-bottom: 6px;
}

.rank-description {
  color: #e5e7eb;
  font-size: 0.85rem;
}

.condom-recommendation {
  background: #065f46;
  border: 1px solid #059669;
  border-radius: 6px;
  padding: 10px 12px;
  margin-top: 12px;
}

.condom-title {
  color: #6ee7b7;
  font-size: 0.85rem;
  font-weight: bold;
  margin-bottom: 4px;
}

.condom-size {
  color: #fff;
  font-size: 1.1rem;
  font-weight: bold;
}

.condom-note {
  color: #d1fae5;
  font-size: 0.75rem;
  margin-top: 4px;
}

.chart-container {
  position: relative;
  height: 250px;
  margin-top: 16px;
}

.disclaimer {
  background: #7c2d12;
  border: 1px solid #ea580c;
  border-radius: 6px;
  padding: 12px;
  margin-top: 16px;
}

.disclaimer-text {
  color: #fed7aa;
  font-size: 0.8rem;
  line-height: 1.5;
}

.collected-stats-card {
  background: linear-gradient(135deg, #1e3a8a 0%, #1e40af 100%);
  border: 2px solid #3b82f6;
  border-radius: 12px;
  padding: 20px;
  margin-bottom: 24px;
  box-shadow: 0 4px 6px rgba(59, 130, 246, 0.1);
}

.stats-header h3 {
  color: #fff;
  font-size: 1.1rem;
  margin: 0 0 16px 0;
  font-weight: bold;
}

.stats-content {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 16px;
}

.stats-loading {
  color: #93c5fd;
  text-align: center;
  padding: 20px;
  font-size: 0.95rem;
}

.stats-item {
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 8px;
  padding: 16px;
  text-align: center;
}

.stats-label {
  color: #93c5fd;
  font-size: 0.85rem;
  margin-bottom: 8px;
}

.stats-value {
  color: #fff;
  font-size: 1.8rem;
  font-weight: bold;
  margin-bottom: 4px;
}

.stats-subvalue {
  color: #dbeafe;
  font-size: 0.9rem;
}

.stats-item-wide {
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 8px;
  padding: 16px;
  grid-column: span 2;
}

.stats-double-container {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
}

.stats-half-item {
  text-align: center;
}

@media (max-width: 640px) {
  .stats-item-wide {
    grid-column: span 1;
  }

  .stats-double-container {
    grid-template-columns: 1fr;
    gap: 12px;
  }

  .stat-grid {
    grid-template-columns: 1fr;
  }

  .tool-card {
    padding: 16px;
  }
}
</style>

<div class="size-tool-container">
  <div class="tool-card">
    <h3>サイズを入力してください</h3>

    <div class="form-group">
      <label class="form-label">長さ（mm）</label>
      <input type="number" id="lengthInput" class="form-input" min="70" max="200" step="1" placeholder="例: 126">
      <p style="color: #9ca3af; font-size: 0.85rem; margin-top: 8px;">※ 勃起時のサイズを入力してください</p>
    </div>

    <div class="form-group">
      <label class="form-label">太さの測定方法</label>
      <div class="radio-group">
        <label class="radio-label">
          <input type="radio" name="girthType" value="diameter" checked>
          直径（mm）
        </label>
        <label class="radio-label">
          <input type="radio" name="girthType" value="circumference">
          外周（mm）
        </label>
      </div>
    </div>

    <div class="form-group">
      <label class="form-label" id="girthLabel">太さ - 直径（mm）</label>
      <input type="number" id="girthInput" class="form-input" min="25" max="50" step="1" placeholder="例: 35">
      <p style="color: #9ca3af; font-size: 0.85rem; margin-top: 8px;">※ 勃起時のサイズを入力してください</p>
    </div>

    <div class="form-group">
      <label class="form-label">年齢層（任意）</label>
      <select id="ageInput" class="form-input">
        <option value="">選択しない</option>
        <option value="20s">20代</option>
        <option value="30s">30代</option>
        <option value="40s">40代</option>
        <option value="50s">50代以上</option>
      </select>
    </div>

    <button class="btn-calculate" id="calculateBtn">統計を計算する</button>
  </div>

  <div id="resultContainer" class="result-hidden">
    <div class="result-card">
      <h3 class="result-title">あなたの統計結果</h3>

      <div class="rank-badge">
        <div class="rank-badge-large" id="rankLevel">平均的</div>
        <div class="rank-description" id="rankDescription">日本人男性の標準範囲内です</div>
      </div>

      <div class="stat-grid">
        <div class="stat-item-double">
          <div class="stat-label">長さ</div>
          <div class="stat-double-row">
            <div class="stat-half">
              <div class="stat-sublabel">パーセンタイル</div>
              <div class="stat-value" id="lengthPercentile">50%</div>
            </div>
            <div class="stat-half">
              <div class="stat-sublabel">100人中</div>
              <div class="stat-value" id="lengthRank">50位</div>
            </div>
          </div>
        </div>
        <div class="stat-item-double">
          <div class="stat-label">太さ</div>
          <div class="stat-double-row">
            <div class="stat-half">
              <div class="stat-sublabel">パーセンタイル</div>
              <div class="stat-value" id="girthPercentile">50%</div>
            </div>
            <div class="stat-half">
              <div class="stat-sublabel">100人中</div>
              <div class="stat-value" id="girthRank">50位</div>
            </div>
          </div>
        </div>
      </div>

      <div class="condom-recommendation">
        <div class="condom-title">コンドームサイズの目安</div>
        <div class="condom-size" id="condomSize">Mサイズ前後</div>
        <div class="condom-note">※ あくまで目安です。サイズの基準はメーカーごとに異なるため、各メーカーのサイズ表（公称幅）で確認してください。</div>
      </div>

    </div>

    <div class="tool-card">
      <h3>目安値との比較</h3>
      <div class="chart-container">
        <canvas id="comparisonChart"></canvas>
      </div>
    </div>

    <div class="disclaimer">
      <div class="disclaimer-text">
        ※ 結果は、目安値を正規分布と仮定して計算したおおよその位置です。実際の分布とは異なる場合があります<br>
        ※ 医学的な診断ではありません。サイズや機能に悩みがある場合は泌尿器科で相談してください<br>
        ※ 「統計を計算する」を押すと、長さ・直径（外周で入力した場合は直径に換算した値）・年齢層（任意）・ブラウザごとの匿名ID・登録日時がサーバーに保存され、匿名の統計データとして利用されます（同じブラウザからは最初の1回分のみ）
      </div>
    </div>
  </div>
</div>

<script>
(function() {
  'use strict';

  // DOMが完全に読み込まれた後に実行
  document.addEventListener('DOMContentLoaded', function() {
    // 統計データはサーバーサイドで埋め込まれているため、初回読み込みは不要
    // loadCollectedStats();

    // 測定方法の切り替え
    document.querySelectorAll('input[name="girthType"]').forEach(radio => {
      radio.addEventListener('change', function() {
        const label = document.getElementById('girthLabel');
        const input = document.getElementById('girthInput');

        if (this.value === 'diameter') {
          label.textContent = '太さ - 直径（mm）';
          input.min = 25;
          input.max = 50;
          input.placeholder = '例: 35';
        } else {
          label.textContent = '太さ - 外周（mm）';
          input.min = 80;
          input.max = 157;
          input.placeholder = '例: 110';
        }
        input.value = '';
      });
    });

    // 計算ボタンのイベントリスナー
    const calculateBtn = document.getElementById('calculateBtn');
    if (calculateBtn) {
      calculateBtn.addEventListener('click', calculateStats);
    }
  });

// 正規分布のCDF（累積分布関数）
function normalCDF(x, mean, stdDev) {
  const z = (x - mean) / stdDev;
  const t = 1 / (1 + 0.2316419 * Math.abs(z));
  const d = 0.3989423 * Math.exp(-z * z / 2);
  let prob = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));

  if (z > 0) {
    prob = 1 - prob;
  }

  return prob;
}

// 外周から直径に変換
function circumferenceToDiameter(circumference) {
  return circumference / Math.PI;
}

// 5段階評価を取得
function getRankLevel(percentile) {
  if (percentile >= 90) return { level: '大きめ', description: '日本人男性の上位10%に入ります' };
  if (percentile >= 70) return { level: 'やや大きめ', description: '日本人男性の平均よりやや大きめです' };
  if (percentile >= 30) return { level: '平均的', description: '日本人男性の標準範囲内です' };
  if (percentile >= 10) return { level: 'やや小さめ', description: '日本人男性の平均よりやや小さめです' };
  return { level: '小さめ', description: '日本人男性の下位10%に入ります' };
}

// コンドームサイズの目安（外周から大まかに判定。S/M/L の基準はメーカーごとに異なる）
function recommendCondomSize(diameter) {
  const circumference = Math.round(diameter * Math.PI);
  let size;
  if (circumference < 105) size = 'Sサイズ前後';
  else if (circumference < 115) size = 'Mサイズ前後';
  else if (circumference < 123) size = 'Lサイズ前後';
  else size = 'XLサイズ前後';
  return size + '（外周 約' + circumference + 'mm）';
}

  let comparisonChart = null;

  function calculateStats() {
  // 入力値を取得
  const lengthMm = parseFloat(document.getElementById('lengthInput').value);
  const girthInput = parseFloat(document.getElementById('girthInput').value);
  const girthType = document.querySelector('input[name="girthType"]:checked').value;

  // バリデーション
  if (!lengthMm || !girthInput) {
    alert('長さと太さを入力してください');
    return;
  }

  if (lengthMm < 70 || lengthMm > 200) {
    alert('長さは70〜200mm（7.0〜20.0cm）の範囲で入力してください。この範囲外の値は医学的に極めて稀です');
    return;
  }

  // 長さはmm単位のまま使用
  const length = lengthMm;

  // 太さを直径に統一
  let diameter;
  if (girthType === 'diameter') {
    diameter = girthInput;
    if (diameter < 25 || diameter > 50) {
      alert('直径は25〜50mmの範囲で入力してください。この範囲外の値は医学的に極めて稀です');
      return;
    }
  } else {
    if (girthInput < 80 || girthInput > 157) {
      alert('外周は80〜157mmの範囲で入力してください。この範囲外の値は医学的に極めて稀です');
      return;
    }
    diameter = circumferenceToDiameter(girthInput);
  }

  // 日本人の目安値（mm単位）
  // 国内の複数の報告（勃起時の長さはおおむね12〜14cm程度の範囲）を参考にした目安値。単一の調査の値ではない
  const jpLengthMean = 124;
  const jpLengthStd = 18;
  const jpDiameterMean = 36;
  const jpDiameterStd = 3.6;

  // パーセンタイル計算
  const lengthPercentile = normalCDF(length, jpLengthMean, jpLengthStd) * 100;
  const diameterPercentile = normalCDF(diameter, jpDiameterMean, jpDiameterStd) * 100;

  // 100人中の順位
  const lengthRank = Math.round(100 - lengthPercentile + 1);
  const diameterRank = Math.round(100 - diameterPercentile + 1);

  // 総合パーセンタイル（平均）
  const avgPercentile = (lengthPercentile + diameterPercentile) / 2;
  const rankInfo = getRankLevel(avgPercentile);

  // コンドームサイズ
  const condomSize = recommendCondomSize(diameter);

  // 結果を表示
  document.getElementById('lengthPercentile').textContent = lengthPercentile.toFixed(1) + '%';
  document.getElementById('girthPercentile').textContent = diameterPercentile.toFixed(1) + '%';
  document.getElementById('lengthRank').textContent = lengthRank + '位';
  document.getElementById('girthRank').textContent = diameterRank + '位';
  document.getElementById('rankLevel').textContent = rankInfo.level;
  document.getElementById('rankDescription').textContent = rankInfo.description;
  document.getElementById('condomSize').textContent = condomSize;

  // 結果エリアを表示
  document.getElementById('resultContainer').classList.remove('result-hidden');

  // グラフを描画
  drawChart(length, diameter);

  // 結果エリアまでスクロール
    document.getElementById('resultContainer').scrollIntoView({ behavior: 'smooth', block: 'start' });

    // 統計データを送信（常に送信、勃起時固定）
    // DB の列は整数のため、直径（外周から換算すると小数になる）などは四捨五入して送る
    sendStatisticsData(Math.round(lengthMm), Math.round(diameter), 'erect', document.getElementById('ageInput').value);
  }

  // 匿名ユーザーIDを取得（LocalStorageベース。1ユーザー1データの判定に使用）
  function getSizeToolUserId() {
    try {
      var key = 'short-av-user-id';
      var userId = localStorage.getItem(key);
      if (!userId) {
        userId = (crypto && crypto.randomUUID)
          ? crypto.randomUUID()
          : 'uid-' + Date.now() + '-' + Math.random().toString(36).slice(2);
        localStorage.setItem(key, userId);
      }
      return userId;
    } catch (e) {
      return null;
    }
  }

  // 統計データをサーバーに送信
  async function sendStatisticsData(lengthMm, diameterMm, erectionState, ageGroup) {
    try {
      var submittedKey = 'short-av-size-submitted';
      var userId = getSizeToolUserId();

      // 既に投稿済みのユーザーは再送信しない（DBへは最初の1件のみ保存される）
      if (localStorage.getItem(submittedKey) === '1') {
        loadCollectedStats();
        return;
      }

      const response = await fetch('/api/size-stats', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          lengthMm,
          diameterMm,
          erectionState,
          ageGroup: ageGroup || null,
          userId,
        }),
      });

      if (!response.ok) {
        console.error('Failed to send statistics data');
      } else {
        // 送信成功後は投稿済みフラグを立て、以降は再送信しない
        try { localStorage.setItem(submittedKey, '1'); } catch (e) {}
        // データ送信成功後、統計データを更新
        loadCollectedStats();
      }
    } catch (error) {
      console.error('Error sending statistics data:', error);
    }
  }

  // 収集された統計データを読み込んで表示
  async function loadCollectedStats() {
    try {
      const response = await fetch('/api/size-stats?erectionState=erect');
      if (!response.ok) {
        throw new Error('Failed to fetch statistics');
      }

      const data = await response.json();
      const statsContent = document.getElementById('statsContent');

      if (data.count === 0) {
        statsContent.textContent = 'まだデータが収集されていません';
        statsContent.className = 'stats-loading';
        return;
      }

      // 表示用の HTML はサーバー側（lib/sizeStats.ts の generateStatsHTML）で組み立てたものを使う
      statsContent.className = 'stats-content';
      statsContent.innerHTML = data.html;
    } catch (error) {
      console.error('Error loading collected statistics:', error);
      const statsContent = document.getElementById('statsContent');
      statsContent.textContent = 'データの読み込みに失敗しました';
      statsContent.className = 'stats-loading';
    }
  }

  function drawChart(userLength, userDiameter) {
    const ctx = document.getElementById('comparisonChart');

    // 既存のチャートを破棄
    if (comparisonChart) {
      comparisonChart.destroy();
    }

    comparisonChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: ['長さ（mm）', '太さ（mm）'],
      datasets: [
        {
          label: 'あなた',
          data: [userLength, userDiameter],
          backgroundColor: 'rgba(59, 130, 246, 0.8)',
          borderColor: 'rgba(59, 130, 246, 1)',
          borderWidth: 2
        },
        {
          label: '日本人の目安値',
          data: [124, 36],
          backgroundColor: 'rgba(34, 197, 94, 0.8)',
          borderColor: 'rgba(34, 197, 94, 1)',
          borderWidth: 2
        },
        {
          label: 'Veale ら（2015）の平均',
          data: [131, 37.1],
          backgroundColor: 'rgba(251, 146, 60, 0.8)',
          borderColor: 'rgba(251, 146, 60, 1)',
          borderWidth: 2
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          labels: {
            color: '#e5e7eb',
            font: {
              size: 12
            }
          }
        },
        tooltip: {
          backgroundColor: 'rgba(17, 24, 39, 0.95)',
          titleColor: '#e5e7eb',
          bodyColor: '#e5e7eb',
          borderColor: '#374151',
          borderWidth: 1
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: {
            color: '#9ca3af'
          },
          grid: {
            color: 'rgba(75, 85, 99, 0.3)'
          }
        },
        x: {
          ticks: {
            color: '#9ca3af'
          },
          grid: {
            color: 'rgba(75, 85, 99, 0.3)'
          }
        }
      }
    }
  });
  }
})();
</script>

<div class="tool-card" style="margin-top: 40px;">
  <h2 class="text-xl md:text-2xl font-bold mb-4 text-white">このツールについて</h2>

  <p class="mb-4 text-gray-300">このツールは、下記の目安値・研究データの平均値と比べて、入力したサイズがおおよそどのあたりに位置するかを表示します。対象は勃起時のサイズのみです。結果は統計上の目安で、医学的な診断ではありません。</p>

  <h3 class="text-lg md:text-xl font-bold mt-6 mb-3 text-white">保存されるデータと使い方</h3>

  <p class="mb-4 text-gray-300">「統計を計算する」を押すと、次の情報がサーバーに送信・保存されます。</p>

  <ul class="list-disc ml-6 space-y-1 text-gray-300 mb-4">
    <li>長さ（mm）と直径（mm。外周で入力した場合は直径に換算した値）</li>
    <li>状態（このツールでは常に「勃起時」）</li>
    <li>年齢層（選んだ場合のみ）</li>
    <li>ブラウザごとの匿名ID（ブラウザ内で自動生成されるランダムな文字列。同じブラウザからの重複登録を防ぐために使用）</li>
    <li>送信元IPアドレスを元に戻せない形に変換した値（同じ回線からの重複登録を防ぐために使用。IPアドレスそのものは保存しません）</li>
    <li>登録日時</li>
  </ul>

  <p class="mb-4 text-gray-300">氏名・メールアドレスなどの入力欄はありません。保存したデータは匿名の統計（件数・平均・標準偏差）としてこのページに表示するために使います。同じブラウザから保存されるのは最初の1回分だけで、同じ回線からの登録も30日に1件までです。詳しくは<a href="/privacy" class="text-blue-400 hover:text-blue-300 underline">プライバシーポリシー</a>をご覧ください。</p>

  <p class="mb-6 text-gray-300">ページ上部の「このツールに集まったデータ」は利用者の自己申告によるもので、測定方法も統一されていないため、参考程度にご覧ください。</p>

  <h3 class="text-lg md:text-xl font-bold mt-6 mb-3 text-white">計算に使っている値</h3>

  <div class="bg-gray-800 border border-gray-700 rounded-lg p-4 mb-4">
    <div class="font-bold text-white mb-2">■ 日本人の目安値（パーセンタイル・順位の計算に使用）</div>
    <ul class="list-disc ml-6 space-y-2 text-gray-300">
      <li><strong class="text-white">長さ</strong><br>124mm（標準偏差18mm）</li>
      <li><strong class="text-white">直径</strong><br>36mm（標準偏差3.6mm）</li>
      <li><strong class="text-white">根拠</strong><br>国内の調査では勃起時の長さがおおむね12〜14cm程度の範囲で報告されており、それらを参考にしたおおよその目安値です。単一の調査の結果ではなく、測定方法（医療者による測定か自己申告か）によっても数値は変わります。</li>
    </ul>
  </div>

  <div class="bg-gray-800 border border-gray-700 rounded-lg p-4 mb-6">
    <div class="font-bold text-white mb-2">■ 海外の研究データ（グラフの比較に使用）</div>
    <ul class="list-disc ml-6 space-y-2 text-gray-300">
      <li><strong class="text-white">勃起時の長さ</strong><br>平均 約13.1cm（標準偏差 約1.7cm）</li>
      <li><strong class="text-white">勃起時の外周</strong><br>平均 約11.7cm（直径に換算すると約37mm）</li>
      <li><strong class="text-white">平常時の長さ（参考）</strong><br>平均 約9.2cm</li>
      <li><strong class="text-white">出典</strong><br>Veale ら（2015年）BJU International。医療者が測定した研究を集めたメタ分析</li>
    </ul>
  </div>

  <p class="mb-6 text-gray-300">計算では、これらの値が正規分布に従うと仮定しています。実際の分布とは異なる場合があるため、パーセンタイルや「100人中○位」は大まかな目安として受け止めてください。</p>

  <h3 class="text-lg md:text-xl font-bold mt-6 mb-3 text-white">パーセンタイルとは</h3>

  <p class="mb-4 text-gray-300">パーセンタイルは、全体の中でどの位置にいるかを示す指標です。</p>

  <p class="mb-6 text-gray-300">50パーセンタイルは真ん中（このツールでは目安値と同じ）を意味し、80パーセンタイルなら上位20%程度にあたります。</p>

  <h3 class="text-lg md:text-xl font-bold mt-6 mb-3 text-white">測定のコツ</h3>

  <p class="mb-4 text-gray-300">測り方によって数値は大きく変わることがあります。次のポイントを押さえましょう。</p>

  <div class="bg-gray-800 border border-gray-700 rounded-lg p-4 mb-4">
    <div class="font-bold text-white mb-2">■ 長さの測定</div>
    <ul class="list-disc ml-6 space-y-1 text-gray-300">
      <li>勃起した状態で測定</li>
      <li>定規を根元の恥骨に軽く当て、上側から先端まで測る</li>
      <li>定規を使って真っすぐ測る</li>
    </ul>
  </div>

  <div class="bg-gray-800 border border-gray-700 rounded-lg p-4 mb-6">
    <div class="font-bold text-white mb-2">■ 太さの測定</div>
    <ul class="list-disc ml-6 space-y-1 text-gray-300">
      <li>柔らかいメジャーで外周を測る（紙テープに印を付けて定規で測ってもよい）</li>
      <li>直径を直接測るのは難しいため、外周で入力するのがおすすめ</li>
      <li>竿の中ほど（一番太いあたり）で測る</li>
    </ul>
  </div>

  <h3 class="text-lg md:text-xl font-bold mt-6 mb-3 text-white">コンドームサイズの選び方</h3>

  <p class="mb-4 text-gray-300">コンドームは自分に合ったサイズを選ぶことが大切です。きつすぎると痛みや破損の原因になり、緩すぎると外れやすくなります。</p>

  <p class="mb-6 text-gray-300">このツールが表示するサイズは外周から見た大まかな目安です。S・M・L などの基準はメーカーによって異なるため、購入前に各メーカーのサイズ表（公称幅）を確認してください。選び方は<a href="/articles/condom-size-guide" class="text-blue-400 hover:text-blue-300 underline">コンドームのサイズ選びガイド</a>で詳しく解説しています。</p>

  <h2 class="text-xl md:text-2xl font-bold mt-8 mb-4 text-white">関連記事</h2>

  <ul class="list-disc ml-6 space-y-2">
    <li><a href="/articles/japanese-penis-size-data" class="text-blue-400 hover:text-blue-300 underline">日本人男性のペニスサイズ｜データで見る平均値と正しい理解</a></li>
    <li><a href="/articles/condom-size-guide" class="text-blue-400 hover:text-blue-300 underline">コンドームのサイズ選びガイド</a></li>
    <li><a href="/articles/penis-size-satisfaction-truth" class="text-blue-400 hover:text-blue-300 underline">ペニスサイズと満足度の真実</a></li>
  </ul>
</div>
  `.trim(),
  publishedAt: '2025-11-05',
  updatedAt: '2026-10-06',
  pinned: true,
  category: 'ツール'
};
