import { unstable_cache } from 'next/cache';
import { supabase } from '@/lib/supabase';

/**
 * 作品ページ（/?v=作品番号）のサイトマップ。ランキング上位と新着を合わせて最大 2,000 件（1時間使い回す）
 * 全作品（毎日約900本増える）を入れると薄いページが何千も登録されてサイト全体の評価を下げかねないので、まずは人気・新着に絞る
 */
export const dynamic = 'force-dynamic';

const LIMIT_RANKED = 500;
const LIMIT_RECENT = 1500;

const getUrls = unstable_cache(
  async () => {
    const [ranked, recent] = await Promise.all([
      supabase.from('videos').select('dmm_content_id, updated_at').eq('is_active', true).not('rank_position', 'is', null).order('rank_position', { ascending: true }).limit(LIMIT_RANKED),
      supabase.from('videos').select('dmm_content_id, updated_at').eq('is_active', true).order('created_at', { ascending: false }).limit(LIMIT_RECENT),
    ]);
    const seen = new Set<string>();
    const rows: { id: string; updated: string }[] = [];
    for (const r of [...(ranked.data ?? []), ...(recent.data ?? [])]) {
      if (seen.has(r.dmm_content_id)) continue;
      seen.add(r.dmm_content_id);
      rows.push({ id: r.dmm_content_id, updated: r.updated_at });
    }
    return rows;
  },
  ['sitemap-videos-v1'],
  { revalidate: 3600 },
);

const escapeXml = (text: string) => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export async function GET() {
  const rows = await getUrls().catch(() => []);
  const body = rows
    .map((r) => `<url><loc>https://short-av.com/?v=${escapeXml(encodeURIComponent(r.id))}</loc><lastmod>${new Date(r.updated).toISOString()}</lastmod><changefreq>weekly</changefreq><priority>0.5</priority></url>`)
    .join('');
  const xml = `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${body}</urlset>`;
  return new Response(xml, { headers: { 'Content-Type': 'application/xml; charset=utf-8', 'Cache-Control': 'public, max-age=3600' } });
}
