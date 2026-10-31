'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

/** 作品の操作の行・作品詳細に出す女優（名前と顔写真）。同じ女優を何度も問い合わせないように覚えておく（2026-10-31） */
export type ActressInfo = { id: string; name: string; slug: string; image: string | null };

const cache = new Map<string, ActressInfo>();

export function useActresses(ids: string[] | null | undefined): ActressInfo[] | null {
  const key = (ids ?? []).join(',');
  const [list, setList] = useState<ActressInfo[] | null>(() => (ids?.length ? (ids.every((id) => cache.has(id)) ? ids.map((id) => cache.get(id)!) : null) : []));
  useEffect(() => {
    const want = key ? key.split(',') : [];
    if (want.length === 0) return setList([]);
    const missing = want.filter((id) => !cache.has(id));
    if (missing.length === 0) return setList(want.map((id) => cache.get(id)!));
    setList(null);
    let alive = true;
    supabase
      .from('actresses')
      .select('id, name, slug, profile_image_url')
      .in('id', missing)
      .then(({ data }) => {
        for (const a of (data ?? []) as { id: string; name: string; slug: string; profile_image_url: string | null }[]) {
          cache.set(a.id, { id: a.id, name: a.name, slug: a.slug, image: a.profile_image_url || null });
        }
        if (alive) setList(want.map((id) => cache.get(id)).filter((a): a is ActressInfo => !!a));
      });
    return () => {
      alive = false;
    };
  }, [key]);
  return list;
}
