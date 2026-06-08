
import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { getDb } from '@/lib/prisma';

export async function GET() {
  const prisma = getDb();
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 });

    const tasks = await prisma.task.findMany({
      where: { userId: user.id, isActive: true },
      orderBy: [{ orderIndex: 'asc' }, { timeStart: 'asc' }],
    });

    return NextResponse.json({ tasks });
  } catch (error) {
    console.error('Tasks GET error:', error);
    return NextResponse.json({ error: 'Ошибка сервера' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const prisma = getDb();
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 });

    const body = await request.json();
    const { title, timeStart, timeEnd, rewardAmount, penaltyAmount, appliesWeekdays, appliesWeekends } = body;

    if (!title || rewardAmount == null || penaltyAmount == null) {
      return NextResponse.json({ error: 'Название, награда и штраф обязательны' }, { status: 400 });
    }

    // Check time slot overlap for timed tasks
    if (timeStart && timeEnd) {
      const existingTasks = await prisma.task.findMany({
        where: {
          userId: user.id,
          isActive: true,
          timeStart: { not: null },
          timeEnd: { not: null },
        },
      });

      const newStart = timeToMinutes(timeStart);
      const newEnd = timeToMinutes(timeEnd);

      for (const t of existingTasks) {
        if (t.timeStart && t.timeEnd) {
          const eStart = timeToMinutes(t.timeStart);
          const eEnd = timeToMinutes(t.timeEnd);
          if (newStart < eEnd && newEnd > eStart) {
            return NextResponse.json({
              error: `Время пересекается с задачей "${t.title}" (${t.timeStart}–${t.timeEnd})`,
            }, { status: 400 });
          }
        }
      }
    }

    const task = await prisma.task.create({
      data: {
        userId: user.id,
        title,
        timeStart: timeStart || null,
        timeEnd: timeEnd || null,
        rewardAmount: parseFloat(rewardAmount),
        penaltyAmount: parseFloat(penaltyAmount),
        appliesWeekdays: appliesWeekdays ?? true,
        appliesWeekends: appliesWeekends ?? false,
        isBreak: false,
      },
    });

    return NextResponse.json({ task });
  } catch (error) {
    console.error('Tasks POST error:', error);
    return NextResponse.json({ error: 'Ошибка сервера' }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  const prisma = getDb();
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 });

    const body = await request.json();
    const { id, title, timeStart, timeEnd, rewardAmount, penaltyAmount, appliesWeekdays, appliesWeekends } = body;

    const task = await prisma.task.findFirst({ where: { id, userId: user.id } });
    if (!task) return NextResponse.json({ error: 'Задача не найдена' }, { status: 404 });

    // Check overlap if time changed
    if (timeStart && timeEnd) {
      const existingTasks = await prisma.task.findMany({
        where: {
          userId: user.id,
          isActive: true,
          timeStart: { not: null },
          timeEnd: { not: null },
          id: { not: id },
        },
      });

      const newStart = timeToMinutes(timeStart);
      const newEnd = timeToMinutes(timeEnd);

      for (const t of existingTasks) {
        if (t.timeStart && t.timeEnd) {
          const eStart = timeToMinutes(t.timeStart);
          const eEnd = timeToMinutes(t.timeEnd);
          if (newStart < eEnd && newEnd > eStart) {
            return NextResponse.json({
              error: `Время пересекается с задачей "${t.title}" (${t.timeStart}–${t.timeEnd})`,
            }, { status: 400 });
          }
        }
      }
    }

    const updated = await prisma.task.update({
      where: { id },
      data: {
        title: title ?? task.title,
        timeStart: timeStart !== undefined ? timeStart : task.timeStart,
        timeEnd: timeEnd !== undefined ? timeEnd : task.timeEnd,
        rewardAmount: rewardAmount != null ? parseFloat(rewardAmount) : task.rewardAmount,
        penaltyAmount: penaltyAmount != null ? parseFloat(penaltyAmount) : task.penaltyAmount,
        appliesWeekdays: appliesWeekdays ?? task.appliesWeekdays,
        appliesWeekends: appliesWeekends ?? task.appliesWeekends,
      },
    });

    return NextResponse.json({ task: updated });
  } catch (error) {
    console.error('Tasks PUT error:', error);
    return NextResponse.json({ error: 'Ошибка сервера' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const prisma = getDb();
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) return NextResponse.json({ error: 'ID обязателен' }, { status: 400 });

    const task = await prisma.task.findFirst({ where: { id, userId: user.id } });
    if (!task) return NextResponse.json({ error: 'Задача не найдена' }, { status: 404 });

    await prisma.task.update({ where: { id }, data: { isActive: false } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Tasks DELETE error:', error);
    return NextResponse.json({ error: 'Ошибка сервера' }, { status: 500 });
  }
}

function timeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}
