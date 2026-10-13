import CatalogIndexList from './CatalogIndexList';
import type { CatalogEntry, CatalogKind } from '@/lib/catalog';
import { Shell } from './DoujinPages';

/**
 * 女優・ジャンルの一覧ページ（/actress・/genre）。作品の多い順に並べ、それぞれのページへリンクする。
 * 女優・ジャンルのページを、サイトマップだけでなくサイトの中からもたどれるようにする
 */
export default function CatalogIndexPage({ kind, entries }: { kind: CatalogKind; entries: CatalogEntry[] }) {
  const isActress = kind === 'actress';
  return (
    <Shell back={{ href: '/', label: 'ホームへ' }}>
      <h1 className="text-xl sm:text-2xl font-bold">
        {isActress ? '女優から探す' : 'ジャンルから探す'}
        <span className="ml-2 text-base font-normal text-gray-400">（{entries.length.toLocaleString('ja-JP')}{isActress ? '人' : '種類'}）</span>
      </h1>
      <p className="mt-2 text-sm text-gray-300 leading-relaxed">
        {isActress
          ? '女優ごとに、出演作のサンプル動画を縦スワイプで次々と無料で見られます（会員登録不要）。作品の多い順に並べています。'
          : 'ジャンルごとに、人気作のサンプル動画を縦スワイプで次々と無料で見られます（会員登録不要）。作品の多い順に並べています。'}
      </p>
      <CatalogIndexList kind={kind} entries={entries} />
    </Shell>
  );
}
