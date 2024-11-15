drop policy "Enable insert for authenticated users only" on "public"."wallet_telegram_mapping";

drop policy "Enable read for all users" on "public"."wallet_telegram_mapping";

revoke delete on table "public"."wallet_telegram_mapping" from "anon";

revoke insert on table "public"."wallet_telegram_mapping" from "anon";

revoke references on table "public"."wallet_telegram_mapping" from "anon";

revoke select on table "public"."wallet_telegram_mapping" from "anon";

revoke trigger on table "public"."wallet_telegram_mapping" from "anon";

revoke truncate on table "public"."wallet_telegram_mapping" from "anon";

revoke update on table "public"."wallet_telegram_mapping" from "anon";

revoke delete on table "public"."wallet_telegram_mapping" from "authenticated";

revoke insert on table "public"."wallet_telegram_mapping" from "authenticated";

revoke references on table "public"."wallet_telegram_mapping" from "authenticated";

revoke select on table "public"."wallet_telegram_mapping" from "authenticated";

revoke trigger on table "public"."wallet_telegram_mapping" from "authenticated";

revoke truncate on table "public"."wallet_telegram_mapping" from "authenticated";

revoke update on table "public"."wallet_telegram_mapping" from "authenticated";

revoke delete on table "public"."wallet_telegram_mapping" from "service_role";

revoke insert on table "public"."wallet_telegram_mapping" from "service_role";

revoke references on table "public"."wallet_telegram_mapping" from "service_role";

revoke select on table "public"."wallet_telegram_mapping" from "service_role";

revoke trigger on table "public"."wallet_telegram_mapping" from "service_role";

revoke truncate on table "public"."wallet_telegram_mapping" from "service_role";

revoke update on table "public"."wallet_telegram_mapping" from "service_role";

alter table "public"."wallet_telegram_mapping" drop constraint "unique_wallet_telegram";

alter table "public"."wallet_telegram_mapping" drop constraint "wallet_telegram_mapping_telegram_user_id_check";

alter table "public"."wallet_telegram_mapping" drop constraint "wallet_telegram_mapping_wallet_address_check";

alter table "public"."wallet_telegram_mapping" drop constraint "wallet_telegram_mapping_pkey";

drop index if exists "public"."idx_telegram_user_id";

drop index if exists "public"."idx_wallet_address";

drop index if exists "public"."unique_wallet_telegram";

drop index if exists "public"."wallet_telegram_mapping_pkey";

drop table "public"."wallet_telegram_mapping";

set check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.handle_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
begin
  new.updated_at = now();
  return new;
end;
$function$
;


