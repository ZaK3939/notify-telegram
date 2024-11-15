'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAccount, useSignMessage, useConnect, useDisconnect } from 'wagmi';
import { createClient } from '@supabase/supabase-js';
import { verifyMessage } from 'viem';
import { injected } from 'wagmi/connectors';
import type { TelegramUser } from '@/types/telegram';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);

export function Connect() {
  const [mounted, setMounted] = useState(false);
  const [error, setError] = useState<string>();
  const [success, setSuccess] = useState(false);
  const [isAuthenticating, setIsAuthenticating] = useState(false);

  const { address, isConnected } = useAccount();
  const { connect } = useConnect();
  const { disconnect } = useDisconnect();
  const { signMessageAsync } = useSignMessage();

  const handleTelegramAuth = useCallback(
    async (user: TelegramUser) => {
      if (!address || isAuthenticating) return;

      try {
        setIsAuthenticating(true);
        setError(undefined);
        console.log('Telegram auth received:', user);

        // Validate with API
        const authResponse = await fetch('/api/telegram-auth', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(user),
        });

        if (!authResponse.ok) {
          const error = await authResponse.json();
          throw new Error(error.error || 'Telegram authentication failed');
        }

        // Create signature message
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

        // Sign message
        const signature = await signMessageAsync({ message: messageToSign });

        // Verify signature
        const verified = await verifyMessage({
          address: address as `0x${string}`,
          message: messageToSign,
          signature,
        });

        if (!verified) {
          throw new Error('Signature verification failed');
        }

        // Save to database
        const { error: dbError } = await supabase.from('wallet_telegram_mapping').upsert({
          wallet_address: address.toLowerCase(),
          telegram_user_id: user.id,
        });

        if (dbError) throw dbError;

        // Send notification
        const notifyResponse = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/telegram-bot`, {
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

        if (!notifyResponse.ok) {
          throw new Error('Failed to send telegram notification');
        }

        setSuccess(true);
      } catch (err) {
        console.error('Connection error:', err);
        setError(err instanceof Error ? err.message : 'Failed to connect');
      } finally {
        setIsAuthenticating(false);
      }
    },
    [address, isAuthenticating, signMessageAsync],
  );

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted || !isConnected) return;

    const container = document.getElementById('telegram-login');
    if (!container) return;

    const cleanup = () => {
      container.innerHTML = '';
      window.onTelegramAuth = undefined;
    };

    cleanup();

    // Set global callback
    window.onTelegramAuth = handleTelegramAuth;

    // Load Telegram script
    const script = document.createElement('script');
    script.async = true;
    script.src = 'https://telegram.org/js/telegram-widget.js?22';
    script.setAttribute('data-telegram-login', 'phi_box_bot');
    script.setAttribute('data-size', 'large');
    script.setAttribute('data-onauth', 'onTelegramAuth');
    script.setAttribute('data-request-access', 'write');

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
