'use client';

import { useEffect, useMemo, useState } from 'react';
import useEmblaCarousel from 'embla-carousel-react';
import DoujinReader from '@/app/components/DoujinReader';
import type { Doujin } from '@/lib/doujin';

// 動画を何本見たら同人誌を1冊挟むか
const DOUJIN_EVERY = 5;

type TestVideo = { dmm_content_id: string; title: string; thumbnail_url: string | null };
type Item = { kind: 'video'; video: TestVideo; n: number } | { kind: 'doujin'; doujin: Doujin };

/**
 * 管理画面の「同人テスト」: 動画5本ごとに人気の同人誌を挟んだ縦スワイプを、サイトに組み込む前に試す画面
 * （動画は再生せず、サムネイルと作品名だけの簡易表示）
 */
export default function DoujinTestView() {
  const [videos, setVideos] = useState<TestVideo[] | null>(null);
  const [doujin, setDoujin] = useState<Doujin[] | null>(null);
  const [error, setError] = useState('');
  const [open, setOpen] = useState(false);

  useEffect(() => {
    fetch('/api/videos?limit=40')
      .then((r) => r.json())
      .then((d) => setVideos((d.pool ?? d.videos ?? []) as TestVideo[]))
      .catch(() => setError('動画を読み込めませんでした'));
    fetch('/api/admin/doujin-test')
      .then((r) => r.json())
      .then((d) => (d.error ? setError(`同人誌を読み込めませんでした: ${d.error}`) : setDoujin(d.doujin)))
      .catch(() => setError('同人誌を読み込めませんでした'));
  }, []);

  const items = useMemo<Item[]>(() => {
    if (!videos || !doujin) return [];
    const list: Item[] = [];
    let d = 0;
    videos.forEach((video, i) => {
      list.push({ kind: 'video', video, n: i + 1 });
      if ((i + 1) % DOUJIN_EVERY === 0 && d < doujin.length) list.push({ kind: 'doujin', doujin: doujin[d++] });
    });
    return list;
  }, [videos, doujin]);

  return (
    <main className="min-h-screen bg-gray-900 text-white p-3 md:p-6">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-xl font-bold">同人テスト</h1>
        <p className="text-sm text-gray-400 mt-2">
          動画{DOUJIN_EVERY}本ごとに、FANZA 同人の人気作品を1冊挟みます。同人誌は左右スワイプでサンプルを読み、最後のページの次に価格と FANZA へのボタンが出ます。
          サイトにはまだ組み込んでいません（この画面だけで試せます）。動画は再生せず、サムネイルと作品名だけの簡易表示です。
        </p>
        {error && <p className="mt-3 text-sm text-red-400">{error}</p>}
        <p className="mt-3 text-sm text-gray-300">
          {doujin ? `人気の同人誌 ${doujin.length}冊（サンプルあり）` : '同人誌を読み込み中...'}
          {videos ? ` ・ 動画 ${videos.length}本` : ''}
        </p>
        <button
          type="button"
          disabled={items.length === 0}
          onClick={() => setOpen(true)}
          className="mt-4 w-full rounded-xl bg-blue-600 py-3.5 font-bold disabled:opacity-40"
        >
          テスト画面を開く
        </button>
      </div>
      {open && <TestFeed items={items} onClose={() => setOpen(false)} />}
    </main>
  );
}

// 縦スワイプの簡易フィード（全画面）
function TestFeed({ items, onClose }: { items: Item[]; onClose: () => void }) {
  const [emblaRef, emblaApi] = useEmblaCarousel({ axis: 'y', loop: false });
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (!emblaApi) return;
    const onSelect = () => setIndex(emblaApi.selectedScrollSnap());
    emblaApi.on('select', onSelect);
    return () => {
      emblaApi.off('select', onSelect);
    };
  }, [emblaApi]);

  // 開いている間は後ろの管理画面をスクロールさせない
  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);

  return (
    <div data-no-pull-refresh className="fixed inset-0 z-[100] flex flex-col bg-black overscroll-none select-none">
      <div className="flex items-center gap-2 bg-gray-950 px-2 pb-1 pt-[max(env(safe-area-inset-top),0.25rem)] border-b border-gray-800">
        <button type="button" onClick={onClose} className="rounded-lg bg-gray-800 px-3 py-1.5 text-sm text-white">
          × 閉じる
        </button>
        <span className="ml-auto text-xs text-gray-400">
          {index + 1} / {items.length}（上下にスワイプ）
        </span>
      </div>
      <div ref={emblaRef} className="flex-1 overflow-hidden">
        <div className="flex h-full flex-col">
          {items.map((item, i) => (
            <div key={item.kind === 'video' ? `v-${item.video.dmm_content_id}` : `d-${item.doujin.contentId}`} className="relative min-h-0 flex-[0_0_100%]">
              {Math.abs(i - index) > 2 ? null : item.kind === 'doujin' ? (
                <DoujinReader doujin={item.doujin} />
              ) : (
                <div className="flex h-full flex-col items-center justify-center gap-3 p-4">
                  {item.video.thumbnail_url && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={item.video.thumbnail_url} alt="" className="max-h-[55vh] max-w-full rounded-lg object-contain" draggable={false} />
                  )}
                  <p className="text-xs text-gray-400">動画 {item.n}本目（テスト用の簡易表示）</p>
                  <p className="max-w-md text-center text-sm font-bold line-clamp-2">{item.video.title}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
