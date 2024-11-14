'use client';

import { useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);

interface TelegramUser {
  id: number;
  auth_date: number;
  hash: string;
}

export function Connect() {
  useEffect(() => {
    // 既存のウィジェットをクリア
    const container = document.getElementById('telegram-login');
    if (container) {
      container.innerHTML = '';
    }

    // スクリプトの作成と設定
    const script = document.createElement('script');
    script.src = 'https://telegram.org/js/telegram-widget.js?22';
    script.setAttribute('data-telegram-login', process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME!);
    script.setAttribute('data-size', 'large');
    script.setAttribute('data-onauth', 'handleTelegramAuth');
    script.setAttribute('data-request-access', 'write');

    // グローバルハンドラーの設定
    window.handleTelegramAuth = async (user: TelegramUser) => {
      try {
        const { error } = await supabase.from('wallet_telegram_mapping').insert({
          telegram_chat_id: user.id.toString(),
          auth_date: new Date(user.auth_date * 1000),
        });

        if (error) throw error;
      } catch (error) {
        console.error('Auth error:', error);
      }
    };

    // スクリプトの追加
    container?.appendChild(script);

    return () => {
      if (container) {
        container.innerHTML = '';
      }
    };
  }, []);

  return (
    <div className='space-y-8 w-full max-w-md'>
      <h2 className='text-2xl font-bold text-center'>Connect with Telegram</h2>
      <div id='telegram-login' className='flex justify-center' />
    </div>
  );
}

// グローバル型定義
declare global {
  interface Window {
    handleTelegramAuth: (user: TelegramUser) => void;
  }
}
