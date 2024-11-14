// app/connect.tsx
'use client';

import { useAccount, useConnect, useDisconnect } from 'wagmi';
import { injected } from 'wagmi/connectors';
import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);

export function Connect() {
  const [mounted, setMounted] = useState(false);
  const { address, isConnected } = useAccount();
  const { connect } = useConnect();
  const { disconnect } = useDisconnect();
  const [status, setStatus] = useState<'disconnected' | 'connecting' | 'connected'>('disconnected');

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (address) {
      setStatus('connecting');
      checkConnection(address);
    } else {
      setStatus('disconnected');
    }
  }, [address]);

  const checkConnection = async (walletAddress: string) => {
    try {
      const { data } = await supabase
        .from('wallet_telegram_mapping')
        .select()
        .eq('wallet_address', walletAddress.toLowerCase())
        .single();

      if (data && isConnected) {
        setStatus('connected');
      } else {
        setStatus('disconnected');
      }
    } catch (error) {
      console.error('Error checking connection:', error);
      setStatus('disconnected');
      // 適切なエラーメッセージを表示する
    }
  };

  const openTelegramBot = () => {
    if (!address) return;
    window.open(`https://t.me/${process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME}?start=${address}`, '_blank');
  };

  if (!mounted) return null;

  return (
    <div className='flex flex-col items-center gap-8'>
      <div className='flex flex-col items-center gap-4 w-full'>
        {!isConnected ? (
          <div className='space-y-4 w-full text-center'>
            <h2 className='text-lg font-medium'>Step 1: Connect Your Wallet</h2>
            <button
              onClick={() => connect({ connector: injected() })}
              className='w-full px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600'
            >
              Connect Wallet
            </button>
          </div>
        ) : status === 'connected' ? (
          <div className='text-center space-y-4'>
            <div className='bg-green-100 text-green-800 p-4 rounded-lg'>
              <p className='font-bold mb-2'>✅ Successfully Connected!</p>
              <p className='text-sm'>Your wallet is linked to Telegram.</p>
            </div>
            <div className='font-mono text-sm break-all bg-gray-100 p-2 rounded'>{address}</div>
            <button onClick={() => disconnect()} className='px-4 py-2 text-red-600 hover:text-red-700 text-sm'>
              Disconnect Wallet
            </button>
          </div>
        ) : status === 'connecting' ? (
          <div className='text-center'>
            <p>Connecting...</p>
          </div>
        ) : (
          <div className='space-y-6 w-full text-center'>
            <div className='space-y-2'>
              <h2 className='text-lg font-medium'>Step 2: Connect Telegram</h2>
              <p className='text-sm text-gray-600'>Click below to connect your Telegram account</p>
            </div>

            <div className='space-y-4'>
              <button
                onClick={openTelegramBot}
                className='w-full px-4 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 flex items-center justify-center gap-2'
              >
                <svg className='w-6 h-6' viewBox='0 0 24 24' fill='currentColor'>
                  <path d='M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69.01-.03.01-.14-.07-.2-.08-.06-.19-.04-.27-.02-.11.02-1.93 1.23-5.46 3.62-.51.35-.98.53-1.39.52-.46-.01-1.33-.26-1.98-.48-.8-.27-1.43-.42-1.38-.89.03-.25.38-.51 1.07-.78 4.19-1.82 6.98-3.03 8.37-3.61 3.98-1.67 4.81-1.96 5.35-1.97.12 0 .37.03.54.18.14.12.18.28.2.45-.02.07-.02.13-.03.21z' />
                </svg>
                Open Telegram Bot
              </button>

              <div className='text-sm text-gray-500'>
                1. Click the button above to open our Telegram bot
                <br />
                2. Start the bot and follow its instructions
                <br />
                3. Your wallet will be automatically connected
              </div>
            </div>

            <div className='pt-4'>
              <button onClick={() => disconnect()} className='text-sm text-gray-500 hover:text-gray-700'>
                Cancel and disconnect wallet
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
