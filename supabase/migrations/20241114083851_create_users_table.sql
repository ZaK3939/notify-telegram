-- bot/supabase/migrations/20240314000000_create_wallet_telegram_mapping.sql
create table if not exists public.wallet_telegram_mapping (
  id uuid default gen_random_uuid() primary key,
  wallet_address text not null,
  telegram_chat_id text not null,
  created_at timestamptz default now(),
  
  -- ウォレットアドレスとTelegram Chat IDの組み合わせはユニーク
  constraint unique_wallet_telegram unique (wallet_address, telegram_chat_id)
);

-- インデックス
create index if not exists idx_wallet_address on wallet_telegram_mapping(wallet_address);
create index if not exists idx_telegram_chat_id on wallet_telegram_mapping(telegram_chat_id);

-- RLSポリシー
alter table public.wallet_telegram_mapping enable row level security;

-- botからの読み取り・書き込みを許可
create policy "Bot service can read and write"
  on public.wallet_telegram_mapping
  using (true)
  with check (true);