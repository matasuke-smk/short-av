'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

/** 作品の操作の行・作品詳細に出す女優（名前と顔写真）。同じ女優を何度も問い合わせないように覚えておく（2026-10-31） */
export type ActressInfo = { id: string; name: string; slug: string; image: string | null };

const cache = new Map<string, ActressInfo>();
// 女優ごとの作品の数（配信中）。女優が複数の作品で、顔を出す人（先頭）を決めるのに使う
const works = new Map<string, number>();

/**
 * 女優が複数のときは、Short AV に入っている作品の数が多い女優を先にする（よく出ている＝人気の目安。2026-10-31 ユーザーの希望）。
 * 数が同じときは FANZA の並び（actress_ids の順＝作品ページで先に書かれている女優）のまま
 */
async function sortByWorks(list: ActressInfo[]): Promise<ActressInfo[]> {
  if (list.length < 2) return list;
  await Promise.all(
    list
      .filter((a) => !works.has(a.id))
      .map(async (a) => {
        const { count } = await supabase.from('videos').select('id', { count: 'exact', head: true }).eq('is_active', true).contains('actress_ids', [a.id]);
        works.set(a.id, count ?? 0);
      }),
  );
  return list
    .map((a, i) => ({ a, i, n: works.get(a.id) ?? 0 }))
    .sort((x, y) => y.n - x.n || x.i - y.i)
    .map((x) => x.a);
}

/** 女優の作品の数（女優が複数の作品で並べたときに数えた分だけ。まだなら null） */
export const worksOf = (id: string): number | null => works.get(id) ?? null;

/** 次に見る作品の女優を先に読み込んでおく（顔の表示が遅れないように。2026-10-31）。顔写真も読み込んでおく */
export async function prefetchActresses(ids: string[]): Promise<void> {
  const missing = [...new Set(ids)].filter((id) => !cache.has(id));
  if (missing.length) {
    const { data } = await supabase.from('actresses').select('id, name, slug, profile_image_url').in('id', missing);
    for (const a of (data ?? []) as { id: string; name: string; slug: string; profile_image_url: string | null }[]) {
      cache.set(a.id, { id: a.id, name: a.name, slug: a.slug, image: a.profile_image_url || null });
    }
  }
  for (const id of ids) {
    const img = cache.get(id)?.image;
    if (img && typeof window !== 'undefined') new window.Image().src = img;
  }
}

export function useActresses(ids: string[] | null | undefined): ActressInfo[] | null {
  const key = (ids ?? []).join(',');
  const [list, setList] = useState<ActressInfo[] | null>(() => (ids?.length ? null : []));
  useEffect(() => {
    const want = key ? key.split(',') : [];
    if (want.length === 0) return setList([]);
    let alive = true;
    const finish = async () => {
      const found = want.map((id) => cache.get(id)).filter((a): a is ActressInfo => !!a);
      const sorted = await sortByWorks(found);
      if (alive) setList(sorted);
    };
    const missing = want.filter((id) => !cache.has(id));
    // 1人だけで覚えている女優なら、すぐ出す（読み込み中の表示を挟まない）
    if (missing.length === 0 && want.length === 1) {
      setList([cache.get(want[0])!]);
      return;
    }
    setList(null);
    if (missing.length === 0) {
      finish();
    } else {
      supabase
        .from('actresses')
        .select('id, name, slug, profile_image_url')
        .in('id', missing)
        .then(({ data }) => {
          for (const a of (data ?? []) as { id: string; name: string; slug: string; profile_image_url: string | null }[]) {
            cache.set(a.id, { id: a.id, name: a.name, slug: a.slug, image: a.profile_image_url || null });
          }
          finish();
        });
    }
    return () => {
      alive = false;
    };
  }, [key]);
  return list;
}
