'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';

interface User {
  id: string;
  name: string;
  balance: number;
  goalAmount: number;
  onboarded: boolean;
  baseRewardMinutes: number;
  carriedDebt: number;
  startDate: string | null;
}

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
}

interface Completion {
  taskId: string;
  status: string;
}

interface Stats {
  streak: number;
  avgCompletion: number;
  totalDays: number;
}

export default function DashboardPage() {
  const [user, setUser] = useState<User | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [completions, setCompletions] = useState<Map<string, string>>(new Map());
  const [stats, setStats] = useState<Stats | null>(null);
  const [currentDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [loading, setLoading] = useState(true);

  // Sequential overdue queue
  const [overdueQueue, setOverdueQueue] = useState<Task[]>([]);
  const [currentOverdue, setCurrentOverdue] = useState<Task | null>(null);
  const [notDoneComment, setNotDoneComment] = useState('');
  const [showCommentField, setShowCommentField] = useState(false);
  const [dayCompleted, setDayCompleted] = useState(false);
  const [dayResult, setDayResult] = useState<any>(null);
  const [completingDay, setCompletingDay] = useState(false);

  const router = useRouter();
  const audioCtxRef = useRef<AudioContext | null>(null);
  const lastSoundTimeRef = useRef<number>(0);
  const checkedEndTimesRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    loadData();
  }, []);

  // Sound notifications
  useEffect(() => {
    if (!tasks.length) return;

    const interval = setInterval(() => {
      const now = new Date();
      const currentMinutes = now.getHours() * 60 + now.getMinutes();
      const currentSeconds = now.getSeconds();

      // Only check at the start of each minute
      if (currentSeconds > 5) return;

      const todayTasks = getTasksForToday(tasks);

      for (const task of todayTasks) {
        if (!task.timeEnd || !task.timeStart) continue;

        const endMinutes = timeToMinutes(task.timeEnd);
        const key = `${task.id}-${currentDate}-${endMinutes}`;

        // Task just ended (within this minute)
        if (currentMinutes === endMinutes && !checkedEndTimesRef.current.has(key)) {
          checkedEndTimesRef.current.add(key);
          const status = completions.get(task.id);
          if (!status) {
            // Task not yet marked - play sound
            playSound(task.isBreak ? 'break_end' : 'task_end');
          }
        }
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [tasks, completions, currentDate]);

  const playSound = useCallback((type: 'task_end' | 'break_end') => {
    const now = Date.now();
    // Debounce: don't play more than once per 30 seconds
    if (now - lastSoundTimeRef.current < 30000) return;
    lastSoundTimeRef.current = now;

    try {
      if (!audioCtxRef.current) {
        audioCtxRef.current = new AudioContext();
      }
      const ctx = audioCtxRef.current;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.connect(gain);
      gain.connect(ctx.destination);

      if (type === 'task_end') {
        // Short pleasant beep
        osc.frequency.value = 880;
        osc.type = 'sine';
        gain.gain.value = 0.15;
        osc.start();
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
        osc.stop(ctx.currentTime + 0.3);
      } else {
        // Break end - two beeps
        osc.frequency.value = 660;
        osc.type = 'sine';
        gain.gain.value = 0.15;
        osc.start();
        osc.stop(ctx.currentTime + 0.15);
        // Second beep
        setTimeout(() => {
          const osc2 = ctx.createOscillator();
          const gain2 = ctx.createGain();
          osc2.connect(gain2);
          gain2.connect(ctx.destination);
          osc2.frequency.value = 880;
          osc2.type = 'sine';
          gain2.gain.value = 0.15;
          osc2.start();
          gain2.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
          osc2.stop(ctx.currentTime + 0.3);
        }, 200);
      }
    } catch {}
  }, []);

  const loadData = async () => {
    try {
      const [userRes, tasksRes, compRes, statsRes] = await Promise.all([
        fetch('/api/auth/me'),
        fetch('/api/tasks'),
        fetch(`/api/completions?date=${currentDate}`),
        fetch('/api/stats'),
      ]);

      if (!userRes.ok) { router.push('/login'); return; }
      const userData = await userRes.json();
      setUser(userData.user);

      if (!userData.user.onboarded) { router.push('/onboarding'); return; }

      const tasksData = await tasksRes.json();
      setTasks(tasksData.tasks);

      const compData = await compRes.json();
      const compMap = new Map<string, string>();
      compData.completions.forEach((c: Completion) => compMap.set(c.taskId, c.status));
      setCompletions(compMap);

      if (statsRes.ok) {
        const statsData = await statsRes.json();
        setStats(statsData);
      }

      // Build overdue queue only if plan has started
      const today = new Date().toISOString().split('T')[0];
      const hasStarted = !userData.user.startDate || userData.user.startDate <= today;
      if (hasStarted) {
        buildOverdueQueue(tasksData.tasks, compMap);
      }
    } catch {
      router.push('/login');
    } finally {
      setLoading(false);
    }
  };

  const buildOverdueQueue = (taskList: Task[], compMap: Map<string, string>) => {
    const now = new Date();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    const todayTasks = getTasksForToday(taskList);

    const overdue: Task[] = [];
    for (const task of todayTasks) {
      if (task.timeStart && task.timeEnd && !compMap.has(task.id)) {
        const endMinutes = timeToMinutes(task.timeEnd);
        if (currentMinutes > endMinutes + 15) {
          overdue.push(task);
        }
      }
    }

    // Sort by time (earliest first)
    overdue.sort((a, b) => {
      const aMin = a.timeStart ? timeToMinutes(a.timeStart) : 9999;
      const bMin = b.timeStart ? timeToMinutes(b.timeStart) : 9999;
      return aMin - bMin;
    });

    if (overdue.length > 0) {
      setOverdueQueue(overdue);
      setCurrentOverdue(overdue[0]);
    }
  };

  const handleStatus = async (taskId: string, status: 'done' | 'not_done' | 'done_late', comment?: string) => {
    try {
      const res = await fetch('/api/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ taskId, date: currentDate, status, comment: comment || undefined }),
      });

      if (res.ok) {
        setCompletions(prev => new Map(prev).set(taskId, status));
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleOverdueAnswer = async (status: 'done' | 'not_done' | 'done_late') => {
    if (!currentOverdue) return;

    if (status === 'not_done') {
      setShowCommentField(true);
      return;
    }

    await handleStatus(currentOverdue.id, status);
    advanceOverdueQueue();
  };

  const handleNotDoneSubmit = async () => {
    if (!currentOverdue) return;
    await handleStatus(currentOverdue.id, 'not_done', notDoneComment);
    setNotDoneComment('');
    setShowCommentField(false);
    advanceOverdueQueue();
  };

  const advanceOverdueQueue = () => {
    const remaining = overdueQueue.slice(1);
    setOverdueQueue(remaining);
    if (remaining.length > 0) {
      setCurrentOverdue(remaining[0]);
    } else {
      setCurrentOverdue(null);
    }
  };

  const toggleTask = async (task: Task) => {
    const current = completions.get(task.id);
    if (current === 'done') {
      await handleStatus(task.id, 'not_done');
    } else {
      await handleStatus(task.id, 'done');
    }
  };

  const completeDay = async () => {
    setCompletingDay(true);
    try {
      const res = await fetch('/api/reports/complete-day', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date: currentDate }),
      });
      const data = await res.json();
      if (res.ok) {
        setDayResult(data);
        setDayCompleted(true);
      } else {
        alert(data.error);
      }
    } catch {
      alert('Ошибка');
    } finally {
      setCompletingDay(false);
    }
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="text-gray-400">Загрузка...</p>
      </div>
    );
  }

  if (!user) return null;

  const todayTasks = getTasksForToday(tasks);
  const timedTasks = todayTasks.filter(t => t.timeStart);
  const allDayTasks = todayTasks.filter(t => !t.timeStart);
  const completedCount = todayTasks.filter(t => completions.get(t.id) === 'done' || completions.get(t.id) === 'done_late').length;
  const totalReward = todayTasks.reduce((sum, t) => sum + t.rewardAmount, 0);
  const progressPercent = user.goalAmount > 0 ? Math.min(100, Math.max(0, (user.balance / user.goalAmount) * 100)) : 0;
  const now = new Date();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  const currentTask = timedTasks.find(t => {
    if (!t.timeStart || !t.timeEnd) return false;
    const start = timeToMinutes(t.timeStart);
    const end = timeToMinutes(t.timeEnd);
    return currentMinutes >= start && currentMinutes <= end;
  });

  const nextTask = timedTasks.find(t => {
    if (!t.timeStart) return false;
    return timeToMinutes(t.timeStart) > currentMinutes && !completions.has(t.id);
  });

  const allowedToday = Math.max(0, user.baseRewardMinutes - user.carriedDebt);
  const todayStr = new Date().toISOString().split('T')[0];
  const hasStarted = !user.startDate || user.startDate <= todayStr;

  // Show waiting screen if plan hasn't started yet
  if (!hasStarted && user.startDate) {
    const dayNames = ['воскресенье', 'понедельник', 'вторник', 'среду', 'четверг', 'пятницу', 'субботу'];
    const monthNames = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
    const start = new Date(user.startDate + 'T00:00:00');
    const daysLeft = Math.ceil((start.getTime() - Date.now()) / (1000 * 60 * 60 * 24));

    return (
      <div className="flex-1 px-4 py-6 max-w-lg mx-auto w-full">
        <div className="text-center py-12">
          <h1 className="text-2xl font-bold mb-4">Привет, {user.name}</h1>
          <p className="text-gray-500 mb-8">Твой план начнётся:</p>
          <div className="bg-white rounded-xl p-6 shadow-sm mb-6">
            <p className="text-lg font-bold text-emerald-600">
              в {dayNames[start.getDay()]}, {start.getDate()} {monthNames[start.getMonth()]}
            </p>
            {daysLeft > 0 && (
              <p className="text-sm text-gray-500 mt-2">через {daysLeft} {daysLeft === 1 ? 'день' : daysLeft < 5 ? 'дня' : 'дней'}</p>
            )}
          </div>
          <p className="text-sm text-gray-400">План: {tasks.length} задач, награда ${totalReward.toLocaleString()}/день</p>
          <button onClick={() => router.push('/plan')} className="mt-4 text-emerald-600 hover:underline text-sm">Редактировать план</button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 px-4 py-6 max-w-lg mx-auto w-full">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-lg font-bold">Привет, {user.name}</h1>
          <p className="text-sm text-gray-400">{formatDate(now)}</p>
        </div>
        <button onClick={() => router.push('/settings')} className="text-gray-500 hover:text-gray-700 text-sm">⚙</button>
      </div>

      {/* Balance & Progress */}
      <div className="bg-white rounded-xl p-4 mb-4 shadow-sm">
        <div className="flex justify-between items-end mb-2">
          <div>
            <p className="text-xs text-gray-500">Баланс</p>
            <p className={`text-2xl font-bold ${user.balance >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
              ${Math.round(user.balance).toLocaleString()}
            </p>
          </div>
          <p className="text-xs text-gray-500">Цель: ${user.goalAmount.toLocaleString()}</p>
        </div>
        <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
          <div className="h-full bg-emerald-500 rounded-full transition-all" style={{ width: `${progressPercent}%` }} />
        </div>
        <p className="text-xs text-gray-500 mt-1">{progressPercent.toFixed(1)}% до цели</p>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-4 gap-2 mb-4">
        <div className="bg-white rounded-lg p-3 text-center shadow-sm">
          <p className="text-lg font-bold text-orange-500">{stats?.streak || 0}</p>
          <p className="text-[10px] text-gray-500">Стрик дней</p>
        </div>
        <div className="bg-white rounded-lg p-3 text-center shadow-sm">
          <p className={`text-lg font-bold ${stats && stats.avgCompletion >= 80 ? 'text-emerald-600' : stats && stats.avgCompletion >= 50 ? 'text-yellow-600' : 'text-red-600'}`}>
            {stats?.avgCompletion || 0}%
          </p>
          <p className="text-[10px] text-gray-500">Ср. выполнение</p>
        </div>
        <div className="bg-white rounded-lg p-3 text-center shadow-sm">
          <p className="text-lg font-bold text-blue-600">{completedCount}/{todayTasks.length}</p>
          <p className="text-[10px] text-gray-500">Сегодня</p>
        </div>
        <div className="bg-white rounded-lg p-3 text-center shadow-sm">
          <p className="text-lg font-bold text-yellow-600">{allowedToday}м</p>
          <p className="text-[10px] text-gray-500">На игры</p>
        </div>
      </div>

      {/* Current/Next Task */}
      {(currentTask || nextTask) && !currentOverdue && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 mb-4">
          {currentTask && (
            <>
              <p className="text-xs text-emerald-700 font-semibold mb-1">Сейчас:</p>
              <p className="font-medium text-gray-900">{currentTask.title}</p>
              <p className="text-xs text-gray-600">
                {currentTask.timeStart}–{currentTask.timeEnd}
                {currentTask.timeEnd && (() => {
                  const remaining = timeToMinutes(currentTask.timeEnd!) - currentMinutes;
                  return remaining > 0 ? ` (${remaining} мин осталось)` : '';
                })()}
              </p>
            </>
          )}
          {!currentTask && nextTask && (
            <>
              <p className="text-xs text-gray-500 font-semibold mb-1">Далее:</p>
              <p className="font-medium text-gray-900">{nextTask.title}</p>
              <p className="text-xs text-gray-600">
                {nextTask.timeStart}–{nextTask.timeEnd}
                {nextTask.timeStart && (() => {
                  const until = timeToMinutes(nextTask.timeStart!) - currentMinutes;
                  return until > 0 ? ` (через ${until} мин)` : '';
                })()}
              </p>
            </>
          )}
        </div>
      )}

      {/* All-day Tasks — сверху */}
      {allDayTasks.length > 0 && (
        <div className="mb-4">
          <h2 className="text-sm font-semibold text-gray-600 mb-2">В течение дня</h2>
          <div className="space-y-2">
            {allDayTasks.map(task => (
              <TaskRow key={task.id} task={task} status={completions.get(task.id)} onToggle={() => toggleTask(task)} />
            ))}
          </div>
        </div>
      )}

      {/* Timed Tasks */}
      {timedTasks.length > 0 && (
        <div className="mb-4">
          <h2 className="text-sm font-semibold text-gray-600 mb-2">По расписанию</h2>
          <div className="space-y-2">
            {timedTasks.map(task => {
              const status = completions.get(task.id);
              const isOverdue = task.timeEnd && currentMinutes > timeToMinutes(task.timeEnd) + 15;
              const isLate = task.timeEnd && currentMinutes > timeToMinutes(task.timeEnd) && currentMinutes <= timeToMinutes(task.timeEnd) + 15;
              const isNow = task.timeStart && task.timeEnd && currentMinutes >= timeToMinutes(task.timeStart) && currentMinutes <= timeToMinutes(task.timeEnd);
              const inQueue = overdueQueue.some(q => q.id === task.id);

              return (
                <TaskRow
                  key={task.id}
                  task={task}
                  status={status}
                  isOverdue={!!isOverdue && !status && !inQueue}
                  isLate={!!isLate && !status}
                  isNow={!!isNow}
                  inQueue={inQueue}
                  onToggle={() => toggleTask(task)}
                />
              );
            })}
          </div>
        </div>
      )}

      {/* Sequential Overdue Modal */}
      {currentOverdue && (
        <div className="fixed inset-0 bg-gray-900/50 flex items-center justify-center z-50 px-4">
          <div className="bg-white rounded-xl p-6 w-full max-w-sm shadow-xl">
            <p className="text-xs text-gray-500 mb-1">
              Отчёт по задаче {overdueQueue.length > 1 ? `(1 из ${overdueQueue.length})` : ''}
            </p>
            <h3 className="font-bold mb-1 text-gray-900">Просрочено</h3>
            <p className="text-lg text-gray-900 mb-1">{currentOverdue.title}</p>
            {currentOverdue.timeStart && (
              <p className="text-sm text-gray-500 mb-4">
                {currentOverdue.timeStart}–{currentOverdue.timeEnd}
              </p>
            )}

            {!showCommentField ? (
              <div className="space-y-2">
                <button
                  onClick={() => handleOverdueAnswer('done')}
                  className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-medium transition-colors"
                >
                  Сделано
                </button>
                <button
                  onClick={() => handleOverdueAnswer('done_late')}
                  className="w-full py-3 bg-yellow-500 hover:bg-yellow-600 text-white rounded-lg font-medium transition-colors"
                >
                  Сделано, но с запозданием
                </button>
                <button
                  onClick={() => handleOverdueAnswer('not_done')}
                  className="w-full py-3 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition-colors"
                >
                  Не сделано
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-sm text-gray-400">Почему не выполнил?</p>
                <textarea
                  value={notDoneComment}
                  onChange={e => setNotDoneComment(e.target.value)}
                  placeholder="Не успел, забыл, не было мотивации..."
                  className="w-full px-3 py-2 bg-gray-100 border border-gray-300 rounded-lg focus:outline-none focus:border-emerald-500 resize-none h-20 text-gray-900"
                />
                <div className="flex gap-2 flex-wrap">
                  {['Не успел', 'Забыл', 'Не было мотивации', 'Лень', 'Отвлёкся'].map(reason => (
                    <button
                      key={reason}
                      onClick={() => setNotDoneComment(reason)}
                      className="px-3 py-1 bg-blue-50 hover:bg-blue-100 rounded-full text-xs transition-colors"
                    >
                      {reason}
                    </button>
                  ))}
                </div>
                <button
                  onClick={handleNotDoneSubmit}
                  disabled={!notDoneComment}
                  className="w-full py-3 bg-red-600 hover:bg-red-700 disabled:opacity-50 rounded-lg font-medium transition-colors"
                >
                  Подтвердить
                </button>
              </div>
            )}

            <p className="text-xs text-gray-500 mt-3 text-center">
              {overdueQueue.length > 1 ? `Ещё ${overdueQueue.length - 1} задач требуют отчёта` : ''}
            </p>
          </div>
        </div>
      )}

      {/* Complete Day Button */}
      {!dayCompleted && hasStarted && (
        <div className="mb-20">
          <button
            onClick={completeDay}
            disabled={completingDay}
            className="w-full py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg font-medium transition-colors"
          >
            {completingDay ? 'Завершаю...' : 'Завершить день'}
          </button>
        </div>
      )}

      {/* Day Complete Result */}
      {dayCompleted && dayResult && (
        <div className="fixed inset-0 bg-gray-900/50 flex items-center justify-center z-50 px-4">
          <div className="bg-white rounded-xl p-6 w-full max-w-sm shadow-xl">
            <h3 className="text-lg font-bold text-gray-900 mb-4">День завершён!</h3>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-gray-600">Выполнено</span>
                <span className="font-medium">{dayResult.completed}/{dayResult.total}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Заработано</span>
                <span className="text-emerald-600 font-bold">+${Math.round(dayResult.earned).toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Потеряно</span>
                <span className="text-red-600 font-bold">−${Math.round(dayResult.lost).toLocaleString()}</span>
              </div>
              <div className="border-t pt-3 flex justify-between">
                <span className="text-gray-900 font-semibold">Итого</span>
                <span className={`font-bold text-lg ${dayResult.netBalance >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                  {dayResult.netBalance >= 0 ? '+' : ''}{Math.round(dayResult.netBalance).toLocaleString()}$
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Новый баланс</span>
                <span className="text-gray-700">${Math.round(dayResult.newBalance).toLocaleString()}</span>
              </div>
            </div>
            <p className="text-xs text-gray-400 mt-4">Утром нужно будет ответить про игры и настроение</p>
            <button
              onClick={() => { setDayCompleted(false); loadData(); }}
              className="w-full mt-4 py-2 bg-gray-200 hover:bg-gray-300 rounded-lg font-medium transition-colors text-gray-700"
            >
              Ок
            </button>
          </div>
        </div>
      )}

      {/* Nav */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200">
        <div className="max-w-lg mx-auto flex">
          <button onClick={() => router.push('/dashboard')} className="flex-1 py-3 text-center text-emerald-600 text-sm font-semibold">Сегодня</button>
          <button onClick={() => router.push('/plan')} className="flex-1 py-3 text-center text-gray-500 text-sm hover:text-gray-700">План</button>
          <button onClick={() => router.push('/reports')} className="flex-1 py-3 text-center text-gray-500 text-sm hover:text-gray-700">Отчёты</button>
          <button onClick={() => router.push('/review')} className="flex-1 py-3 text-center text-gray-500 text-sm hover:text-gray-700">Утро</button>
        </div>
      </div>
    </div>
  );
}

function TaskRow({ task, status, isOverdue, isLate, isNow, inQueue, onToggle }: {
  task: Task;
  status?: string;
  isOverdue?: boolean;
  isLate?: boolean;
  isNow?: boolean;
  inQueue?: boolean;
  onToggle: () => void;
}) {
  const done = status === 'done' || status === 'done_late';

  return (
    <button
      onClick={onToggle}
      className={`w-full flex items-center gap-3 p-3 rounded-lg text-left transition-colors shadow-sm ${
        done ? 'bg-gray-50 border border-gray-200' :
        inQueue ? 'bg-orange-50 border border-orange-300' :
        isOverdue ? 'bg-red-50 border border-red-300' :
        isLate ? 'bg-yellow-50 border border-yellow-300' :
        isNow ? 'bg-emerald-50 border border-emerald-300' :
        'bg-white border border-gray-200 hover:bg-gray-50'
      }`}
    >
      <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
        done ? 'border-emerald-500 bg-emerald-500' :
        inQueue ? 'border-orange-400' :
        isOverdue ? 'border-red-400' :
        'border-gray-400'
      }`}>
        {done && <span className="text-xs text-white font-bold">✓</span>}
      </div>
      <div className="flex-1 min-w-0">
        <p className={`font-medium ${done ? 'line-through text-gray-400' : 'text-gray-900'}`}>
          {task.title}
        </p>
        <div className="flex gap-2 text-xs">
          {task.timeStart && <span className="text-gray-500">{task.timeStart}–{task.timeEnd}</span>}
          <span className="text-emerald-600">+${task.rewardAmount}</span>
          <span className="text-red-600">−${task.penaltyAmount}</span>
          {status === 'done_late' && <span className="text-yellow-600">с опозданием</span>}
          {inQueue && <span className="text-orange-600">ожидает отчёта</span>}
        </div>
      </div>
      {(isOverdue || inQueue) && <span className="text-xs text-red-500">!</span>}
    </button>
  );
}

function getTasksForToday(tasks: Task[]): Task[] {
  const day = new Date().getDay();
  const isWeekend = day === 0 || day === 6;
  return tasks.filter(t => isWeekend ? t.appliesWeekends : t.appliesWeekdays);
}

function timeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

function formatDate(date: Date): string {
  return date.toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long' });
}
