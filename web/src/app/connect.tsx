'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAccount, useSignMessage, useConnect, useDisconnect } from 'wagmi';
import { createClient } from '@supabase/supabase-js';
import { verifyMessage } from 'viem';
import { injected } from 'wagmi/connectors';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);

interface TelegramUser {
  id: number;
  first_name?: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
  auth_date: number;
  hash: string;
}

declare global {
  interface Window {
    onTelegramAuth?: (user: TelegramUser) => void;
  }
}

export function Connect() {
  const [mounted, setMounted] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string>();
  const [success, setSuccess] = useState(false);

  const { address, isConnected } = useAccount();
  const { connect } = useConnect();
  const { disconnect } = useDisconnect();
  const { signMessageAsync } = useSignMessage();

  const handleTelegramAuth = useCallback(
    async (user: TelegramUser) => {
      console.log('Telegram auth callback received:', user);
      if (!address || connecting) {
        console.log('Skipping auth - no address or already connecting');
        return;
      }

      try {
        setConnecting(true);
        setError(undefined);

        // メッセージの署名
        const nonce = Math.floor(Math.random() * 1000000);
        const message = `Connect Telegram with ${address} (nonce: ${nonce})`;
        console.log('Requesting signature for message:', message);

        const signature = await signMessageAsync({ message });
        console.log('Signature obtained');

        // 署名の検証
        const valid = await verifyMessage({
          address: address as `0x${string}`,
          message,
          signature,
        });

        if (!valid) {
          throw new Error('Wallet signature verification failed');
        }

        // DBへの保存
        const { error: dbError } = await supabase.from('wallet_telegram_mapping').upsert({
          wallet_address: address.toLowerCase(),
          telegram_user_id: user.id,
        });

        if (dbError) {
          console.error('Database error:', dbError);
          throw dbError;
        }

        // Supabase Function呼び出し
        const response = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/telegram-bot`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`,
          },
          body: JSON.stringify({
            type: 'Connected',
            data: {
              telegramId: user.id,
              walletAddress: address,
              timestamp: new Date().toISOString(),
              userData: {
                firstName: user.first_name,
                lastName: user.last_name,
                username: user.username,
                photoUrl: user.photo_url,
              },
            },
          }),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          console.error('Notification error:', errorData);
          throw new Error('Failed to send telegram notification');
        }

        setSuccess(true);
      } catch (err) {
        console.error('Connection error:', err);
        setError(err instanceof Error ? err.message : 'Failed to connect');
      } finally {
        setConnecting(false);
      }
    },
    [address, connecting, signMessageAsync],
  );

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted || !isConnected) return;

    const container = document.getElementById('telegram-login');
    if (!container) return;

    // クリーンアップ関数
    const cleanup = () => {
      container.innerHTML = '';
      // グローバルコールバックをクリーンアップ
      window.onTelegramAuth = undefined;
    };

    cleanup();

    // グローバルコールバックを設定
    window.onTelegramAuth = handleTelegramAuth;

    // Telegramウィジェットの設定
    const script = document.createElement('script');
    script.async = true;
    script.src = 'https://telegram.org/js/telegram-widget.js?22';
    script.setAttribute('data-telegram-login', 'phi_box_bot');
    script.setAttribute('data-size', 'medium');
    script.setAttribute('data-userpic', 'true');
    // コールバック名を修正
    script.setAttribute('data-onauth', 'onTelegramAuth');
    script.setAttribute('data-request-access', 'write');

    // エラーハンドリング
    script.onerror = (error) => {
      console.error('Failed to load Telegram widget:', error);
      setError('Failed to load Telegram login widget');
    };

    container.appendChild(script);

    return cleanup;
  }, [mounted, isConnected, handleTelegramAuth]);

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
            <p className='text-center text-gray-600'>
              {connecting ? 'Connecting...' : 'Connect your Telegram account'}
            </p>
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
              disabled={connecting}
            >
              Disconnect Wallet
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
