import { getUserId } from '@/lib/user-id';

/**
 * 閲覧履歴（クライアント用）
 * - 一般の利用者: 端末の localStorage（video_history、新しい順に最大100件）
 * - 運営者（管理画面にログインした端末）: localStorage に加えてサーバー（/api/admin/history）にも保存し、
 *   読むときはサーバーの履歴を使う（PC・スマホの Chrome・「サイトを開く」で同じ履歴になる）
 */
const HISTORY_KEY = 'video_history';
const LIMIT = 100;

export const isAdminDevice = () => typeof document !== 'undefined' && document.cookie.split('; ').includes('sav_admin_ui=1');

export function getLocalHistory(): string[] {
  try {
    const value = JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]');
    return Array.isArray(value) ? value.filter((id): id is string => typeof id === 'string') : [];
  } catch {
    return [];
  }
}

export function addToHistory(videoId: string): void {
  const next = [videoId, ...getLocalHistory().filter((id) => id !== videoId)].slice(0, LIMIT);
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
  } catch {
    // 保存できなくても再生には影響しない
  }
  if (isAdminDevice()) {
    fetch('/api/admin/history', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: getUserId(), videoId }),
    }).catch(() => {});
  }
}

export async function loadHistory(): Promise<string[]> {
  if (isAdminDevice()) {
    try {
      const response = await fetch(`/api/admin/history?userId=${encodeURIComponent(getUserId())}`, { cache: 'no-store' });
      if (response.ok) return (await response.json()).ids as string[];
    } catch {
      // サーバーの履歴を読めなければ端末の履歴を使う
    }
  }
  return getLocalHistory();
}

export async function clearHistory(): Promise<void> {
  try {
    localStorage.removeItem(HISTORY_KEY);
  } catch {
    // 消せなくても続ける
  }
  if (isAdminDevice()) {
    await fetch(`/api/admin/history?userId=${encodeURIComponent(getUserId())}`, { method: 'DELETE' }).catch(() => {});
  }
}
