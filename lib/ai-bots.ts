/**
 * AI のボット（ChatGPT・Perplexity など）のアクセスを見分けて記録する（sql/018）
 *
 * - isAiBot: User-Agent からボットの名前を返す（学習用のボットも含めて記録する。robots.txt で拒否していても読みに来ることがあるため）
 * - recordAiBotHit: Supabase の REST にそのまま書く（middleware＝Edge で動くので、supabase-js は使わない）
 * middleware.ts から呼ぶ。記録に失敗しても利用者の表示には影響させない
 */

// 名前の順に調べる（先に書いたものが優先。ChatGPT-User は Mozilla… の後ろに付く）
const AI_BOTS = [
  'OAI-SearchBot',
  'ChatGPT-User',
  'GPTBot',
  'PerplexityBot',
  'Perplexity-User',
  'Claude-SearchBot',
  'Claude-User',
  'ClaudeBot',
  'anthropic-ai',
  'Google-Extended',
  'DuckAssistBot',
  'Amazonbot',
  'meta-externalagent',
  'YouBot',
  'cohere-ai',
  'Bytespider',
  'Applebot-Extended',
] as const;

export type AiBotName = (typeof AI_BOTS)[number];

export function isAiBot(userAgent: string | null): AiBotName | null {
  if (!userAgent) return null;
  const ua = userAgent.toLowerCase();
  for (const name of AI_BOTS) if (ua.includes(name.toLowerCase())) return name;
  return null;
}

export async function recordAiBotHit(hit: { bot: string; path: string; userAgent: string | null; referer: string | null }): Promise<void> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return;
  try {
    await fetch(`${url}/rest/v1/ai_bot_hits`, {
      method: 'POST',
      headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
      body: JSON.stringify({
        bot: hit.bot,
        path: hit.path.slice(0, 500),
        user_agent: hit.userAgent?.slice(0, 300) ?? null,
        referer: hit.referer?.slice(0, 300) ?? null,
      }),
    });
  } catch {
    // 記録できなくても何もしない（表が無い・通信エラーなど）
  }
}
