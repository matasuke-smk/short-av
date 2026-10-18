/**
 * サイトマップにあるページのうち、変わったものを IndexNow で検索エンジン（Bing など）に知らせる（vercel.json で毎日 10:00 JST に実行）
 * 動画データの更新（9:00）とサンプルの長さの記録（9:30）のあとに動かす。
 * IndexNow は「変わったページだけ」送る決まりなので、毎日全件（約1,900件）は送らない（2026-10-18）:
 * - 毎日: トップ・記事一覧・ランキングと、この2日以内に更新された記事・作品ページ
 * - 月曜だけ: 女優・ジャンル・同人誌のページ（中身は毎日少しずつ変わるが、更新日を持っていないため週1回にまとめる）
 */

import { NextResponse } from 'next/server';
import sitemap from '@/app/sitemap';
import { notifyIndexNow } from '@/lib/indexnow';

export const dynamic = 'force-dynamic';

function verifyCronRequest(request: Request): boolean {
  if (process.env.CRON_SECRET) {
    return request.headers.get('authorization') === `Bearer ${process.env.CRON_SECRET}`;
  }
  return process.env.NODE_ENV === 'development';
}

export async function GET(request: Request) {
  if (!verifyCronRequest(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    // sitemap.xml にはランキング上位 500 件の作品ページも入っている（2026-10-11〜）。重複を除いて知らせる
    const entries = await sitemap();
    const base = 'https://short-av.com';
    const daily = new Set([base, `${base}/articles`, `${base}/ranking`]);
    const isCatalog = (url: string) => /^https:\/\/short-av\.com\/(actress|genre|doujin|circle)(\/|$)/.test(url);
    // cron は 01:00 UTC（10:00 JST）なので、UTC の曜日がそのまま日本の曜日
    const isMonday = new Date().getUTCDay() === 1;
    const since = Date.now() - 2 * 24 * 60 * 60 * 1000;
    const urls = [
      ...new Set(
        entries
          .filter((e) => {
            if (daily.has(e.url)) return true;
            if (isCatalog(e.url)) return isMonday;
            return e.lastModified !== undefined && new Date(e.lastModified).getTime() >= since;
          })
          .map((e) => e.url),
      ),
    ];
    const result = await notifyIndexNow(urls);
    console.info(`[Cron] IndexNow ${result.submitted}件を送信 (HTTP ${result.status})`);
    return NextResponse.json({ success: result.status >= 200 && result.status < 300, ...result });
  } catch (error) {
    console.error('[Cron] IndexNow の送信に失敗:', error);
    return NextResponse.json({ error: 'IndexNow の送信に失敗しました' }, { status: 500 });
  }
}
