'use client';

import { useState, useEffect } from 'react';
import { useAccount, useSignMessage, useConnect, useDisconnect } from 'wagmi';
import { createClient } from '@supabase/supabase-js';
import { verifyMessage } from 'viem';
import { injected } from 'wagmi/connectors';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);

interface TelegramUser {
  id: number;
  first_name?: string;
  username?: string;
  auth_date: number;
  hash: string;
}

// 型安全なグローバル定義
declare global {
  interface Window {
    onTelegramAuth: ((user: TelegramUser) => void) | null;
  }
}

export function Connect() {
  const [mounted, setMounted] = useState(false);
  const [error, setError] = useState<string>();
  const [success, setSuccess] = useState(false);

  const { address, isConnected } = useAccount();
  const { connect } = useConnect();
  const { disconnect } = useDisconnect();
  const { signMessageAsync } = useSignMessage();

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted || !isConnected) return;

    const container = document.getElementById('telegram-login');
    if (!container) return;

    // クリーンアップ用の関数
    const cleanup = () => {
      container.innerHTML = '';
      // 型安全なクリーンアップ
      window.onTelegramAuth = null;
    };

    // 初期クリーンアップ
    cleanup();

    // 型安全なコールバック関数の定義
    const handleTelegramAuth = async (user: TelegramUser) => {
      try {
        console.log('Telegram auth received:', user);

        if (!address) {
          throw new Error('Wallet not connected');
        }

        // 署名用のメッセージを作成
        const timestamp = Date.now();
        const nonce = Math.floor(Math.random() * 1000000);
        const messageToSign = JSON.stringify({
          action: 'telegram-connect',
          telegramId: user.id,
          walletAddress: address,
          timestamp: timestamp,
          nonce: nonce,
        });

        console.log('Requesting signature for message:', messageToSign);

        // メッセージの署名
        const signature = await signMessageAsync({ message: messageToSign });

        // 署名の検証
        const verified = await verifyMessage({
          address: address as `0x${string}`,
          message: messageToSign,
          signature,
        });

        if (!verified) {
          throw new Error('Signature verification failed');
        }

        // Save to DB
        const { error: dbError } = await supabase.from('wallet_telegram_mapping').upsert({
          wallet_address: address.toLowerCase(),
          telegram_user_id: user.id,
        });

        if (dbError) throw dbError;

        // Notify with signature
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
              timestamp: timestamp,
              signature: {
                message: messageToSign,
                signature: signature,
              },
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
      }
    };

    // 型安全なコールバックの設定
    window.onTelegramAuth = handleTelegramAuth;

    const script = document.createElement('script');
    script.async = true;
    script.src = 'https://telegram.org/js/telegram-widget.js?22';
    script.setAttribute('data-telegram-login', 'phi_box_bot');
    script.setAttribute('data-size', 'large');
    script.setAttribute('data-onauth', 'onTelegramAuth');
    script.setAttribute('data-request-access', 'write');

    container.appendChild(script);

    // クリーンアップ関数を返す
    return cleanup;
  }, [mounted, address, isConnected, signMessageAsync]);

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
