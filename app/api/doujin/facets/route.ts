import { NextResponse } from 'next/server';
import { doujinFacets } from '@/lib/doujin';

// 同人誌の検索の選択肢（ジャンル・サークル。人気上位500冊でよく使われている順）
export async function GET() {
  try {
    return NextResponse.json(await doujinFacets());
  } catch (error) {
    console.error('[doujin facets]', error);
    return NextResponse.json({ error: '選択肢を取得できませんでした' }, { status: 500 });
  }
}
