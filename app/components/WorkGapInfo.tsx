'use client';

import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { productCode } from '@/lib/product-code';

/**
 * スマホの縦画面で、バナーと作品の操作の行の間にあく余白に、作品名・サンプルの長さ・品番・ジャンルを出す（2026-10-31 ユーザーの希望）。
 * 余白の高さは画面の縦の長さで変わるので、入る分だけ出す（狭ければ作品名1行、広ければ2行＋サンプルの長さ・品番・ジャンル。とても狭ければ出さない）
 */
type Props = {
  title: string;
  contentId: string;
  sampleSeconds: number | null | undefined;
  genreIds: string[] | null | undefined;
};

// ジャンルの名前（同じジャンルを何度も問い合わせない）
const genreNames = new Map<string, string>();

const len = (s: number | null | undefined) => (s && s > 0 ? `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}` : null);

export default function WorkGapInfo({ title, contentId, sampleSeconds, genreIds }: Props) {
  const boxRef = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState(0);
  const [genres, setGenres] = useState<string[]>([]);

  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setHeight(el.clientHeight));
    ro.observe(el);
    setHeight(el.clientHeight);
    return () => ro.disconnect();
  }, []);

  const key = (genreIds ?? []).join(',');
  useEffect(() => {
    const ids = key ? key.split(',') : [];
    const show = () => setGenres(ids.map((id) => genreNames.get(id)).filter((n): n is string => !!n && n !== 'ハイビジョン').slice(0, 4));
    const missing = ids.filter((id) => !genreNames.has(id));
    if (missing.length === 0) return show();
    let alive = true;
    supabase
      .from('genres')
      .select('id, name')
      .in('id', missing)
      .then(({ data }) => {
        for (const g of (data ?? []) as { id: string; name: string }[]) genreNames.set(g.id, g.name);
        if (alive) show();
      });
    return () => {
      alive = false;
    };
  }, [key]);

  // 入る分だけ: 26px 未満は出さない、48px 未満は作品名1行、66px 未満は2行、それ以上は2行＋長さ・品番・ジャンル
  const lines = height < 26 ? 0 : height < 48 ? 1 : 2;
  const withTags = height >= 66;
  const code = productCode(contentId);
  const length = len(sampleSeconds);

  return (
    <div ref={boxRef} className="min-h-0 flex-1 overflow-hidden">
      {lines > 0 && (
        <div className="flex h-full flex-col justify-center gap-1.5 pb-2">
          <p className={`text-[13px] font-bold leading-snug text-gray-100 ${lines === 1 ? 'line-clamp-1' : 'line-clamp-2'}`}>{title}</p>
          {withTags && (
            <div className="flex gap-1.5 overflow-hidden whitespace-nowrap text-[11px]">
              {length && <span className="text-amber-300">▶ {length}</span>}
              {code && <span className="text-gray-400">{code}</span>}
              {genres.map((g) => (
                <span key={g} className="rounded-full bg-gray-800 px-2 text-gray-300">
                  {g}
                </span>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
