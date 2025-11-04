import { supabase } from '@/lib/supabase';

export default async function TestDbPage() {
  // genresテーブルからデータを取得
  const { data: genres, error } = await supabase
    .from('genres')
    .select('*')
    .order('sort_order', { ascending: true });

  if (error) {
    return (
      <div className="p-8">
        <h1 className="text-2xl font-bold text-red-600 mb-4">データベース接続エラー</h1>
        <pre className="bg-red-50 p-4 rounded">{JSON.stringify(error, null, 2)}</pre>
        <p className="mt-4 text-gray-600">
          環境変数が正しく設定されているか確認してください。
        </p>
      </div>
    );
  }

  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold mb-6">データベース接続テスト</h1>

      <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
        <p className="text-green-800 font-semibold">✅ データベース接続成功！</p>
      </div>

      <h2 className="text-xl font-semibold mb-4">登録済みジャンル一覧</h2>

      <div className="grid gap-4">
        {genres?.map((genre) => (
          <div key={genre.id} className="bg-white border rounded-lg p-4 shadow-sm">
            <h3 className="font-bold text-lg">{genre.name}</h3>
            <p className="text-gray-600 text-sm">スラッグ: {genre.slug}</p>
            {genre.description && (
              <p className="text-gray-700 mt-2">{genre.description}</p>
            )}
          </div>
        ))}
      </div>

      <div className="mt-8 text-sm text-gray-500">
        <p>取得件数: {genres?.length}件</p>
      </div>
    </div>
  );
}
