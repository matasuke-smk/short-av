'use client';

import { useEffect } from 'react';
import { getUserId, isValidUserId, setUserId } from '@/lib/user-id';

const SYNCED_KEY = 'sav_admin_user_synced';

/**
 * 管理画面にログインした端末（sav_admin_ui cookie）では、ユーザーIDを運営者の共通IDにそろえる。
 * PC・スマホの Chrome・ホーム画面アプリの「サイトを開く」のどこでいいねしても、同じ一覧になる。
 * 共通IDが変わったときだけ1回読み込み直す（いいねの表示を新しいIDで取り直すため）。
 */
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
        if (!isValidUserId(shared) || shared === current) return;
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
