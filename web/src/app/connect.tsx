'use client';

import { useState, useEffect } from 'react';
import { useAccount, useSignMessage, useConnect, useDisconnect } from 'wagmi';
import { createClient } from '@supabase/supabase-js';
import { verifyMessage } from 'viem';
import { injected } from 'wagmi/connectors';
import crypto from 'crypto';

// Initialize Supabase client
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);

// Types for Telegram authentication
interface TelegramUser {
  id: number;
  first_name?: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
  auth_date: number;
  hash: string;
}

// Extend window object to include Telegram callback
declare global {
  interface Window {
    handleTelegramAuth: (user: TelegramUser) => void;
  }
}

// Function to verify Telegram authentication data
function verifyTelegramAuth(telegramData: TelegramUser): boolean {
  const botToken = process.env.NEXT_PUBLIC_TELEGRAM_BOT_TOKEN;
  if (!botToken) {
    console.error('Telegram bot token is not configured');
    return false;
  }

  const { hash, ...data } = telegramData;

  // Create data check string by sorting fields alphabetically
  const checkString = Object.entries(data)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`)
    .join('\n');

  // Generate secret key from bot token
  const secretKey = crypto.createHash('sha256').update(botToken).digest();

  // Calculate HMAC signature
  const hmac = crypto.createHmac('sha256', secretKey).update(checkString).digest('hex');

  // Compare calculated hash with received hash
  return hmac === hash;
}

export function Connect() {
  // Component state
  const [mounted, setMounted] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string>();
  const [success, setSuccess] = useState(false);

  // Wagmi hooks
  const { address, isConnected } = useAccount();
  const { connect } = useConnect();
  const { disconnect } = useDisconnect();
  const { signMessageAsync } = useSignMessage();

  // Handle component mounting
  useEffect(() => {
    setMounted(true);
  }, []);

  // Setup Telegram login widget and handle authentication
  useEffect(() => {
    if (!mounted || !isConnected) return;

    const container = document.getElementById('telegram-login');
    if (container) {
      // Clear existing content
      container.innerHTML = '';

      // Create and configure Telegram widget script
      const script = document.createElement('script');
      script.async = true;
      script.src = 'https://telegram.org/js/telegram-widget.js?22';
      script.setAttribute('data-telegram-login', 'phi_box_bot');
      script.setAttribute('data-size', 'large');
      script.setAttribute('data-radius', '8');
      script.setAttribute('lang', 'en');
      script.setAttribute('data-request-access', 'write');
      script.setAttribute('data-onauth', 'handleTelegramAuth');
      script.setAttribute('data-auth-url', `${window.location.origin}/api/telegram-auth`);

      // Add debug logging
      console.log('Setting up Telegram widget:', {
        botUsername: 'phi_box_bot',
        origin: window.location.origin,
      });

      container.appendChild(script);
    }

    // Define Telegram authentication callback
    window.handleTelegramAuth = async (user: TelegramUser) => {
      if (!address || connecting) return;

      try {
        setConnecting(true);
        setError(undefined);

        console.log('Received Telegram auth data:', user);

        // Verify Telegram authentication data
        if (!verifyTelegramAuth(user)) {
          throw new Error('Invalid Telegram authentication data');
        }

        // Check authentication timestamp (1 hour validity)
        const authTimestamp = user.auth_date * 1000;
        const now = Date.now();
        if (now - authTimestamp > 3600000) {
          throw new Error('Telegram authentication has expired');
        }

        // Generate and sign message with wallet
        const nonce = Math.floor(Math.random() * 1000000);
        const message = `Connect Telegram with ${address} (nonce: ${nonce})`;
        console.log('Requesting message signature:', message);

        const signature = await signMessageAsync({ message });

        // Verify message signature
        const valid = await verifyMessage({
          address: address as `0x${string}`,
          message,
          signature,
        });

        if (!valid) {
          throw new Error('Wallet signature verification failed');
        }

        // Save to database
        console.log('Saving to database:', {
          walletAddress: address.toLowerCase(),
          telegramUserId: user.id,
        });

        const { error: dbError } = await supabase.from('wallet_telegram_mapping').upsert({
          wallet_address: address.toLowerCase(),
          telegram_user_id: user.id,
        });

        if (dbError) {
          console.error('Database error:', dbError);
          throw dbError;
        }

        // Send connection notification
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
          const responseData = await response.json().catch(() => ({}));
          console.error('Notification error:', responseData);
          throw new Error('Failed to send Telegram notification');
        }

        setSuccess(true);
      } catch (err) {
        console.error('Connection error:', err);
        setError(err instanceof Error ? err.message : 'Failed to connect');
      } finally {
        setConnecting(false);
      }
    };

    // Cleanup on unmount
    return () => {
      const container = document.getElementById('telegram-login');
      if (container) {
        container.innerHTML = '';
      }
    };
  }, [mounted, address, isConnected, connecting, signMessageAsync]);

  // Don't render until mounted
  if (!mounted) return null;

  return (
    <div className='space-y-8 w-full max-w-md'>
      <h2 className='text-2xl font-bold text-center'>Connect with Telegram</h2>

      {/* Error display */}
      {error && <div className='p-4 bg-red-50 text-red-600 rounded-lg text-center'>{error}</div>}

      {/* Success message */}
      {success && (
        <div className='p-4 bg-green-50 text-green-600 rounded-lg text-center'>
          <p className='font-bold'>✅ Successfully Connected!</p>
          <p className='text-sm mt-2'>Check your Telegram for confirmation.</p>
        </div>
      )}

      {/* Wallet connection */}
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
          {/* Telegram login widget */}
          <div className='space-y-4'>
            <p className='text-center text-gray-600'>Connect your Telegram account</p>
            <div id='telegram-login' className='flex justify-center' />
          </div>

          {/* Wallet info and disconnect button */}
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
