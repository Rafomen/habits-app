'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function SettingsPage() {
  const [user, setUser] = useState<any>(null);
  const [wakeTime, setWakeTime] = useState('');
  const [sleepTime, setSleepTime] = useState('');
  const [goalAmount, setGoalAmount] = useState(1000000);
  const [baseRewardMinutes, setBaseRewardMinutes] = useState(60);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const router = useRouter();

  useEffect(() => {
    loadUser();
  }, []);

  const loadUser = async () => {
    try {
      const res = await fetch('/api/auth/me');
      if (!res.ok) { router.push('/login'); return; }
      const data = await res.json() as any;
      setUser(data.user);
      setWakeTime(data.user.wakeTime || '07:00');
      setSleepTime(data.user.sleepTime || '23:00');
      setGoalAmount(data.user.goalAmount);
      setBaseRewardMinutes(data.user.baseRewardMinutes);
    } catch {
      router.push('/login');
    }
  };

  const save = async () => {
    setSaving(true);
    try {
      await fetch('/api/onboarding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ wakeTime, sleepTime, goalAmount }),
      });

      await fetch('/api/auth/me');
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch {}
    setSaving(false);
  };

  const logout = async () => {
    document.cookie = 'token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
    router.push('/login');
  };

  if (!user) {
    return <div className="flex-1 flex items-center justify-center"><p className="text-gray-400">Загрузка...</p></div>;
  }

  return (
    <div className="flex-1 px-4 py-6 max-w-lg mx-auto w-full pb-20">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-xl font-bold">Настройки</h1>
        <button onClick={logout} className="text-red-400 hover:text-red-300 text-sm">Выйти</button>
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-sm text-gray-400 mb-1">Пробуждение</label>
          <input type="time" value={wakeTime} onChange={e => setWakeTime(e.target.value)}
            className="w-full px-3 py-2 bg-gray-100 border border-gray-300 rounded-lg focus:outline-none focus:border-emerald-500 text-gray-900" />
        </div>

        <div>
          <label className="block text-sm text-gray-400 mb-1">Отбой</label>
          <input type="time" value={sleepTime} onChange={e => setSleepTime(e.target.value)}
            className="w-full px-3 py-2 bg-gray-100 border border-gray-300 rounded-lg focus:outline-none focus:border-emerald-500 text-gray-900" />
        </div>

        <div>
          <label className="block text-sm text-gray-400 mb-1">Цель ($)</label>
          <input type="number" value={goalAmount} onChange={e => setGoalAmount(Number(e.target.value))}
            className="w-full px-3 py-2 bg-gray-100 border border-gray-300 rounded-lg focus:outline-none focus:border-emerald-500 text-gray-900" />
        </div>

        <div className="bg-white rounded-lg p-3">
          <p className="text-sm text-gray-400">Текущий баланс</p>
          <p className="text-xl font-bold">${Math.round(user.balance).toLocaleString()}</p>
        </div>

        <button
          onClick={save}
          disabled={saving}
          className="w-full py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 rounded-lg font-medium transition-colors"
        >
          {saving ? 'Сохраняю...' : saved ? 'Сохранено!' : 'Сохранить'}
        </button>
      </div>

      {/* Nav */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-blue-100">
        <div className="max-w-lg mx-auto flex">
          <button onClick={() => router.push('/dashboard')} className="flex-1 py-3 text-center text-gray-500 text-sm hover:text-gray-700">Сегодня</button>
          <button onClick={() => router.push('/plan')} className="flex-1 py-3 text-center text-gray-500 text-sm hover:text-gray-700">План</button>
          <button onClick={() => router.push('/reports')} className="flex-1 py-3 text-center text-gray-500 text-sm hover:text-gray-700">Отчёты</button>
          <button onClick={() => router.push('/review')} className="flex-1 py-3 text-center text-gray-500 text-sm hover:text-gray-700">Утро</button>
        </div>
      </div>
    </div>
  );
}
