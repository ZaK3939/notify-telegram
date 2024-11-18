'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAccount, useSignMessage, useConnect, useDisconnect } from 'wagmi';
import { createClient } from '@supabase/supabase-js';
import { verifyMessage } from 'viem';
import { walletConnect } from 'wagmi/connectors';
import type { TelegramUser } from '@/types/telegram';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);

export function Connect() {
  const [mounted, setMounted] = useState<boolean>(false);
  const [error, setError] = useState<string | undefined>();
  const [success, setSuccess] = useState<boolean>(false);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);

  const { address, isConnected } = useAccount();
  const { connect } = useConnect();
  const { disconnect } = useDisconnect();
  const { signMessageAsync } = useSignMessage();

  const handleTelegramAuth = useCallback(
    async (user: TelegramUser) => {
      if (!address || isProcessing) {
        console.log('Skipping auth - no address or already processing');
        return;
      }

      try {
        setIsProcessing(true);
        setError(undefined);
        console.log('Starting Telegram auth process with user:', user);

        const timestamp = Date.now();
        const nonce = Math.floor(Math.random() * 1000000);
        const messageToSign = JSON.stringify({
          action: 'telegram-connect',
          telegramId: user.id,
          walletAddress: address,
          timestamp: timestamp,
          nonce: nonce,
        });

        console.log('Requesting wallet signature for message:', messageToSign);

        const signature = await signMessageAsync({ message: messageToSign });
        console.log('Obtained signature:', signature);

        const isValid = await verifyMessage({
          address: address as `0x${string}`,
          message: messageToSign,
          signature,
        });

        if (!isValid) {
          throw new Error('Signature verification failed');
        }

        console.log('Signature verified successfully');

        console.log('Saving connection to database...');
        const { error: dbError } = await supabase.from('wallet_telegram_mapping').upsert(
          {
            wallet_address: address.toLowerCase(),
            telegram_user_id: user.id,
            created_at: new Date().toISOString(),
          },
          {
            onConflict: 'wallet_address,telegram_user_id',
            ignoreDuplicates: false,
          },
        );

        if (dbError) {
          console.error('Database error:', dbError);
          throw dbError;
        }

        console.log('Sending Telegram notification...');
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
            },
          }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          console.error('Notification error:', errorData);
          throw new Error('Failed to send telegram notification');
        }

        console.log('Connection process completed successfully');
        setSuccess(true);
      } catch (err) {
        console.error('Connection process failed:', err);
        setError(err instanceof Error ? err.message : 'Failed to connect');
      } finally {
        setIsProcessing(false);
      }
    },
    [address, isProcessing, signMessageAsync],
  );

  const handleConnect = async () => {
    try {
      setError(undefined);
      const connector = await walletConnect({
        projectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID!,
        showQrModal: true,
        metadata: {
          name: 'PHI BOX',
          description: 'Connect your wallet with Telegram',
          url: window.location.origin,
          icons: [`${window.location.origin}/logo.png`],
        },
      });

      await connect({ connector });
    } catch (err) {
      console.error('Wallet connection error:', err);
      setError(err instanceof Error ? err.message : 'Failed to connect wallet. Please try again.');
    }
  };

  const handleDisconnect = () => {
    disconnect();
    setSuccess(false);
    setError(undefined);
  };

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted || !isConnected) return;

    const container = document.getElementById('telegram-login');
    if (!container) {
      console.error('Telegram login container not found');
      return;
    }

    const cleanup = () => {
      console.log('Cleaning up Telegram widget...');
      container.innerHTML = '';
      window.onTelegramAuth = undefined;
      window.handleTelegramAuth = undefined;
    };

    cleanup();

    window.onTelegramAuth = handleTelegramAuth;
    window.handleTelegramAuth = handleTelegramAuth;

    const script = document.createElement('script');
    script.async = true;
    script.src = 'https://telegram.org/js/telegram-widget.js?22';

    script.setAttribute('data-telegram-login', 'phi_box_bot');
    script.setAttribute('data-size', 'large');
    script.setAttribute('data-onauth', 'handleTelegramAuth(user)');
    script.setAttribute('data-request-access', 'write');

    script.onload = () => {
      console.log('Telegram widget script loaded successfully');
      console.log('Auth handlers status:', {
        onTelegramAuth: !!window.onTelegramAuth,
        handleTelegramAuth: !!window.handleTelegramAuth,
        TelegramSDK: !!window.Telegram,
      });
    };

    script.onerror = (error) => {
      console.error('Failed to load Telegram widget script:', error);
      setError('Failed to load Telegram login widget');
    };

    container.appendChild(script);

    return cleanup;
  }, [mounted, address, isConnected, handleTelegramAuth]);

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

      {isProcessing && (
        <div className='p-4 bg-blue-50 text-blue-600 rounded-lg text-center'>
          <p>Connecting your accounts...</p>
        </div>
      )}

      {!isConnected ? (
        <div className='space-y-4'>
          <p className='text-center text-gray-600'>Connect your wallet to get started</p>
          <button
            onClick={handleConnect}
            className='w-full px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors disabled:opacity-50'
            disabled={isProcessing}
          >
            Connect with WalletConnect
          </button>
        </div>
      ) : (
        <div className='space-y-6'>
          <div className='space-y-4'>
            <p className='text-center text-gray-600'>
              {isProcessing ? 'Connecting...' : 'Connect your Telegram account'}
            </p>
            <div id='telegram-login' className='flex justify-center' />
          </div>

          <div className='space-y-2 pt-4 border-t border-gray-200'>
            <div className='text-sm text-gray-600 text-center break-all'>Connected: {address}</div>
            <button
              onClick={handleDisconnect}
              className='w-full px-4 py-2 text-red-500 hover:text-red-600 text-sm transition-colors disabled:opacity-50'
              disabled={isProcessing}
            >
              Disconnect Wallet
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
