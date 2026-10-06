import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * FANZA のサンプル動画プレイヤーまわり（サーバー専用）
 * - プレイヤー本体の URL を取り出す（/api/sample-player で画面に合わせた大きさで開くため）
 * - サンプル動画の長さ（秒）を調べる（検索の「サンプル動画が長い作品のみ」用。FANZA の API には長さがない）
 */

const UA = { 'User-Agent': 'Mozilla/5.0' };

export const litevideoUrl = (cid: string) => `https://www.dmm.co.jp/litevideo/-/part/=/cid=${cid}/size=560_360/`;

/** litevideo ページの中にあるプレイヤー本体の URL（取り出せなければ null） */
export async function findPlayerUrl(cid: string, init?: RequestInit): Promise<string | null> {
  const response = await fetch(litevideoUrl(cid), { headers: UA, ...init });
  if (!response.ok) return null;
  const html = await response.text();
  return html.match(/https:\/\/www\.dmm\.co\.jp\/service\/digitalapi\/-\/html5_player\/=\/[^"']+/)?.[0] ?? null;
}

async function readRange(url: string, start: number, end: number): Promise<Buffer> {
  const response = await fetch(url, { headers: { ...UA, Range: `bytes=${start}-${end}` }, cache: 'no-store' });
  if (!response.ok) throw new Error(`range ${response.status}`);
  return Buffer.from(await response.arrayBuffer());
}

// mvhd ボックス（先頭位置 i）から長さ（秒）を読む
function mvhdSeconds(buf: Buffer, i: number): number | null {
  if (i < 0 || i + 40 > buf.length) return null;
  const version = buf[i + 8];
  const timescale = version === 0 ? buf.readUInt32BE(i + 20) : buf.readUInt32BE(i + 28);
  const duration = version === 0 ? buf.readUInt32BE(i + 24) : Number(buf.readBigUInt64BE(i + 32));
  return timescale > 0 ? duration / timescale : null;
}

/**
 * サンプル動画の長さ（秒）。動画ファイルの先頭 64KB と、長さの情報（moov）がある位置の数KBだけを読む。
 * moov はファイルの先頭にある場合と、動画本体（mdat）の後ろにある場合がある（後者は箱の大きさから位置を計算する）。
 * 調べられなかったときは null。
 */
export async function getSampleSeconds(cid: string): Promise<number | null> {
  const playerUrl = await findPlayerUrl(cid, { cache: 'no-store' });
  if (!playerUrl) return null;
  const playerHtml = await (await fetch(playerUrl, { headers: UA, cache: 'no-store' })).text();
  const src = playerHtml.match(/"src":"([^"]+\.mp4)"/)?.[1];
  if (!src) return null;
  const videoUrl = `https:${JSON.parse(`"${src}"`)}`;

  let buf = await readRange(videoUrl, 0, 65535);
  let base = 0; // buf の先頭がファイルの何バイト目か
  let offset = 0; // 次の箱の位置（ファイル内）
  for (let guard = 0; guard < 20; guard++) {
    // 次の箱が手元にない場合は、その位置から読み直す
    if (offset + 16 > base + buf.length) {
      buf = await readRange(videoUrl, offset, offset + 8191);
      base = offset;
    }
    const pos = offset - base;
    let size = buf.readUInt32BE(pos);
    const type = buf.toString('latin1', pos + 4, pos + 8);
    if (size === 1) size = Number(buf.readBigUInt64BE(pos + 8));
    if (type === 'moov') {
      const seconds = mvhdSeconds(buf, buf.indexOf('mvhd', pos) - 4);
      // 明らかにおかしい値（0 秒や 1 時間超）は採用しない
      return seconds && seconds > 0 && seconds < 3600 ? Math.round(seconds) : null;
    }
    if (size < 8) return null;
    offset += size;
  }
  return null;
}

/**
 * まだ長さを調べていない作品のサンプル動画の長さを、締め切り時刻まで調べて videos.sample_seconds に記録する。
 * 新しい作品から順に。調べられなかった作品は -1 にして、次回以降に同じ作品で止まらないようにする。
 * 毎日の自動更新（cron）と、管理画面の「今すぐ調べる」ボタンから使う。戻り値は記録した件数。
 */
export async function measureSampleLengths(supabase: SupabaseClient, deadline: number, concurrency = 8): Promise<number> {
  const { data, error } = await supabase
    .from('videos')
    .select('id, dmm_content_id, sample_video_url')
    .is('sample_seconds', null)
    .not('sample_video_url', 'is', null)
    .order('created_at', { ascending: false })
    .limit(600);
  if (error) {
    console.error('[sample-length] 対象の取得エラー:', error);
    return 0;
  }

  const queue = [...(data ?? [])];
  let measured = 0;
  const failedIds: string[] = [];
  const worker = async () => {
    while (queue.length > 0 && Date.now() < deadline) {
      const video = queue.shift()!;
      const cid = (video.sample_video_url as string).match(/\/cid=([0-9a-z_]+)\//)?.[1] ?? (video.dmm_content_id as string);
      const seconds = await getSampleSeconds(cid).catch(() => null);
      if (seconds === null) {
        failedIds.push(video.id as string);
        continue;
      }
      const { error: updateError } = await supabase.from('videos').update({ sample_seconds: seconds }).eq('id', video.id);
      if (!updateError) measured++;
    }
  };
  await Promise.all(Array.from({ length: concurrency }, worker));

  // 調べられなかった作品は -1 にする。ただし1件も調べられなかったときは、FANZA 側の制限など仕組みの問題の
  // 可能性が高いので記録しない（以前、海外のサーバーから実行して全件が -1 になったことがある）
  if (measured > 0 && failedIds.length > 0) {
    for (let i = 0; i < failedIds.length; i += 200) {
      await supabase.from('videos').update({ sample_seconds: -1 }).in('id', failedIds.slice(i, i + 200));
    }
  } else if (measured === 0 && failedIds.length > 0) {
    console.error(`[sample-length] ${failedIds.length}件すべて調べられませんでした（記録はしません）`);
  }
  return measured;
}
