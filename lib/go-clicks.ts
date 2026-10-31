/**
 * 人が /go（FANZA への転送）を通ったクリックを記録する（sql/024 go_clicks。2026-10-27）。
 * GA は広告ブロック・すぐ閉じた人・集計待ちで欠けるので、サーバー側でも数え、毎朝の要約で DMM・GA と並べる。
 * app/go/route.ts から、転送の応答を返したあとに呼ぶ。Supabase の REST にそのまま書く（lib/ai-bots.ts と同じ形）。
 * 表がまだ無い・通信エラーのときは何もしない（利用者の転送には影響させない）
 */
export async function recordGoClick(click: { target: string; owner: boolean; country: string | null; referer: string | null; userAgent: string | null }): Promise<void> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  // 記録できないときは理由を1行だけ残す（Cloudflare の Observability・Vercel の記録で調べられるように。2026-11-01）
  if (!url || !key) {
    console.error('[go-click] 記録の設定がない', { url: !!url, key: !!key });
    return;
  }
  try {
    const res = await fetch(`${url}/rest/v1/go_clicks`, {
      method: 'POST',
      headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
      body: JSON.stringify({
        owner: click.owner,
        target: click.target.slice(0, 500),
        country: click.country,
        referer: click.referer?.slice(0, 300) ?? null,
        user_agent: click.userAgent?.slice(0, 300) ?? null,
      }),
    });
    if (!res.ok) console.error('[go-click] 記録できない', res.status, (await res.text().catch(() => '')).slice(0, 200));
  } catch (e) {
    // 記録できなくても利用者の転送には影響させない
    console.error('[go-click] 記録の通信エラー', e instanceof Error ? e.message : e);
  }
}
