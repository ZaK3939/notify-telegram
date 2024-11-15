// src/app/connect.tsx
'use client';

import { useState, useEffect } from 'react';
import { useAccount, useSignMessage, useConnect, useDisconnect } from 'wagmi';
import { createClient } from '@supabase/supabase-js';
import { verifyMessage } from 'viem';
import { injected } from 'wagmi/connectors';

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
  const { connect } = useConnect();
  const { disconnect } = useDisconnect();
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
      script.setAttribute('data-telegram-login', 'phi_box_bot');
      script.setAttribute('data-size', 'large');
      script.setAttribute('data-lang', 'en');
      script.setAttribute('data-onauth', 'handleTelegramAuth');
      script.setAttribute('data-request-access', 'write');
      script.setAttribute('data-radius', '8');

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
        console.log('Sending telegram notification');
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
            },
          }),
        });

        if (!response.ok) throw new Error('Failed to send telegram notification');

        // 成功メッセージを表示
        const container = document.getElementById('telegram-login');
        if (container) {
          container.innerHTML = `
        <div class="text-center text-green-600">
          <p class="font-bold">✅ Successfully Connected!</p>
          <p class="text-sm mt-2">Check your Telegram for confirmation.</p>
        </div>
      `;
        }
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

      {!isConnected ? (
        // Step 1: ウォレット接続
        <div className='space-y-4'>
          <p className='text-center text-gray-600'>Step 1: Connect your wallet to verify ownership</p>
          <button
            onClick={() => connect({ connector: injected() })}
            className='w-full px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors'
          >
            Connect Wallet
          </button>
        </div>
      ) : (
        <div className='space-y-6'>
          {!signature ? (
            // Step 2: 署名
            <div className='space-y-4'>
              <p className='text-center text-gray-600'>Step 2: Sign message to verify wallet ownership</p>
              <button
                onClick={signMessage}
                className='w-full px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors'
              >
                Sign Message
              </button>
            </div>
          ) : (
            // Step 3: Telegram連携
            <div className='space-y-4'>
              <p className='text-center text-gray-600'>Step 3: Connect your Telegram account</p>
              <div id='telegram-login' className='flex justify-center' />
            </div>
          )}

          {/* ウォレット情報と切断ボタン */}
          <div className='space-y-2 pt-4 border-t border-gray-200'>
            <div className='text-sm text-gray-600 text-center break-all'>Connected wallet: {address}</div>
            <button
              onClick={() => {
                disconnect();
                setSignature(undefined);
                setMessage(undefined);
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
