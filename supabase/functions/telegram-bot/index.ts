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

interface DisconnectedEvent {
  walletAddress: string;
}

interface DailyClaimEvent {
  artists: {
    artist: string;
    quantity: number;
  }[];
  date: string;
}

interface RewardsDepositEvent {
  receiver: string;
  minter: string;
  referral: string;
  verifier: string;
  transactionHash: string;
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { type, data } = await req.json();

    switch (type) {
      case 'Connected': {
        const { telegramId, walletAddress } = data as ConnectedEvent;
        const normalizedWalletAddress = walletAddress.toLowerCase();

        try {
          const { error: deleteError } = await supabase
            .from('wallet_telegram_mapping')
            .delete()
            .or(`wallet_address.eq.${normalizedWalletAddress},telegram_user_id.eq.${telegramId}`);

          if (deleteError) {
            console.error('Database delete error:', deleteError);
          }

          await new Promise((resolve) => setTimeout(resolve, 200));

          const { error: upsertError } = await supabase.from('wallet_telegram_mapping').upsert(
            {
              wallet_address: normalizedWalletAddress,
              telegram_user_id: telegramId,
            },
            {
              onConflict: 'wallet_address,telegram_user_id',
              ignoreDuplicates: false,
            },
          );

          if (upsertError) {
            throw upsertError;
          }

          await sendTelegramMessage(
            telegramId,
            `
✅ *Successfully Connected!*

Your Telegram account is now linked to:
\`${walletAddress}\`
            `,
          );

          return new Response(JSON.stringify({ success: true, message: 'Welcome message sent' }), {
            status: 200,
            headers: {
              ...corsHeaders,
              'Content-Type': 'application/json',
            },
          });
        } catch (error) {
          console.error('Database error:', error);
          throw error;
        }
      }

      case 'Disconnected': {
        const { walletAddress } = data as DisconnectedEvent;
        const normalizedWalletAddress = walletAddress.toLowerCase();

        try {
          const { data: userData, error: selectError } = await supabase
            .from('wallet_telegram_mapping')
            .select('telegram_user_id')
            .eq('wallet_address', normalizedWalletAddress)
            .single();

          if (selectError) {
            console.error('Database select error:', selectError);
            throw selectError;
          }

          if (userData) {
            await sendTelegramMessage(
              userData.telegram_user_id,
              `
❌ *Wallet Disconnected*

Your wallet has been disconnected:
\`${walletAddress}\`
              `,
            );

            const { error: deleteError } = await supabase
              .from('wallet_telegram_mapping')
              .delete()
              .eq('wallet_address', normalizedWalletAddress);

            if (deleteError) {
              console.error('Database delete error:', deleteError);
              throw deleteError;
            }
          }

          return new Response(JSON.stringify({ success: true, message: 'Disconnect notification sent' }), {
            status: 200,
            headers: {
              ...corsHeaders,
              'Content-Type': 'application/json',
            },
          });
        } catch (error) {
          console.error('Database error:', error);
          throw error;
        }
      }
      case 'DailyClaim': {
        const { artists } = data as DailyClaimEvent;
        const utcDate = new Date().toISOString().split('T')[0];

        for (const { artist, quantity } of artists) {
          const { data: userData, error: dbError } = await supabase
            .from('wallet_telegram_mapping')
            .select('telegram_user_id')
            .eq('wallet_address', artist.toLowerCase())
            .single();

          if (dbError) {
            console.error(`Database error for artist ${artist}:`, dbError);
            continue;
          }

          if (userData) {
            try {
              await sendTelegramMessage(
                userData.telegram_user_id,
                `
  📊 *Daily Claim Report (UTC)*
  
  Date: ${utcDate}
  Total Claims: ${quantity} Art${quantity > 1 ? 's' : ''}
                `,
              );
            } catch (error) {
              console.error(`Failed to send notification to artist ${artist}:`, error);
            }
          }
        }

        return new Response(JSON.stringify({ success: true, message: 'Daily claim notifications sent' }), {
          status: 200,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
          },
        });
      }
      case 'RewardsDeposit': {
        const { receiver, minter, referral, verifier, transactionHash } = data as RewardsDepositEvent;
        const addresses = [receiver, minter, referral, verifier];
        const uniqueAddresses = [...new Set(addresses)];

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

        return new Response(JSON.stringify({ success: true, message: 'Notifications sent' }), {
          status: 200,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
          },
        });
      }

      default:
        return new Response(JSON.stringify({ success: false, error: 'Invalid event type' }), {
          status: 400,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
          },
        });
    }
  } catch (error) {
    console.error('Function error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error',
      }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      },
    );
  }
});
