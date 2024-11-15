-- Drop table if exists (optional)
drop table if exists public.wallet_telegram_mapping;

-- Create the wallet_telegram_mapping table
create table public.wallet_telegram_mapping (
    id uuid primary key default uuid_generate_v4(),
    wallet_address text not null check (wallet_address ~ '^0x[a-fA-F0-9]{40}$'),
    telegram_user_id bigint not null check (telegram_user_id > 0),
    created_at timestamptz default now(),
    
    constraint unique_wallet_telegram unique (wallet_address, telegram_user_id)
);

-- Create indexes
create index idx_wallet_address on public.wallet_telegram_mapping(wallet_address);
create index idx_telegram_user_id on public.wallet_telegram_mapping(telegram_user_id);

-- Setup RLS
alter table public.wallet_telegram_mapping enable row level security;

-- Create policies
create policy "Enable read for all users" 
    on public.wallet_telegram_mapping for select 
    using (true);

create policy "Enable insert for authenticated users only" 
    on public.wallet_telegram_mapping for insert 
    with check (true);

-- Grant privileges
grant usage on schema public to postgres, anon, authenticated, service_role;
grant all privileges on public.wallet_telegram_mapping to postgres, anon, authenticated, service_role;