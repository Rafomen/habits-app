'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

interface Task {
  id: string;
  title: string;
  timeStart: string | null;
  timeEnd: string | null;
  rewardAmount: number;
  penaltyAmount: number;
  appliesWeekdays: boolean;
  appliesWeekends: boolean;
  isBreak: boolean;
  isActive: boolean;
}

export default function PlanPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // New task form
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [timeStart, setTimeStart] = useState('');
  const [timeEnd, setTimeEnd] = useState('');
  const [isAllDay, setIsAllDay] = useState(false);
  const [reward, setReward] = useState(0);
  const [penalty, setPenalty] = useState(0);
  const [weekdays, setWeekdays] = useState(true);
  const [weekends, setWeekends] = useState(false);
  const [saving, setSaving] = useState(false);

  const router = useRouter();

  useEffect(() => {
    loadTasks();
  }, []);

  const loadTasks = async () => {
    try {
      const res = await fetch('/api/tasks');
      if (!res.ok) { router.push('/login'); return; }
      const data = await res.json() as any;
      setTasks(data.tasks);
    } catch {
      router.push('/login');
    } finally {
      setLoading(false);
    }
  };

  const totalReward = tasks.reduce((s, t) => s + t.rewardAmount, 0);
  const diff = 10000 - totalReward;

  const resetForm = () => {
    setTitle(''); setTimeStart(''); setTimeEnd('');
    setIsAllDay(false); setReward(0); setPenalty(0);
    setWeekdays(true); setWeekends(false);
    setEditId(null); setShowForm(false); setError('');
  };

  const editTask = (task: Task) => {
    setTitle(task.title);
    setTimeStart(task.timeStart || '');
    setTimeEnd(task.timeEnd || '');
    setIsAllDay(!task.timeStart);
    setReward(task.rewardAmount);
    setPenalty(task.penaltyAmount);
    setWeekdays(task.appliesWeekdays);
    setWeekends(task.appliesWeekends);
    setEditId(task.id);
    setShowForm(true);
    setError('');
  };

  const saveTask = async () => {
    setSaving(true);
    setError('');

    try {
      const body = {
        title,
        timeStart: isAllDay ? null : timeStart,
        timeEnd: isAllDay ? null : timeEnd,
        rewardAmount: reward,
        penaltyAmount: penalty,
        appliesWeekdays: weekdays,
        appliesWeekends: weekends,
      };

      let res;
      if (editId) {
        res = await fetch('/api/tasks', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: editId, ...body }),
        });
      } else {
        res = await fetch('/api/tasks', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
      }

      if (!res.ok) {
        const data = await res.json() as any;
        setError(data.error);
        return;
      }

      resetForm();
      loadTasks();
    } catch {
      setError('Ошибка сохранения');
    } finally {
      setSaving(false);
    }
  };

  const deleteTask = async (id: string) => {
    if (!confirm('Удалить задачу?')) return;
    try {
      await fetch(`/api/tasks?id=${id}`, { method: 'DELETE' });
      loadTasks();
    } catch {}
  };

  if (loading) {
    return <div className="flex-1 flex items-center justify-center"><p className="text-gray-400">Загрузка...</p></div>;
  }

  return (
    <div className="flex-1 px-4 py-6 max-w-lg mx-auto w-full pb-20">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-xl font-bold">План дня</h1>
        <button
          onClick={() => { resetForm(); setShowForm(true); }}
          className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 rounded-lg text-sm font-medium transition-colors"
        >
          + Добавить
        </button>
      </div>

      {/* Total indicator */}
      <div className={`rounded-lg p-3 mb-4 ${diff === 0 ? 'bg-emerald-900/30 border border-emerald-700/50' : diff > 0 ? 'bg-yellow-900/30 border border-yellow-700/50' : 'bg-red-900/30 border border-red-700/50'}`}>
        <div className="flex justify-between items-center">
          <span className="text-sm text-gray-400">Итого наград за день:</span>
          <span className="font-bold">${totalReward.toLocaleString()}</span>
        </div>
        <p className="text-xs mt-1">
          {diff === 0 ? <span className="text-emerald-400">Ровно $10,000 — идеально!</span> :
           diff > 0 ? <span className="text-yellow-400">Не хватает ${diff.toLocaleString()}</span> :
           <span className="text-red-400">Перебор на ${Math.abs(diff).toLocaleString()}</span>}
        </p>
      </div>

      {/* Task list */}
      <div className="space-y-2 mb-4">
        {tasks.map(task => (
          <div key={task.id} className="bg-white rounded-lg p-3 flex items-center justify-between">
            <div className="flex-1 min-w-0">
              <p className="font-medium">{task.title}</p>
              <div className="flex gap-2 text-xs mt-1">
                {!task.timeStart && <span className="text-gray-500">весь день</span>}
                {task.timeStart && <span className="text-gray-500">{task.timeStart}–{task.timeEnd}</span>}
                <span className="text-emerald-500">+${task.rewardAmount}</span>
                <span className="text-red-500">−${task.penaltyAmount}</span>
                {task.appliesWeekdays && <span className="text-gray-500">Пн-Пт</span>}
                {task.appliesWeekends && <span className="text-gray-500">Сб-Вс</span>}
              </div>
            </div>
            <div className="flex gap-2 ml-2">
              <button onClick={() => editTask(task)} className="text-gray-400 hover:text-gray-700 text-sm">✎</button>
              <button onClick={() => deleteTask(task.id)} className="text-gray-400 hover:text-red-400 text-sm">✕</button>
            </div>
          </div>
        ))}
        {tasks.length === 0 && (
          <p className="text-center text-gray-500 py-8">Нет задач. Добавь первую!</p>
        )}
      </div>

      {/* Add/Edit form */}
      {showForm && (
        <div className="bg-white rounded-xl p-4 space-y-3">
          <h3 className="font-medium">{editId ? 'Редактировать задачу' : 'Новая задача'}</h3>

          <input
            type="text"
            placeholder="Название (например, Холодный душ)"
            value={title}
            onChange={e => setTitle(e.target.value)}
            className="w-full px-3 py-2 bg-gray-100 border border-gray-300 rounded-lg focus:outline-none focus:border-emerald-500 text-gray-900"
          />

          <label className="flex items-center gap-2 text-sm text-gray-400">
            <input type="checkbox" checked={isAllDay} onChange={e => setIsAllDay(e.target.checked)} className="rounded border-gray-600" />
            Задача на весь день
          </label>

          {!isAllDay && (
            <div className="flex gap-2">
              <div className="flex-1">
                <label className="block text-xs text-gray-500 mb-1">Начало</label>
                <input type="time" value={timeStart} onChange={e => setTimeStart(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-100 border border-gray-300 rounded-lg focus:outline-none focus:border-emerald-500 text-gray-900" />
              </div>
              <div className="flex-1">
                <label className="block text-xs text-gray-500 mb-1">Конец</label>
                <input type="time" value={timeEnd} onChange={e => setTimeEnd(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-100 border border-gray-300 rounded-lg focus:outline-none focus:border-emerald-500 text-gray-900" />
              </div>
            </div>
          )}

          <div className="flex gap-2">
            <div className="flex-1">
              <label className="block text-xs text-gray-500 mb-1">Награда $</label>
              <input type="number" value={reward} onChange={e => setReward(Number(e.target.value))} min={0}
                className="w-full px-3 py-2 bg-gray-100 border border-gray-300 rounded-lg focus:outline-none focus:border-emerald-500 text-gray-900" />
            </div>
            <div className="flex-1">
              <label className="block text-xs text-gray-500 mb-1">Штраф $</label>
              <input type="number" value={penalty} onChange={e => setPenalty(Number(e.target.value))} min={0}
                className="w-full px-3 py-2 bg-gray-100 border border-gray-300 rounded-lg focus:outline-none focus:border-emerald-500 text-gray-900" />
            </div>
          </div>

          <div className="flex gap-4">
            <label className="flex items-center gap-2 text-sm text-gray-400">
              <input type="checkbox" checked={weekdays} onChange={e => setWeekdays(e.target.checked)} className="rounded border-gray-600" />
              Будни
            </label>
            <label className="flex items-center gap-2 text-sm text-gray-400">
              <input type="checkbox" checked={weekends} onChange={e => setWeekends(e.target.checked)} className="rounded border-gray-600" />
              Выходные
            </label>
          </div>

          {error && <p className="text-red-400 text-sm">{error}</p>}

          <div className="flex gap-2">
            <button onClick={resetForm} className="flex-1 py-2 bg-gray-200 hover:bg-gray-300 rounded-lg transition-colors">
              Отмена
            </button>
            <button onClick={saveTask} disabled={saving || !title}
              className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 rounded-lg font-medium transition-colors">
              {saving ? 'Сохраняю...' : 'Сохранить'}
            </button>
          </div>
        </div>
      )}

      {/* Nav */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-blue-100">
        <div className="max-w-lg mx-auto flex">
          <button onClick={() => router.push('/dashboard')} className="flex-1 py-3 text-center text-gray-500 text-sm hover:text-gray-700">Сегодня</button>
          <button onClick={() => router.push('/plan')} className="flex-1 py-3 text-center text-emerald-400 text-sm font-medium">План</button>
          <button onClick={() => router.push('/reports')} className="flex-1 py-3 text-center text-gray-500 text-sm hover:text-gray-700">Отчёты</button>
          <button onClick={() => router.push('/review')} className="flex-1 py-3 text-center text-gray-500 text-sm hover:text-gray-700">Утро</button>
        </div>
      </div>
    </div>
  );
}
