// supabase/functions/telegram-bot/index.ts

import { serve } from 'std/http/server.ts';
import { createClient } from '@supabase/supabase-js';

const telegramToken = Deno.env.get('TELEGRAM_BOT_TOKEN');

if (!telegramToken) {
  console.error('TELEGRAM_BOT_TOKEN is missing');
  Deno.exit(1);
}

const supabase = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_ANON_KEY') ?? '');

interface ConnectedEvent {
  telegramId: number;
  walletAddress: string;
  timestamp: string;
}

interface RewardsDepositEvent {
  receiver: string;
  minter: string;
  referral: string;
  verifier: string;
  transactionHash: string;
}

async function sendTelegramMessage(userId: number, text: string) {
  try {
    const response = await fetch(`https://api.telegram.org/bot${telegramToken}/sendMessage`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        chat_id: userId,
        text: text,
        parse_mode: 'Markdown',
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Telegram API error: ${errorText}`);
    }
  } catch (error) {
    console.error(`Failed to send message to user ${userId}:`, error);
    throw error;
  }
}

serve(async (req: Request) => {
  try {
    const { type, data } = await req.json();

    switch (type) {
      case 'Connected': {
        const { telegramId, walletAddress } = data as ConnectedEvent;

        // 新規連携の登録
        const { error: dbError } = await supabase.from('wallet_telegram_mapping').upsert({
          wallet_address: walletAddress.toLowerCase(),
          telegram_user_id: telegramId,
        });

        if (dbError) {
          console.error('Database error:', dbError);
          throw dbError;
        }

        // ウェルカムメッセージの送信
        await sendTelegramMessage(
          telegramId,
          `
✅ *Successfully Connected!*

Your Telegram account is now linked to:
\`${walletAddress}\`

You will receive notifications for:
📥 Receiver Events
🔨 Minter Events
🤝 Referral Events
✅ Verifier Events
          `,
        );

        return new Response('Welcome message sent', { status: 200 });
      }

      case 'RewardsDeposit': {
        const { receiver, minter, referral, verifier, transactionHash } = data as RewardsDepositEvent;
        const addresses = [receiver, minter, referral, verifier];
        const uniqueAddresses = [...new Set(addresses)];

        // 各アドレスに対応するユーザーに通知を送信
        for (const address of uniqueAddresses) {
          const { data: userData, error: dbError } = await supabase
            .from('wallet_telegram_mapping')
            .select('telegram_user_id')
            .eq('wallet_address', address.toLowerCase())
            .single();

          if (dbError) {
            console.error(`Database error for address ${address}:`, dbError);
            continue;
          }

          if (userData) {
            // ロールの判定
            let role = '';
            if (address === receiver) role = '📥 Receiver';
            else if (address === minter) role = '🔨 Minter';
            else if (address === referral) role = '🤝 Referral';
            else if (address === verifier) role = '✅ Verifier';

            try {
              await sendTelegramMessage(
                userData.telegram_user_id,
                `
🎉 *New RewardsDeposit Event* 🎉
${role ? `\nYou are the ${role}` : ''}

*Event Details:*
- Receiver: \`${receiver}\`
- Minter: \`${minter}\`
- Referral: \`${referral}\`
- Verifier: \`${verifier}\`

🔗 [View on Etherscan](https://etherscan.io/tx/${transactionHash})
                `,
              );
            } catch (error) {
              console.error(`Failed to send notification to user ${userData.telegram_user_id}:`, error);
            }
          }
        }

        return new Response('Notifications sent', { status: 200 });
      }

      default:
        return new Response('Invalid event type', { status: 400 });
    }
  } catch (error) {
    console.error('Function error:', error);
    return new Response(error.message, { status: 500 });
  }
});
