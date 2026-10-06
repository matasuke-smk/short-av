// 管理画面のログイン画面
// パスワード管理で保存・自動入力できるよう、name / id / autocomplete を付けた通常のフォームにしている
export default async function AdminLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const { next, error } = await searchParams;

  return (
    <main className="min-h-screen bg-gray-900 text-white flex items-center justify-center p-4">
      <form method="post" action="/api/admin/login" className="w-full max-w-sm bg-gray-800 rounded-lg p-6 space-y-4">
        <h1 className="text-xl font-bold">管理画面にログイン</h1>
        <input type="hidden" name="next" value={next ?? ''} />
        <label className="block" htmlFor="username">
          <span className="text-sm text-gray-300">ユーザー名</span>
          <input
            id="username"
            name="username"
            type="text"
            autoComplete="username"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            className="mt-1 w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 text-white"
            required
          />
        </label>
        <label className="block" htmlFor="password">
          <span className="text-sm text-gray-300">パスワード</span>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            className="mt-1 w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 text-white"
            required
          />
        </label>
        {error && <p className="text-sm text-red-400">ユーザー名またはパスワードが違います</p>}
        <button type="submit" className="w-full bg-blue-600 hover:bg-blue-500 rounded py-2 font-bold">
          ログイン
        </button>
        <p className="text-xs text-gray-500">一度ログインすると、この端末では90日間ログインしたままになります。</p>
      </form>
    </main>
  );
}
