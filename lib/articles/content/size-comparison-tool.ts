import type { Article } from '../types';

export const article: Article = {
  slug: 'size-comparison-tool',
  title: 'ペニスサイズ比較ツール - 日本人・世界平均との統計比較',
  description: '自分のサイズを入力するだけで、日本人平均や世界平均と比較できる統計ツール。パーセンタイル、100人中の順位、最適なコンドームサイズを科学的に表示。完全匿名で安全に利用できます。',
  content: `
<script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js"></script>

<h1 style="font-size: 1.8rem; font-weight: bold; margin-bottom: 1.5rem; color: white; line-height: 1.4;">ペニスサイズ比較ツール - 日本人・世界平均との統計比較</h1>

<p style="color: #d1d5db; margin-bottom: 1rem;">自分のサイズを入力すると、日本人平均および世界平均と比較して、統計的な位置を確認できます。</p>

<p style="color: #d1d5db; margin-bottom: 1.5rem;">入力データは完全匿名でサーバーに送信され、統計データとして活用されます。個人を特定できる情報は一切含まれません。</p>

<!-- 収集された統計データ表示 -->
<div id="collectedStats" class="collected-stats-card">
  <div class="stats-header">
    <h3>📊 収集された統計データ（勃起時）</h3>
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

.regional-equivalent-compact {
  background: rgba(139, 92, 246, 0.15);
  border: 1px solid #8b5cf6;
  border-radius: 6px;
  padding: 8px 12px;
  margin-bottom: 12px;
}

.regional-equiv-row {
  display: flex;
  gap: 16px;
  justify-content: center;
  align-items: center;
}

.regional-equiv-item {
  display: flex;
  align-items: center;
  gap: 6px;
}

.regional-equiv-label {
  color: #c4b5fd;
  font-size: 0.8rem;
}

.regional-equiv-value {
  color: #fff;
  font-size: 0.95rem;
  font-weight: bold;
}

.regional-comparison {
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
}

.regional-title {
  color: #fff;
  font-size: 0.9rem;
  font-weight: bold;
  margin-bottom: 8px;
}

.regional-table {
  background: rgba(0, 0, 0, 0.2);
  border-radius: 6px;
  overflow: hidden;
}

.regional-row {
  display: grid;
  grid-template-columns: 1.5fr 1fr 1fr;
  gap: 6px;
  padding: 6px 10px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
}

.regional-row:last-child {
  border-bottom: none;
}

.regional-header {
  background: rgba(255, 255, 255, 0.1);
  font-weight: bold;
  padding: 8px 10px;
}

.regional-highlight {
  background: rgba(59, 130, 246, 0.15);
  font-weight: bold;
}

.regional-cell {
  color: #e5e7eb;
  font-size: 0.8rem;
  text-align: left;
}

.regional-header .regional-cell {
  color: #fff;
  font-weight: bold;
  font-size: 0.85rem;
}

.regional-highlight .regional-cell {
  color: #fff;
}

.regional-cell:nth-child(2),
.regional-cell:nth-child(3) {
  text-align: center;
}

.regional-note {
  color: #9ca3af;
  font-size: 0.75rem;
  margin-top: 6px;
  text-align: center;
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

      <div class="regional-equivalent-compact">
        <div class="regional-equiv-row">
          <div class="regional-equiv-item">
            <span class="regional-equiv-label">長さ:</span>
            <span class="regional-equiv-value" id="lengthEquivalent">○○人相当</span>
          </div>
          <div class="regional-equiv-item">
            <span class="regional-equiv-label">太さ:</span>
            <span class="regional-equiv-value" id="girthEquivalent">○○人相当</span>
          </div>
        </div>
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
        <div class="condom-title">推奨コンドームサイズ</div>
        <div class="condom-size" id="condomSize">Mサイズ（32-36mm）</div>
      </div>

      <div class="regional-comparison">
        <h4 class="regional-title">世界各地域の平均サイズ</h4>
        <div class="regional-table">
          <div class="regional-row regional-header">
            <div class="regional-cell">地域</div>
            <div class="regional-cell">平均長さ</div>
            <div class="regional-cell">平均直径</div>
          </div>
          <div class="regional-row">
            <div class="regional-cell">コンゴ</div>
            <div class="regional-cell">170mm</div>
            <div class="regional-cell">42mm</div>
          </div>
          <div class="regional-row">
            <div class="regional-cell">中南米</div>
            <div class="regional-cell">145mm</div>
            <div class="regional-cell">38mm</div>
          </div>
          <div class="regional-row">
            <div class="regional-cell">中東</div>
            <div class="regional-cell">130mm</div>
            <div class="regional-cell">37mm</div>
          </div>
          <div class="regional-row regional-highlight">
            <div class="regional-cell">世界平均</div>
            <div class="regional-cell">131mm</div>
            <div class="regional-cell">37mm</div>
          </div>
          <div class="regional-row">
            <div class="regional-cell">ヨーロッパ</div>
            <div class="regional-cell">126mm</div>
            <div class="regional-cell">36mm</div>
          </div>
          <div class="regional-row regional-highlight">
            <div class="regional-cell">日本</div>
            <div class="regional-cell">124mm</div>
            <div class="regional-cell">36mm</div>
          </div>
          <div class="regional-row">
            <div class="regional-cell">西太平洋</div>
            <div class="regional-cell">116mm</div>
            <div class="regional-cell">34mm</div>
          </div>
          <div class="regional-row">
            <div class="regional-cell">東南アジア</div>
            <div class="regional-cell">109mm</div>
            <div class="regional-cell">33mm</div>
          </div>
          <div class="regional-row">
            <div class="regional-cell">韓国</div>
            <div class="regional-cell">95mm</div>
            <div class="regional-cell">31mm</div>
          </div>
        </div>
        <div class="regional-note">※ 複数の研究データに基づく推定値です</div>
      </div>
    </div>

    <div class="tool-card">
      <h3>日本人平均との比較</h3>
      <div class="chart-container">
        <canvas id="comparisonChart"></canvas>
      </div>
    </div>

    <div class="disclaimer">
      <div class="disclaimer-text">
        ※ 統計データに基づく参考情報です<br>
        ※ 個人差があります<br>
        ※ 医学的診断ではありません<br>
        ※ 入力データ（勃起時のサイズ）は匿名で自動的に収集され、統計データとして活用されます<br>
        ※ 収集されるデータ：長さ・太さ・年齢層のみ（個人を特定する情報は一切含まれません）
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

// コンドームサイズ推奨
function recommendCondomSize(diameter) {
  if (diameter < 27) return 'SSサイズ（〜26mm）';
  if (diameter < 32) return 'Sサイズ（27-31mm）';
  if (diameter < 37) return 'Mサイズ（32-36mm）';
  if (diameter < 42) return 'Lサイズ（37-41mm）';
  return 'XLサイズ（42mm以上）';
}

// 地域別の平均データから最も近い地域を計算（長さ）
function getLengthRegionalEquivalent(lengthMm) {
  const regions = [
    { name: 'コンゴ', avg: 170 },
    { name: '中南米', avg: 145 },
    { name: '中東', avg: 130 },
    { name: 'ヨーロッパ', avg: 126 },
    { name: '日本', avg: 124 },
    { name: '西太平洋', avg: 116 },
    { name: '東南アジア', avg: 109 },
    { name: '韓国', avg: 95 }
  ];

  let closestRegion = regions[0];
  let minDiff = Math.abs(lengthMm - regions[0].avg);

  for (let i = 1; i < regions.length; i++) {
    const diff = Math.abs(lengthMm - regions[i].avg);
    if (diff < minDiff) {
      minDiff = diff;
      closestRegion = regions[i];
    }
  }

  return closestRegion.name + '人相当';
}

// 地域別の平均データから最も近い地域を計算（直径）
function getGirthRegionalEquivalent(diameterMm) {
  const regions = [
    { name: 'コンゴ', avg: 42 },
    { name: '中南米', avg: 38 },
    { name: '中東', avg: 37 },
    { name: 'ヨーロッパ', avg: 36 },
    { name: '日本', avg: 36 },
    { name: '西太平洋', avg: 34 },
    { name: '東南アジア', avg: 33 },
    { name: '韓国', avg: 31 }
  ];

  let closestRegion = regions[0];
  let minDiff = Math.abs(diameterMm - regions[0].avg);

  for (let i = 1; i < regions.length; i++) {
    const diff = Math.abs(diameterMm - regions[i].avg);
    if (diff < minDiff) {
      minDiff = diff;
      closestRegion = regions[i];
    }
  }

  return closestRegion.name + '人相当';
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

  // 日本人統計データ（mm単位）
  // 出典: 泌尿器科調査(2006,324人)117mm、国内研究(100例)127mm、TENGA調査(50万件)135.6mm
  // 加重平均（医学的測定3：自己申告1）
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

  // 地域別比較
  const lengthEquivalent = getLengthRegionalEquivalent(length);
  const girthEquivalent = getGirthRegionalEquivalent(diameter);

  // 結果を表示
  document.getElementById('lengthPercentile').textContent = lengthPercentile.toFixed(1) + '%';
  document.getElementById('girthPercentile').textContent = diameterPercentile.toFixed(1) + '%';
  document.getElementById('lengthRank').textContent = lengthRank + '位';
  document.getElementById('girthRank').textContent = diameterRank + '位';
  document.getElementById('rankLevel').textContent = rankInfo.level;
  document.getElementById('rankDescription').textContent = rankInfo.description;
  document.getElementById('lengthEquivalent').textContent = lengthEquivalent;
  document.getElementById('girthEquivalent').textContent = girthEquivalent;
  document.getElementById('condomSize').textContent = condomSize;

  // 結果エリアを表示
  document.getElementById('resultContainer').classList.remove('result-hidden');

  // グラフを描画
  drawChart(length, diameter);

  // 結果エリアまでスクロール
    document.getElementById('resultContainer').scrollIntoView({ behavior: 'smooth', block: 'start' });

    // 統計データを送信（常に送信、勃起時固定）
    sendStatisticsData(lengthMm, diameter, 'erect', document.getElementById('ageInput').value);
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

      var cls = 'class';
      var html = '';
      html += '<div ' + cls + '="stats-item">';
      html += '<div ' + cls + '="stats-label">データ件数</div>';
      html += '<div ' + cls + '="stats-value">' + data.count + '</div>';
      html += '<div ' + cls + '="stats-subvalue">人</div>';
      html += '</div>';

      html += '<div ' + cls + '="stats-item-wide">';
      html += '<div ' + cls + '="stats-double-container">';
      html += '<div ' + cls + '="stats-half-item">';
      html += '<div ' + cls + '="stats-label">平均長さ</div>';
      html += '<div ' + cls + '="stats-value">' + data.statistics.avgLength + '</div>';
      html += '<div ' + cls + '="stats-subvalue">mm（標準偏差: ' + data.statistics.stdLength + 'mm）</div>';
      html += '</div>';
      html += '<div ' + cls + '="stats-half-item">';
      html += '<div ' + cls + '="stats-label">平均直径</div>';
      html += '<div ' + cls + '="stats-value">' + data.statistics.avgDiameter + '</div>';
      html += '<div ' + cls + '="stats-subvalue">mm（標準偏差: ' + data.statistics.stdDiameter + 'mm）</div>';
      html += '</div>';
      html += '</div>';
      html += '</div>';

      statsContent.innerHTML = html;
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
          label: '日本人平均',
          data: [124, 36],
          backgroundColor: 'rgba(34, 197, 94, 0.8)',
          borderColor: 'rgba(34, 197, 94, 1)',
          borderWidth: 2
        },
        {
          label: '世界平均',
          data: [131, 37.3],
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

  <p class="mb-4 text-gray-300">このツールは、科学的な統計データに基づいてあなたのサイズを客観的に評価します。勃起時のサイズのみを対象としています。</p>

  <p class="mb-6 text-gray-300">入力されたデータ（勃起時の長さ・太さ・年齢層）は匿名で自動的に収集され、より正確な統計データの作成に活用されます。個人を特定する情報は一切含まれません。</p>

  <h3 class="text-lg md:text-xl font-bold mt-6 mb-3 text-white">使用している統計データ</h3>

  <div class="bg-gray-800 border border-gray-700 rounded-lg p-4 mb-4">
    <div class="font-bold text-white mb-2">■ 日本人データ</div>
    <ul class="list-disc ml-6 space-y-2 text-gray-300">
      <li><strong class="text-white">長さ平均</strong><br>124mm（標準偏差18mm）</li>
      <li><strong class="text-white">直径平均</strong><br>36mm（標準偏差3.6mm）</li>
      <li><strong class="text-white">データソース</strong><br>泌尿器科調査(2006,324人)、国内研究(100例)、TENGA調査(50万件)の加重平均</li>
    </ul>
  </div>

  <div class="bg-gray-800 border border-gray-700 rounded-lg p-4 mb-6">
    <div class="font-bold text-white mb-2">■ 世界平均データ</div>
    <ul class="list-disc ml-6 space-y-2 text-gray-300">
      <li><strong class="text-white">長さ平均</strong><br>131mm</li>
      <li><strong class="text-white">外周平均</strong><br>117mm（直径約37.3mm）</li>
      <li><strong class="text-white">データソース</strong><br>Veale et al. (2015) BJU International、15,521人のメタアナリシス</li>
    </ul>
  </div>

  <h3 class="text-lg md:text-xl font-bold mt-6 mb-3 text-white">パーセンタイルとは</h3>

  <p class="mb-4 text-gray-300">パーセンタイルは、あなたが全体の中でどの位置にいるかを示す指標です。</p>

  <p class="mb-6 text-gray-300">50パーセンタイルは平均を意味し、80パーセンタイルなら上位20%に入ることを意味します。</p>

  <h3 class="text-lg md:text-xl font-bold mt-6 mb-3 text-white">測定のコツ</h3>

  <p class="mb-4 text-gray-300">正確な測定のために、以下のポイントを押さえましょう。</p>

  <div class="bg-gray-800 border border-gray-700 rounded-lg p-4 mb-4">
    <div class="font-bold text-white mb-2">■ 長さの測定</div>
    <ul class="list-disc ml-6 space-y-1 text-gray-300">
      <li>完全に勃起した状態で測定</li>
      <li>恥骨の骨から先端まで</li>
      <li>定規を使って真っすぐ測る</li>
    </ul>
  </div>

  <div class="bg-gray-800 border border-gray-700 rounded-lg p-4 mb-6">
    <div class="font-bold text-white mb-2">■ 太さの測定</div>
    <ul class="list-disc ml-6 space-y-1 text-gray-300">
      <li>メジャーで外周を測定</li>
      <li>または直径をノギスで測定</li>
      <li>最も太い部分で測る</li>
    </ul>
  </div>

  <h3 class="text-lg md:text-xl font-bold mt-6 mb-3 text-white">コンドームサイズの選び方</h3>

  <p class="mb-4 text-gray-300">コンドームは正しいサイズを選ぶことが重要です。</p>

  <p class="mb-6 text-gray-300">きつすぎると痛みや破損のリスクがあり、緩すぎると外れる可能性があります。このツールの推奨サイズを参考にしてください。</p>

  <h2 class="text-xl md:text-2xl font-bold mt-8 mb-4 text-white">関連記事</h2>

  <ul class="list-disc ml-6 space-y-2">
    <li><a href="/articles/japanese-men-condom-size-data" class="text-blue-400 hover:text-blue-300 underline">購買データで判明！日本人男性のリアルなサイズ分布</a> - コンドーム購買データ分析</li>
    <li><a href="/articles/penis-size-global-comparison" class="text-blue-400 hover:text-blue-300 underline">ペニスサイズの真実：世界と日本のデータ比較</a> - 国際比較</li>
    <li><a href="/articles/how-to-measure-penis-correctly" class="text-blue-400 hover:text-blue-300 underline">自分のサイズを正しく測る方法</a> - 測定方法詳細</li>
  </ul>
</div>
  `.trim(),
  publishedAt: '2025-11-05',
  pinned: true,
  category: 'ツール'
};
