// supabase/functions/telegram-bot/index.ts
import { serve } from 'std/http/server.ts';
import { createClient } from '@supabase/supabase-js';

const telegramToken = Deno.env.get('TELEGRAM_BOT_TOKEN');

if (!telegramToken) {
  console.error('TELEGRAM_BOT_TOKEN is missing');
  Deno.exit(1);
}

const supabase = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_ANON_KEY') ?? '');

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

serve(async (req) => {
  try {
    const { type, data } = await req.json();

    // 連携完了時の通知
    if (type === 'Connected') {
      const { telegramId, walletAddress } = data;
      await sendTelegramMessage(
        parseInt(telegramId),
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

    // RewardsDeposit イベントの処理
    if (type === 'RewardsDeposit') {
      const { receiver, minter, referral, verifier, transactionHash } = data;
      const addresses = [receiver, minter, referral, verifier];
      const uniqueAddresses = [...new Set(addresses)];

      for (const address of uniqueAddresses) {
        const { data: userData } = await supabase
          .from('wallet_telegram_mapping')
          .select('telegram_chat_id')
          .eq('wallet_address', address.toLowerCase())
          .single();

        if (userData) {
          let role = '';
          if (address === receiver) role = '📥 Receiver';
          else if (address === minter) role = '🔨 Minter';
          else if (address === referral) role = '🤝 Referral';
          else if (address === verifier) role = '✅ Verifier';

          await sendTelegramMessage(
            parseInt(userData.telegram_chat_id),
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
        }
      }
      return new Response('Notifications sent', { status: 200 });
    }

    return new Response('OK', { status: 200 });
  } catch (error) {
    console.error('Function error:', error);
    return new Response('Error', { status: 500 });
  }
});
