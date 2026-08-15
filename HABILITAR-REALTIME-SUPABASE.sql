-- ============================================================
-- HABILITAR REALTIME (SEGURO) — ejecutar UNA sola vez.
--
-- IMPORTANTE: ejecutar en el proyecto DEDICADO que usa la app:
--     https://fzkpgrvqncqnmvagbjaf.supabase.co
-- (verificado por HTTP 200 en las 9 tablas; si sale 42P01 es que
--  el SQL Editor está apuntando a OTRO proyecto del panel).
--
-- NO crea tablas, NO toca RLS, NO borra ni modifica datos:
-- solo agrega a la publicación 'supabase_realtime' las tablas que
-- EXISTEN de verdad y que no estén ya incluidas. Las que no existan
-- o ya estén, se omiten con un aviso (nunca un error).
-- ============================================================
do $$
declare t text;
begin
  foreach t in array array['personal_backups','ajustes','peso','comidas','calorias','proteina','ejercicios','pasos','gastos']
  loop
    if to_regclass('public.'||t) is not null then
      if not exists (
        select 1 from pg_publication_tables
        where pubname='supabase_realtime' and schemaname='public' and tablename=t
      ) then
        execute format('alter publication supabase_realtime add table public.%I', t);
        raise notice '✔ realtime habilitado para %', t;
      else
        raise notice '— % ya estaba en supabase_realtime (se omite)', t;
      end if;
    else
      raise notice '✘ tabla % NO existe en este proyecto (se omite)', t;
    end if;
  end loop;
end $$;
