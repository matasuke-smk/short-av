import { NextResponse } from 'next/server';
import { fetchDoujin } from '@/lib/doujin';

// 同人誌の新着（同人誌の画面の「新着」ボタン。動画の「4分以上」の位置。2026-10-31）: 新しく出た順に40冊
export async function GET() {
  try {
    return NextResponse.json({ doujin: await fetchDoujin('date', 40) }, { headers: { 'Cache-Control': 'public, max-age=600' } });
  } catch (error) {
    console.error('[doujin new]', error);
    return NextResponse.json({ error: '新着を取得できませんでした' }, { status: 500 });
  }
}
