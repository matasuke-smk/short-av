import { supabase } from '@/lib/supabase';

/** 女優のプロフィール（DMM の女優検索から取り込んだもの。sql/028）。作品詳細の出演欄・女優の詳細で使う（2026-10-31） */
export type ActressProfile = {
  id: string;
  kana: string | null;
  birth_date: string | null;
  height: number | null;
  bust: number | null;
  waist: number | null;
  hip: number | null;
};

/** 誕生日（YYYY-MM-DD）から今の年齢 */
export function ageOf(birth: string): number {
  const b = new Date(`${birth}T00:00:00+09:00`);
  const n = new Date();
  let age = n.getFullYear() - b.getFullYear();
  if (n.getMonth() < b.getMonth() || (n.getMonth() === b.getMonth() && n.getDate() < b.getDate())) age--;
  return age;
}

/**
 * 出演欄に出す1行（年齢・身長・サイズのうち分かるもの）。何も分からなければ null。
 * short: 2列のときは年齢・身長だけ（幅が狭いため）
 */
export function profileLine(p: ActressProfile | undefined, short = false): string | null {
  if (!p) return null;
  const parts = [
    p.birth_date ? `${ageOf(p.birth_date)}歳` : null,
    p.height ? `${p.height}cm` : null,
    !short && p.bust ? `B${p.bust} W${p.waist ?? '-'} H${p.hip ?? '-'}` : null,
  ].filter(Boolean);
  return parts.length > 0 ? parts.join('・') : null;
}

// 同じ女優を何度も問い合わせない
const profiles = new Map<string, ActressProfile>();
const counts = new Map<string, number>();

/** 女優のプロフィールと、Short AV に入っている出演作の数（配信中）をまとめて取る */
export async function fetchActressProfiles(ids: string[]): Promise<{ profiles: Map<string, ActressProfile>; counts: Map<string, number> }> {
  const missing = ids.filter((id) => !profiles.has(id));
  if (missing.length > 0) {
    const { data } = await supabase.from('actresses').select('id, kana, birth_date, height, bust, waist, hip').in('id', missing);
    for (const p of (data ?? []) as ActressProfile[]) profiles.set(p.id, p);
  }
  await Promise.all(
    ids
      .filter((id) => !counts.has(id))
      .map(async (id) => {
        const { count } = await supabase.from('videos').select('id', { count: 'exact', head: true }).eq('is_active', true).contains('actress_ids', [id]);
        counts.set(id, count ?? 0);
      }),
  );
  return { profiles, counts };
}
