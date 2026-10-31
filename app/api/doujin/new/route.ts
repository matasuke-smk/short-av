import { NextResponse } from 'next/server';
import { newDoujin } from '@/lib/doujin';

// 同人誌の新着（同人誌の画面の「新着」ボタン。動画の「4分超」の位置）: 発売から30日以内・人気順・サンプル10ページの作品を40冊（2026-11-01）
export async function GET() {
  try {
    return NextResponse.json({ doujin: await newDoujin(40) }, { headers: { 'Cache-Control': 'public, max-age=600' } });
  } catch (error) {
    console.error('[doujin new]', error);
    return NextResponse.json({ error: '新着を取得できませんでした' }, { status: 500 });
  }
}
