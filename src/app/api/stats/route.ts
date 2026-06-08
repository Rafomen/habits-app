
import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { getDb } from '@/lib/prisma';

export async function GET() {
  const prisma = getDb();
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 });

    const reports = await prisma.dailyReport.findMany({
      where: { userId: user.id, reviewCompleted: true },
      orderBy: { date: 'desc' },
      take: 90,
    });

    if (reports.length === 0) {
      return NextResponse.json({ streak: 0, avgCompletion: 0, totalDays: 0 });
    }

    // Calculate streak: consecutive days where all tasks completed
    let streak = 0;
    const today = new Date();

    for (let i = 0; i < 90; i++) {
      const checkDate = new Date(today);
      checkDate.setDate(checkDate.getDate() - i);
      const dateStr = checkDate.toISOString().split('T')[0];

      const report = reports.find(r => r.date === dateStr);
      if (!report) break;

      if (report.tasksCompleted === report.tasksTotal && report.tasksTotal > 0) {
        streak++;
      } else {
        break;
      }
    }

    // Average completion rate
    const totalTasks = reports.reduce((s, r) => s + r.tasksTotal, 0);
    const completedTasks = reports.reduce((s, r) => s + r.tasksCompleted, 0);
    const avgCompletion = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

    return NextResponse.json({
      streak,
      avgCompletion,
      totalDays: reports.length,
    });
  } catch (error) {
    console.error('Stats error:', error);
    return NextResponse.json({ error: 'Ошибка сервера' }, { status: 500 });
  }
}
