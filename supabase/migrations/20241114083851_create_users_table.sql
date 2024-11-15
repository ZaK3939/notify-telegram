create table if not exists public.wallet_telegram_mapping (
  id uuid default gen_random_uuid() primary key,
  wallet_address text not null check (wallet_address ~ '^0x[a-fA-F0-9]{40}$'),
  telegram_user_id bigint not null check (telegram_user_id > 0),
  created_at timestamptz default now(),
  
  constraint unique_wallet_telegram unique (wallet_address, telegram_user_id)
);

-- インデックス
create index if not exists idx_wallet_address on wallet_telegram_mapping(wallet_address);
create index if not exists idx_telegram_user_id on wallet_telegram_mapping(telegram_user_id);

-- RLSポリシー
alter table public.wallet_telegram_mapping enable row level security;

create policy "Bot service can read and write"
  on public.wallet_telegram_mapping
  using (true)
  with check (true);