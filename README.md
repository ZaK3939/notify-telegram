# deno がなければインストール

curl -fsSL https://deno.land/x/install/install.sh | sh

# 一度プロジェクトをリンク（まだの場合）

supabase link --project-ref your-project-ref

# 環境変数の設定

supabase secrets set TELEGRAM_BOT_TOKEN=your_bot_token

# Edge Function のデプロイ

supabase functions deploy telegram-bot --no-verify-jwt

# デプロイされた function URL の確認

supabase functions describe telegram-bot
notify
