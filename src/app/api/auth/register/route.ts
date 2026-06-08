export const runtime = 'edge';

import { NextResponse } from 'next/server';
import { getDb } from '@/lib/prisma';
import { createToken } from '@/lib/auth';
import bcrypt from 'bcryptjs';

export async function POST(request: Request) {
  const prisma = getDb();
  try {
    const { email, password, name } = await request.json() as any;

    if (!email || !password || !name) {
      return NextResponse.json({ error: 'Все поля обязательны' }, { status: 400 });
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return NextResponse.json({ error: 'Email уже зарегистрирован' }, { status: 400 });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const user = await prisma.user.create({
      data: { email, passwordHash, name },
    });

    const token = await createToken(user.id);

    const response = NextResponse.json({
      user: { id: user.id, email: user.email, name: user.name },
    });

    response.cookies.set('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 30 * 24 * 60 * 60,
      path: '/',
    });

    return response;
  } catch (error) {
    console.error('Register error:', error);
    return NextResponse.json({ error: 'Ошибка сервера' }, { status: 500 });
  }
}
