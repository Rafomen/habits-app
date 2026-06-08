'use client';

import { useState } from 'react';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await res.json() as any;

      if (!res.ok) {
        setError(data.error);
        return;
      }

      setSent(true);
    } catch {
      setError('Ошибка соединения');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex-1 flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <h1 className="text-2xl font-bold text-center mb-8">Сброс пароля</h1>

        {sent ? (
          <div className="space-y-4">
            <div className="bg-emerald-900/30 border border-emerald-700 rounded-lg p-4">
              <p className="text-emerald-300 text-sm">
                Если аккаунт с таким email существует, мы отправили письмо с инструкцией для сброса пароля.
              </p>
            </div>
            <p className="text-center text-sm text-gray-400">
              <a href="/login" className="text-emerald-400 hover:underline">
                Вернуться к входу
              </a>
            </p>
          </div>
        ) : (
          <>
            <p className="text-sm text-gray-400 mb-6">
              Введите ваш email, и мы отправим ссылку для сброса пароля.
            </p>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm text-gray-400 mb-1">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-100 border border-gray-300 rounded-lg focus:outline-none focus:border-emerald-500 text-gray-900"
                  required
                />
              </div>

              {error && <p className="text-red-400 text-sm">{error}</p>}

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 rounded-lg font-medium transition-colors"
              >
                {loading ? 'Отправляю...' : 'Отправить ссылку'}
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
