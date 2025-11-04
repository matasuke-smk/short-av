export default function Loading() {
  return (
    <div className="h-[100dvh] flex flex-col bg-black">
      {/* ヘッダースケルトン */}
      <div className="fixed top-0 left-0 right-0 z-40 bg-black/50 h-6 animate-pulse" />

      {/* メインコンテンツスケルトン */}
      <div className="flex-1 flex flex-col items-center justify-center gap-4 p-4">
        {/* タイトルスケルトン */}
        <div className="h-8 w-3/4 bg-gray-800 rounded animate-pulse" />

        {/* サムネイルスケルトン */}
        <div className="w-full max-w-md aspect-[4/3] bg-gray-800 rounded-lg animate-pulse" />

        {/* バナースケルトン */}
        <div className="w-full max-w-md aspect-[640/200] bg-gray-800 rounded animate-pulse" />

        {/* ボタンスケルトン */}
        <div className="flex gap-4 w-full max-w-md">
          <div className="flex-1 h-12 bg-gray-800 rounded-xl animate-pulse" />
          <div className="flex-1 h-12 bg-gray-800 rounded-xl animate-pulse" />
        </div>
      </div>

      {/* フッタースケルトン */}
      <div className="fixed bottom-0 left-0 right-0 bg-black/50 h-20 animate-pulse" />
    </div>
  );
}
