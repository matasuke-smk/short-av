import type { Article } from '../types';

export const article: Article = {
  slug: 'size-comparison-tool',
  title: 'ペニスサイズ偏差値チェッカー - 日本人の平均と比べて100人中なん位か',
  description: '勃起時の長さと太さを入れるだけで、日本人の目安値と比べた偏差値と100人中なん位かが分かるツール（ちんこ偏差値チェッカー）。cm でも mm でも入力でき、コンドームのサイズの目安も表示。登録不要・匿名。結果は統計上の目安で、医学的な診断ではありません。',
  content: `
<script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js"></script>

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

.tool-lead {
  color: #d1d5db;
  margin-bottom: 1rem;
  line-height: 1.7;
}
.tool-lead strong { color: #fff; }
.form-hint {
  color: #9ca3af;
  font-size: 0.85rem;
  margin-top: 8px;
  line-height: 1.5;
}
.tool-error {
  color: #fca5a5;
  background: rgba(127, 29, 29, 0.35);
  border: 1px solid #991b1b;
  border-radius: 8px;
  padding: 10px 12px;
  margin-bottom: 12px;
  font-size: 0.9rem;
}
.dev-hero {
  text-align: center;
  padding: 8px 0 16px;
}
.rank-tag {
  display: inline-block;
  background: #fde047;
  color: #1f2937;
  font-weight: 800;
  font-size: 1.15rem;
  padding: 6px 16px;
  border-radius: 999px;
  margin: 4px 0 10px;
}
.rank-tag span { font-size: 1.35rem; }
.collected-stats-card {
  margin-top: 20px;
}
.dev-label {
  color: #bfdbfe;
  font-size: 0.9rem;
}
.dev-main {
  color: #fff;
  font-size: 4rem;
  font-weight: 800;
  line-height: 1.1;
  margin: 4px 0 8px;
}
.stat-input {
  color: #9ca3af;
  font-size: 0.8rem;
  font-weight: normal;
}
.stat-foot {
  color: #bfdbfe;
  font-size: 0.85rem;
  text-align: center;
  margin-top: 6px;
}
.share-row {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-top: 18px;
}
.btn-share {
  flex: 1 1 200px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 12px 16px;
  border-radius: 10px;
  border: 1px solid #4b5563;
  background: #111827;
  color: #fff;
  font-weight: bold;
  font-size: 0.95rem;
  text-decoration: none;
  cursor: pointer;
}
.btn-share:hover { background: #1f2937; }
.btn-share-x {
  background: #fff;
  color: #000;
  border-color: #fff;
}
.btn-share-x:hover { background: #e5e7eb; }
.share-note {
  color: #9ca3af;
  font-size: 0.8rem;
  margin-top: 8px;
}
</style>

<div class="size-tool-container">
  <p class="tool-lead">勃起時の長さと太さを入れるだけで、日本人の目安値と比べた<strong>偏差値</strong>と、<strong>100人中なん位か</strong>、そして「AV男優並み」「日本人の平均並み」のどれにあたるかが分かります。登録不要・匿名です。結果は統計上の目安で、医学的な診断ではありません。</p>

  <div class="tool-card" id="inputCard">
    <h3>サイズを入力してください（勃起時）</h3>

    <div class="form-group">
      <label class="form-label" for="lengthInput">長さ</label>
      <input type="number" id="lengthInput" class="form-input" inputmode="decimal" step="0.1" placeholder="例: 13.5（cm）または 135（mm）">
      <p class="form-hint">cm でも mm でもかまいません（30未満は cm として扱います）</p>
    </div>

    <div class="form-group">
      <label class="form-label">太さの測り方</label>
      <div class="radio-group">
        <label class="radio-label">
          <input type="radio" name="girthType" value="circumference" checked>
          外周（ぐるっと一周の長さ。おすすめ）
        </label>
        <label class="radio-label">
          <input type="radio" name="girthType" value="diameter">
          直径
        </label>
      </div>
    </div>

    <div class="form-group">
      <label class="form-label" id="girthLabel" for="girthInput">太さ - 外周</label>
      <input type="number" id="girthInput" class="form-input" inputmode="decimal" step="0.1" placeholder="例: 11（cm）または 110（mm）">
      <p class="form-hint" id="girthHint">いちばん太いところを柔らかいメジャーか紐で測ります。cm でも mm でも可</p>
    </div>

    <div class="form-group">
      <label class="form-label" for="ageInput">年齢層（任意）</label>
      <select id="ageInput" class="form-input">
        <option value="">選択しない</option>
        <option value="20s">20代</option>
        <option value="30s">30代</option>
        <option value="40s">40代</option>
        <option value="50s">50代以上</option>
      </select>
    </div>

    <p id="toolError" class="tool-error" hidden></p>
    <button class="btn-calculate" id="calculateBtn">偏差値を計算する</button>
    <p class="form-hint" style="margin-top: 10px;">押すと、入力した長さ・太さ・年齢層（任意）とブラウザごとの匿名IDが保存され、下の「集まったデータ」の集計に使われます（同じブラウザからは最初の1回分のみ）。氏名などの入力はありません。<a href="/privacy" style="color: #60a5fa; text-decoration: underline;">プライバシーポリシー</a></p>
  </div>

  <div id="resultContainer" class="result-hidden">
    <div class="result-card">
      <h3 class="result-title">あなたの結果</h3>

      <div class="dev-hero">
        <div class="dev-label">総合の偏差値</div>
        <div class="dev-main" id="overallDeviation">50</div>
        <div class="rank-tag">あなたは <span id="rankTag">日本人の平均並み</span></div>
        <div class="rank-badge-large" id="rankLevel">平均的</div>
        <div class="rank-description" id="rankDescription">日本人男性の標準範囲内です</div>
      </div>

      <div class="stat-grid">
        <div class="stat-item-double">
          <div class="stat-label">長さ <span class="stat-input" id="lengthEcho"></span></div>
          <div class="stat-double-row">
            <div class="stat-half">
              <div class="stat-sublabel">偏差値</div>
              <div class="stat-value" id="lengthDeviation">50</div>
            </div>
            <div class="stat-half">
              <div class="stat-sublabel">100人中</div>
              <div class="stat-value" id="lengthRank">50位</div>
            </div>
          </div>
          <div class="stat-foot" id="lengthPercentile">上位 50%</div>
        </div>
        <div class="stat-item-double">
          <div class="stat-label">太さ <span class="stat-input" id="girthEcho"></span></div>
          <div class="stat-double-row">
            <div class="stat-half">
              <div class="stat-sublabel">偏差値</div>
              <div class="stat-value" id="girthDeviation">50</div>
            </div>
            <div class="stat-half">
              <div class="stat-sublabel">100人中</div>
              <div class="stat-value" id="girthRank">50位</div>
            </div>
          </div>
          <div class="stat-foot" id="girthPercentile">上位 50%</div>
        </div>
      </div>

      <div class="condom-recommendation">
        <div class="condom-title">コンドームサイズの目安</div>
        <div class="condom-size" id="condomSize">Mサイズ前後</div>
        <div class="condom-note">※ あくまで目安です。S・M・L の基準はメーカーごとに異なります。選び方は<a href="/articles/condom-size-guide" style="color: #93c5fd; text-decoration: underline;">コンドームのサイズの選び方</a>へ</div>
      </div>

      <div class="share-row">
        <a id="shareX" class="btn-share btn-share-x" href="#" target="_blank" rel="noopener">𝕏 結果をポストする</a>
        <button id="shareCopy" class="btn-share" type="button">結果の文をコピー</button>
      </div>
      <p class="share-note" id="shareNote">ポストには数字だけが入ります（入力した mm は入りません）。</p>
    </div>

    <div class="tool-card">
      <h3>目安値との比較</h3>
      <div class="chart-container">
        <canvas id="comparisonChart"></canvas>
      </div>
    </div>

    <div class="disclaimer">
      <div class="disclaimer-text">
        ※ 偏差値・順位は、日本人の目安値（長さ 124mm・直径 36mm）を正規分布と仮定して計算したおおよその位置です。実際の分布とは異なる場合があります<br>
        ※ 医学的な診断ではありません。サイズや機能に悩みがある場合は泌尿器科で相談してください
      </div>
    </div>
  </div>

  <div id="collectedStats" class="collected-stats-card">
    <div class="stats-header">
      <h3>📊 このツールに集まったデータ（勃起時・自己申告）</h3>
    </div>
    <div id="statsContent" class="stats-content">
      <div class="stats-loading">データを読み込み中...</div>
    </div>
  </div>
</div>

<script>
(function() {
  'use strict';

  var TOOL_URL = 'https://short-av.com/articles/size-comparison-tool';
  // 日本人の目安値（mm）。国内の複数の報告（勃起時の長さはおおむね12〜14cm）を参考にした目安で、単一の調査の値ではない
  var JP = { lengthMean: 124, lengthStd: 18, diameterMean: 36, diameterStd: 3.6 };

  document.addEventListener('DOMContentLoaded', function() {
    document.querySelectorAll('input[name="girthType"]').forEach(function(radio) {
      radio.addEventListener('change', function() {
        var label = document.getElementById('girthLabel');
        var input = document.getElementById('girthInput');
        var hint = document.getElementById('girthHint');
        if (this.value === 'diameter') {
          label.textContent = '太さ - 直径';
          input.placeholder = '例: 3.5（cm）または 35（mm）';
          hint.textContent = '直径を直接測るのは難しいので、外周で入力するのがおすすめです。cm でも mm でも可';
        } else {
          label.textContent = '太さ - 外周';
          input.placeholder = '例: 11（cm）または 110（mm）';
          hint.textContent = 'いちばん太いところを柔らかいメジャーか紐で測ります。cm でも mm でも可';
        }
        input.value = '';
        hideError();
      });
    });
    var calculateBtn = document.getElementById('calculateBtn');
    if (calculateBtn) calculateBtn.addEventListener('click', calculateStats);
    var copyBtn = document.getElementById('shareCopy');
    if (copyBtn) copyBtn.addEventListener('click', copyShareText);
    var xBtn = document.getElementById('shareX');
    if (xBtn) xBtn.addEventListener('click', function() { track('size_tool_share', { method: 'x' }); });
  });

  function track(name, params) {
    try { if (window.gtag) window.gtag('event', name, params || {}); } catch (e) {}
  }

  // 正規分布の累積分布関数
  function normalCDF(x, mean, stdDev) {
    var z = (x - mean) / stdDev;
    var t = 1 / (1 + 0.2316419 * Math.abs(z));
    var d = 0.3989423 * Math.exp(-z * z / 2);
    var prob = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
    return z > 0 ? 1 - prob : prob;
  }

  // 偏差値 = 50 + 10 × (値 − 平均) ÷ 標準偏差
  function deviation(x, mean, stdDev) {
    return Math.round(50 + 10 * (x - mean) / stdDev);
  }

  // cm で入力された値を mm に直す（長さ・外周は 30 未満、直径は 8 未満を cm とみなす）
  function toMm(value, cmBelow) {
    return value < cmBelow ? value * 10 : value;
  }

  // 評価（上から: 上位2%・上位16%・平均まわり・下位16%・下位2%。偏差値 70・60・40・30 の区切り）
  function getRankLevel(percentile) {
    if (percentile >= 97.7) return { level: '大きめ', tag: 'AV男優並み', description: '日本人男性の上位2%。文句なしの大きさです' };
    if (percentile >= 84) return { level: 'やや大きめ', tag: 'バナナ並み', description: '日本人男性の上位16%。堂々としたサイズです' };
    if (percentile >= 16) return { level: '平均的', tag: '日本人の平均並み', description: '日本人男性の標準範囲内。いちばん多いゾーンです' };
    if (percentile >= 2.3) return { level: 'やや小さめ', tag: 'ミニバナナ並み', description: '平均より少し控えめ。相性と使い方しだいです' };
    return { level: '小さめ', tag: 'コンパクト派', description: '平均よりかなり控えめ。悩みがあれば泌尿器科で相談を' };
  }

  // コンドームサイズの目安（外周から大まかに判定。S/M/L の基準はメーカーごとに異なる）
  function recommendCondomSize(diameter) {
    var circumference = Math.round(diameter * Math.PI);
    var size;
    if (circumference < 105) size = 'Sサイズ前後';
    else if (circumference < 115) size = 'Mサイズ前後';
    else if (circumference < 123) size = 'Lサイズ前後';
    else size = 'XLサイズ前後';
    return size + '（外周 約' + circumference + 'mm・直径 約' + Math.round(diameter) + 'mm）';
  }

  function showError(message) {
    var el = document.getElementById('toolError');
    el.textContent = message;
    el.hidden = false;
  }
  function hideError() {
    var el = document.getElementById('toolError');
    el.hidden = true;
  }

  var comparisonChart = null;
  var lastShareText = '';

  function calculateStats() {
    hideError();
    var lengthRaw = parseFloat(document.getElementById('lengthInput').value);
    var girthRaw = parseFloat(document.getElementById('girthInput').value);
    var girthType = document.querySelector('input[name="girthType"]:checked').value;

    if (!lengthRaw || !girthRaw) {
      showError('長さと太さの両方を入力してください。');
      return;
    }
    var lengthMm = toMm(lengthRaw, 30);
    if (lengthMm < 70 || lengthMm > 200) {
      showError('長さは 7〜20cm（70〜200mm）の範囲で入力してください。');
      return;
    }
    var diameter;
    if (girthType === 'diameter') {
      diameter = toMm(girthRaw, 8);
      if (diameter < 25 || diameter > 50) {
        showError('直径は 2.5〜5cm（25〜50mm）の範囲で入力してください。');
        return;
      }
    } else {
      var circumference = toMm(girthRaw, 30);
      if (circumference < 80 || circumference > 157) {
        showError('外周は 8〜15.7cm（80〜157mm）の範囲で入力してください。');
        return;
      }
      diameter = circumference / Math.PI;
    }

    var lengthPercentile = normalCDF(lengthMm, JP.lengthMean, JP.lengthStd) * 100;
    var diameterPercentile = normalCDF(diameter, JP.diameterMean, JP.diameterStd) * 100;
    var lengthDev = deviation(lengthMm, JP.lengthMean, JP.lengthStd);
    var girthDev = deviation(diameter, JP.diameterMean, JP.diameterStd);
    var overallDev = Math.round((lengthDev + girthDev) / 2);
    var lengthRank = Math.min(100, Math.max(1, Math.round(100 - lengthPercentile + 1)));
    var diameterRank = Math.min(100, Math.max(1, Math.round(100 - diameterPercentile + 1)));
    var avgPercentile = (lengthPercentile + diameterPercentile) / 2;
    var rankInfo = getRankLevel(avgPercentile);
    var topPct = function(p) { return Math.max(1, Math.round(100 - p)); };

    document.getElementById('overallDeviation').textContent = overallDev;
    document.getElementById('lengthDeviation').textContent = lengthDev;
    document.getElementById('girthDeviation').textContent = girthDev;
    document.getElementById('lengthRank').textContent = lengthRank + '位';
    document.getElementById('girthRank').textContent = diameterRank + '位';
    document.getElementById('lengthPercentile').textContent = '上位 ' + topPct(lengthPercentile) + '%';
    document.getElementById('girthPercentile').textContent = '上位 ' + topPct(diameterPercentile) + '%';
    document.getElementById('lengthEcho').textContent = '（' + (lengthMm / 10).toFixed(1) + 'cm）';
    document.getElementById('girthEcho').textContent = '（直径 ' + (diameter / 10).toFixed(1) + 'cm）';
    document.getElementById('rankTag').textContent = rankInfo.tag;
    document.getElementById('rankLevel').textContent = rankInfo.level;
    document.getElementById('rankDescription').textContent = rankInfo.description;
    document.getElementById('condomSize').textContent = recommendCondomSize(diameter);

    // X に投稿する文（数字だけ。入力した mm は入れない）
    lastShareText = 'ペニスサイズ偏差値チェッカーで測ったら、偏差値 ' + overallDev + '（長さ ' + lengthDev + '・太さ ' + girthDev + '）。日本人男性100人中 ' + Math.round((lengthRank + diameterRank) / 2) + '位くらいで「' + rankInfo.tag + '」でした。\\n#ちんこ偏差値チェッカー\\n' + TOOL_URL;
    document.getElementById('shareX').href = 'https://twitter.com/intent/tweet?text=' + encodeURIComponent(lastShareText);

    document.getElementById('resultContainer').classList.remove('result-hidden');
    drawChart(lengthMm, diameter);
    document.getElementById('resultContainer').scrollIntoView({ behavior: 'smooth', block: 'start' });

    track('size_tool_calculate', { deviation: overallDev, level: rankInfo.tag, girth_type: girthType });

    // DB の列は整数のため、直径（外周から換算すると小数になる）などは四捨五入して送る
    sendStatisticsData(Math.round(lengthMm), Math.round(diameter), 'erect', document.getElementById('ageInput').value);
  }

  function copyShareText() {
    if (!lastShareText) return;
    var done = function() {
      var note = document.getElementById('shareNote');
      note.textContent = 'コピーしました。X などに貼り付けてください。';
      track('size_tool_share', { method: 'copy' });
    };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(lastShareText).then(done).catch(function() { fallbackCopy(lastShareText, done); });
    } else {
      fallbackCopy(lastShareText, done);
    }
  }
  function fallbackCopy(text, done) {
    var ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); done(); } catch (e) {}
    document.body.removeChild(ta);
  }

  // 匿名ユーザーID（LocalStorage。1ブラウザ1データの判定に使用）
  function getSizeToolUserId() {
    try {
      var key = 'short-av-user-id';
      var userId = localStorage.getItem(key);
      if (!userId) {
        userId = (crypto && crypto.randomUUID) ? crypto.randomUUID() : 'uid-' + Date.now() + '-' + Math.random().toString(36).slice(2);
        localStorage.setItem(key, userId);
      }
      return userId;
    } catch (e) {
      return null;
    }
  }

  async function sendStatisticsData(lengthMm, diameterMm, erectionState, ageGroup) {
    try {
      var submittedKey = 'short-av-size-submitted';
      var userId = getSizeToolUserId();
      // 既に登録済みのブラウザは再送信しない（DB へは最初の1件のみ保存される）
      if (localStorage.getItem(submittedKey) === '1') {
        loadCollectedStats();
        return;
      }
      var response = await fetch('/api/size-stats', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lengthMm: lengthMm, diameterMm: diameterMm, erectionState: erectionState, ageGroup: ageGroup || null, userId: userId }),
      });
      if (!response.ok) {
        console.error('Failed to send statistics data');
      } else {
        try { localStorage.setItem(submittedKey, '1'); } catch (e) {}
        loadCollectedStats();
      }
    } catch (error) {
      console.error('Error sending statistics data:', error);
    }
  }

  async function loadCollectedStats() {
    try {
      var response = await fetch('/api/size-stats?erectionState=erect');
      if (!response.ok) throw new Error('Failed to fetch statistics');
      var data = await response.json();
      var statsContent = document.getElementById('statsContent');
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
    }
  }

  function drawChart(userLength, userDiameter) {
    var ctx = document.getElementById('comparisonChart');
    if (comparisonChart) comparisonChart.destroy();
    comparisonChart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: ['長さ（mm）', '太さ（直径 mm）'],
        datasets: [
          { label: 'あなた', data: [Math.round(userLength), Math.round(userDiameter * 10) / 10], backgroundColor: 'rgba(59, 130, 246, 0.8)', borderColor: 'rgba(59, 130, 246, 1)', borderWidth: 2 },
          { label: '日本人の目安値', data: [124, 36], backgroundColor: 'rgba(34, 197, 94, 0.8)', borderColor: 'rgba(34, 197, 94, 1)', borderWidth: 2 },
          { label: 'Veale ら（2015）の平均', data: [131, 37.1], backgroundColor: 'rgba(251, 146, 60, 0.8)', borderColor: 'rgba(251, 146, 60, 1)', borderWidth: 2 }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { labels: { color: '#e5e7eb', font: { size: 12 } } },
          tooltip: { backgroundColor: 'rgba(17, 24, 39, 0.95)', titleColor: '#e5e7eb', bodyColor: '#e5e7eb', borderColor: '#374151', borderWidth: 1 }
        },
        scales: {
          y: { beginAtZero: true, ticks: { color: '#9ca3af' }, grid: { color: 'rgba(75, 85, 99, 0.3)' } },
          x: { ticks: { color: '#9ca3af' }, grid: { color: 'rgba(75, 85, 99, 0.3)' } }
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

  <p class="mb-4 text-gray-300">「偏差値を計算する」を押すと、次の情報がサーバーに送信・保存されます。</p>

  <ul class="list-disc ml-6 space-y-1 text-gray-300 mb-4">
    <li>長さ（mm）と直径（mm。外周で入力した場合は直径に換算した値）</li>
    <li>状態（このツールでは常に「勃起時」）</li>
    <li>年齢層（選んだ場合のみ）</li>
    <li>ブラウザごとの匿名ID（ブラウザ内で自動生成されるランダムな文字列。同じブラウザからの重複登録を防ぐために使用）</li>
    <li>送信元IPアドレスを元に戻せない形に変換した値（同じ回線からの重複登録を防ぐために使用。IPアドレスそのものは保存しません）</li>
    <li>登録日時</li>
  </ul>

  <p class="mb-4 text-gray-300">氏名・メールアドレスなどの入力欄はありません。保存したデータは匿名の統計（件数・平均・標準偏差）としてこのページに表示するために使います。同じブラウザから保存されるのは最初の1回分だけで、同じ回線からの登録も30日に1件までです。詳しくは<a href="/privacy" class="text-blue-400 hover:text-blue-300 underline">プライバシーポリシー</a>をご覧ください。</p>

  <p class="mb-6 text-gray-300">結果の下の「このツールに集まったデータ」は利用者の自己申告によるもので、測定方法も統一されていないため、参考程度にご覧ください。</p>

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

  <h3 class="text-lg md:text-xl font-bold mt-6 mb-3 text-white">偏差値と「100人中なん位」の意味</h3>

  <p class="mb-4 text-gray-300">偏差値は、平均を50、標準偏差1つぶんを10として位置を表した数字です（学校のテストの偏差値と同じ計算）。目安値どおりなら50、平均より標準偏差1つぶん大きければ60、小さければ40になります。総合の偏差値は長さと太さの偏差値の平均です。</p>

  <p class="mb-6 text-gray-300">「100人中なん位」は、同じ分布の100人を大きい順に並べたときのおおよその順位です。偏差値60なら上位16%程度（100人中16位くらい）、偏差値40なら下位16%程度にあたります。</p>

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
  updatedAt: '2026-10-10',
  pinned: true,
  ogImage: '/og/size-tool.png',
  category: 'ツール'
};
