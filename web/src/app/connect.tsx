'use client';

import { useState, useEffect } from 'react';
import { useAccount, useSignMessage, useConnect, useDisconnect } from 'wagmi';
import { createClient } from '@supabase/supabase-js';
import { verifyMessage } from 'viem';
import { injected } from 'wagmi/connectors';
import crypto from 'crypto';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);

interface TelegramUser {
  id: number;
  first_name?: string;
  username?: string;
  photo_url?: string;
  auth_date: number;
  hash: string;
}

declare global {
  interface Window {
    handleTelegramAuth: (user: TelegramUser) => void;
  }
}

// Telegram認証データの検証関数
function verifyTelegramAuth(telegramData: TelegramUser): boolean {
  const botToken = process.env.NEXT_PUBLIC_TELEGRAM_BOT_TOKEN;
  if (!botToken) {
    console.error('Telegram bot token is not set');
    return false;
  }

  const { hash, ...data } = telegramData;

  // データチェック文字列の作成
  const checkString = Object.entries(data)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`)
    .join('\n');

  // 秘密鍵の生成
  const secretKey = crypto.createHash('sha256').update(botToken).digest();

  // HMACの計算
  const hmac = crypto.createHmac('sha256', secretKey).update(checkString).digest('hex');

  // ハッシュの比較
  return hmac === hash;
}

export function Connect() {
  const [mounted, setMounted] = useState(false);
  const { address, isConnected } = useAccount();
  const { connect } = useConnect();
  const { disconnect } = useDisconnect();
  const { signMessageAsync } = useSignMessage();
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string>();
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted || !isConnected) return;

    const container = document.getElementById('telegram-login');
    if (container) {
      container.innerHTML = '';

      const script = document.createElement('script');
      script.src = 'https://telegram.org/js/telegram-widget.js?22';
      script.setAttribute('data-telegram-login', 'phi_box_bot');
      script.setAttribute('data-size', 'large');
      script.setAttribute('data-radius', '8');
      script.setAttribute('data-request-access', 'write');
      script.setAttribute('data-onauth', 'handleTelegramAuth');
      script.setAttribute('data-auth-url', `${process.env.NEXT_PUBLIC_APP_URL}/api/telegram-auth`);

      container.appendChild(script);
    }

    window.handleTelegramAuth = async (user: TelegramUser) => {
      if (!address || connecting) return;

      try {
        setConnecting(true);
        setError(undefined);

        // Telegram認証データの検証
        if (!verifyTelegramAuth(user)) {
          throw new Error('Invalid Telegram authentication');
        }

        // 認証の有効期限チェック（1時間）
        const authTimestamp = user.auth_date * 1000; // convert to milliseconds
        const now = Date.now();
        if (now - authTimestamp > 3600000) {
          throw new Error('Telegram authentication expired');
        }

        // メッセージの署名
        const nonce = Math.floor(Math.random() * 1000000);
        const message = `Connect Telegram with ${address} (nonce: ${nonce})`;
        const signature = await signMessageAsync({ message });

        // 署名の検証
        const valid = await verifyMessage({
          address: address as `0x${string}`,
          message,
          signature,
        });

        if (!valid) {
          throw new Error('Signature verification failed');
        }

        // DBへの保存
        const { error: dbError } = await supabase.from('wallet_telegram_mapping').upsert({
          wallet_address: address.toLowerCase(),
          telegram_user_id: user.id,
        });

        if (dbError) throw dbError;

        // 連携完了通知の送信
        const response = await fetch('/api/telegram-bot', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            type: 'Connected',
            data: {
              telegramId: user.id,
              walletAddress: address,
              timestamp: new Date().toISOString(),
            },
          }),
        });

        if (!response.ok) {
          throw new Error('Failed to send telegram notification');
        }

        setSuccess(true);
      } catch (err) {
        console.error('Connection error:', err);
        setError(err instanceof Error ? err.message : 'Failed to connect');
      } finally {
        setConnecting(false);
      }
    };

    return () => {
      const container = document.getElementById('telegram-login');
      if (container) {
        container.innerHTML = '';
      }
    };
  }, [mounted, address, isConnected, connecting, signMessageAsync]);

  if (!mounted) return null;

  return (
    <div className='space-y-8 w-full max-w-md'>
      <h2 className='text-2xl font-bold text-center'>Connect with Telegram</h2>

      {error && <div className='p-4 bg-red-50 text-red-600 rounded-lg text-center'>{error}</div>}

      {success && (
        <div className='p-4 bg-green-50 text-green-600 rounded-lg text-center'>
          <p className='font-bold'>✅ Successfully Connected!</p>
          <p className='text-sm mt-2'>Check your Telegram for confirmation.</p>
        </div>
      )}

      {!isConnected ? (
        <div className='space-y-4'>
          <p className='text-center text-gray-600'>Connect your wallet to get started</p>
          <button
            onClick={() => connect({ connector: injected() })}
            className='w-full px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors'
          >
            Connect Wallet
          </button>
        </div>
      ) : (
        <div className='space-y-6'>
          <div className='space-y-4'>
            <p className='text-center text-gray-600'>Connect your Telegram account</p>
            <div id='telegram-login' className='flex justify-center' />
          </div>

          <div className='space-y-2 pt-4 border-t border-gray-200'>
            <div className='text-sm text-gray-600 text-center break-all'>Connected: {address}</div>
            <button
              onClick={() => {
                disconnect();
                setSuccess(false);
                setError(undefined);
              }}
              className='w-full px-4 py-2 text-red-500 hover:text-red-600 text-sm transition-colors'
            >
              Disconnect Wallet
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
