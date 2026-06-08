export const runtime = 'edge';

import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { getDb } from '@/lib/prisma';

export async function POST(request: Request) {
  const prisma = getDb();
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 });

    const body = await request.json();
    const { wakeTime, sleepTime, timezone, goalAmount, startDate } = body;

    const updated = await prisma.user.update({
      where: { id: user.id },
      data: {
        wakeTime: wakeTime || user.wakeTime,
        sleepTime: sleepTime || user.sleepTime,
        timezone: timezone || user.timezone,
        goalAmount: goalAmount != null ? parseFloat(goalAmount) : user.goalAmount,
        startDate: startDate || user.startDate,
        onboarded: true,
      },
    });

    return NextResponse.json({ user: updated });
  } catch (error) {
    console.error('Onboarding error:', error);
    return NextResponse.json({ error: 'Ошибка сервера' }, { status: 500 });
  }
}
