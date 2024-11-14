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
  const [chatId, setChatId] = useState('');
  const [status, setStatus] = useState<'disconnected' | 'connecting' | 'connected'>('disconnected');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!address) return;
    checkConnection(address);
  }, [address]);

  // Supabaseで既存の連携をチェック
  const checkConnection = async (walletAddress: string) => {
    try {
      const { data, error } = await supabase
        .from('wallet_telegram_mapping')
        .select()
        .eq('wallet_address', walletAddress.toLowerCase())
        .single();

      if (error) {
        if (error.code !== 'PGRST116') {
          // PGRST116 は "データが見つからない" エラー
          throw error;
        }
      }

      if (data) {
        setStatus('connected');
        setChatId(data.telegram_chat_id);
      } else {
        setStatus('disconnected');
      }
    } catch (error) {
      console.error('Error checking connection:', error);
      setError('Failed to check existing connection');
    }
  };

  // Telegram連携処理
  const handleTelegramConnect = async () => {
    if (!address || !chatId) return;
    setStatus('connecting');
    setError(null);

    try {
      const { error } = await supabase.from('wallet_telegram_mapping').insert({
        wallet_address: address.toLowerCase(),
        telegram_chat_id: chatId,
      });

      if (error) throw error;

      setStatus('connected');
    } catch (error) {
      console.error('Error connecting:', error);
      setError('Failed to connect with Telegram');
      setStatus('disconnected');
    }
  };

  // クライアントサイドでのレンダリングを確認
  if (!mounted) return null;

  return (
    <div className='flex flex-col items-center gap-8'>
      {/* エラーメッセージ */}
      {error && <div className='w-full p-4 bg-red-100 text-red-700 rounded-md text-sm'>{error}</div>}

      {/* ウォレット接続 */}
      <div className='flex flex-col items-center gap-4 w-full'>
        {!isConnected ? (
          <button
            onClick={() => connect({ connector: injected() })}
            className='w-full px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600'
          >
            Connect Wallet
          </button>
        ) : (
          <div className='flex flex-col items-center gap-2 w-full'>
            <p className='font-mono break-all text-sm text-center'>{address}</p>
            <button
              onClick={() => disconnect()}
              className='w-full px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600'
            >
              Disconnect
            </button>
          </div>
        )}
      </div>

      {/* Telegram接続 */}
      {isConnected && status !== 'connected' && (
        <div className='flex flex-col items-center gap-4 w-full'>
          <div className='flex flex-col gap-2 items-center'>
            <a
              href={`https://t.me/${process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME}`}
              target='_blank'
              rel='noopener noreferrer'
              className='w-full px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 text-center'
            >
              Open Telegram Bot
            </a>
            <p className='text-sm text-gray-600'>Get your Chat ID from the bot and enter it below:</p>
          </div>

          <input
            type='text'
            value={chatId}
            onChange={(e) => setChatId(e.target.value)}
            placeholder='Enter Telegram Chat ID'
            className='w-full px-4 py-2 border rounded'
          />

          <button
            onClick={handleTelegramConnect}
            disabled={!chatId || status === 'connecting'}
            className='w-full px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 disabled:opacity-50'
          >
            {status === 'connecting' ? 'Connecting...' : 'Connect Telegram'}
          </button>
        </div>
      )}

      {/* 接続完了状態 */}
      {status === 'connected' && (
        <div className='text-center'>
          <p className='text-green-500 font-bold'>✅ Connected!</p>
          <p className='text-sm text-gray-600'>You will now receive notifications in Telegram.</p>
        </div>
      )}
    </div>
  );
}
