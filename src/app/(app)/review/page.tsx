'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

interface UncompletedTask {
  id: string;
  title: string;
  comment: string;
}

export default function ReviewPage() {
  const [reviewData, setReviewData] = useState<any>(null);
  const [gamesMinutes, setGamesMinutes] = useState(0);
  const [mood, setMood] = useState(5);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [result, setResult] = useState<any>(null);

  // Sequential uncompleted task comments
  const [uncompletedTasks, setUncompletedTasks] = useState<UncompletedTask[]>([]);
  const [currentUncompleted, setCurrentUncompleted] = useState<number>(0);
  const [comment, setComment] = useState('');
  const [phase, setPhase] = useState<'comments' | 'games_mood' | 'done'>('comments');

  const router = useRouter();

  useEffect(() => {
    fetchReview();
  }, []);

  const fetchReview = async () => {
    try {
      const res = await fetch('/api/reports/morning-review');
      if (!res.ok) { router.push('/login'); return; }
      const data = await res.json() as any;
      setReviewData(data);
      if (data.allowedToday) setGamesMinutes(data.allowedToday);

      // Build list of uncompleted tasks needing comments
      if (data.yesterdayStats?.needsReview) {
        // Fetch yesterday's completions to find not_done tasks
        const compRes = await fetch(`/api/completions?date=${data.yesterday}`);
        if (compRes.ok) {
          const compData = await compRes.json() as any;
          const notDone = compData.completions
            .filter((c: any) => c.status === 'not_done' && !c.comment)
            .map((c: any) => ({ id: c.taskId, title: c.taskId, comment: '' }));

          if (notDone.length > 0) {
            // Get task titles
            const tasksRes = await fetch('/api/tasks');
            if (tasksRes.ok) {
              const tasksData = await tasksRes.json() as any;
              const taskMap = new Map(tasksData.tasks.map((t: any) => [t.id, t.title]));
              notDone.forEach((nt: any) => { nt.title = taskMap.get(nt.id) || nt.id; });
            }
            setUncompletedTasks(notDone);
          } else {
            setPhase('games_mood');
          }
        } else {
          setPhase('games_mood');
        }
      } else {
        setPhase('games_mood');
      }
    } catch {
      router.push('/login');
    } finally {
      setLoading(false);
    }
  };

  const handleCommentSubmit = async () => {
    if (uncompletedTasks.length > 0 && currentUncompleted < uncompletedTasks.length) {
      const task = uncompletedTasks[currentUncompleted];
      // Save comment
      await fetch('/api/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          taskId: task.id,
          date: reviewData.yesterday,
          status: 'not_done',
          comment: comment || 'Без комментария',
        }),
      });

      setComment('');
      const next = currentUncompleted + 1;
      if (next >= uncompletedTasks.length) {
        setPhase('games_mood');
      } else {
        setCurrentUncompleted(next);
      }
    }
  };

  const handleSubmit = async () => {
    if (!reviewData) return;
    setSubmitting(true);

    try {
      const res = await fetch('/api/reports/morning-review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: reviewData.yesterday,
          gamesSocialActual: gamesMinutes,
          mood,
        }),
      });

      if (!res.ok) throw new Error('Ошибка');
      const data = await res.json() as any;
      setResult(data);
      setSubmitted(true);
    } catch {
      alert('Ошибка сохранения');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <div className="flex-1 flex items-center justify-center"><p className="text-gray-400">Загрузка...</p></div>;
  }

  if (!reviewData) return null;

  const overplay = Math.max(0, gamesMinutes - Math.max(0, reviewData.allowedToday));
  const penalty = overplay * 2;

  const Nav = () => (
    <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-blue-100">
      <div className="max-w-lg mx-auto flex">
        <button onClick={() => router.push('/dashboard')} className="flex-1 py-3 text-center text-gray-500 text-sm hover:text-gray-700">Сегодня</button>
        <button onClick={() => router.push('/plan')} className="flex-1 py-3 text-center text-gray-500 text-sm hover:text-gray-700">План</button>
        <button onClick={() => router.push('/reports')} className="flex-1 py-3 text-center text-gray-500 text-sm hover:text-gray-700">Отчёты</button>
        <button onClick={() => router.push('/review')} className="flex-1 py-3 text-center text-emerald-400 text-sm font-medium">Утро</button>
      </div>
    </div>
  );

  // If plan hasn't started yet
  if (reviewData.hasntStarted) {
    return (
      <div className="flex-1 px-4 py-6 max-w-lg mx-auto w-full pb-20">
        <div className="text-center py-12">
          <h1 className="text-xl font-bold mb-4">План ещё не начался</h1>
          <p className="text-gray-500">Отчёты появятся когда начнёшь выполнять план ({reviewData.startDate})</p>
          <button onClick={() => router.push('/dashboard')} className="mt-6 px-6 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-medium transition-colors">
            На главную
          </button>
        </div>
        <Nav />
      </div>
    );
  }

  if (submitted && result) {
    return (
      <div className="flex-1 px-4 py-6 max-w-lg mx-auto w-full pb-20">
        <h1 className="text-xl font-bold mb-6">Итог за {reviewData.yesterday}</h1>
        <div className="space-y-3">
          <div className="bg-white rounded-lg p-4">
            <p className="text-sm text-gray-400">Заработано</p>
            <p className={`text-xl font-bold ${result.netBalance >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
              {result.netBalance >= 0 ? '+' : ''}{Math.round(result.netBalance).toLocaleString()}$
            </p>
          </div>
          <div className="bg-white rounded-lg p-4">
            <p className="text-sm text-gray-400">Штраф за игры</p>
            <p className="text-xl font-bold text-red-400">{result.gamesPenaltyMinutes} мин</p>
          </div>
          <div className="bg-white rounded-lg p-4">
            <p className="text-sm text-gray-400">Перенос на сегодня</p>
            <p className="text-xl font-bold text-yellow-400">{result.newCarriedDebt} мин долга</p>
          </div>
        </div>
        <button onClick={() => router.push('/dashboard')} className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 rounded-lg font-medium mt-6 transition-colors">
          К плану на сегодня
        </button>
        <Nav />
      </div>
    );
  }

  // Phase 1: Comment on uncompleted tasks
  if (phase === 'comments' && uncompletedTasks.length > 0 && currentUncompleted < uncompletedTasks.length) {
    const task = uncompletedTasks[currentUncompleted];
    return (
      <div className="flex-1 px-4 py-6 max-w-lg mx-auto w-full pb-20">
        <h1 className="text-xl font-bold mb-2">Почему не выполнил?</h1>
        <p className="text-sm text-gray-400 mb-6">
          Задача {currentUncompleted + 1} из {uncompletedTasks.length}
        </p>

        <div className="bg-red-900/20 border border-red-800/30 rounded-xl p-4 mb-6">
          <p className="font-medium text-white">{task.title}</p>
        </div>

        <div className="space-y-3">
          <textarea
            value={comment}
            onChange={e => setComment(e.target.value)}
            placeholder="Расскажи почему не выполнил..."
            className="w-full px-3 py-2 bg-gray-100 border border-gray-300 rounded-lg focus:outline-none focus:border-emerald-500 resize-none h-20 text-gray-900"
          />
          <div className="flex gap-2 flex-wrap">
            {['Не успел', 'Забыл', 'Не было мотивации', 'Лень', 'Отвлёкся', 'Устал'].map(reason => (
              <button
                key={reason}
                onClick={() => setComment(reason)}
                className={`px-3 py-1 rounded-full text-xs transition-colors ${comment === reason ? 'bg-emerald-600 text-white' : 'bg-blue-50 hover:bg-blue-100'}`}
              >
                {reason}
              </button>
            ))}
          </div>
          <button
            onClick={handleCommentSubmit}
            disabled={!comment}
            className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 rounded-lg font-medium transition-colors"
          >
            {currentUncompleted + 1 < uncompletedTasks.length ? 'Далее' : 'К отчёту'}
          </button>
        </div>
        <Nav />
      </div>
    );
  }

  // Phase 2: Games & mood
  return (
    <div className="flex-1 px-4 py-6 max-w-lg mx-auto w-full pb-20">
      <h1 className="text-xl font-bold mb-2">Отчёт за вчера</h1>
      <p className="text-sm text-gray-400 mb-6">{reviewData.yesterday}</p>

      {reviewData.yesterdayStats && (
        <div className="bg-white rounded-xl p-4 mb-6">
          <div className="flex justify-between mb-2">
            <span className="text-sm text-gray-400">Задач выполнено</span>
            <span className="font-medium">
              {reviewData.yesterdayStats.tasksCompleted}/{reviewData.yesterdayStats.tasksTotal}
            </span>
          </div>
          {reviewData.yesterdayStats.earned > 0 && (
            <div className="flex justify-between mb-2">
              <span className="text-sm text-gray-400">Заработано</span>
              <span className="text-emerald-400">+${Math.round(reviewData.yesterdayStats.earned).toLocaleString()}</span>
            </div>
          )}
          {reviewData.yesterdayStats.lost > 0 && (
            <div className="flex justify-between">
              <span className="text-sm text-gray-400">Потеряно</span>
              <span className="text-red-400">−${Math.round(reviewData.yesterdayStats.lost).toLocaleString()}</span>
            </div>
          )}
        </div>
      )}

      <div className="mb-6">
        <h2 className="font-medium mb-3">Сколько минут ты играл / сидел в соцсетях?</h2>
        <p className="text-xs text-gray-400 mb-3">Разрешено было: {reviewData.allowedToday} мин</p>
        <div className="flex items-center gap-4">
          <input type="range" min={0} max={180} value={gamesMinutes}
            onChange={e => setGamesMinutes(Number(e.target.value))} className="flex-1 accent-emerald-500" />
          <span className="text-lg font-bold w-16 text-right">{gamesMinutes} мин</span>
        </div>
        {overplay > 0 && (
          <p className="text-red-400 text-sm mt-2">
            Перебор: {overplay} мин. Штраф: {penalty} мин перенесётся на сегодня
          </p>
        )}
      </div>

      <div className="mb-8">
        <h2 className="font-medium mb-3">Настроение перед сном?</h2>
        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-400">1</span>
          <input type="range" min={1} max={10} value={mood}
            onChange={e => setMood(Number(e.target.value))} className="flex-1 accent-emerald-500" />
          <span className="text-sm text-gray-400">10</span>
          <span className="text-2xl font-bold w-8 text-center">{mood}</span>
        </div>
      </div>

      <button onClick={handleSubmit} disabled={submitting}
        className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 rounded-lg font-medium transition-colors">
        {submitting ? 'Сохраняю...' : 'Отправить отчёт'}
      </button>
      <Nav />
    </div>
  );
}
