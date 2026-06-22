-- =====================================================================
-- FIX 401 — Remito público (ingresos_hacienda / egresos_hacienda)
-- =====================================================================
-- Causa real del 401: codigo Postgres 42501 "permission denied for table".
-- NO era la key (coincide con la vigente) ni el proyecto (Healthy) ni el
-- header Authorization. Al rol `anon` (el que usa el link publico del
-- remito, sin login) le falta el GRANT a nivel tabla.
--
-- OJO: en este proyecto las POLICIES RLS solas NO alcanzan. Hace falta
-- el GRANT explicito ademas de la policy (por eso `tropas` y
-- `movimientos_corral` de supabase_feria_etapa1.sql tambien dan 42501:
-- tienen policy pero les falta el GRANT).
--
-- Modelo elegido: leer + registrar (SELECT + INSERT). SIN update/delete,
-- asi nadie con la key publica puede modificar ni borrar registros.
-- Ejecutar en: Supabase Dashboard > SQL Editor (proyecto qkrrumlbvspbxjoxvxho)
-- =====================================================================

-- 1) GRANT a nivel tabla (esto es lo que faltaba). Solo SELECT e INSERT.
grant select, insert on table public.ingresos_hacienda to anon;
grant select, insert on table public.egresos_hacienda  to anon;

-- 2) RLS encendido + policies acotadas (leer e insertar; NO update/delete).
alter table public.ingresos_hacienda enable row level security;
alter table public.egresos_hacienda  enable row level security;

drop policy if exists "anon select ingresos" on public.ingresos_hacienda;
drop policy if exists "anon insert ingresos" on public.ingresos_hacienda;
create policy "anon select ingresos" on public.ingresos_hacienda for select to anon using (true);
create policy "anon insert ingresos" on public.ingresos_hacienda for insert to anon with check (true);

drop policy if exists "anon select egresos" on public.egresos_hacienda;
drop policy if exists "anon insert egresos" on public.egresos_hacienda;
create policy "anon select egresos" on public.egresos_hacienda for select to anon using (true);
create policy "anon insert egresos" on public.egresos_hacienda for insert to anon with check (true);

-- 3) (Solo si "Registrar" diera 42501 al insertar por una secuencia:
--     PK serial/identity). Si la PK es uuid gen_random_uuid() NO hace falta.
-- grant usage, select on all sequences in schema public to anon;

-- 4) Verificacion (debe devolver el conteo, NO "permission denied"):
-- select count(*) as ingresos from public.ingresos_hacienda;
-- select count(*) as egresos  from public.egresos_hacienda;

-- ---------------------------------------------------------------------
-- EXTRA (opcional, mismo bug): si queres que tropas / movimientos_corral
-- tambien funcionen desde el front, les falta el GRANT igual que arriba:
-- grant select, insert on table public.tropas             to anon;
-- grant select, insert on table public.movimientos_corral to anon;
-- ---------------------------------------------------------------------
