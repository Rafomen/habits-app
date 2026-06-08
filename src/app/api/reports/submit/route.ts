export const runtime = 'edge';

import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { getDb } from '@/lib/prisma';

export async function GET() {
  const prisma = getDb();
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 });

    const reports = await prisma.dailyReport.findMany({
      where: { userId: user.id },
      orderBy: { date: 'desc' },
      take: 90,
    });

    const balanceLogs = await prisma.balanceLog.findMany({
      where: { userId: user.id },
      orderBy: { date: 'desc' },
      take: 200,
    });

    return NextResponse.json({ reports, balanceLogs });
  } catch (error) {
    console.error('Reports error:', error);
    return NextResponse.json({ error: 'Ошибка сервера' }, { status: 500 });
  }
}
