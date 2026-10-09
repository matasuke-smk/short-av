// アクセス解析を開いて集計を待つ間に出す画面（以前は何も出ず、スマホで真っ白な画面が続いていた）
export default function Loading() {
  return (
    <main className="min-h-screen bg-gray-900 text-white px-2 py-3 md:p-6">
      <h1 className="text-xl md:text-2xl font-bold">アクセス解析</h1>
      <p className="mt-6 flex items-center gap-2 text-sm text-gray-400">
        <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-gray-500 border-t-transparent" />
        集計を読み込んでいます…
      </p>
    </main>
  );
}
