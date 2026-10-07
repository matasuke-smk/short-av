'use client';

import { useEffect } from 'react';
import { getUserId, isValidUserId, setUserId } from '@/lib/user-id';
import { getLocalHistory } from '@/lib/view-history';

const SYNCED_KEY = 'sav_admin_user_synced';
// この端末の履歴をサーバーの共有の履歴に取り込んだか（取り込み先の共通IDを入れる）
const HISTORY_MERGED_KEY = 'sav_admin_history_merged';

/**
 * 管理画面にログインした端末（sav_admin_ui cookie）では、ユーザーIDを運営者の共通IDにそろえる。
 * PC・スマホの Chrome・ホーム画面アプリの「サイトを開く」のどこでいいねしても、同じ一覧になる。
 * 共通IDが変わったときだけ1回読み込み直す（いいねの表示を新しいIDで取り直すため）。
 */
// この端末に残っている履歴を、最初の1回だけサーバーの共有の履歴に取り込む
function mergeLocalHistory(sharedId: string) {
  try {
    if (localStorage.getItem(HISTORY_MERGED_KEY) === sharedId) return;
  } catch {
    return;
  }
  fetch('/api/admin/history', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId: sharedId, merge: getLocalHistory() }),
  })
    .then((response) => {
      if (response.ok) localStorage.setItem(HISTORY_MERGED_KEY, sharedId);
    })
    .catch(() => {});
}

export default function AdminUserSync() {
  useEffect(() => {
    if (!document.cookie.split('; ').includes('sav_admin_ui=1')) return;
    const current = getUserId();
    fetch('/api/admin/sync-user', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: current }),
    })
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => {
        const shared = data?.userId;
        if (!isValidUserId(shared)) return;
        mergeLocalHistory(shared);
        if (shared === current) return;
        setUserId(shared);
        // 万一切り替えが繰り返されても、読み込み直しは1回だけにする
        try {
          if (sessionStorage.getItem(SYNCED_KEY) === shared) return;
          sessionStorage.setItem(SYNCED_KEY, shared);
        } catch {
          return;
        }
        window.location.reload();
      })
      .catch(() => {});
  }, []);
  return null;
}
