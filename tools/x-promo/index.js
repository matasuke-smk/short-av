#!/usr/bin/env node

/**
 * X投稿支援ツール
 * short-av.comの作品をXで宣伝するためのツール
 *
 * 使い方:
 *   node tools/x-promo/index.js              # ランダムな動画を選択
 *   node tools/x-promo/index.js --random     # ランダムな動画を選択
 *   node tools/x-promo/index.js --id <id>    # 指定IDの動画を選択
 *   node tools/x-promo/index.js --ranking    # ランキング上位から選択
 *   node tools/x-promo/index.js --download   # サンプル動画もダウンロード
 */

const { createClient } = require('@supabase/supabase-js');
const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

// 環境変数を.env.localから読み込む
require('dotenv').config({ path: path.join(__dirname, '../../.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('エラー: Supabase の環境変数が設定されていません。');
  console.error('.env.local ファイルに以下を設定してください:');
  console.error('  NEXT_PUBLIC_SUPABASE_URL=xxx');
  console.error('  NEXT_PUBLIC_SUPABASE_ANON_KEY=xxx');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// 紹介文テンプレート
const PROMO_TEMPLATES = [
  (video) => `${video.title}

${getActressText(video)}
${getGenreText(video)}

▶️ サンプル動画はこちら
${getVideoUrl(video)}

#PR #FANZA #アダルト動画`,

  (video) => `【おすすめ作品】
${video.title}

${video.maker ? `メーカー: ${video.maker}` : ''}
${getActressText(video)}

サンプル動画で確認できます👇
${getVideoUrl(video)}

#PR #FANZA`,

  (video) => `${getActressText(video) ? getActressText(video) + 'の新作！' : '話題の作品！'}

「${video.title}」

${video.price ? `💰 ${video.price.toLocaleString()}円` : ''}

詳しくはこちら👇
${getVideoUrl(video)}

#PR #FANZA #AV`,
];

function getVideoUrl(video) {
  // short-av.comの作品ページURL
  return `https://short-av.com/?v=${video.dmm_content_id}`;
}

function getActressText(video) {
  // actress_idsから女優名を取得（データがある場合）
  // ここでは簡易的にnullチェックのみ
  return '';
}

function getGenreText(video) {
  return '';
}

// ランダムな動画を取得
async function getRandomVideo() {
  const { data, error, count } = await supabase
    .from('videos')
    .select('*', { count: 'exact' })
    .eq('is_active', true)
    .not('sample_video_url', 'is', null);

  if (error) {
    throw new Error(`データベースエラー: ${error.message}`);
  }

  if (!data || data.length === 0) {
    throw new Error('動画が見つかりません');
  }

  const randomIndex = Math.floor(Math.random() * data.length);
  return data[randomIndex];
}

// ランキング上位の動画を取得
async function getRankingVideos(limit = 10) {
  const { data, error } = await supabase
    .from('videos')
    .select('*')
    .eq('is_active', true)
    .not('sample_video_url', 'is', null)
    .order('rank_position', { ascending: true, nullsFirst: false })
    .limit(limit);

  if (error) {
    throw new Error(`データベースエラー: ${error.message}`);
  }

  return data || [];
}

// 指定IDの動画を取得
async function getVideoById(id) {
  const { data, error } = await supabase
    .from('videos')
    .select('*')
    .eq('dmm_content_id', id)
    .single();

  if (error) {
    throw new Error(`動画が見つかりません: ${id}`);
  }

  return data;
}

// 紹介文を生成
function generatePromoText(video, templateIndex = null) {
  const index = templateIndex !== null
    ? templateIndex
    : Math.floor(Math.random() * PROMO_TEMPLATES.length);

  return PROMO_TEMPLATES[index](video);
}

// 動画をダウンロード
async function downloadVideo(url, filename) {
  return new Promise((resolve, reject) => {
    const downloadDir = path.join(__dirname, 'downloads');
    if (!fs.existsSync(downloadDir)) {
      fs.mkdirSync(downloadDir, { recursive: true });
    }

    const filePath = path.join(downloadDir, filename);
    const file = fs.createWriteStream(filePath);

    const protocol = url.startsWith('https') ? https : http;

    console.log(`ダウンロード中: ${url}`);

    const request = protocol.get(url, (response) => {
      // リダイレクト対応
      if (response.statusCode === 301 || response.statusCode === 302) {
        const redirectUrl = response.headers.location;
        console.log(`リダイレクト: ${redirectUrl}`);
        file.close();
        fs.unlinkSync(filePath);
        return downloadVideo(redirectUrl, filename).then(resolve).catch(reject);
      }

      if (response.statusCode !== 200) {
        reject(new Error(`ダウンロード失敗: HTTP ${response.statusCode}`));
        return;
      }

      const totalSize = parseInt(response.headers['content-length'], 10);
      let downloadedSize = 0;

      response.on('data', (chunk) => {
        downloadedSize += chunk.length;
        if (totalSize) {
          const percent = Math.round((downloadedSize / totalSize) * 100);
          process.stdout.write(`\r進捗: ${percent}% (${(downloadedSize / 1024 / 1024).toFixed(2)}MB)`);
        }
      });

      response.pipe(file);

      file.on('finish', () => {
        file.close();
        console.log(`\n保存完了: ${filePath}`);
        resolve(filePath);
      });
    });

    request.on('error', (err) => {
      fs.unlink(filePath, () => {});
      reject(err);
    });
  });
}

// クリップボードにコピー（Windows対応）
function copyToClipboard(text) {
  return new Promise((resolve, reject) => {
    // Windowsの場合
    if (process.platform === 'win32') {
      const proc = exec('clip', (err) => {
        if (err) reject(err);
        else resolve();
      });
      proc.stdin.write(text);
      proc.stdin.end();
    }
    // macOSの場合
    else if (process.platform === 'darwin') {
      const proc = exec('pbcopy', (err) => {
        if (err) reject(err);
        else resolve();
      });
      proc.stdin.write(text);
      proc.stdin.end();
    }
    // Linuxの場合
    else {
      const proc = exec('xclip -selection clipboard', (err) => {
        if (err) reject(err);
        else resolve();
      });
      proc.stdin.write(text);
      proc.stdin.end();
    }
  });
}

// メイン処理
async function main() {
  const args = process.argv.slice(2);

  let video;
  let shouldDownload = args.includes('--download') || args.includes('-d');

  try {
    // 動画を取得
    if (args.includes('--id') || args.includes('-i')) {
      const idIndex = args.indexOf('--id') !== -1 ? args.indexOf('--id') : args.indexOf('-i');
      const id = args[idIndex + 1];
      if (!id) {
        console.error('エラー: --id オプションにはIDを指定してください');
        process.exit(1);
      }
      video = await getVideoById(id);
    } else if (args.includes('--ranking') || args.includes('-r')) {
      const videos = await getRankingVideos(10);
      if (videos.length === 0) {
        console.error('ランキング動画が見つかりません');
        process.exit(1);
      }
      // ランキングから1つ選択
      const index = Math.floor(Math.random() * Math.min(5, videos.length));
      video = videos[index];
    } else {
      // デフォルト: ランダム
      video = await getRandomVideo();
    }

    console.log('\n========================================');
    console.log('【選択された動画】');
    console.log('========================================');
    console.log(`タイトル: ${video.title}`);
    console.log(`ID: ${video.dmm_content_id}`);
    console.log(`メーカー: ${video.maker || '不明'}`);
    console.log(`価格: ${video.price ? video.price.toLocaleString() + '円' : '不明'}`);
    console.log(`ランク: ${video.rank_position || '-'}`);

    console.log('\n========================================');
    console.log('【サンプル動画URL】');
    console.log('========================================');
    console.log(video.sample_video_url || 'サンプル動画なし');

    // 紹介文を生成
    const promoText = generatePromoText(video);

    console.log('\n========================================');
    console.log('【X投稿用テキスト】');
    console.log('========================================');
    console.log(promoText);
    console.log('========================================');

    // クリップボードにコピー
    try {
      await copyToClipboard(promoText);
      console.log('\n✅ テキストをクリップボードにコピーしました！');
    } catch (err) {
      console.log('\n⚠️ クリップボードへのコピーに失敗しました');
    }

    // 動画ダウンロード
    if (shouldDownload && video.sample_video_url) {
      console.log('\n========================================');
      console.log('【サンプル動画ダウンロード】');
      console.log('========================================');

      const filename = `${video.dmm_content_id}.mp4`;
      try {
        const filePath = await downloadVideo(video.sample_video_url, filename);
        console.log(`\n✅ ダウンロード完了: ${filePath}`);
      } catch (err) {
        console.error(`\n❌ ダウンロードエラー: ${err.message}`);
      }
    } else if (shouldDownload && !video.sample_video_url) {
      console.log('\n⚠️ この動画にはサンプル動画がありません');
    }

    console.log('\n========================================');
    console.log('【次のステップ】');
    console.log('========================================');
    console.log('1. Xを開く');
    console.log('2. 新規投稿を作成');
    console.log('3. テキストを貼り付け (Ctrl+V)');
    if (video.sample_video_url) {
      if (shouldDownload) {
        console.log('4. ダウンロードした動画を添付');
      } else {
        console.log('4. サンプル動画をダウンロードして添付');
        console.log(`   → ${video.sample_video_url}`);
        console.log('   または --download オプションで自動ダウンロード');
      }
    }
    console.log('5. 投稿！');

  } catch (error) {
    console.error(`エラー: ${error.message}`);
    process.exit(1);
  }
}

// ヘルプ表示
if (process.argv.includes('--help') || process.argv.includes('-h')) {
  console.log(`
X投稿支援ツール - short-av.com

使い方:
  node tools/x-promo/index.js [オプション]

オプション:
  --random, -r     ランダムな動画を選択（デフォルト）
  --ranking        ランキング上位から選択
  --id, -i <id>    指定したIDの動画を選択
  --download, -d   サンプル動画をダウンロード
  --help, -h       このヘルプを表示

例:
  node tools/x-promo/index.js
  node tools/x-promo/index.js --ranking --download
  node tools/x-promo/index.js --id abc123 --download
`);
  process.exit(0);
}

main();
