-- Tecsopack — esquema inicial: inventario de materia prima + OEE de máquinas

-- ============================================================================
-- 1. Roles y perfiles de usuario
-- ============================================================================

create type public.user_role as enum ('operario', 'supervisor', 'admin');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  role public.user_role not null default 'operario',
  active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create or replace function public.current_role()
returns public.user_role
language sql
security invoker
stable
set search_path = ''
as $$
  select role from public.profiles where id = auth.uid();
$$;

create policy "profiles_select_own_or_admin" on public.profiles
  for select to authenticated
  using (id = auth.uid() or public.current_role() = 'admin');

create policy "profiles_update_own_no_role_change" on public.profiles
  for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid() and role = (select role from public.profiles where id = auth.uid()));

create policy "profiles_admin_manage" on public.profiles
  for all to authenticated
  using (public.current_role() = 'admin')
  with check (public.current_role() = 'admin');

-- Crea automáticamente el perfil al registrarse un usuario (rol por defecto: operario).
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', ''));
  return new;
end;
$$;

revoke execute on function public.handle_new_user() from public, anon, authenticated;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================================
-- 2. Catálogos: materiales, lotes, máquinas, ubicaciones
-- ============================================================================

create type public.location_type as enum ('bodega', 'piso', 'maquina', 'externo', 'merma');
create type public.material_type as enum ('resina', 'masterbatch', 'aditivo', 'otro');
create type public.uom as enum ('kg', 'g', 'ton', 'bulto', 'unidad');

create table public.materials (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  name text not null,
  material_type public.material_type not null default 'resina',
  unit_of_measure public.uom not null default 'kg',
  min_stock numeric(12, 2) not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  created_by uuid references public.profiles(id)
);

create table public.machines (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  name text not null,
  machine_type text,
  ideal_run_rate_per_hour numeric(12, 2),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.locations (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  name text not null,
  type public.location_type not null,
  machine_id uuid references public.machines(id),
  active boolean not null default true,
  constraint machine_location_consistency
    check ((type = 'maquina') = (machine_id is not null))
);

-- Cada máquina nueva obtiene automáticamente su ubicación tipo "maquina".
create or replace function public.create_machine_location()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  insert into public.locations (code, name, type, machine_id)
  values ('MAQ-' || new.code, new.name, 'maquina', new.id);
  return new;
end;
$$;

create trigger on_machine_created
  after insert on public.machines
  for each row execute function public.create_machine_location();

create table public.material_lots (
  id uuid primary key default gen_random_uuid(),
  material_id uuid not null references public.materials(id),
  lot_code text not null,
  supplier text,
  received_date date,
  expiry_date date,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  created_by uuid references public.profiles(id),
  unique (material_id, lot_code)
);

alter table public.materials enable row level security;
alter table public.machines enable row level security;
alter table public.locations enable row level security;
alter table public.material_lots enable row level security;

create policy "materials_select_all" on public.materials for select to authenticated using (true);
create policy "materials_write_admin" on public.materials for all to authenticated
  using (public.current_role() = 'admin') with check (public.current_role() = 'admin');

create policy "machines_select_all" on public.machines for select to authenticated using (true);
create policy "machines_write_admin" on public.machines for all to authenticated
  using (public.current_role() = 'admin') with check (public.current_role() = 'admin');

create policy "locations_select_all" on public.locations for select to authenticated using (true);
create policy "locations_write_admin" on public.locations for all to authenticated
  using (public.current_role() = 'admin') with check (public.current_role() = 'admin');

create policy "material_lots_select_all" on public.material_lots for select to authenticated using (true);
create policy "material_lots_insert_operational" on public.material_lots for insert to authenticated
  with check (public.current_role() in ('operario', 'supervisor', 'admin'));
create policy "material_lots_update_supervisor" on public.material_lots for update to authenticated
  using (public.current_role() in ('supervisor', 'admin'))
  with check (public.current_role() in ('supervisor', 'admin'));

-- ============================================================================
-- 3. Movimientos de inventario (ledger inmutable)
-- ============================================================================

create type public.movement_type as enum ('entrada', 'salida', 'traslado', 'consumo', 'ajuste');

create table public.inventory_movements (
  id uuid primary key default gen_random_uuid(),
  movement_type public.movement_type not null,
  material_id uuid not null references public.materials(id),
  lot_id uuid references public.material_lots(id),
  quantity numeric(12, 3) not null check (quantity > 0),
  from_location_id uuid references public.locations(id),
  to_location_id uuid references public.locations(id),
  reference_doc text,
  reason_code text,
  notes text,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  cancelled_at timestamptz,
  cancelled_by uuid references public.profiles(id),
  cancel_reason text,
  constraint movement_locations_check check (
    (movement_type = 'entrada' and to_location_id is not null) or
    (movement_type in ('salida', 'consumo') and from_location_id is not null) or
    (movement_type = 'traslado' and from_location_id is not null and to_location_id is not null) or
    (movement_type = 'ajuste')
  )
);

create index inventory_movements_material_idx on public.inventory_movements (material_id, created_at desc);
create index inventory_movements_from_location_idx on public.inventory_movements (from_location_id);
create index inventory_movements_to_location_idx on public.inventory_movements (to_location_id);

-- El ledger es inmutable: un UPDATE solo puede tocar las columnas de cancelación.
create or replace function public.protect_movement_immutability()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.movement_type is distinct from old.movement_type
    or new.material_id is distinct from old.material_id
    or new.lot_id is distinct from old.lot_id
    or new.quantity is distinct from old.quantity
    or new.from_location_id is distinct from old.from_location_id
    or new.to_location_id is distinct from old.to_location_id
    or new.created_by is distinct from old.created_by
    or new.created_at is distinct from old.created_at
  then
    raise exception 'inventory_movements es un ledger inmutable: solo se permiten cancelaciones';
  end if;
  return new;
end;
$$;

create trigger protect_inventory_movements_immutability
  before update on public.inventory_movements
  for each row execute function public.protect_movement_immutability();

alter table public.inventory_movements enable row level security;

create policy "inventory_movements_select_all" on public.inventory_movements for select to authenticated using (true);
create policy "inventory_movements_insert_operational" on public.inventory_movements for insert to authenticated
  with check (public.current_role() in ('operario', 'supervisor', 'admin') and created_by = auth.uid());
create policy "inventory_movements_cancel_supervisor" on public.inventory_movements for update to authenticated
  using (public.current_role() in ('supervisor', 'admin'))
  with check (public.current_role() in ('supervisor', 'admin'));

-- Existencia agregada por material/lote/ubicación, derivada del ledger.
create view public.v_inventory_stock
with (security_invoker = true) as
select material_id, lot_id, location_id, sum(qty) as quantity
from (
  select material_id, lot_id, to_location_id as location_id, quantity as qty
  from public.inventory_movements
  where cancelled_at is null and to_location_id is not null
  union all
  select material_id, lot_id, from_location_id as location_id, -quantity as qty
  from public.inventory_movements
  where cancelled_at is null and from_location_id is not null
) t
group by material_id, lot_id, location_id
having sum(qty) <> 0;

-- RPC transaccional para salidas/traslados: valida stock disponible y serializa
-- escrituras concurrentes sobre el mismo par material+ubicación con un advisory lock.
create or replace function public.create_outbound_movement(
  p_movement_type public.movement_type,
  p_material_id uuid,
  p_lot_id uuid,
  p_quantity numeric,
  p_from_location_id uuid,
  p_to_location_id uuid,
  p_reference_doc text default null,
  p_notes text default null
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_available numeric;
  v_id uuid;
begin
  if p_movement_type not in ('salida', 'traslado', 'consumo') then
    raise exception 'create_outbound_movement solo admite salida, traslado o consumo';
  end if;

  perform pg_advisory_xact_lock(hashtext(p_material_id::text || p_from_location_id::text));

  select coalesce(sum(quantity), 0) into v_available
  from public.v_inventory_stock
  where material_id = p_material_id
    and location_id = p_from_location_id
    and lot_id is not distinct from p_lot_id;

  if v_available < p_quantity then
    raise exception 'Stock insuficiente: disponible %, solicitado %', v_available, p_quantity;
  end if;

  insert into public.inventory_movements (
    movement_type, material_id, lot_id, quantity,
    from_location_id, to_location_id, reference_doc, notes, created_by
  )
  values (
    p_movement_type, p_material_id, p_lot_id, p_quantity,
    p_from_location_id, p_to_location_id, p_reference_doc, p_notes, auth.uid()
  )
  returning id into v_id;

  return v_id;
end;
$$;

-- ============================================================================
-- 4. Máquinas: turnos, paros y producción (base para OEE)
-- ============================================================================

create table public.shift_catalog (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  name text not null,
  start_time time not null,
  end_time time not null,
  active boolean not null default true
);

create type public.shift_status as enum ('abierto', 'cerrado');

create table public.shift_instances (
  id uuid primary key default gen_random_uuid(),
  machine_id uuid not null references public.machines(id),
  shift_id uuid not null references public.shift_catalog(id),
  operator_id uuid references public.profiles(id),
  run_date date not null default current_date,
  planned_start timestamptz not null,
  planned_end timestamptz not null,
  actual_start timestamptz,
  actual_end timestamptz,
  status public.shift_status not null default 'abierto',
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now()
);

create index shift_instances_machine_date_idx on public.shift_instances (machine_id, run_date);
create unique index one_open_shift_per_machine
  on public.shift_instances (machine_id) where (status = 'abierto');

create table public.downtime_reasons (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  name text not null,
  category text not null check (category in ('planeado', 'no_planeado')),
  active boolean not null default true
);

create table public.machine_downtime_events (
  id uuid primary key default gen_random_uuid(),
  shift_instance_id uuid not null references public.shift_instances(id),
  machine_id uuid not null references public.machines(id),
  reason_id uuid not null references public.downtime_reasons(id),
  start_time timestamptz not null default now(),
  end_time timestamptz,
  notes text,
  source text not null default 'manual' check (source in ('manual', 'plc')),
  device_id text,
  created_by uuid not null references public.profiles(id),
  closed_by uuid references public.profiles(id)
);

create index machine_downtime_events_machine_idx on public.machine_downtime_events (machine_id, start_time);
create unique index one_open_downtime_per_machine
  on public.machine_downtime_events (machine_id) where (end_time is null);

create table public.production_counts (
  id uuid primary key default gen_random_uuid(),
  shift_instance_id uuid not null references public.shift_instances(id),
  machine_id uuid not null references public.machines(id),
  recorded_at timestamptz not null default now(),
  good_qty integer not null default 0 check (good_qty >= 0),
  reject_qty integer not null default 0 check (reject_qty >= 0),
  reject_reason text,
  source text not null default 'manual' check (source in ('manual', 'plc')),
  device_id text,
  created_by uuid not null references public.profiles(id)
);

create index production_counts_shift_idx on public.production_counts (shift_instance_id);

alter table public.shift_catalog enable row level security;
alter table public.shift_instances enable row level security;
alter table public.downtime_reasons enable row level security;
alter table public.machine_downtime_events enable row level security;
alter table public.production_counts enable row level security;

create policy "shift_catalog_select_all" on public.shift_catalog for select to authenticated using (true);
create policy "shift_catalog_write_admin" on public.shift_catalog for all to authenticated
  using (public.current_role() = 'admin') with check (public.current_role() = 'admin');

create policy "downtime_reasons_select_all" on public.downtime_reasons for select to authenticated using (true);
create policy "downtime_reasons_write_admin" on public.downtime_reasons for all to authenticated
  using (public.current_role() = 'admin') with check (public.current_role() = 'admin');

create policy "shift_instances_select_all" on public.shift_instances for select to authenticated using (true);
create policy "shift_instances_insert_operational" on public.shift_instances for insert to authenticated
  with check (public.current_role() in ('operario', 'supervisor', 'admin') and created_by = auth.uid());
create policy "shift_instances_update_operational" on public.shift_instances for update to authenticated
  using (public.current_role() in ('operario', 'supervisor', 'admin'))
  with check (public.current_role() in ('operario', 'supervisor', 'admin'));

create policy "machine_downtime_events_select_all" on public.machine_downtime_events for select to authenticated using (true);
create policy "machine_downtime_events_insert_operational" on public.machine_downtime_events for insert to authenticated
  with check (public.current_role() in ('operario', 'supervisor', 'admin') and created_by = auth.uid());
create policy "machine_downtime_events_update_operational" on public.machine_downtime_events for update to authenticated
  using (public.current_role() in ('operario', 'supervisor', 'admin'))
  with check (public.current_role() in ('operario', 'supervisor', 'admin'));

create policy "production_counts_select_all" on public.production_counts for select to authenticated using (true);
create policy "production_counts_insert_operational" on public.production_counts for insert to authenticated
  with check (public.current_role() in ('operario', 'supervisor', 'admin') and created_by = auth.uid());

-- Agrega tiempos planeados, paros y producción por turno — base para el cálculo de OEE.
create view public.v_oee_by_shift
with (security_invoker = true) as
with planned as (
  select
    si.id as shift_instance_id,
    si.machine_id,
    extract(epoch from (coalesce(si.actual_end, now()) - si.actual_start)) as elapsed_seconds
  from public.shift_instances si
  where si.actual_start is not null
),
downtime as (
  select
    e.shift_instance_id,
    sum(extract(epoch from (coalesce(e.end_time, now()) - e.start_time)))
      filter (where dr.category = 'no_planeado') as unplanned_seconds,
    sum(extract(epoch from (coalesce(e.end_time, now()) - e.start_time)))
      filter (where dr.category = 'planeado') as planned_downtime_seconds
  from public.machine_downtime_events e
  join public.downtime_reasons dr on dr.id = e.reason_id
  group by e.shift_instance_id
),
counts as (
  select shift_instance_id, sum(good_qty) as good_qty, sum(reject_qty) as reject_qty
  from public.production_counts
  group by shift_instance_id
)
select
  p.shift_instance_id,
  p.machine_id,
  p.elapsed_seconds - coalesce(d.planned_downtime_seconds, 0) as planned_production_seconds,
  p.elapsed_seconds - coalesce(d.planned_downtime_seconds, 0) - coalesce(d.unplanned_seconds, 0) as run_seconds,
  coalesce(c.good_qty, 0) as good_qty,
  coalesce(c.reject_qty, 0) as reject_qty,
  m.ideal_run_rate_per_hour
from planned p
join public.machines m on m.id = p.machine_id
left join downtime d on d.shift_instance_id = p.shift_instance_id
left join counts c on c.shift_instance_id = p.shift_instance_id;

-- ============================================================================
-- 5. Seeds: ubicaciones base y motivos de paro estándar
-- ============================================================================

insert into public.locations (code, name, type) values
  ('BOD-01', 'Bodega principal', 'bodega'),
  ('PISO-01', 'Piso de fábrica', 'piso'),
  ('PROV', 'Proveedor externo', 'externo'),
  ('SCRAP', 'Merma / desecho', 'merma');

insert into public.downtime_reasons (code, name, category) values
  ('CAMBIO_MOLDE', 'Cambio de molde', 'planeado'),
  ('MANTENIMIENTO_PROG', 'Mantenimiento programado', 'planeado'),
  ('FALLA_MECANICA', 'Falla mecánica', 'no_planeado'),
  ('FALTA_MATERIAL', 'Falta de materia prima', 'no_planeado'),
  ('AJUSTE_CALIDAD', 'Ajuste de calidad', 'no_planeado'),
  ('SIN_OPERARIO', 'Sin operario disponible', 'no_planeado');

insert into public.shift_catalog (code, name, start_time, end_time) values
  ('MAT', 'Turno mañana', '06:00', '14:00'),
  ('TAR', 'Turno tarde', '14:00', '22:00'),
  ('NOC', 'Turno noche', '22:00', '06:00');
