export const runtime = 'edge';

import { NextResponse } from 'next/server';
import { getDb } from '@/lib/prisma';
import { getRequestContext } from '@cloudflare/next-on-pages';

export async function POST(request: Request) {
  const prisma = getDb();
  try {
    const { email } = await request.json() as any;

    if (!email) {
      return NextResponse.json({ error: 'Email обязателен' }, { status: 400 });
    }

    // Always return success to prevent email enumeration
    const user = await prisma.user.findUnique({ where: { email } });

    if (user) {
      const token = crypto.randomUUID();
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

      await prisma.passwordReset.create({
        data: {
          userId: user.id,
          token,
          expiresAt,
        },
      });

      // Send email via Resend
      try {
        const ctx = getRequestContext();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const resendApiKey = (ctx.env as any).RESEND_API_KEY;

        if (resendApiKey) {
          await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${resendApiKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              from: 'Дисциплина Дня <noreply@habits-app.net>',
              to: [email],
              subject: 'Сброс пароля',
              html: `
                <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 20px;">
                  <h2 style="color: #059669;">Сброс пароля</h2>
                  <p>Вы запросили сброс пароля для аккаунта <strong>${email}</strong>.</p>
                  <p>Нажмите на кнопку ниже, чтобы установить новый пароль. Ссылка действительна 1 час.</p>
                  <a href="https://habits-app.net/reset-password?token=${token}" style="display: inline-block; padding: 12px 24px; background-color: #059669; color: white; text-decoration: none; border-radius: 8px; font-weight: 500;">
                    Сбросить пароль
                  </a>
                  <p style="color: #9ca3af; font-size: 14px; margin-top: 16px;">
                    Если вы не запрашивали сброс пароля, просто проигнорируйте это письмо.
                  </p>
                </div>
              `,
            }),
          });
        } else {
          console.warn('RESEND_API_KEY not configured, skipping email send');
          console.info('Password reset token:', token);
        }
      } catch (emailError) {
        console.error('Failed to send reset email:', emailError);
      }
    }

    return NextResponse.json({ message: 'Если аккаунт с таким email существует, мы отправили письмо для сброса пароля' });
  } catch (error) {
    console.error('Forgot password error:', error);
    return NextResponse.json({ error: 'Ошибка сервера' }, { status: 500 });
  }
}
