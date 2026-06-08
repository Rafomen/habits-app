'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';

function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    const t = searchParams.get('token');
    if (!t) {
      setError('Отсутствует токен сброса пароля. Пожалуйста, запросите новую ссылку.');
    } else {
      setToken(t);
    }
  }, [searchParams]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (password !== confirmPassword) {
      setError('Пароли не совпадают');
      return;
    }

    if (password.length < 6) {
      setError('Пароль должен быть не менее 6 символов');
      return;
    }

    if (!token) {
      setError('Отсутствует токен сброса пароля');
      return;
    }

    setLoading(true);

    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      });
      const data = await res.json() as any;

      if (!res.ok) {
        setError(data.error);
        return;
      }

      setSuccess(true);
    } catch {
      setError('Ошибка соединения');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex-1 flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <h1 className="text-2xl font-bold text-center mb-8">Новый пароль</h1>

        {success ? (
          <div className="space-y-4">
            <div className="bg-emerald-900/30 border border-emerald-700 rounded-lg p-4">
              <p className="text-emerald-300 text-sm">
                Пароль успешно изменён. Теперь вы можете войти с новым паролем.
              </p>
            </div>
            <p className="text-center text-sm text-gray-400">
              <a href="/login" className="text-emerald-400 hover:underline">
                Войти
              </a>
            </p>
          </div>
        ) : (
          <>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm text-gray-400 mb-1">Новый пароль</label>
                <input
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-100 border border-gray-300 rounded-lg focus:outline-none focus:border-emerald-500 text-gray-900"
                  required
                  minLength={6}
                />
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-1">Подтвердите пароль</label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-100 border border-gray-300 rounded-lg focus:outline-none focus:border-emerald-500 text-gray-900"
                  required
                  minLength={6}
                />
              </div>

              {error && <p className="text-red-400 text-sm">{error}</p>}

              <button
                type="submit"
                disabled={loading || !token}
                className="w-full py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 rounded-lg font-medium transition-colors"
              >
                {loading ? 'Сохраняю...' : 'Сменить пароль'}
              </button>
            </form>

            <p className="text-center text-sm text-gray-400 mt-6">
              <a href="/login" className="text-emerald-400 hover:underline">
                Вернуться к входу
              </a>
            </p>
          </>
        )}
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={
      <div className="flex-1 flex items-center justify-center">
        <p className="text-gray-400">Загрузка...</p>
      </div>
    }>
      <ResetPasswordForm />
    </Suspense>
  );
}
