import { firstTimeLinks } from '@/config/banners';
import { unstable_cache } from 'next/cache';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { supabase } from '@/lib/supabase';
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
  if (videos.length === 0) return '<p class="text-gray-500">いま表示できる作品がありません。時間をおいてもう一度ご覧ください。</p>';
  const items = videos
    .map((video, i) => {
      const thumb = video.thumbnail_url
        ? `<img src="${escapeHtml(video.thumbnail_url)}" alt="" loading="lazy" class="w-20 h-28 flex-shrink-0 rounded object-cover object-right bg-gray-100" />`
        : '';
      return `<li><a href="/?v=${encodeURIComponent(video.dmm_content_id)}" class="flex gap-3 items-start rounded-lg bg-gray-50 hover:bg-gray-100 p-2.5 no-underline">${thumb}<span class="min-w-0 flex-1"><span class="block text-xs text-amber-700 font-bold mb-1">${badge(video, i)}</span><span class="block text-sm text-gray-800 leading-snug line-clamp-3">${escapeHtml(video.title)}</span></span></a></li>`;
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
    const cell = 'py-2 px-3 border-b border-gray-200';

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
        return `<div class="flex items-center gap-2 text-sm"><span class="w-24 flex-shrink-0 text-gray-500">${b}〜${b + 1}cm</span><span class="h-3 rounded bg-blue-500" style="width:${Math.max(4, (n / maxCount) * 70)}%"></span><span class="text-gray-700">${n}</span></div>`;
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
<table class="w-full text-sm"><thead class="text-gray-500"><tr><th class="${cell} text-left font-normal"></th><th class="${cell} text-right font-normal">件数</th><th class="${cell} text-right font-normal">長さの平均</th><th class="${cell} text-right font-normal">直径の平均</th></tr></thead><tbody>${summaryRows}</tbody></table>
${distribution ? `<div><p class="text-sm text-gray-700 font-bold mb-2">勃起時の長さの分布</p><div class="space-y-1.5">${distribution}</div></div>` : ''}
${byAge ? `<div><p class="text-sm text-gray-700 font-bold mb-2">年代別（勃起時）</p><table class="w-full text-sm"><thead class="text-gray-500"><tr><th class="${cell} text-left font-normal">年代</th><th class="${cell} text-right font-normal">件数</th><th class="${cell} text-right font-normal">長さの平均</th></tr></thead><tbody>${byAge}</tbody></table></div>` : ''}
</div>`;
  },
  ['article-live-size-report-v1'],
  { revalidate: CACHE_SECONDS },
);

// サンプル動画の長さの集計（記事「FANZA のサンプル動画は何分？」）。配信中で長さを測れた全作品が対象。
// 1万件以上を読むので1日1回だけ数え直す。公開している作品の情報だけなので、管理用ではなく通常の読み取りの接続を使う（2026-10-31）
const sampleLengthStats = unstable_cache(
  async () => {
    const rows: { sample_seconds: number; maker: string | null; genre_ids: number[] | null }[] = [];
    for (let offset = 0; ; offset += 1000) {
      const { data, error } = await supabase
        .from('videos')
        .select('sample_seconds, maker, genre_ids')
        .eq('is_active', true)
        .gt('sample_seconds', 0)
        .order('id')
        .range(offset, offset + 999);
      if (error) throw error;
      rows.push(...((data ?? []) as typeof rows));
      if (!data || data.length < 1000) break;
    }
    if (rows.length === 0) return '<p class="text-gray-500">いま表示できるデータがありません。</p>';
    const secs = rows.map((r) => r.sample_seconds).sort((a, b) => a - b);
    const total = secs.length;
    const avg = Math.round(secs.reduce((a, b) => a + b, 0) / total);
    const median = secs[Math.floor(total / 2)];
    const pct = (n: number) => `${((n / total) * 100).toFixed(1)}%`;
    const bands: [string, number, number][] = [['1分未満', 0, 60], ['1分台', 60, 120], ['2分台', 120, 180], ['3分台', 180, 240], ['4分以上', 240, Infinity]];
    const bars = bands
      .map(([label, lo, hi]) => {
        const n = secs.filter((x) => x >= lo && x < hi).length;
        return `<li class="flex items-center gap-2 text-sm"><span class="w-16 flex-shrink-0 text-gray-600">${label}</span><span class="flex-1 h-4 rounded bg-gray-100 overflow-hidden"><span class="block h-full bg-amber-400" style="width:${Math.max(0.5, (n / total) * 100).toFixed(1)}%"></span></span><span class="w-36 flex-shrink-0 text-right text-gray-800 whitespace-nowrap">${n.toLocaleString('ja-JP')}本（${pct(n)}）</span></li>`;
      })
      .join('');
    // メーカー・ジャンルごとの「4分以上」の数。作品が少ないものは割合がぶれるので、作品数の下限を置く
    const tally = (keys: (r: (typeof rows)[number]) => (string | number)[]) => {
      const m = new Map<string | number, { n: number; long: number }>();
      for (const r of rows) for (const k of keys(r)) {
        const e = m.get(k) ?? { n: 0, long: 0 };
        e.n++;
        if (r.sample_seconds >= 240) e.long++;
        m.set(k, e);
      }
      return m;
    };
    const makers = [...tally((r) => (r.maker ? [r.maker] : []))].filter(([, e]) => e.long > 0).sort((a, b) => b[1].long - a[1].long).slice(0, 8);
    const genreTally = [...tally((r) => r.genre_ids ?? [])].filter(([, e]) => e.n >= 150 && e.long > 0).sort((a, b) => b[1].long / b[1].n - a[1].long / a[1].n).slice(0, 8);
    const { data: genreNames } = await supabase.from('genres').select('id, name').in('id', genreTally.map(([id]) => Number(id)));
    const gname = new Map((genreNames ?? []).map((g: { id: number; name: string }) => [g.id, g.name]));
    const table = (head: string, tail: string, items: [string, string][]) =>
      `<table class="w-full text-sm my-4"><thead><tr><th class="text-left">${head}</th><th class="text-right">${tail}</th></tr></thead><tbody>${items.map(([a, b]) => `<tr><td>${escapeHtml(a)}</td><td class="text-right">${b}</td></tr>`).join('')}</tbody></table>`;
    const today = new Date(Date.now() + 9 * 3_600_000).toISOString().slice(0, 10).replaceAll('-', '/');
    return `<div class="not-prose my-6 rounded-2xl border border-gray-200 p-5">
      <p class="font-bold text-gray-900 m-0">最新の集計（${today} 時点・配信中の${total.toLocaleString('ja-JP')}本）</p>
      <p class="mt-2 text-sm text-gray-700 m-0">平均 ${sampleLength(avg)}・真ん中の作品 ${sampleLength(median)}・いちばん長い作品 ${sampleLength(secs[total - 1])}</p>
      <ul class="mt-4 space-y-1.5 list-none p-0">${bars}</ul>
    </div>
    <h3>4分以上の作品が多いメーカー</h3>
    ${table('メーカー', '4分以上の作品', makers.map(([k, e]) => [String(k), `${e.long}本（全${e.n}本中）`]))}
    <h3>4分以上の作品の割合が高いジャンル（作品150本以上のジャンル）</h3>
    ${table('ジャンル', '4分以上の割合', genreTally.map(([k, e]) => [gname.get(Number(k)) ?? String(k), `${((e.long / e.n) * 100).toFixed(1)}%（${e.long}本／${e.n}本）`]))}`;
  },
  ['article-live-sample-length-stats-v1'],
  { revalidate: 86400 },
);

// ちんこ偏差値チェッカーへの導線（平均を調べる人は「自分はどのくらいの位置か」が知りたいので、答えの直後に目立つ枠で出す）
const checkerCta = async () =>
  `<div class="not-prose my-6 rounded-2xl border border-yellow-300 bg-yellow-50 p-5 md:p-6">
    <p class="text-lg md:text-xl font-bold text-gray-900 m-0">あなたは平均の上？下？ 10秒で分かります</p>
    <p class="mt-2 text-sm md:text-base text-gray-700 m-0">長さと太さを入れるだけで、日本基準と世界基準の偏差値、100人中なん位か、「AV男優並み」「日本人の平均並み」のどれかが出ます。登録不要・匿名、cm でも mm でも OK。</p>
    <a href="/articles/size-comparison-tool" onclick="try{window.gtag&&window.gtag('event','tool_cta_click',{position:'average_article'})}catch(e){}" class="mt-4 flex items-center justify-center gap-2 rounded-xl bg-yellow-400 py-3 px-4 font-bold text-gray-900 no-underline hover:bg-yellow-300">🍌 ちんこ偏差値チェッカーで調べる</a>
  </div>`;

// FANZA TV（見放題）の案内。無料お試し登録の報酬が大きい。記事「FANZA で安く買う方法」の見放題の段落の後に出す
const fanzaTvCta = async () =>
  `<div class="not-prose my-6 rounded-2xl border border-gray-200 bg-gray-50 p-5 md:p-6">
    <p class="text-lg md:text-xl font-bold text-gray-900 m-0">月に何本も見るなら、FANZA TV の14日間無料体験から</p>
    <p class="mt-2 text-sm md:text-base text-gray-600 m-0">月額550円（税込）で2,200作品以上が見放題。まず14日間の無料体験で、見たい作品やメーカーが入っているかを確かめられます。期間内に解約すれば料金はかかりません。</p>
    <a href="${firstTimeLinks.fanzaTv}" target="_blank" rel="noopener noreferrer sponsored" onclick="try{window.gtag&&window.gtag('event','first_time_link_click',{kind:'fanza_tv',position:'article_save_money'})}catch(e){}" class="mt-4 flex items-center justify-center gap-2 rounded-full bg-gray-900 hover:bg-gray-700 py-3 font-bold text-white no-underline">FANZA TV を14日間無料で試す</a>
    <p class="mt-2 text-xs text-gray-400 m-0">※ 広告（アフィリエイト）リンクです</p>
  </div>`;

const SECTIONS: Record<string, () => Promise<string>> = {
  'checker-cta': checkerCta,
  'fanza-tv': fanzaTvCta,
  'long-samples': longSamples,
  'popular-week': popularWeek,
  'sample-length-stats': sampleLengthStats,
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
          return '<p class="text-gray-500">いまデータを表示できません。時間をおいてもう一度ご覧ください。</p>';
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
