// 記事の文字数分析スクリプト
const articles = [
  {
    slug: 'getting-started',
    title: 'Short AVの使い方ガイド',
  },
  {
    slug: 'features',
    title: 'Short AVの主な機能',
  },
  {
    slug: 'privacy-security',
    title: 'プライバシーとセキュリティ',
  },
  {
    slug: 'tips-tricks',
    title: '便利な使い方のヒント',
  },
  {
    slug: 'faq',
    title: 'よくある質問（FAQ）',
  },
  {
    slug: 'adult-industry-knowledge',
    title: 'アダルト動画業界の基礎知識',
  },
  {
    slug: 'genre-guide',
    title: 'ジャンル選びの完全ガイド',
  },
  {
    slug: 'safe-browsing',
    title: '安全なアダルトコンテンツ視聴ガイド',
  },
];

// lib/articles.tsから記事データをインポート
const { articles: articleData } = require('../lib/articles.ts');

console.log('=== 記事文字数分析 ===\n');

articleData.forEach((article, index) => {
  const contentLength = article.content.length;
  const target = 1500;
  const needed = Math.max(0, target - contentLength);
  const percentage = Math.round((contentLength / target) * 100);

  console.log(`${index + 1}. ${article.title}`);
  console.log(`   現在: ${contentLength}文字 (目標の${percentage}%)`);
  console.log(`   不足: ${needed}文字`);
  console.log('');
});

console.log('=== まとめ ===');
const total = articleData.reduce((sum, a) => sum + a.content.length, 0);
const avg = Math.round(total / articleData.length);
console.log(`総文字数: ${total}文字`);
console.log(`平均: ${avg}文字/記事`);
console.log(`目標: 1,500文字/記事 × 8記事 = 12,000文字`);
console.log(`不足: ${Math.max(0, 12000 - total)}文字`);
