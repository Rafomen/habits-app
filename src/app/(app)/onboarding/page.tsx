'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface Task {
  title: string;
  timeStart: string;
  timeEnd: string;
  isAllDay: boolean;
  rewardAmount: number;
  penaltyAmount: number;
  appliesWeekdays: boolean;
  appliesWeekends: boolean;
}

export default function OnboardingPage() {
  const [step, setStep] = useState(1);
  const [wakeTime, setWakeTime] = useState('07:00');
  const [sleepTime, setSleepTime] = useState('23:00');
  const [timezone, setTimezone] = useState(Intl.DateTimeFormat().resolvedOptions().timeZone);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [goalAmount, setGoalAmount] = useState(1000000);
  const [applyToWeekdays, setApplyToWeekdays] = useState(true);
  const [applyToWeekends, setApplyToWeekends] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [startDate, setStartDate] = useState(() => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow.toISOString().split('T')[0];
  });
  const router = useRouter();

  // Step 2: task form (no prices)
  const [taskTitle, setTaskTitle] = useState('');
  const [taskTimeStart, setTaskTimeStart] = useState('');
  const [taskTimeEnd, setTaskTimeEnd] = useState('');
  const [taskIsAllDay, setTaskIsAllDay] = useState(false);

  const inputClass = 'w-full px-3 py-2 bg-gray-100 border border-gray-300 rounded-lg focus:outline-none focus:border-emerald-500 text-gray-900';

  const addTask = () => {
    if (!taskTitle) return setError('Введите название задачи');
    if (!taskIsAllDay && (!taskTimeStart || !taskTimeEnd)) return setError('Укажите время');

    if (!taskIsAllDay) {
      const newStart = timeToMinutes(taskTimeStart);
      const newEnd = timeToMinutes(taskTimeEnd);
      if (newEnd <= newStart) return setError('Конец должен быть позже начала');

      for (const t of tasks) {
        if (t.isAllDay) continue;
        const eStart = timeToMinutes(t.timeStart);
        const eEnd = timeToMinutes(t.timeEnd);
        if (newStart < eEnd && newEnd > eStart) {
          return setError(`Время пересекается с "${t.title}" (${t.timeStart}–${t.timeEnd})`);
        }
      }
    }

    const evenSplit = tasks.length > 0 ? Math.floor(10000 / (tasks.length + 1)) : 10000;

    setTasks([...tasks, {
      title: taskTitle,
      timeStart: taskIsAllDay ? '' : taskTimeStart,
      timeEnd: taskIsAllDay ? '' : taskTimeEnd,
      isAllDay: taskIsAllDay,
      rewardAmount: evenSplit,
      penaltyAmount: Math.round(evenSplit * 0.7),
      appliesWeekdays: applyToWeekdays,
      appliesWeekends: applyToWeekends,
    }]);

    // Rebalance rewards to sum = 10000
    rebalanceRewards([...tasks, {
      title: taskTitle,
      timeStart: taskIsAllDay ? '' : taskTimeStart,
      timeEnd: taskIsAllDay ? '' : taskTimeEnd,
      isAllDay: taskIsAllDay,
      rewardAmount: evenSplit,
      penaltyAmount: Math.round(evenSplit * 0.7),
      appliesWeekdays: applyToWeekdays,
      appliesWeekends: applyToWeekends,
    }]);

    setTaskTitle('');
    setTaskTimeStart('');
    setTaskTimeEnd('');
    setError('');
  };

  const rebalanceRewards = (taskList: Task[]) => {
    const count = taskList.length;
    if (count === 0) return;
    const base = Math.floor(10000 / count);
    const remainder = 10000 - base * count;
    const updated = taskList.map((t, i) => ({
      ...t,
      rewardAmount: base + (i < remainder ? 1 : 0),
      penaltyAmount: Math.round((base + (i < remainder ? 1 : 0)) * 0.7),
    }));
    setTasks(updated);
  };

  const removeTask = (index: number) => {
    const updated = tasks.filter((_, i) => i !== index);
    if (updated.length > 0) rebalanceRewards(updated);
    else setTasks([]);
  };

  const updateTaskValue = (index: number, field: 'rewardAmount' | 'penaltyAmount', value: number) => {
    const updated = [...tasks];
    updated[index] = { ...updated[index], [field]: value };
    setTasks(updated);
  };

  const totalReward = tasks.reduce((sum, t) => sum + t.rewardAmount, 0);
  const daysToGoal = totalReward > 0 ? Math.ceil(goalAmount / totalReward) : '?';

  const handleFinish = async () => {
    setLoading(true);
    setError('');

    try {
      const onboardRes = await fetch('/api/onboarding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ wakeTime, sleepTime, timezone, goalAmount, startDate }),
      });
      if (!onboardRes.ok) throw new Error('Ошибка сохранения настроек');

      for (const task of tasks) {
        const res = await fetch('/api/tasks', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: task.title,
            timeStart: task.isAllDay ? null : task.timeStart,
            timeEnd: task.isAllDay ? null : task.timeEnd,
            rewardAmount: task.rewardAmount,
            penaltyAmount: task.penaltyAmount,
            appliesWeekdays: task.appliesWeekdays,
            appliesWeekends: task.appliesWeekends,
          }),
        });
        if (!res.ok) throw new Error('Ошибка сохранения задач');
      }

      router.push('/dashboard');
    } catch (err: any) {
      setError(err.message || 'Ошибка');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex-1 flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-lg">
        {/* Progress */}
        <div className="flex gap-2 mb-8">
          {[1, 2, 3, 4, 5, 6].map(s => (
            <div key={s} className={`h-1 flex-1 rounded-full ${s <= step ? 'bg-emerald-500' : 'bg-blue-100'}`} />
          ))}
        </div>

        {/* Step 1: Time */}
        {step === 1 && (
          <div>
            <h2 className="text-xl font-bold mb-6">Когда ты просыпаешься и ложишься спать?</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-gray-500 mb-1">Пробуждение</label>
                <input type="time" value={wakeTime} onChange={e => setWakeTime(e.target.value)} className={inputClass} />
              </div>
              <div>
                <label className="block text-sm text-gray-500 mb-1">Отбой</label>
                <input type="time" value={sleepTime} onChange={e => setSleepTime(e.target.value)} className={inputClass} />
              </div>
              <button onClick={() => setStep(2)} className="w-full py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-medium transition-colors mt-4">
                Далее
              </button>
            </div>
          </div>
        )}

        {/* Step 2: Add tasks (no prices) */}
        {step === 2 && (
          <div>
            <h2 className="text-xl font-bold mb-2">Создай план дня</h2>
            <p className="text-sm text-gray-500 mb-4">
              Добавь все задачи на день. Цены зададим на следующем шаге.
            </p>

            {/* Task list */}
            <div className="space-y-2 mb-4 max-h-52 overflow-y-auto">
              {tasks.map((t, i) => (
                <div key={i} className="flex items-center justify-between bg-white p-3 rounded-lg shadow-sm">
                  <div>
                    <span className="font-medium text-gray-900">{t.title}</span>
                    <span className="text-xs text-gray-400 ml-2">
                      {t.isAllDay ? 'весь день' : `${t.timeStart}–${t.timeEnd}`}
                    </span>
                  </div>
                  <button onClick={() => removeTask(i)} className="text-gray-400 hover:text-red-500 text-lg ml-2">✕</button>
                </div>
              ))}
            </div>

            {/* Add task form */}
            <div className="bg-white p-4 rounded-lg shadow-sm space-y-3">
              <input
                type="text"
                placeholder="Название задачи (например, Холодный душ)"
                value={taskTitle}
                onChange={e => setTaskTitle(e.target.value)}
                className={inputClass}
              />

              <label className="flex items-center gap-2 text-sm text-gray-500">
                <input type="checkbox" checked={taskIsAllDay} onChange={e => setTaskIsAllDay(e.target.checked)} className="rounded" />
                Задача на весь день (не привязана ко времени)
              </label>

              {!taskIsAllDay && (
                <div className="flex gap-2">
                  <input type="time" value={taskTimeStart} onChange={e => setTaskTimeStart(e.target.value)} className={`flex-1 ${inputClass}`} />
                  <input type="time" value={taskTimeEnd} onChange={e => setTaskTimeEnd(e.target.value)} className={`flex-1 ${inputClass}`} />
                </div>
              )}

              <label className="flex items-center gap-2 text-sm text-gray-500">
                <input type="checkbox" checked={applyToWeekdays} onChange={e => setApplyToWeekdays(e.target.checked)} className="rounded" />
                Будни (Пн–Пт)
              </label>
              <label className="flex items-center gap-2 text-sm text-gray-500">
                <input type="checkbox" checked={applyToWeekends} onChange={e => setApplyToWeekends(e.target.checked)} className="rounded" />
                Выходные (Сб–Вс)
              </label>

              {error && <p className="text-red-500 text-sm">{error}</p>}

              <button
                onClick={addTask}
                className={`w-full py-2 rounded-lg text-sm font-medium transition-colors ${
                  taskTitle
                    ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                    : 'bg-blue-100 text-gray-500'
                }`}
              >
                + Добавить задачу
              </button>
            </div>

            <div className="flex gap-2 mt-4">
              <button onClick={() => setStep(1)} className="flex-1 py-2 bg-gray-200 hover:bg-gray-300 rounded-lg transition-colors">
                Назад
              </button>
              <button
                onClick={() => { setError(''); setStep(3); }}
                disabled={tasks.length === 0}
                className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-lg font-medium transition-colors"
              >
                Все задачи добавлены, оценить стоимость
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Pricing */}
        {step === 3 && (
          <div>
            <h2 className="text-xl font-bold mb-2">Оцени каждую задачу</h2>
            <p className="text-sm text-gray-500 mb-2">
              Общая сумма наград за день должна быть <span className="font-bold text-emerald-600">$10,000</span>.
            </p>
            <div className={`p-3 rounded-lg mb-4 text-sm font-medium ${
              totalReward === 10000 ? 'bg-emerald-100 text-emerald-700' :
              totalReward < 10000 ? 'bg-yellow-100 text-yellow-700' :
              'bg-red-100 text-red-700'
            }`}>
              Итого: ${totalReward.toLocaleString()} из $10,000
              {totalReward < 10000 && ` (ещё $${(10000 - totalReward).toLocaleString()})`}
              {totalReward > 10000 && ` (перебор на $${(totalReward - 10000).toLocaleString()})`}
              {totalReward === 10000 && ' — идеально!'}
            </div>

            <div className="space-y-3 max-h-72 overflow-y-auto">
              {tasks.map((t, i) => (
                <div key={i} className="bg-white p-3 rounded-lg shadow-sm">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium text-gray-900">{t.title}</span>
                    <span className="text-xs text-gray-400">
                      {t.isAllDay ? 'весь день' : `${t.timeStart}–${t.timeEnd}`}
                    </span>
                  </div>
                  <div className="flex gap-2">
                    <div className="flex-1">
                      <label className="block text-xs text-gray-500 mb-1">Награда $</label>
                      <input
                        type="number"
                        value={t.rewardAmount}
                        onChange={e => updateTaskValue(i, 'rewardAmount', Number(e.target.value))}
                        className={inputClass}
                        min={0}
                      />
                    </div>
                    <div className="flex-1">
                      <label className="block text-xs text-gray-500 mb-1">Штраф $</label>
                      <input
                        type="number"
                        value={t.penaltyAmount}
                        onChange={e => updateTaskValue(i, 'penaltyAmount', Number(e.target.value))}
                        className={inputClass}
                        min={0}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex gap-2 mt-4">
              <button onClick={() => setStep(2)} className="flex-1 py-2 bg-gray-200 hover:bg-gray-300 rounded-lg transition-colors">
                Назад
              </button>
              <button
                onClick={() => setStep(4)}
                disabled={totalReward !== 10000}
                className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-lg font-medium transition-colors"
              >
                Далее
              </button>
            </div>
          </div>
        )}

        {/* Step 4: Weekday/Weekend */}
        {step === 4 && (
          <div>
            <h2 className="text-xl font-bold mb-6">Применить этот план?</h2>
            <div className="space-y-4">
              <p className="text-gray-500">
                Ты создал план с {tasks.length} задачами на сумму ${totalReward.toLocaleString()}.
              </p>

              <div className="bg-white p-4 rounded-lg shadow-sm">
                <p className="text-sm text-gray-500 mb-2">
                  Награда за день: <span className="text-emerald-600 font-bold">${totalReward.toLocaleString()}</span>
                </p>
                <p className="text-sm text-gray-500">
                  Применяется: {applyToWeekdays && applyToWeekends ? 'каждый день' : applyToWeekdays ? 'будни (Пн–Пт)' : applyToWeekends ? 'выходные (Сб–Вс)' : 'не выбрано'}
                </p>
              </div>

              <div className="flex gap-2 mt-4">
                <button onClick={() => setStep(3)} className="flex-1 py-2 bg-gray-200 hover:bg-gray-300 rounded-lg transition-colors">Назад</button>
                <button onClick={() => setStep(5)} className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-medium transition-colors">Далее</button>
              </div>
            </div>
          </div>
        )}

        {/* Step 5: Start date */}
        {step === 5 && (() => {
          const today = new Date();
          const tomorrow = new Date(); tomorrow.setDate(today.getDate() + 1);
          const dayAfter = new Date(); dayAfter.setDate(today.getDate() + 2);
          const dayNames = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];
          const monthNames = ['янв', 'фев', 'мар', 'апр', 'мая', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];

          const options = [
            { date: tomorrow.toISOString().split('T')[0], label: 'Завтра', sub: `${dayNames[tomorrow.getDay()]}, ${tomorrow.getDate()} ${monthNames[tomorrow.getMonth()]}` },
            { date: dayAfter.toISOString().split('T')[0], label: 'Послезавтра', sub: `${dayNames[dayAfter.getDay()]}, ${dayAfter.getDate()} ${monthNames[dayAfter.getMonth()]}` },
          ];

          const nextMonday = new Date(today);
          nextMonday.setDate(today.getDate() + ((1 - today.getDay() + 7) % 7 || 7));
          const mondayStr = nextMonday.toISOString().split('T')[0];
          if (!options.find(o => o.date === mondayStr)) {
            options.push({ date: mondayStr, label: 'Следующий понедельник', sub: `${nextMonday.getDate()} ${monthNames[nextMonday.getMonth()]}` });
          }

          return (
            <div>
              <h2 className="text-xl font-bold mb-2">Когда начинаем?</h2>
              <p className="text-sm text-gray-500 mb-6">
                Сейчас {dayNames[today.getDay()]}, {today.getDate()} {monthNames[today.getMonth()]} {today.getHours()}:{String(today.getMinutes()).padStart(2, '0')}
              </p>

              <div className="space-y-3">
                {options.map(opt => (
                  <button
                    key={opt.date}
                    onClick={() => setStartDate(opt.date)}
                    className={`w-full p-4 rounded-lg text-left transition-colors ${
                      startDate === opt.date
                        ? 'bg-emerald-100 border-2 border-emerald-500'
                        : 'bg-white hover:bg-blue-50 border border-gray-300'
                    }`}
                  >
                    <p className="font-medium text-gray-900">{opt.label}</p>
                    <p className="text-sm text-gray-500">{opt.sub}</p>
                  </button>
                ))}
                <div>
                  <label className="block text-sm text-gray-500 mb-1">Или выбери дату:</label>
                  <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} min={tomorrow.toISOString().split('T')[0]} className={inputClass} />
                </div>
              </div>

              <div className="flex gap-2 mt-6">
                <button onClick={() => setStep(4)} className="flex-1 py-2 bg-gray-200 hover:bg-gray-300 rounded-lg transition-colors">Назад</button>
                <button onClick={() => setStep(6)} className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-medium transition-colors">Далее</button>
              </div>
            </div>
          );
        })()}

        {/* Step 6: Goal */}
        {step === 6 && (
          <div>
            <h2 className="text-xl font-bold mb-6">Поставь цель</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-gray-500 mb-1">Цель ($)</label>
                <input type="number" value={goalAmount} onChange={e => setGoalAmount(Number(e.target.value))} className={inputClass} min={1000} />
              </div>

              <div className="bg-white p-4 rounded-lg shadow-sm">
                <p className="text-sm text-gray-500">
                  При заработке ${totalReward.toLocaleString()} в день тебе потребуется:
                </p>
                <p className="text-2xl font-bold text-emerald-600 mt-1">
                  {daysToGoal} дней без ошибок
                </p>
                <p className="text-sm text-gray-500 mt-1">чтобы заработать ${goalAmount.toLocaleString()}</p>
              </div>

              {error && <p className="text-red-500 text-sm">{error}</p>}

              <div className="flex gap-2 mt-4">
                <button onClick={() => setStep(5)} className="flex-1 py-2 bg-gray-200 hover:bg-gray-300 rounded-lg transition-colors">Назад</button>
                <button onClick={handleFinish} disabled={loading} className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-lg font-medium transition-colors">
                  {loading ? 'Сохраняю...' : 'Начать!'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function timeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}
