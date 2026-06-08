export const runtime = 'edge';

import { NextResponse } from 'next/server';
import { getDb } from '@/lib/prisma';
import bcrypt from 'bcryptjs';

export async function POST(request: Request) {
  const prisma = getDb();
  try {
    const { token, password } = await request.json();

    if (!token || !password) {
      return NextResponse.json({ error: 'Токен и новый пароль обязательны' }, { status: 400 });
    }

    if (password.length < 6) {
      return NextResponse.json({ error: 'Пароль должен быть не менее 6 символов' }, { status: 400 });
    }

    const resetRecord = await prisma.passwordReset.findUnique({
      where: { token },
    });

    if (!resetRecord) {
      return NextResponse.json({ error: 'Недействительная ссылка для сброса пароля' }, { status: 400 });
    }

    if (resetRecord.used) {
      return NextResponse.json({ error: 'Эта ссылка уже была использована' }, { status: 400 });
    }

    if (new Date(resetRecord.expiresAt) < new Date()) {
      return NextResponse.json({ error: 'Ссылка для сброса пароля истекла' }, { status: 400 });
    }

    // Hash new password and update user
    const passwordHash = await bcrypt.hash(password, 12);

    // Update user password and mark token as used
    await prisma.user.update({
      where: { id: resetRecord.userId },
      data: { passwordHash },
    });

    await prisma.passwordReset.update({
      where: { id: resetRecord.id },
      data: { used: true },
    });

    return NextResponse.json({ message: 'Пароль успешно изменён' });
  } catch (error) {
    console.error('Reset password error:', error);
    return NextResponse.json({ error: 'Ошибка сервера' }, { status: 500 });
  }
}
