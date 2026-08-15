-- ============================================================
-- DIAGNÓSTICO SOLO LECTURA — estructura REAL de personal_backups
-- Ejecutar en Supabase > SQL Editor (proyecto fzkpgrvqncqnmvagbjaf).
-- NO modifica nada: solo SELECTs de catálogo. Pega la salida aquí.
-- ============================================================

-- 1) Columnas reales de la tabla (¿user_id es not null? ¿hay id?).
select column_name, data_type, is_nullable, column_default
from information_schema.columns
where table_schema='public' and table_name='personal_backups'
order by ordinal_position;

-- 2) Restricciones (PK / UNIQUE): el upsert usa on_conflict=user_id.
select conname, contype, pg_get_constraintdef(oid) as definicion
from pg_constraint
where conrelid='public.personal_backups'::regclass;

-- 3) Políticas RLS reales (SELECT/UPDATE/INSERT): una política UPDATE ausente
--    haría que el upsert responda ok pero no modifique la fila.
select policyname, cmd, qual, with_check
from pg_policies
where schemaname='public' and tablename='personal_backups';

-- 4) Disparadores (triggers) sobre la tabla: cualquiera que reescriba data
--    o updated_at explicaría "escribo 53 y queda 42".
select tgname, pg_get_triggerdef(oid) as definicion
from pg_trigger
where tgrelid='public.personal_backups'::regclass and not tgisinternal;

-- 5) Publicación Realtime de la tabla.
select pubname, tablename
from pg_publication_tables
where tablename='personal_backups';

-- 6) Resumen de la fila (sin contenido): cantidad y fechas.
select count(*) as filas, min(updated_at) as mas_antigua, max(updated_at) as mas_reciente
from public.personal_backups;
