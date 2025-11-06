'use client';

import { useState, useEffect } from 'react';

/**
 * バナーID配列からランダムに1つ選択するカスタムフック
 *
 * ハイドレーションエラーを避けるため、useEffectでクライアントサイドのみで選択します
 * 依存配列を指定することで、特定の値が変わるたびにバナーを再選択できます
 *
 * @param bannerIds - バナーIDの配列
 * @param dependencies - バナーを再選択するトリガーとなる依存配列（例：currentIndex）
 * @returns 選択されたバナーID（初回レンダリング時はnull）
 */
export function useRandomBannerId(bannerIds: string[], dependencies: any[] = []): string | null {
  const [selectedBannerId, setSelectedBannerId] = useState<string | null>(null);

  useEffect(() => {
    if (bannerIds.length > 0) {
      const randomIndex = Math.floor(Math.random() * bannerIds.length);
      setSelectedBannerId(bannerIds[randomIndex]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bannerIds, ...dependencies]);

  return selectedBannerId;
}
