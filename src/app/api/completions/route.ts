import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 });

    const { taskId, date, status, comment } = await request.json();

    if (!taskId || !date || !status) {
      return NextResponse.json({ error: 'taskId, date, status обязательны' }, { status: 400 });
    }

    if (!['done', 'not_done', 'done_late'].includes(status)) {
      return NextResponse.json({ error: 'Неверный статус' }, { status: 400 });
    }

    const task = await prisma.task.findFirst({ where: { id: taskId, userId: user.id } });
    if (!task) return NextResponse.json({ error: 'Задача не найдена' }, { status: 404 });

    const completion = await prisma.taskCompletion.upsert({
      where: { taskId_date: { taskId, date } },
      update: {
        status,
        comment: comment ?? undefined,
        completedAt: status !== 'not_done' ? new Date() : null,
      },
      create: {
        taskId, userId: user.id, date, status,
        comment: comment || null,
        completedAt: status !== 'not_done' ? new Date() : null,
      },
    });

    return NextResponse.json({ completion });
  } catch (error) {
    console.error('Completions error:', error);
    return NextResponse.json({ error: 'Ошибка сервера' }, { status: 500 });
  }
}

export async function GET(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const date = searchParams.get('date');

    if (!date) return NextResponse.json({ error: 'date обязательна' }, { status: 400 });

    const completions = await prisma.taskCompletion.findMany({
      where: { userId: user.id, date },
    });

    return NextResponse.json({ completions });
  } catch (error) {
    console.error('Completions GET error:', error);
    return NextResponse.json({ error: 'Ошибка сервера' }, { status: 500 });
  }
}
