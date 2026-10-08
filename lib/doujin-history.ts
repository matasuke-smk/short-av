/**
 * 同人誌の閲覧履歴（端末の localStorage、新しい順に最大100件）。動画の履歴（lib/view-history.ts）とは分けて持つ
 */
const KEY = 'doujin_history';
const MAX = 100;

export function getDoujinHistory(): string[] {
  try {
    const value = JSON.parse(localStorage.getItem(KEY) || '[]');
    return Array.isArray(value) ? value.filter((id) => typeof id === 'string') : [];
  } catch {
    return [];
  }
}

export function addDoujinHistory(contentId: string): void {
  try {
    const next = [contentId, ...getDoujinHistory().filter((id) => id !== contentId)].slice(0, MAX);
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // 保存できなくても表示には影響しない
  }
}
