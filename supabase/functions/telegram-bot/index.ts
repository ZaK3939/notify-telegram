// supabase/functions/telegram-bot/index.ts
import { serve } from 'std/http/server.ts';
import { createClient } from '@supabase/supabase-js';

// 必要なのはTelegram Bot Tokenだけ
const telegramToken = Deno.env.get('TELEGRAM_BOT_TOKEN');

if (!telegramToken) {
  console.error('TELEGRAM_BOT_TOKEN is missing');
  Deno.exit(1);
}

// Supabaseクライアントは自動的に適切な認証情報で初期化される
const supabase = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_ANON_KEY') ?? '');

// Telegramへメッセージを送信する関数
async function sendTelegramMessage(chatId: number, text: string, parseMode = 'Markdown') {
  const response = await fetch(`https://api.telegram.org/bot${telegramToken}/sendMessage`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      chat_id: chatId,
      text: text,
      parse_mode: parseMode,
    }),
  });

  if (!response.ok) {
    throw new Error(`Telegram API error: ${await response.text()}`);
  }
}

// EOAアドレスのバリデーション
const isValidEOA = (address: string) => /^0x[a-fA-F0-9]{40}$/.test(address);

serve(async (req) => {
  try {
    const update = await req.json();
    const { message } = update;

    if (!message) {
      return new Response('No message', { status: 400 });
    }

    const chatId = message.chat.id;
    const text = message.text;

    // /start <address> コマンドの処理
    if (text?.startsWith('/start ')) {
      const address = text.split(' ')[1]?.toLowerCase();

      if (!address || !isValidEOA(address)) {
        await sendTelegramMessage(
          chatId,
          `
❌ *Invalid EOA Address*

Please provide a valid Ethereum address.
Example: \`0x742d35Cc6634C0532925a3b844Bc454e4438f44e\`
        `,
        );
        return new Response('Invalid address', { status: 400 });
      }

      try {
        // 既存の連携確認
        const { data: existing } = await supabase
          .from('wallet_telegram_mapping')
          .select()
          .eq('wallet_address', address)
          .eq('telegram_chat_id', chatId.toString())
          .single();

        if (existing) {
          await sendTelegramMessage(
            chatId,
            `
⚠️ *Already Connected*

This wallet address is already connected to your Telegram account.

*Connected Address:*
\`${address}\`
          `,
          );
          return new Response('Already connected', { status: 200 });
        }

        // 新規登録
        const { error } = await supabase.from('wallet_telegram_mapping').insert({
          wallet_address: address,
          telegram_chat_id: chatId.toString(),
        });

        if (error) throw error;

        await sendTelegramMessage(
          chatId,
          `
✅ *Successfully Connected!*

Your Telegram account is now linked to:
\`${address}\`

You will receive notifications for:
📥 Receiver Events
🔨 Minter Events
🤝 Referral Events
✅ Verifier Events

*Available Commands:*
/status - Check your connected wallets
/disconnect - Remove connection
        `,
        );

        return new Response('Connected successfully', { status: 200 });
      } catch (error) {
        console.error('Error:', error);
        await sendTelegramMessage(
          chatId,
          `
❌ *Connection Failed*

There was an error connecting your wallet.
Please try again or contact support.
        `,
        );
        throw error;
      }
    }

    // /status コマンドの処理
    if (text === '/status') {
      try {
        const { data } = await supabase
          .from('wallet_telegram_mapping')
          .select('wallet_address')
          .eq('telegram_chat_id', chatId.toString());

        if (!data?.length) {
          await sendTelegramMessage(
            chatId,
            `
ℹ️ *No Connected Wallets*

Use \`/start <wallet-address>\` to connect your wallet.
          `,
          );
        } else {
          const addresses = data.map((d) => d.wallet_address).join('\n');
          await sendTelegramMessage(
            chatId,
            `
📱 *Connected Wallets*

${data.map((d) => `\`${d.wallet_address}\``).join('\n')}

You will receive notifications for all events related to these addresses.
          `,
          );
        }

        return new Response('Status checked', { status: 200 });
      } catch (error) {
        console.error('Error:', error);
        throw error;
      }
    }

    // /disconnect コマンドの処理
    if (text === '/disconnect') {
      try {
        const { error } = await supabase
          .from('wallet_telegram_mapping')
          .delete()
          .eq('telegram_chat_id', chatId.toString());

        if (error) throw error;

        await sendTelegramMessage(
          chatId,
          `
✅ *Successfully Disconnected*

All wallet connections have been removed.
Use \`/start <wallet-address>\` to connect a new wallet.
        `,
        );

        return new Response('Disconnected successfully', { status: 200 });
      } catch (error) {
        console.error('Error:', error);
        throw error;
      }
    }

    // その他のコマンドの場合
    return new Response('OK', { status: 200 });
  } catch (error) {
    console.error('Function error:', error);
    return new Response('Error', { status: 500 });
  }
});
