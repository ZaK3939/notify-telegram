create table "public"."wallet_telegram_mapping" (
    "id" uuid not null default gen_random_uuid(),
    "wallet_address" text not null,
    "telegram_user_id" bigint not null,
    "created_at" timestamp with time zone default now()
);


alter table "public"."wallet_telegram_mapping" enable row level security;

CREATE INDEX idx_telegram_user_id ON public.wallet_telegram_mapping USING btree (telegram_user_id);

CREATE INDEX idx_wallet_address ON public.wallet_telegram_mapping USING btree (wallet_address);

CREATE UNIQUE INDEX unique_wallet_telegram ON public.wallet_telegram_mapping USING btree (wallet_address, telegram_user_id);

CREATE UNIQUE INDEX wallet_telegram_mapping_pkey ON public.wallet_telegram_mapping USING btree (id);

alter table "public"."wallet_telegram_mapping" add constraint "wallet_telegram_mapping_pkey" PRIMARY KEY using index "wallet_telegram_mapping_pkey";

alter table "public"."wallet_telegram_mapping" add constraint "unique_wallet_telegram" UNIQUE using index "unique_wallet_telegram";

alter table "public"."wallet_telegram_mapping" add constraint "wallet_telegram_mapping_telegram_user_id_check" CHECK ((telegram_user_id > 0)) not valid;

alter table "public"."wallet_telegram_mapping" validate constraint "wallet_telegram_mapping_telegram_user_id_check";

alter table "public"."wallet_telegram_mapping" add constraint "wallet_telegram_mapping_wallet_address_check" CHECK ((wallet_address ~ '^0x[a-fA-F0-9]{40}$'::text)) not valid;

alter table "public"."wallet_telegram_mapping" validate constraint "wallet_telegram_mapping_wallet_address_check";

grant delete on table "public"."wallet_telegram_mapping" to "anon";

grant insert on table "public"."wallet_telegram_mapping" to "anon";

grant references on table "public"."wallet_telegram_mapping" to "anon";

grant select on table "public"."wallet_telegram_mapping" to "anon";

grant trigger on table "public"."wallet_telegram_mapping" to "anon";

grant truncate on table "public"."wallet_telegram_mapping" to "anon";

grant update on table "public"."wallet_telegram_mapping" to "anon";

grant delete on table "public"."wallet_telegram_mapping" to "authenticated";

grant insert on table "public"."wallet_telegram_mapping" to "authenticated";

grant references on table "public"."wallet_telegram_mapping" to "authenticated";

grant select on table "public"."wallet_telegram_mapping" to "authenticated";

grant trigger on table "public"."wallet_telegram_mapping" to "authenticated";

grant truncate on table "public"."wallet_telegram_mapping" to "authenticated";

grant update on table "public"."wallet_telegram_mapping" to "authenticated";

grant delete on table "public"."wallet_telegram_mapping" to "service_role";

grant insert on table "public"."wallet_telegram_mapping" to "service_role";

grant references on table "public"."wallet_telegram_mapping" to "service_role";

grant select on table "public"."wallet_telegram_mapping" to "service_role";

grant trigger on table "public"."wallet_telegram_mapping" to "service_role";

grant truncate on table "public"."wallet_telegram_mapping" to "service_role";

grant update on table "public"."wallet_telegram_mapping" to "service_role";

create policy "Enable insert for service role"
on "public"."wallet_telegram_mapping"
as permissive
for insert
to public
with check (true);


create policy "Enable read for all users"
on "public"."wallet_telegram_mapping"
as permissive
for select
to public
using (true);


create policy "Enable update for service role"
on "public"."wallet_telegram_mapping"
as permissive
for update
to public
using (true)
with check (true);



