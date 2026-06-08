'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

interface Report {
  id: string;
  date: string;
  tasksTotal: number;
  tasksCompleted: number;
  tasksDoneLate: number;
  earned: number;
  lost: number;
  gamesSocialAllowed: number;
  gamesSocialActual: number;
  gamesPenaltyMinutes: number;
  mood: number | null;
  reviewCompleted: boolean;
}

export default function ReportsPage() {
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedReport, setSelectedReport] = useState<Report | null>(null);
  const router = useRouter();

  useEffect(() => {
    loadReports();
  }, []);

  const loadReports = async () => {
    try {
      const res = await fetch('/api/reports/submit');
      if (!res.ok) { router.push('/login'); return; }
      const data = await res.json();
      setReports(data.reports || []);
    } catch {
      router.push('/login');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="flex-1 flex items-center justify-center"><p className="text-gray-400">Загрузка...</p></div>;
  }

  const moods = reports.filter(r => r.mood != null).reverse();
  const successRates = reports.map(r => ({
    date: r.date,
    rate: r.tasksTotal > 0 ? (r.tasksCompleted / r.tasksTotal) * 100 : 0,
  })).reverse();

  const Nav = () => (
    <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-blue-100">
      <div className="max-w-lg mx-auto flex">
        <button onClick={() => router.push('/dashboard')} className="flex-1 py-3 text-center text-gray-500 text-sm hover:text-gray-700">Сегодня</button>
        <button onClick={() => router.push('/plan')} className="flex-1 py-3 text-center text-gray-500 text-sm hover:text-gray-700">План</button>
        <button onClick={() => router.push('/reports')} className="flex-1 py-3 text-center text-emerald-400 text-sm font-medium">Отчёты</button>
        <button onClick={() => router.push('/review')} className="flex-1 py-3 text-center text-gray-500 text-sm hover:text-gray-700">Утро</button>
      </div>
    </div>
  );

  return (
    <div className="flex-1 px-4 py-6 max-w-lg mx-auto w-full pb-20">
      <h1 className="text-xl font-bold mb-6">Отчёты</h1>

      {/* Mood chart (simple bar chart) */}
      {moods.length > 0 && (
        <div className="mb-6">
          <h2 className="text-sm font-medium text-gray-400 mb-3">Настроение по дням</h2>
          <div className="flex items-end gap-1 h-32 bg-white rounded-lg p-3">
            {moods.slice(-14).map(r => (
              <div key={r.date} className="flex-1 flex flex-col items-center justify-end">
                <div
                  className="w-full bg-emerald-500 rounded-t"
                  style={{ height: `${(r.mood! / 10) * 100}%`, minHeight: 2 }}
                  title={`${r.date}: ${r.mood}/10`}
                />
                <span className="text-[8px] text-gray-500 mt-1">
                  {r.date.slice(5)}
                </span>
              </div>
            ))}
          </div>
          <div className="flex justify-between text-xs text-gray-500 mt-1">
            <span>1</span><span>5</span><span>10</span>
          </div>
        </div>
      )}

      {/* Success rate chart */}
      {successRates.length > 0 && (
        <div className="mb-6">
          <h2 className="text-sm font-medium text-gray-400 mb-3">Успешность выполнения</h2>
          <div className="flex items-end gap-1 h-32 bg-white rounded-lg p-3">
            {successRates.slice(-14).map(r => (
              <div key={r.date} className="flex-1 flex flex-col items-center justify-end">
                <div
                  className={`w-full rounded-t ${r.rate >= 80 ? 'bg-emerald-500' : r.rate >= 50 ? 'bg-yellow-500' : 'bg-red-500'}`}
                  style={{ height: `${r.rate}%`, minHeight: 2 }}
                  title={`${r.date}: ${r.rate.toFixed(0)}%`}
                />
                <span className="text-[8px] text-gray-500 mt-1">
                  {r.date.slice(5)}
                </span>
              </div>
            ))}
          </div>
          <div className="flex justify-between text-xs text-gray-500 mt-1">
            <span>0%</span><span>50%</span><span>100%</span>
          </div>
        </div>
      )}

      {/* Report list */}
      <h2 className="text-sm font-medium text-gray-400 mb-3">История</h2>
      <div className="space-y-2">
        {reports.map(report => (
          <button
            key={report.id}
            onClick={() => setSelectedReport(selectedReport?.id === report.id ? null : report)}
            className="w-full bg-white rounded-lg p-3 text-left"
          >
            <div className="flex justify-between items-center">
              <span className="font-medium">{report.date}</span>
              <span className={`text-sm ${report.earned - report.lost >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                {report.earned - report.lost >= 0 ? '+' : ''}{Math.round(report.earned - report.lost).toLocaleString()}$
              </span>
            </div>
            <div className="flex gap-3 text-xs text-gray-400 mt-1">
              <span>{report.tasksCompleted}/{report.tasksTotal} задач</span>
              {report.mood && <span>Настроение: {report.mood}/10</span>}
            </div>

            {selectedReport?.id === report.id && (
              <div className="mt-3 pt-3 border-t border-blue-100 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-400">Заработано</span>
                  <span className="text-emerald-400">+${Math.round(report.earned).toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Потеряно (штрафы)</span>
                  <span className="text-red-400">−${Math.round(report.lost).toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">С опозданием</span>
                  <span>{report.tasksDoneLate}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Игры разрешено / реально</span>
                  <span>{report.gamesSocialAllowed} / {report.gamesSocialActual} мин</span>
                </div>
                {report.gamesPenaltyMinutes > 0 && (
                  <div className="flex justify-between">
                    <span className="text-gray-400">Штраф за игры</span>
                    <span className="text-red-400">{report.gamesPenaltyMinutes} мин</span>
                  </div>
                )}
                {report.mood && (
                  <div className="flex justify-between">
                    <span className="text-gray-400">Настроение</span>
                    <span>{report.mood}/10</span>
                  </div>
                )}
              </div>
            )}
          </button>
        ))}
        {reports.length === 0 && (
          <p className="text-center text-gray-500 py-8">Пока нет отчётов. Пройди первый день!</p>
        )}
      </div>

      <Nav />
    </div>
  );
}
