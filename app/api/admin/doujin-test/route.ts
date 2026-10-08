import { NextResponse } from 'next/server';
import { fetchPopularDoujin } from '@/lib/doujin';

/**
 * 管理画面の「同人テスト」用: 人気の同人作品（サンプル画像つき）を DMM の API から直接取る
 * （サイトに組み込むときは、動画と同じく毎日データベースに貯めてから使う予定）
 */
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    return NextResponse.json({ doujin: await fetchPopularDoujin(30) });
  } catch (error) {
    console.error('[doujin-test]', error);
    return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}
