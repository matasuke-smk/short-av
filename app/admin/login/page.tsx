'use client';

import { Suspense, useState } from 'react';
import { useSearchParams } from 'next/navigation';

function LoginForm() {
  const searchParams = useSearchParams();
  const [user, setUser] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    const response = await fetch('/api/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user, password }),
    });
    if (response.ok) {
      // 管理画面の中のパスだけを戻り先にする
      const next = searchParams.get('next');
      window.location.href = next && next.startsWith('/admin') ? next : '/admin/analytics';
      return;
    }
    setError((await response.json().catch(() => null))?.error ?? 'ログインできませんでした');
    setBusy(false);
  }

  return (
    <form onSubmit={submit} className="w-full max-w-sm bg-gray-800 rounded-lg p-6 space-y-4">
      <h1 className="text-xl font-bold">管理画面にログイン</h1>
      <label className="block">
        <span className="text-sm text-gray-300">ユーザー名</span>
        <input
          value={user}
          onChange={(e) => setUser(e.target.value)}
          autoComplete="username"
          autoCapitalize="none"
          className="mt-1 w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 text-white"
          required
        />
      </label>
      <label className="block">
        <span className="text-sm text-gray-300">パスワード</span>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
          className="mt-1 w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 text-white"
          required
        />
      </label>
      {error && <p className="text-sm text-red-400">{error}</p>}
      <button
        type="submit"
        disabled={busy}
        className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 rounded py-2 font-bold"
      >
        {busy ? 'ログイン中...' : 'ログイン'}
      </button>
      <p className="text-xs text-gray-500">一度ログインすると、この端末では90日間ログインしたままになります。</p>
    </form>
  );
}

export default function AdminLoginPage() {
  return (
    <main className="min-h-screen bg-gray-900 text-white flex items-center justify-center p-4">
      <Suspense>
        <LoginForm />
      </Suspense>
    </main>
  );
}
