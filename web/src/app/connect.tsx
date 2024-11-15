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

export function Connect() {
  const [mounted, setMounted] = useState(false);
  const [error, setError] = useState<string>();
  const [success, setSuccess] = useState(false);
  const [isAuthenticating, setIsAuthenticating] = useState(false);

  const { address, isConnected } = useAccount();
  const { connect } = useConnect();
  const { disconnect } = useDisconnect();
  const { signMessageAsync } = useSignMessage();

  useEffect(() => {
    setMounted(true);
  }, []);

  // Telegramユーザー情報の検証と署名
  const verifyAndSignTelegramAuth = async (user: TelegramUser) => {
    if (!address) throw new Error('Wallet not connected');

    try {
      // Nonce生成（タイムスタンプとランダム値を組み合わせて）
      const timestamp = Date.now();
      const randomValue = Math.floor(Math.random() * 1000000);
      const nonce = `${timestamp}-${randomValue}`;

      // 署名するメッセージの作成
      const messageToSign = JSON.stringify({
        type: 'telegram_auth',
        telegramId: user.id,
        walletAddress: address,
        nonce: nonce,
        timestamp: timestamp,
      });

      console.log('Requesting signature for:', messageToSign);

      // メッセージの署名
      const signature = await signMessageAsync({ message: messageToSign });

      // 署名の検証
      const isValid = await verifyMessage({
        address: address as `0x${string}`,
        message: messageToSign,
        signature,
      });

      if (!isValid) {
        throw new Error('Message signature verification failed');
      }

      console.log('Signature verified:', signature);

      return {
        messageToSign,
        signature,
      };
    } catch (error) {
      console.error('Signature error:', error);
      throw new Error('Failed to sign message');
    }
  };

  useEffect(() => {
    if (!mounted || !isConnected) return;

    const container = document.getElementById('telegram-login');
    if (!container) return;

    container.innerHTML = '';

    container.innerHTML = `
      <script 
        async 
        src="https://telegram.org/js/telegram-widget.js?22" 
        data-telegram-login="phi_box_bot"
        data-size="medium"
        data-userpic="true" 
        data-request-access="write"
        data-onauth="onTelegramAuth(user)"
      ></script>
      <script type="text/javascript">
        function onTelegramAuth(user) {
          window.postMessage({ type: 'TELEGRAM_AUTH', user: user }, '*');
        }
      </script>
    `;

    const handleMessage = async (event: MessageEvent) => {
      if (event.data.type === 'TELEGRAM_AUTH') {
        const user = event.data.user as TelegramUser;
        console.log('Telegram auth received:', user);

        if (isAuthenticating) return;

        try {
          setIsAuthenticating(true);
          setError(undefined);

          if (!address) {
            throw new Error('Wallet not connected');
          }

          // 署名と検証を実行
          const { messageToSign, signature } = await verifyAndSignTelegramAuth(user);

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
                  username: user.username,
                },
                signature: {
                  message: messageToSign,
                  signature: signature,
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
          setIsAuthenticating(false);
        }
      }
    };

    window.addEventListener('message', handleMessage);

    return () => {
      container.innerHTML = '';
      window.removeEventListener('message', handleMessage);
    };
  }, [mounted, address, isConnected, signMessageAsync, isAuthenticating]);

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

      {isAuthenticating && (
        <div className='p-4 bg-blue-50 text-blue-600 rounded-lg text-center'>
          <p>Authenticating...</p>
        </div>
      )}

      {!isConnected ? (
        <div className='space-y-4'>
          <p className='text-center text-gray-600'>Connect your wallet to get started</p>
          <button
            onClick={() => connect({ connector: injected() })}
            className='w-full px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors'
            disabled={isAuthenticating}
          >
            Connect Wallet
          </button>
        </div>
      ) : (
        <div className='space-y-6'>
          <div className='space-y-4'>
            <p className='text-center text-gray-600'>
              {isAuthenticating ? 'Connecting...' : 'Connect your Telegram account'}
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
              disabled={isAuthenticating}
            >
              Disconnect Wallet
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
