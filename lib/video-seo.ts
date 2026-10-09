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

export async function getVideoNames(video: { actress_ids: string[] | null; genre_ids: string[] | null }): Promise<{ actresses: string[]; genres: string[] }> {
  const [actresses, genres] = await Promise.all([
    video.actress_ids && video.actress_ids.length > 0
      ? supabase.from('actresses').select('id, name').in('id', video.actress_ids.slice(0, 5)).then(({ data }) => (data ?? []).map((r) => r.name as string))
      : Promise.resolve([] as string[]),
    video.genre_ids && video.genre_ids.length > 0
      ? supabase.from('genres').select('id, name').in('id', video.genre_ids.slice(0, 8)).then(({ data }) => (data ?? []).map((r) => r.name as string))
      : Promise.resolve([] as string[]),
  ]);
  return { actresses, genres };
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
  const head = `${video.title}のサンプル動画${length ? `（${length}）` : ''}を無料で視聴。`;
  const tail = '縦スワイプで次の作品へ。会員登録不要の Short AV。';
  const body = parts.length > 0 ? `${parts.join('。')}。` : '';
  const text = `${head}${body}${tail}`;
  return text.length > 160 ? `${text.slice(0, 157)}…` : text;
}
