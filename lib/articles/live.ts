import { unstable_cache } from 'next/cache';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { runReports } from '@/lib/ga-data';
import { getSizeStatisticsRows, LENGTH_RANGE_MM, summarizeForAdmin, summarizeSizeStatistics } from '@/lib/sizeStats';

/**
 * 記事に最新のデータを差し込む（サーバー専用）
 * 記事の本文に `<!-- live:名前 -->` の1行を置くと、表示のたびにここで作った HTML に置き換わる。
 * データベースと GA への問い合わせは1時間使い回す（記事を開くたびに問い合わせない）。
 */

const CACHE_SECONDS = 3600;

const escapeHtml = (text: string) =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const sampleLength = (seconds: number) => `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;

type VideoRow = { dmm_content_id: string; title: string; thumbnail_url: string | null; sample_seconds: number | null };

// 作品の一覧（タップすると Short AV のスワイプ画面でその作品から見られる）。サムネイルはパッケージの表面（右半分）を出す
function videoList(videos: VideoRow[], badge: (video: VideoRow, index: number) => string): string {
  if (videos.length === 0) return '<p class="text-gray-400">いま表示できる作品がありません。時間をおいてもう一度ご覧ください。</p>';
  const items = videos
    .map((video, i) => {
      const thumb = video.thumbnail_url
        ? `<img src="${escapeHtml(video.thumbnail_url)}" alt="" loading="lazy" class="w-20 h-28 flex-shrink-0 rounded object-cover object-right bg-gray-900" />`
        : '';
      return `<li><a href="/?v=${encodeURIComponent(video.dmm_content_id)}" class="flex gap-3 items-start rounded-lg bg-gray-800 hover:bg-gray-700 p-2.5 no-underline">${thumb}<span class="min-w-0 flex-1"><span class="block text-xs text-amber-300 font-bold mb-1">${badge(video, i)}</span><span class="block text-sm text-gray-100 leading-snug line-clamp-3">${escapeHtml(video.title)}</span></span></a></li>`;
    })
    .join('');
  return `<ul class="not-prose grid grid-cols-1 sm:grid-cols-2 gap-2 my-6 list-none p-0">${items}</ul>`;
}

// サンプル動画が4分以上ある作品（長い順）
const longSamples = unstable_cache(
  async () => {
    const { data, error } = await getSupabaseAdmin()
      .from('videos')
      .select('dmm_content_id, title, thumbnail_url, sample_seconds')
      .eq('is_active', true)
      .not('thumbnail_url', 'is', null)
      .gte('sample_seconds', 240)
      .order('sample_seconds', { ascending: false })
      .limit(40);
    if (error) throw error;
    const videos = (data ?? []) as VideoRow[];
    return videoList(videos, (v) => `サンプル ${sampleLength(v.sample_seconds ?? 0)}`);
  },
  ['article-live-long-samples-v1'],
  { revalidate: CACHE_SECONDS },
);

// 直近7日間に Short AV でよく再生されたサンプル動画（GA の video_view。運営者のアクセスは GA で除外済み）
const popularWeek = unstable_cache(
  async () => {
    const [rows] = await runReports([
      {
        dateRanges: [{ startDate: '6daysAgo', endDate: 'today' }],
        dimensions: [{ name: 'customEvent:content_id' }],
        metrics: [{ name: 'eventCount' }],
        dimensionFilter: { filter: { fieldName: 'eventName', stringFilter: { value: 'video_view' } } },
        orderBys: [{ metric: { metricName: 'eventCount' }, desc: true }],
        limit: 40,
      },
    ]);
    const plays = new Map(rows.map((r) => [r.dimensions[0], r.metrics[0]]).filter(([id]) => id && id !== '(not set)') as [string, number][]);
    if (plays.size === 0) return videoList([], () => '');
    const { data, error } = await getSupabaseAdmin()
      .from('videos')
      .select('dmm_content_id, title, thumbnail_url, sample_seconds')
      .eq('is_active', true)
      .in('dmm_content_id', [...plays.keys()]);
    if (error) throw error;
    const videos = ((data ?? []) as VideoRow[])
      .sort((a, b) => (plays.get(b.dmm_content_id) ?? 0) - (plays.get(a.dmm_content_id) ?? 0))
      .slice(0, 20);
    return videoList(videos, (v, i) =>
      `${i + 1}位${v.sample_seconds && v.sample_seconds > 0 ? `・サンプル ${sampleLength(v.sample_seconds)}` : ''}`,
    );
  },
  ['article-live-popular-week-v1'],
  { revalidate: CACHE_SECONDS },
);

// サイズ比較ツールに寄せられたデータの集計（勃起時・通常時の件数と平均、勃起時の長さの分布、年代別）
const sizeReport = unstable_cache(
  async () => {
    const [erectRows, flaccidRows] = await Promise.all([getSizeStatisticsRows('erect'), getSizeStatisticsRows('flaccid')]);
    const erect = summarizeSizeStatistics(erectRows, 'erect');
    const flaccid = summarizeSizeStatistics(flaccidRows, 'flaccid');
    const correction = Number(summarizeForAdmin(erectRows, 'erect').correctionMm);
    const usable = erectRows.filter((d) => d.length_mm >= LENGTH_RANGE_MM.min && d.length_mm <= LENGTH_RANGE_MM.max);
    const cm = (mm: number) => (mm / 10).toFixed(1);
    const cell = 'py-2 px-3 border-b border-gray-700';

    const summaryRows = [
      ['勃起時', erect],
      ['通常時', flaccid],
    ]
      .map(([label, s]) => {
        const stats = s as ReturnType<typeof summarizeSizeStatistics>;
        return `<tr><td class="${cell}">${label}</td><td class="${cell} text-right">${stats.count}件</td><td class="${cell} text-right">${stats.statistics ? `${cm(Number(stats.statistics.avgLength))}cm` : '—'}</td><td class="${cell} text-right">${stats.statistics ? `${cm(Number(stats.statistics.avgDiameter))}cm` : '—'}</td></tr>`;
      })
      .join('');

    // 勃起時の長さの分布（1cm ごと）
    const buckets = new Map<number, number>();
    for (const d of usable) {
      const bucket = Math.floor((d.length_mm - correction) / 10);
      buckets.set(bucket, (buckets.get(bucket) ?? 0) + 1);
    }
    const maxCount = Math.max(...buckets.values(), 1);
    const distribution = [...buckets.keys()]
      .sort((a, b) => a - b)
      .map((b) => {
        const n = buckets.get(b) ?? 0;
        return `<div class="flex items-center gap-2 text-sm"><span class="w-24 flex-shrink-0 text-gray-400">${b}〜${b + 1}cm</span><span class="h-3 rounded bg-blue-500" style="width:${Math.max(4, (n / maxCount) * 70)}%"></span><span class="text-gray-300">${n}</span></div>`;
      })
      .join('');

    // 年代別（勃起時）
    const AGE_LABELS: Record<string, string> = { '20s': '20代', '30s': '30代', '40s': '40代', '50s': '50代以上' };
    const byAge = Object.entries(AGE_LABELS)
      .map(([key, label]) => {
        const rows = usable.filter((d) => d.age_group === key);
        if (rows.length === 0) return '';
        const avg = rows.reduce((sum, d) => sum + d.length_mm - correction, 0) / rows.length;
        return `<tr><td class="${cell}">${label}</td><td class="${cell} text-right">${rows.length}件</td><td class="${cell} text-right">${cm(avg)}cm</td></tr>`;
      })
      .join('');

    const updated = new Date().toLocaleDateString('ja-JP', { timeZone: 'Asia/Tokyo', year: 'numeric', month: 'long', day: 'numeric' });
    return `<div class="not-prose my-6 space-y-6">
<p class="text-xs text-gray-500">${updated}時点の集計</p>
<table class="w-full text-sm"><thead class="text-gray-400"><tr><th class="${cell} text-left font-normal"></th><th class="${cell} text-right font-normal">件数</th><th class="${cell} text-right font-normal">長さの平均</th><th class="${cell} text-right font-normal">直径の平均</th></tr></thead><tbody>${summaryRows}</tbody></table>
${distribution ? `<div><p class="text-sm text-gray-300 font-bold mb-2">勃起時の長さの分布</p><div class="space-y-1.5">${distribution}</div></div>` : ''}
${byAge ? `<div><p class="text-sm text-gray-300 font-bold mb-2">年代別（勃起時）</p><table class="w-full text-sm"><thead class="text-gray-400"><tr><th class="${cell} text-left font-normal">年代</th><th class="${cell} text-right font-normal">件数</th><th class="${cell} text-right font-normal">長さの平均</th></tr></thead><tbody>${byAge}</tbody></table></div>` : ''}
</div>`;
  },
  ['article-live-size-report-v1'],
  { revalidate: CACHE_SECONDS },
);

const SECTIONS: Record<string, () => Promise<string>> = {
  'long-samples': longSamples,
  'popular-week': popularWeek,
  'size-report': sizeReport,
};

/** 本文（Markdown を HTML にしたもの）の差し込み位置を、最新のデータに置き換える */
export async function fillLiveSections(html: string): Promise<string> {
  const names = [...html.matchAll(/<!-- live:([a-z-]+) -->/g)].map((m) => m[1]);
  let result = html;
  for (const name of new Set(names)) {
    const section = SECTIONS[name];
    const replacement = section
      ? await section().catch((error) => {
          console.error(`[articles] ${name} を作れませんでした:`, error);
          return '<p class="text-gray-400">いまデータを表示できません。時間をおいてもう一度ご覧ください。</p>';
        })
      : '';
    // 段落（<p>）に包まれていれば段落ごと置き換える
    result = result
      .split(`<p class="mb-4"><!-- live:${name} --></p>`)
      .join(replacement)
      .split(`<!-- live:${name} -->`)
      .join(replacement);
  }
  return result;
}
