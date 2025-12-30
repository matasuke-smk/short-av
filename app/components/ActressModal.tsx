'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import type { Database } from '@/lib/supabase';

type Actress = Database['public']['Tables']['actresses']['Row'];

interface ActressModalProps {
  isOpen: boolean;
  onClose: () => void;
  actressIds: string[];
  onActressSelect: (actressId: string, actressName: string) => void;
}

export default function ActressModal({ isOpen, onClose, actressIds, onActressSelect }: ActressModalProps) {
  const [actresses, setActresses] = useState<Actress[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isOpen || !actressIds || actressIds.length === 0) {
      setActresses([]);
      setLoading(false);
      return;
    }

    const fetchActresses = async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from('actresses')
          .select('*')
          .in('id', actressIds)
          .order('name', { ascending: true });

        if (error) {
          console.error('女優データ取得エラー:', error);
          setActresses([]);
        } else {
          setActresses(data || []);
        }
      } catch (error) {
        console.error('女優データ取得エラー:', error);
        setActresses([]);
      } finally {
        setLoading(false);
      }
    };

    fetchActresses();
  }, [isOpen, actressIds]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black/90 z-50 flex items-end justify-center sm:items-center"
      onClick={onClose}
    >
      <div
        className="bg-gray-900 w-full sm:max-w-lg sm:rounded-t-2xl rounded-t-2xl max-h-[80vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ヘッダー */}
        <div className="flex items-center justify-between p-4 border-b border-gray-700">
          <h2 className="text-lg font-bold text-white">出演女優</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors p-2"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* コンテンツ */}
        <div className="overflow-y-auto flex-1 p-4">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-gray-400">読み込み中...</div>
            </div>
          ) : actresses.length === 0 ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-gray-400">出演女優情報がありません</div>
            </div>
          ) : (
            <div className="space-y-2">
              {actresses.map((actress) => (
                <button
                  key={actress.id}
                  onClick={() => {
                    onActressSelect(actress.id, actress.name);
                    onClose();
                  }}
                  className="w-full bg-gray-800 hover:bg-gray-700 text-white rounded-lg p-4 text-left transition-colors active:scale-98"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium text-base">{actress.name}</div>
                      {actress.kana && (
                        <div className="text-sm text-gray-400 mt-1">{actress.kana}</div>
                      )}
                    </div>
                    <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* フッター */}
        <div className="p-4 border-t border-gray-700">
          <p className="text-xs text-gray-400 text-center">
            女優をタップして作品を検索
          </p>
        </div>
      </div>
    </div>
  );
}
