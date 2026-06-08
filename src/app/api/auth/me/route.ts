import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Не авторизован' }, { status: 401 });
    }

    return NextResponse.json({
      user: {
        id: user.id, email: user.email, name: user.name,
        balance: user.balance, goalAmount: user.goalAmount,
        onboarded: user.onboarded, timezone: user.timezone,
        wakeTime: user.wakeTime, sleepTime: user.sleepTime,
        baseRewardMinutes: user.baseRewardMinutes,
        carriedDebt: user.carriedDebt,
        startDate: user.startDate,
      },
    });
  } catch (error) {
    console.error('Me error:', error);
    return NextResponse.json({ error: 'Ошибка сервера' }, { status: 500 });
  }
}
