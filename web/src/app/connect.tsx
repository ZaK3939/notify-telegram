// src/app/connect.tsx
'use client';

import { useState, useEffect } from 'react';
import { useAccount, useSignMessage } from 'wagmi';
import { createClient } from '@supabase/supabase-js';
import { verifyMessage } from 'viem';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);

interface TelegramUser {
  id: number;
  auth_date: number;
  hash: string;
}

declare global {
  interface Window {
    handleTelegramAuth: (user: TelegramUser) => void;
  }
}

export function Connect() {
  const [mounted, setMounted] = useState(false);
  const { address, isConnected } = useAccount();
  const { signMessageAsync } = useSignMessage();
  const [signature, setSignature] = useState<`0x${string}`>();
  const [message, setMessage] = useState<string>();

  useEffect(() => {
    setMounted(true);
  }, []);

  const signMessage = async () => {
    if (!address) return;
    try {
      const nonce = Math.floor(Math.random() * 1000000);
      const messageToSign = `Connect Telegram with ${address} (nonce: ${nonce})`;
      setMessage(messageToSign);
      const sig = (await signMessageAsync({ message: messageToSign })) as `0x${string}`;

      const valid = await verifyMessage({
        address: address as `0x${string}`,
        message: messageToSign,
        signature: sig,
      });

      if (!valid) {
        throw new Error('Signature verification failed');
      }

      setSignature(sig);
    } catch (error) {
      console.error('Error signing message:', error);
    }
  };

  useEffect(() => {
    if (!mounted || !signature) return;

    const container = document.getElementById('telegram-login');
    if (container && isConnected) {
      container.innerHTML = '';

      const script = document.createElement('script');
      script.src = 'https://telegram.org/js/telegram-widget.js?22';
      script.setAttribute('data-telegram-login', process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME!);
      script.setAttribute('data-size', 'large');
      script.setAttribute('data-onauth', 'handleTelegramAuth');
      script.setAttribute('data-request-access', 'write');

      container.appendChild(script);
    }

    window.handleTelegramAuth = async (user: TelegramUser) => {
      if (!address || !signature || !message) return;

      try {
        const valid = await verifyMessage({
          address: address as `0x${string}`,
          message: message,
          signature: signature,
        });

        if (!valid) {
          throw new Error('Signature verification failed');
        }

        const { error } = await supabase.from('wallet_telegram_mapping').insert({
          wallet_address: address.toLowerCase(),
          telegram_chat_id: user.id.toString(),
        });

        if (error) throw error;

        // 連携完了通知の送信
        await fetch('/functions/v1/telegram-bot', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            type: 'Connected',
            data: {
              telegramId: user.id,
              walletAddress: address,
            },
          }),
        });

        console.log('Successfully connected Telegram and EOA');
      } catch (error) {
        console.error('Connection error:', error);
      }
    };

    return () => {
      if (container) {
        container.innerHTML = '';
      }
    };
  }, [mounted, address, isConnected, signature, message]);

  if (!mounted) return null;

  return (
    <div className='space-y-8 w-full max-w-md'>
      <h2 className='text-2xl font-bold text-center'>Connect with Telegram</h2>

      {isConnected && !signature ? (
        <button onClick={signMessage} className='w-full px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600'>
          Sign to verify wallet ownership
        </button>
      ) : signature ? (
        <div id='telegram-login' className='flex justify-center' />
      ) : null}

      {address && <div className='text-sm text-gray-600 text-center'>Connected wallet: {address}</div>}
    </div>
  );
}
