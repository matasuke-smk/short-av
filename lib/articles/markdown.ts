/**
 * 記事本文（簡易 Markdown）を HTML に変換する
 * 対応: 見出し（# / ## / ###）、表（カード表示）、箇条書き（- / 1.）、太字、リンク
 * - 段落は空行区切り。段落の途中から始まる箇条書きもリストとして表示する
 * - 本文先頭の「# 記事タイトル」はページ側の h1 と重複するため出さない
 */

const LINK_RE = /\[([^\]]+)\]\(([^)]+)\)/g;
const BULLET_RE = /^\s*[-・]\s+/;
const ORDERED_RE = /^\s*\d+[.)]\s+/;

function inline(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, '<strong class="font-bold text-gray-900">$1</strong>')
    .replace(LINK_RE, '<a href="$2" class="text-blue-600 hover:text-blue-800 underline">$1</a>');
}

function renderTable(lines: string[]): string {
  const headers = lines[0].split('|').map(h => h.trim()).filter(Boolean);
  const rows = lines.slice(2).map(line =>
    line.split('|').map(cell => cell.trim()).filter(cell => cell !== '')
  );

  // スマホで読みやすいようカード形式にする
  let html = '<div class="space-y-4 my-6">';
  for (const row of rows) {
    html += '<div class="bg-gray-50 border border-gray-200 rounded-lg p-4 hover:border-gray-300 transition-colors">';
    row.forEach((cell, i) => {
      if (i >= headers.length) return;
      const header = headers[i].replace(/\*\*(.+?)\*\*/g, '$1');
      const value = inline(cell).replace(/<br>/g, '<br class="my-1">');
      if (i === 0) {
        html += `<div class="text-lg font-bold text-gray-900 mb-3 pb-3 border-b border-gray-200">${value}</div>`;
      } else {
        html += '<div class="flex justify-between items-start py-2 border-b border-gray-200 last:border-0">';
        html += `<span class="text-sm text-gray-500 font-medium">${header}</span>`;
        html += `<span class="text-sm text-gray-800 text-right ml-4">${value}</span>`;
        html += '</div>';
      }
    });
    html += '</div>';
  }
  return html + '</div>';
}

// 段落内の行を、地の文・箇条書き・番号付きリストのまとまりに分けて出力する
function renderBlock(block: string): string {
  const lines = block.split('\n');
  let html = '';
  let text: string[] = [];
  let list: { tag: 'ul' | 'ol'; items: string[] } | null = null;

  const flushText = () => {
    if (text.length > 0) html += `<p class="mb-4">${inline(text.join('\n'))}</p>`;
    text = [];
  };
  const flushList = () => {
    if (!list) return;
    const cls = list.tag === 'ul' ? 'list-disc' : 'list-decimal';
    html += `<${list.tag} class="${cls} ml-6 space-y-2 mb-4">${list.items.map(i => `<li class="ml-4">${inline(i)}</li>`).join('')}</${list.tag}>`;
    list = null;
  };

  for (const line of lines) {
    const bullet = BULLET_RE.test(line);
    const ordered = !bullet && ORDERED_RE.test(line);
    if (bullet || ordered) {
      const tag = bullet ? 'ul' : 'ol';
      flushText();
      if (list && list.tag !== tag) flushList();
      if (!list) list = { tag, items: [] };
      list.items.push(line.replace(bullet ? BULLET_RE : ORDERED_RE, ''));
    } else if (list && /^\s{2,}\S/.test(line)) {
      // 字下げされた行は直前の項目の続き
      list.items[list.items.length - 1] += `<br>${line.trim()}`;
    } else {
      flushList();
      text.push(line);
    }
  }
  flushText();
  flushList();
  return html;
}

export function renderArticleMarkdown(content: string, title: string): string {
  const blocks = content.split(/\n\s*\n/).map(b => b.replace(/^\n+|\n+$/g, '')).filter(Boolean);
  let h2Count = 0; // 目次用に h2 へ sec-1, sec-2... の id を振る

  return blocks
    .map((block, index) => {
      // 見出し（見出しの直後に空行なしで本文が続く場合は、残りを通常の段落として出す）
      const heading = block.match(/^(#{1,3}) (.+)(?:\n([\s\S]*))?$/);
      if (heading) {
        const [, marks, text, rest] = heading;
        const body = rest?.trim() ? renderBlock(rest) : '';
        if (marks === '#' && index === 0 && title.startsWith(text.split(/[｜|:：]| - /)[0].trim())) return body;
        const tag = marks === '###' ? 'h3' : 'h2';
        const idAttr = tag === 'h2' ? ` id="sec-${++h2Count}"` : '';
        const cls = marks === '#'
          ? 'text-2xl md:text-3xl font-bold mt-8 mb-4 text-gray-900'
          : marks === '##'
            ? 'text-xl md:text-2xl font-bold mt-6 mb-3 text-gray-900'
            : 'text-lg md:text-xl font-bold mt-4 mb-2 text-gray-900';
        return `<${tag}${idAttr} class="${cls}">${inline(text.trim())}</${tag}>${body}`;
      }

      const lines = block.split('\n').filter(line => line.trim());
      if (block.includes('|') && lines.length > 2 && lines[1].includes('---')) {
        return renderTable(lines);
      }

      // 引用（> で始まる行のまとまり）: 本文と区別した薄い囲みで出す
      if (lines.every(line => /^\s*>/.test(line))) {
        const body = lines.map(line => line.replace(/^\s*>\s?/, '')).join('\n');
        return `<blockquote class="my-6 border-l-4 border-gray-200 pl-4 text-gray-600">${inline(body)}</blockquote>`;
      }

      return renderBlock(block);
    })
    .join('');
}

/** <script> / <style> を含む HTML ツール記事か（Markdown 変換せずそのまま出す） */
export function isInteractiveArticle(content: string): boolean {
  return content.includes('<script') || content.includes('<style');
}

/** 変換後の HTML から目次（h2 の id と見出し文）を取り出す */
export function extractToc(html: string): { id: string; text: string }[] {
  const toc: { id: string; text: string }[] = [];
  for (const m of html.matchAll(/<h2 id="([^"]+)"[^>]*>([\s\S]*?)<\/h2>/g)) {
    toc.push({ id: m[1], text: m[2].replace(/<[^>]+>/g, '') });
  }
  return toc;
}
