-- ============================================================
-- Esquema de la app personal (ya aplicado al proyecto dedicado).
-- Ejecuta este archivo UNA sola vez en Supabase > SQL Editor si
-- necesitas recrearlo en otro proyecto.
--
-- Cada usuario solo puede ver y editar SUS propios datos (RLS con
-- auth.uid() = user_id). No hay ninguna clave secreta aquí.
-- ============================================================

-- 1) Tablas por-ítem (sync local-first por elemento con client_id):
--    peso, comidas, calorias, proteina, ejercicios, pasos, gastos
do $$
declare t text;
begin
  foreach t in array array['peso','comidas','calorias','proteina','ejercicios','pasos','gastos']
  loop
    execute format($f$
      create table if not exists public.%I (
        id uuid primary key default gen_random_uuid(),
        user_id uuid not null references auth.users(id) on delete cascade,
        client_id text not null,
        data jsonb not null default '{}'::jsonb,
        updated_at timestamptz not null default now(),
        deleted boolean not null default false,
        unique(user_id, client_id)
      )$f$, t);
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists own_rows on public.%I', t);
    execute format($p$create policy own_rows on public.%I
        for all to authenticated
        using ((select auth.uid()) = user_id)
        with check ((select auth.uid()) = user_id)$p$, t);
    execute format('create index if not exists %I on public.%I (user_id, updated_at)',
        t || '_user_updated_idx', t);
  end loop;
end $$;

-- 2) Una fila por usuario: ajustes (configuración) + personal_backups (respaldo completo)
do $$
declare t text;
begin
  foreach t in array array['ajustes','personal_backups']
  loop
    execute format($f$
      create table if not exists public.%I (
        user_id uuid primary key references auth.users(id) on delete cascade,
        data jsonb not null default '{}'::jsonb,
        updated_at timestamptz not null default now()
      )$f$, t);
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists own_rows on public.%I', t);
    execute format($p$create policy own_rows on public.%I
        for all to authenticated
        using ((select auth.uid()) = user_id)
        with check ((select auth.uid()) = user_id)$p$, t);
  end loop;
end $$;

-- 3) Bucket privado para fotos/medios + políticas por carpeta de usuario
insert into storage.buckets (id,name,public)
values ('personal-media','personal-media',false)
on conflict (id) do nothing;

drop policy if exists "media_insert_own" on storage.objects;
create policy "media_insert_own" on storage.objects for insert to authenticated
  with check (bucket_id='personal-media' and (storage.foldername(name))[1]=auth.uid()::text);

drop policy if exists "media_update_own" on storage.objects;
create policy "media_update_own" on storage.objects for update to authenticated
  using (bucket_id='personal-media' and (storage.foldername(name))[1]=auth.uid()::text);

drop policy if exists "media_select_own" on storage.objects;
create policy "media_select_own" on storage.objects for select to authenticated
  using (bucket_id='personal-media' and (storage.foldername(name))[1]=auth.uid()::text);

drop policy if exists "media_delete_own" on storage.objects;
create policy "media_delete_own" on storage.objects for delete to authenticated
  using (bucket_id='personal-media' and (storage.foldername(name))[1]=auth.uid()::text);

-- ============================================================
-- TELEGRAM: buzón de entrada del bot (SOLO lectura/escritura del dueño)
-- ============================================================
-- El bot escribe aquí con un JWT de rol telegram_bot (firmado por el Worker
-- con un secreto configurado en Cloudflare); la app lee/actualiza con la
-- sesión normal del usuario. RLS existente NO se debilita: estas son
-- políticas NUEVAS de tablas NUEVAS.
create table if not exists public.telegram_inbox (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id),
  chat_id text,
  tipo text not null default 'ticket',      -- ticket | lista | nevera | comida
  texto text,
  imagen_url text,
  estado text not null default 'pendiente', -- pendiente | procesada | necesita_confirmacion
  created_at timestamptz not null default now()
);
alter table public.telegram_inbox enable row level security;

drop policy if exists "tg_own_select" on public.telegram_inbox;
create policy "tg_own_select" on public.telegram_inbox for select to authenticated
  using (auth.uid() = user_id);
drop policy if exists "tg_own_update" on public.telegram_inbox;
create policy "tg_own_update" on public.telegram_inbox for update to authenticated
  using (auth.uid() = user_id);
drop policy if exists "tg_own_delete" on public.telegram_inbox;
create policy "tg_own_delete" on public.telegram_inbox for delete to authenticated
  using (auth.uid() = user_id);

-- El bot (role telegram_bot) SOLO inserta filas para el usuario del JWT
-- (auth.uid() = user_id) y solo lee/marca su propio buzón.
drop policy if exists "tg_bot_insert" on public.telegram_inbox;
create policy "tg_bot_insert" on public.telegram_inbox for insert to telegram_bot
  with check (auth.uid() = user_id);
drop policy if exists "tg_bot_select" on public.telegram_inbox;
create policy "tg_bot_select" on public.telegram_inbox for select to telegram_bot
  using (auth.uid() = user_id);
drop policy if exists "tg_bot_update" on public.telegram_inbox;
create policy "tg_bot_update" on public.telegram_inbox for update to telegram_bot
  using (auth.uid() = user_id);

-- Rol del bot: SIN login, sin acceso a NINGUNA otra tabla.
do $$ begin
  if not exists (select 1 from pg_roles where rolname='telegram_bot') then
    create role telegram_bot nologin;
  end if;
end $$;
grant usage on schema public to telegram_bot;
grant select, insert, update on public.telegram_inbox to telegram_bot;

-- El bot sube la imagen del ticket a la carpeta del usuario en personal-media
-- (misma carpeta que usa la app: <uid>/telegram/<archivo>).
drop policy if exists "media_tg_insert" on storage.objects;
create policy "media_tg_insert" on storage.objects for insert to telegram_bot
  with check (bucket_id='personal-media' and (storage.foldername(name))[1]=auth.uid()::text);
drop policy if exists "media_tg_select" on storage.objects;
create policy "media_tg_select" on storage.objects for select to telegram_bot
  using (bucket_id='personal-media' and (storage.foldername(name))[1]=auth.uid()::text);
grant select, insert on storage.objects to telegram_bot;
