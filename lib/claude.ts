import Anthropic from '@anthropic-ai/sdk';

/**
 * Claude API の共通の呼び出し口（サーバー専用。2026-10-25）
 * - 鍵は環境変数 ANTHROPIC_API_KEY（Vercel の設定。Max プランの月 200 ドルのクレジットで動く）
 * - モデルは Claude Opus 5.5。思考は常に有効で、深さは effort で決める（標準は medium）
 * - 失敗したときは呼び出し側が判断できるよう、例外はそのまま投げる（安全上の拒否は null を返す）
 */

export const CLAUDE_MODEL = 'claude-opus-5-5';

let client: Anthropic | null = null;

export class ClaudeNotConfiguredError extends Error {}

export function isClaudeConfigured(): boolean {
  return !!process.env.ANTHROPIC_API_KEY;
}

export function getClaude(): Anthropic {
  if (typeof window !== 'undefined') throw new Error('getClaude() must not be called in the browser');
  if (!process.env.ANTHROPIC_API_KEY) throw new ClaudeNotConfiguredError('ANTHROPIC_API_KEY が設定されていません');
  client ??= new Anthropic();
  return client;
}

export type AskOptions = {
  /** 思考の深さ。短い定型の文章は low、要約や判断は medium、難しい分析は high */
  effort?: 'low' | 'medium' | 'high';
  maxTokens?: number;
  /** 同じ system を何度も送るときはキャッシュする（1時間） */
  cacheSystem?: boolean;
};

/** truncated: 長さの上限（max_tokens。思考の分も含む）で途中で切れた */
export type AskResult = { text: string; inputTokens: number; outputTokens: number; cachedTokens: number; truncated: boolean };

/**
 * 1往復のテキスト生成。safety の拒否（stop_reason: refusal）のときは null を返す
 */
export async function askClaude(system: string, user: string, options: AskOptions = {}): Promise<AskResult | null> {
  const anthropic = getClaude();
  const response = await anthropic.messages.create({
    model: CLAUDE_MODEL,
    max_tokens: options.maxTokens ?? 4000,
    output_config: { effort: options.effort ?? 'medium' },
    system: options.cacheSystem ? [{ type: 'text', text: system, cache_control: { type: 'ephemeral', ttl: '1h' } }] : system,
    messages: [{ role: 'user', content: user }],
  });
  if (response.stop_reason === 'refusal') return null;
  const text = response.content
    .filter((b): b is Anthropic.TextBlock => b.type === 'text')
    .map((b) => b.text)
    .join('')
    .trim();
  return {
    text,
    inputTokens: response.usage.input_tokens,
    outputTokens: response.usage.output_tokens,
    cachedTokens: response.usage.cache_read_input_tokens ?? 0,
    truncated: response.stop_reason === 'max_tokens',
  };
}

/** 円に直す（Opus 5.5: 入力 $4 / 出力 $20 / キャッシュ読み取り $0.20 per 1M トークン。1ドル=150円の目安） */
export function estimateYen(r: { inputTokens: number; outputTokens: number; cachedTokens: number }): number {
  const usd = (r.inputTokens * 4 + r.outputTokens * 20 + r.cachedTokens * 0.2) / 1_000_000;
  return Math.round(usd * 150 * 100) / 100;
}
