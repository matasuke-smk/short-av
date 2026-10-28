'use client';

import type { DailyData } from '@/lib/daily-summary';
import type { Trends } from './data';
import { TrendLine } from './AnalyticsView';

/**
 * 昨日のレポート（2026-10-28 ユーザーの要望で「今朝の要約」から名前を変え、見やすいレポートの形にして図を入れた）。
 * 上に大事な数字（タイル）、良かった点・悪い点、図（来た元・今月の推移・FANZA のクリックの比べ）、そのあとに Claude の文の残りの見出しを並べる。
 * 数字は要約を作ったときの材料（daily_summaries.data）から出す。古い記録で材料が無いときは文だけ出す
 */

type Section = { heading: string | null; lines: string[] };

function parseSections(text: string): Section[] {
  const sections: Section[] = [];
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    if (!line.startsWith('・') && !line.startsWith('※') && line.length <= 40) sections.push({ heading: line, lines: [] });
    else if (sections.length === 0) sections.push({ heading: null, lines: [line] });
    else sections[sections.length - 1].lines.push(line);
  }
  return sections;
}

const fmt = (n: number) => Math.round(n).toLocaleString('ja-JP');
const FANZA_EVENTS = ['dmm_link_click', 'fanza_banner_click', 'fanza_widget_click', 'fanza_coupon_click', 'first_time_link_click'];
const SOURCE_LABEL: Record<string, string> = { 'chatgpt.com': 'ChatGPT', openai: 'OpenAI', x: 'X', 't.co': 'X', '(direct)': '直接', '(not set)': '不明', google: 'Google', bing: 'Bing', yahoo: 'Yahoo!' };

export default function DailyReport({ summary, data, trends }: { summary: string; data: DailyData | null; trends: Trends | null }) {
  const sections = parseSections(summary);
  const good = sections.find((s) => s.heading?.startsWith('良かった点'));
  const bad = sections.find((s) => s.heading?.startsWith('悪い点'));
  const rest = sections.filter((s) => s !== good && s !== bad);

  return (
    <div className="space-y-4 text-sm text-gray-200">
      {data && <Tiles data={data} />}

      {(good || bad) && (
        <div className="grid gap-3 md:grid-cols-2">
          {good && <Box tone="good" section={good} />}
          {bad && <Box tone="bad" section={bad} />}
        </div>
      )}

      {data && (
        <div className="grid gap-3 md:grid-cols-2">
          <Panel title="昨日どこから来たか（Short AV・人）">
            <Bars
              rows={data.shortav.sources
                .map((s) => ({ label: SOURCE_LABEL[s.source] ?? s.source, value: s.yesterday, note: `一昨日 ${fmt(s.dayBefore)}人` }))
                .slice(0, 6)}
              unit="人"
              color="#38bdf8"
            />
          </Panel>
          <Panel title="FANZA へのクリックの比べ（昨日）">
            <Bars
              rows={[
                ...(data.clickGap.dmm !== null ? [{ label: 'DMM の記録', value: data.clickGap.dmm, note: 'DMM の管理画面のクリック' }] : []),
                ...(data.clickGap.byId ? [{ label: 'うち今のサイトから', value: data.clickGap.byId.site, note: '紹介 ID 991・005' }] : []),
                ...(data.clickGap.goHumans !== null ? [{ label: 'サイトを通った人', value: data.clickGap.goHumans, note: '入口（/go）の記録' }] : []),
                { label: 'GA（全部の国）', value: data.clickGap.gaAll, note: `日本 ${fmt(data.clickGap.gaJapan)}回` },
              ]}
              unit="回"
              color="#34d399"
            />
          </Panel>
          {trends && trends.dates.length > 2 && (
            // 昨日までの直近14日（今日は途中なので入れない。10/8 ごろの X の山が入ると最近の動きが見えなくなるため14日に絞る）
            <Panel title="直近14日の来た人（Short AV・日本・昨日まで）" wide>
              <TrendLine data={trends.dates.map((date, i) => ({ date, users: trends.users[i] ?? 0 })).slice(-15, -1)} height={120} labels />
            </Panel>
          )}
        </div>
      )}

      <div className="grid gap-3 md:grid-cols-2">
        {rest.map((sec, i) => (
          <section key={i} className="rounded-lg border border-gray-700 bg-gray-800/60 px-3 py-2">
            {sec.heading && <h3 className="mb-1 font-bold text-white">{sec.heading}</h3>}
            {sec.lines.map((l, j) => (
              <p key={j} className="leading-relaxed text-gray-300">{l}</p>
            ))}
          </section>
        ))}
      </div>
    </div>
  );
}

function Tiles({ data }: { data: DailyData }) {
  const [y, d2, avg] = data.shortav.sessions.map((r) => r.value);
  const ev = (name: string) => data.shortav.events.find((e) => e.name === name);
  const plays = ev('video_view');
  const clicks = FANZA_EVENTS.reduce((sum, n) => sum + (ev(n)?.yesterday ?? 0), 0);
  const clicksBefore = FANZA_EVENTS.reduce((sum, n) => sum + (ev(n)?.dayBefore ?? 0), 0);
  const dmm = data.dmm?.updated ? data.dmm : null;
  const tiles = [
    { label: '来た人（Short AV）', value: y, unit: '人', before: d2, sub: avg !== undefined ? `7日平均 ${fmt(avg)}人` : undefined },
    { label: 'サンプルの再生', value: plays?.yesterday ?? 0, unit: '回', before: plays?.dayBefore, sub: plays ? `7日平均 ${fmt(plays.week)}回` : undefined },
    { label: 'FANZA へのクリック（GA・日本）', value: clicks, unit: '回', before: clicksBefore, sub: undefined },
    { label: 'FANZA の成約（DMM）', value: dmm ? dmm.direct + dmm.category + dmm.newCount : null, unit: '件', before: undefined, sub: dmm ? undefined : '昨日分はまだ取れていない' },
  ];
  return (
    <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
      {tiles.map((t) => {
        const diff = t.value !== null && t.before !== undefined ? t.value - t.before : null;
        return (
          <div key={t.label} className="rounded-lg bg-gray-800 px-3 py-2">
            <div className="text-xs text-gray-400">{t.label}</div>
            <div className="mt-0.5 text-2xl font-bold leading-tight text-white">
              {t.value === null ? '—' : fmt(t.value)}
              <span className="ml-0.5 text-sm font-normal text-gray-400">{t.value === null ? '' : t.unit}</span>
            </div>
            <div className="mt-0.5 text-xs text-gray-400">
              {diff !== null && (
                <span className={diff > 0 ? 'text-emerald-300' : diff < 0 ? 'text-red-300' : ''}>
                  一昨日より {diff > 0 ? '+' : ''}{fmt(diff)}
                </span>
              )}
              {diff !== null && t.sub && '・'}
              {t.sub}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function Box({ tone, section }: { tone: 'good' | 'bad'; section: Section }) {
  const c = tone === 'good' ? { box: 'border-emerald-500/40 bg-emerald-500/10', head: 'text-emerald-300', body: 'text-emerald-100' } : { box: 'border-red-500/40 bg-red-500/10', head: 'text-red-300', body: 'text-red-100' };
  return (
    <section className={`rounded-lg border px-3 py-2 ${c.box}`}>
      <h3 className={`mb-1 font-bold ${c.head}`}>{tone === 'good' ? '✓ ' : '! '}{section.heading}</h3>
      {section.lines.map((l, i) => (
        <p key={i} className={`leading-relaxed ${c.body}`}>{l}</p>
      ))}
    </section>
  );
}

function Panel({ title, wide, children }: { title: string; wide?: boolean; children: React.ReactNode }) {
  return (
    <section className={`rounded-lg border border-gray-700 bg-gray-800/60 px-3 py-2 ${wide ? 'md:col-span-2' : ''}`}>
      <h3 className="mb-2 text-xs font-bold text-gray-300">{title}</h3>
      {children}
    </section>
  );
}

// 横向きの棒（1系列なので凡例なし。数字は棒の右に、細かい内訳は指を乗せると出る）
function Bars({ rows, unit, color }: { rows: { label: string; value: number; note?: string }[]; unit: string; color: string }) {
  if (rows.length === 0) return <p className="text-xs text-gray-500">データがありません</p>;
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <div className="space-y-1.5">
      {rows.map((r) => (
        <div key={r.label} className="flex items-center gap-2 text-xs" title={r.note ? `${r.label}: ${fmt(r.value)}${unit}（${r.note}）` : undefined}>
          <span className="w-28 shrink-0 truncate text-gray-300">{r.label}</span>
          <span className="relative h-3 flex-1 rounded bg-gray-700/50">
            <span className="absolute inset-y-0 left-0 rounded" style={{ width: `${(r.value / max) * 100}%`, background: color }} />
          </span>
          <span className="w-14 shrink-0 text-right tabular-nums text-gray-200">
            {fmt(r.value)}
            {unit}
          </span>
        </div>
      ))}
    </div>
  );
}
