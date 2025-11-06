'use client';

import { useState, useEffect } from 'react';

/**
 * バナーID配列からランダムに1つ選択するカスタムフック
 *
 * ハイドレーションエラーを避けるため、useEffectでクライアントサイドのみで選択します
 *
 * @param bannerIds - バナーIDの配列
 * @returns 選択されたバナーID（初回レンダリング時はnull）
 */
export function useRandomBannerId(bannerIds: string[]): string | null {
  const [selectedBannerId, setSelectedBannerId] = useState<string | null>(null);

  useEffect(() => {
    if (bannerIds.length > 0) {
      const randomIndex = Math.floor(Math.random() * bannerIds.length);
      setSelectedBannerId(bannerIds[randomIndex]);
    }
  }, [bannerIds]);

  return selectedBannerId;
}
