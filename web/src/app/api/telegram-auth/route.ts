import { NextResponse } from 'next/server';
import crypto from 'crypto';
import type { TelegramUser } from '../../../types/telegram';

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

function validateTelegramData(data: Omit<TelegramUser, 'hash'>, hash: string): boolean {
  if (!BOT_TOKEN) {
    throw new Error('TELEGRAM_BOT_TOKEN is not configured!');
  }

  const secretKey = crypto.createHash('sha256').update(BOT_TOKEN).digest();

  const dataCheckString = Object.keys(data)
    .sort()
    .map((key) => `${key}=${data[key as keyof typeof data]}`)
    .join('\n');

  const hmac = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex');

  return hmac === hash;
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { hash, ...userData } = body as TelegramUser;

    if (!validateTelegramData(userData, hash)) {
      return NextResponse.json({ error: 'Invalid authentication data' }, { status: 400 });
    }

    const authTimestamp = userData.auth_date * 1000;
    const now = Date.now();
    if (now - authTimestamp > 3600000) {
      return NextResponse.json({ error: 'Authentication expired' }, { status: 400 });
    }

    return NextResponse.json({ success: true, user: userData });
  } catch (error) {
    console.error('Telegram auth error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
