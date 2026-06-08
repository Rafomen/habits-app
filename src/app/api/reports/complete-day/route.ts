export const runtime = 'edge';

import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { getDb } from '@/lib/prisma';

export async function POST(request: Request) {
  const prisma = getDb();
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 });

    const { date } = await request.json();
    if (!date) return NextResponse.json({ error: 'date обязательна' }, { status: 400 });

    // Check if already completed
    const existing = await prisma.dailyReport.findUnique({
      where: { userId_date: { userId: user.id, date } },
    });
    if (existing?.reviewCompleted) {
      return NextResponse.json({ error: 'День уже завершён' }, { status: 400 });
    }

    // Get completions for the date
    const completions = await prisma.taskCompletion.findMany({
      where: { userId: user.id, date },
    });

    // Get tasks that should apply for this day
    const dayOfWeek = new Date(date + 'T00:00:00').getDay();
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
    const allTasks = await prisma.task.findMany({
      where: { userId: user.id, isActive: true },
    });
    const dayTasks = allTasks.filter(t => isWeekend ? t.appliesWeekends : t.appliesWeekdays);

    let earned = 0;
    let lost = 0;
    let completed = 0;
    let doneLate = 0;

    for (const task of dayTasks) {
      const comp = completions.find(c => c.taskId === task.id);
      if (comp?.status === 'done') {
        earned += task.rewardAmount;
        completed++;
      } else if (comp?.status === 'done_late') {
        earned += task.rewardAmount;
        completed++;
        doneLate++;
      } else {
        // Not done
        lost += task.penaltyAmount;
      }
    }

    const netBalance = earned - lost;

    // Calculate entertainment debt
    const notDone = dayTasks.length - completed;
    const taskDebtMinutes = notDone * 10;
    const newCarriedDebt = Math.max(0, taskDebtMinutes - user.baseRewardMinutes + user.carriedDebt);

    // Create daily report
    const report = await prisma.dailyReport.upsert({
      where: { userId_date: { userId: user.id, date } },
      update: {
        tasksTotal: dayTasks.length,
        tasksCompleted: completed,
        tasksDoneLate: doneLate,
        earned,
        lost,
        gamesSocialAllowed: Math.max(0, user.baseRewardMinutes - user.carriedDebt),
        gamesSocialActual: 0, // Will be updated in morning review
        gamesPenaltyMinutes: 0,
        mood: 0,
        reviewCompleted: false, // Morning review still needed for games/mood
        dayCompleted: true,
      },
      create: {
        userId: user.id,
        date,
        tasksTotal: dayTasks.length,
        tasksCompleted: completed,
        tasksDoneLate: doneLate,
        earned,
        lost,
        gamesSocialAllowed: Math.max(0, user.baseRewardMinutes - user.carriedDebt),
        gamesSocialActual: 0,
        gamesPenaltyMinutes: 0,
        mood: 0,
        reviewCompleted: false,
        dayCompleted: true,
      },
    });

    // Update user balance immediately
    await prisma.user.update({
      where: { id: user.id },
      data: {
        balance: user.balance + netBalance,
        carriedDebt: newCarriedDebt,
      },
    });

    // Log balance changes
    if (earned > 0) {
      await prisma.balanceLog.create({
        data: { userId: user.id, date, amount: earned, type: 'reward', description: `Награда за ${completed} задач` },
      });
    }
    if (lost > 0) {
      await prisma.balanceLog.create({
        data: { userId: user.id, date, amount: -lost, type: 'penalty', description: `Штраф за ${dayTasks.length - completed} невыполненных` },
      });
    }

    return NextResponse.json({
      report,
      netBalance,
      earned,
      lost,
      completed,
      total: dayTasks.length,
      newBalance: user.balance + netBalance,
      carriedDebt: newCarriedDebt,
    });
  } catch (error) {
    console.error('Complete day error:', error);
    return NextResponse.json({ error: 'Ошибка сервера' }, { status: 500 });
  }
}
