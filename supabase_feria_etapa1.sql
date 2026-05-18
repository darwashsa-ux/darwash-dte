-- =====================================================================
-- ETAPA 1 — Feria en Vivo (extraferia + base para feria de remate)
-- Ejecutar en Supabase Dashboard > SQL Editor
-- =====================================================================

-- TABLA: tropas
-- Unidad central de trazabilidad. Cada tropa representa un grupo de
-- animales que pertenece a un propietario/empresa y comparte categoría.
create table if not exists public.tropas (
  id              uuid        primary key default gen_random_uuid(),
  created_at      timestamptz not null default now(),
  codigo_tropa    text        not null,
  propietario     text,
  empresa         text,
  tipo_origen     text        not null check (tipo_origen in ('remate','extraferia')),
  remate_codigo   text,
  categoria       text        not null,
  cabezas_inicial integer     not null check (cabezas_inicial >= 0),
  observaciones   text,
  usuario         text,
  estado          text        not null default 'activa' check (estado in ('activa','cerrada'))
);

create index if not exists tropas_tipo_origen_idx on public.tropas (tipo_origen);
create index if not exists tropas_remate_codigo_idx on public.tropas (remate_codigo);
create index if not exists tropas_estado_idx on public.tropas (estado);
create index if not exists tropas_created_at_idx on public.tropas (created_at desc);


-- TABLA: movimientos_corral
-- Cada vez que una tropa (o parte) cambia de ubicación se inserta una fila.
create table if not exists public.movimientos_corral (
  id               uuid        primary key default gen_random_uuid(),
  created_at       timestamptz not null default now(),
  tropa_id         uuid        not null references public.tropas(id) on delete cascade,
  corral_origen    text,
  corral_destino   text,
  cabezas          integer     not null check (cabezas >= 0),
  tipo_movimiento  text        not null,
  peso_kg          numeric,
  usuario          text,
  observaciones    text
);

create index if not exists mov_corral_tropa_idx on public.movimientos_corral (tropa_id);
create index if not exists mov_corral_created_idx on public.movimientos_corral (created_at desc);
create index if not exists mov_corral_destino_idx on public.movimientos_corral (corral_destino);
create index if not exists mov_corral_tipo_idx on public.movimientos_corral (tipo_movimiento);


-- =====================================================================
-- RLS — ajustar según la política actual de ingresos_hacienda/egresos_hacienda.
-- Si esas tablas operan abiertas con la anon key, replicar acá.
-- Si tienen RLS + policies, copiar el mismo patrón.
--
-- Versión permisiva (igual que el resto del proyecto hoy):
-- =====================================================================
alter table public.tropas             enable row level security;
alter table public.movimientos_corral enable row level security;

create policy "anon all on tropas"
  on public.tropas for all
  to anon
  using (true) with check (true);

create policy "anon all on movimientos_corral"
  on public.movimientos_corral for all
  to anon
  using (true) with check (true);
