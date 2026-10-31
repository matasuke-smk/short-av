import { unstable_cache } from 'next/cache';
import { featureLabel } from '@/lib/feature-length';
import { productCode } from '@/lib/product-code';
import { supabase } from '@/lib/supabase';

/**
 * 作品ページ（/?v=作品番号）の検索エンジン向けの情報。女優名・ジャンル名を引いて、説明文と構造化データに使う
 */
export type VideoSeoRow = {
  dmm_content_id: string;
  title: string;
  description: string | null;
  thumbnail_url: string;
  maker: string | null;
  release_date: string | null;
  sample_seconds: number | null;
  actress_ids: string[] | null;
  genre_ids: string[] | null;
};

// 女優名・ジャンル名はほとんど変わらないので、同じ組み合わせは1日使い回す
// （トップページを開くたびに最初の作品の名前を Supabase に問い合わせていた。呼び出し1回ごとに Supabase のログが増える）
const getNamesCached = unstable_cache(
  async (actressIds: string[], genreIds: string[]): Promise<{ actresses: string[]; genres: string[] }> => {
    const [actresses, genres] = await Promise.all([
      actressIds.length > 0
        ? supabase.from('actresses').select('id, name').in('id', actressIds).then(({ data }) => (data ?? []).map((r) => r.name as string))
        : Promise.resolve([] as string[]),
      genreIds.length > 0
        ? supabase.from('genres').select('id, name').in('id', genreIds).then(({ data }) => (data ?? []).map((r) => r.name as string))
        : Promise.resolve([] as string[]),
    ]);
    return { actresses, genres };
  },
  ['video-names-v1'],
  { revalidate: 86400 },
);

export async function getVideoNames(video: { actress_ids: string[] | null; genre_ids: string[] | null }): Promise<{ actresses: string[]; genres: string[] }> {
  return getNamesCached((video.actress_ids ?? []).slice(0, 5), (video.genre_ids ?? []).slice(0, 8));
}

const sampleLength = (seconds: number | null) => (seconds && seconds > 0 ? `${Math.floor(seconds / 60)}分${seconds % 60}秒` : null);
const jpDate = (date: string | null) => (date ? date.slice(0, 10).replace(/-/g, '/') : null);

/** 検索結果に出る説明文（作品名・出演・ジャンル・メーカー・発売日・サンプルの長さ。約160文字まで） */
export function buildVideoDescription(video: VideoSeoRow, names: { actresses: string[]; genres: string[] }): string {
  const parts = [
    names.actresses.length > 0 ? `出演: ${names.actresses.join('・')}` : null,
    names.genres.length > 0 ? `ジャンル: ${names.genres.slice(0, 4).join('・')}` : null,
    video.maker ? `メーカー: ${video.maker}` : null,
    jpDate(video.release_date) ? `${jpDate(video.release_date)}発売` : null,
  ].filter((p): p is string => p !== null);
  const length = sampleLength(video.sample_seconds);
  // 品番（STARS-840 など）でも検索に当たるよう先頭に入れる（2026-10-31 ユーザーの希望）
  const code = productCode(video.dmm_content_id);
  // 本編の長さも括弧の中に入れる（「サンプル動画（2分0秒・本編150分）」。検索結果で長さが分かるように。2026-10-31 ユーザーの希望）
  const feature = featureLabel(video.description);
  const lengths = [length, feature ? `本編${feature}` : null].filter(Boolean).join('・');
  const head = `${code ? `【${code}】` : ''}${video.title}のサンプル動画${lengths ? `（${lengths}）` : ''}を無料で視聴。`;
  const tail = '縦スワイプで次の作品へ。会員登録不要の Short AV。';
  const body = parts.length > 0 ? `${parts.join('。')}。` : '';
  const text = `${head}${body}${tail}`;
  return text.length > 160 ? `${text.slice(0, 157)}…` : text;
}
