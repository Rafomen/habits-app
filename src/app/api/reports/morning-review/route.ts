import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 });

    const today = new Date().toISOString().split('T')[0];

    // If plan hasn't started yet, no review needed
    if (user.startDate && user.startDate > today) {
      return NextResponse.json({
        yesterday: getYesterday(),
        yesterdayStats: { needsReview: false, tasksTotal: 0, tasksCompleted: 0, earned: 0, lost: 0 },
        todayReport: false,
        allowedToday: user.baseRewardMinutes,
        carriedDebt: 0,
        baseRewardMinutes: user.baseRewardMinutes,
        hasntStarted: true,
        startDate: user.startDate,
      });
    }

    // Check if today's report exists and review is completed
    const todayReport = await prisma.dailyReport.findUnique({
      where: { userId_date: { userId: user.id, date: today } },
    });

    // Get yesterday's report (needs morning review)
    const yesterday = getYesterday();
    const yesterdayReport = await prisma.dailyReport.findUnique({
      where: { userId_date: { userId: user.id, date: yesterday } },
    });

    // Get yesterday's completions
    const yesterdayCompletions = await prisma.taskCompletion.findMany({
      where: { userId: user.id, date: yesterday },
      include: { task: true },
    });

    // Calculate allowed entertainment for today
    const allowedToday = Math.max(0, user.baseRewardMinutes - user.carriedDebt);

    // If yesterday has no report yet, we need to create one from completions
    let yesterdayStats = null;
    if (!yesterdayReport) {
      const tasks = getTasksForDay(
        await prisma.task.findMany({
          where: { userId: user.id, isActive: true },
        }),
        new Date(yesterday)
      );

      let earned = 0;
      let lost = 0;
      let completed = 0;
      let doneLate = 0;

      for (const task of tasks) {
        const comp = yesterdayCompletions.find(c => c.taskId === task.id);
        if (comp?.status === 'done') {
          earned += task.rewardAmount;
          completed++;
        } else if (comp?.status === 'done_late') {
          earned += task.rewardAmount;
          completed++;
          doneLate++;
        } else {
          lost += task.penaltyAmount;
        }
      }

      yesterdayStats = {
        tasksTotal: tasks.length,
        tasksCompleted: completed,
        tasksDoneLate: doneLate,
        earned,
        lost,
        needsReview: true,
      };
    } else {
      yesterdayStats = {
        ...yesterdayReport,
        needsReview: !yesterdayReport.reviewCompleted,
      };
    }

    return NextResponse.json({
      yesterday: yesterday,
      yesterdayStats,
      todayReport: todayReport?.reviewCompleted || false,
      allowedToday,
      carriedDebt: user.carriedDebt,
      baseRewardMinutes: user.baseRewardMinutes,
    });
  } catch (error) {
    console.error('Morning review GET error:', error);
    return NextResponse.json({ error: 'Ошибка сервера' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 });

    const { date, gamesSocialActual, mood } = await request.json();

    if (!date || gamesSocialActual == null || mood == null) {
      return NextResponse.json({ error: 'Все поля обязательны' }, { status: 400 });
    }

    // Get completions for that date
    const completions = await prisma.taskCompletion.findMany({
      where: { userId: user.id, date },
      include: { task: true },
    });

    const tasks = getTasksForDay(
      await prisma.task.findMany({ where: { userId: user.id, isActive: true } }),
      new Date(date)
    );

    let earned = 0;
    let lost = 0;
    let completed = 0;
    let doneLate = 0;

    for (const task of tasks) {
      const comp = completions.find(c => c.taskId === task.id);
      if (comp?.status === 'done') {
        earned += task.rewardAmount;
        completed++;
      } else if (comp?.status === 'done_late') {
        earned += task.rewardAmount;
        completed++;
        doneLate++;
      } else {
        lost += task.penaltyAmount;
      }
    }

    const netBalance = earned - lost;

    // Calculate games penalty
    const allowed = user.baseRewardMinutes - user.carriedDebt;
    const overplay = Math.max(0, gamesSocialActual - Math.max(0, allowed));
    const gamesPenaltyMinutes = overplay * 2; // double penalty

    // Calculate new carried debt for tomorrow
    // New debt = games penalty + whatever was left from tasks penalty (each undone task = -10 min)
    const taskDebtMinutes = (tasks.length - completed) * 10;
    const newCarriedDebt = Math.max(0, gamesPenaltyMinutes + taskDebtMinutes - user.baseRewardMinutes + user.carriedDebt);

    // Create or update daily report
    const report = await prisma.dailyReport.upsert({
      where: { userId_date: { userId: user.id, date } },
      update: {
        tasksTotal: tasks.length,
        tasksCompleted: completed,
        tasksDoneLate: doneLate,
        earned,
        lost,
        gamesSocialAllowed: Math.max(0, allowed),
        gamesSocialActual,
        gamesPenaltyMinutes,
        mood,
        reviewCompleted: true,
      },
      create: {
        userId: user.id,
        date,
        tasksTotal: tasks.length,
        tasksCompleted: completed,
        tasksDoneLate: doneLate,
        earned,
        lost,
        gamesSocialAllowed: Math.max(0, allowed),
        gamesSocialActual,
        gamesPenaltyMinutes,
        mood,
        reviewCompleted: true,
      },
    });

    // Update user balance and carried debt
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
        data: {
          userId: user.id, date, amount: earned,
          type: 'reward', description: `Награда за ${completed} задач`,
        },
      });
    }
    if (lost > 0) {
      await prisma.balanceLog.create({
        data: {
          userId: user.id, date, amount: -lost,
          type: 'penalty', description: `Штраф за ${tasks.length - completed} невыполненных`,
        },
      });
    }
    if (overplay > 0) {
      await prisma.balanceLog.create({
        data: {
          userId: user.id, date, amount: -(overplay * 2 * 100),
          type: 'games_penalty', description: `Штраф за превышение игр на ${overplay} мин`,
        },
      });
    }

    return NextResponse.json({ report, netBalance, gamesPenaltyMinutes, newCarriedDebt });
  } catch (error) {
    console.error('Morning review POST error:', error);
    return NextResponse.json({ error: 'Ошибка сервера' }, { status: 500 });
  }
}

function getYesterday(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toISOString().split('T')[0];
}

function getTasksForDay(tasks: any[], date: Date): any[] {
  const day = date.getDay(); // 0=Sun, 6=Sat
  const isWeekend = day === 0 || day === 6;
  return tasks.filter(t => isWeekend ? t.appliesWeekends : t.appliesWeekdays);
}
