-- Inventario de Producto Terminado (PT): dominio propio, separado de materia
-- prima. Se construye aparte (no reutiliza materials/inventory_movements)
-- porque a futuro un rol Vendedor creará pedidos que descuenten stock de PT
-- y disparen órdenes de fabricación cuando falte — ese flujo necesita poder
-- evolucionar sin tocar el motor de materia prima.

create table public.products (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  name text not null,
  unit_of_measure public.uom not null default 'unidad',
  min_stock numeric(12, 2) not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  created_by uuid references public.profiles(id)
);

alter table public.products enable row level security;

create policy "products_select_all" on public.products for select to authenticated using (true);
create policy "products_insert_admin" on public.products for insert to authenticated
  with check (public.current_role() = 'admin');
create policy "products_update_admin" on public.products for update to authenticated
  using (public.current_role() = 'admin') with check (public.current_role() = 'admin');
create policy "products_delete_super_admin" on public.products for delete to authenticated
  using (public.is_super_admin());

create type public.product_movement_type as enum ('entrada', 'salida', 'ajuste');

create table public.product_movements (
  id uuid primary key default gen_random_uuid(),
  movement_type public.product_movement_type not null,
  product_id uuid not null references public.products(id),
  quantity numeric(12, 3) not null check (quantity > 0),
  from_location_id uuid references public.locations(id),
  to_location_id uuid references public.locations(id),
  reference_doc text,
  notes text,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  cancelled_at timestamptz,
  cancelled_by uuid references public.profiles(id),
  cancel_reason text,
  constraint product_movement_locations_check check (
    (movement_type = 'entrada' and to_location_id is not null) or
    (movement_type = 'salida' and from_location_id is not null) or
    (movement_type = 'ajuste')
  )
);

create index product_movements_product_idx on public.product_movements (product_id, created_at desc);
create index product_movements_from_location_idx on public.product_movements (from_location_id);
create index product_movements_to_location_idx on public.product_movements (to_location_id);
create index product_movements_created_by_idx on public.product_movements (created_by);
create index product_movements_cancelled_by_idx on public.product_movements (cancelled_by);

-- Mismo patrón de inmutabilidad que inventory_movements: un UPDATE solo
-- puede tocar las columnas de cancelación.
create or replace function public.protect_product_movement_immutability()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.movement_type is distinct from old.movement_type
    or new.product_id is distinct from old.product_id
    or new.quantity is distinct from old.quantity
    or new.from_location_id is distinct from old.from_location_id
    or new.to_location_id is distinct from old.to_location_id
    or new.created_by is distinct from old.created_by
    or new.created_at is distinct from old.created_at
  then
    raise exception 'product_movements es un ledger inmutable: solo se permiten cancelaciones';
  end if;
  return new;
end;
$$;

create trigger protect_product_movements_immutability
  before update on public.product_movements
  for each row execute function public.protect_product_movement_immutability();

alter table public.product_movements enable row level security;

create policy "product_movements_select_all" on public.product_movements for select to authenticated using (true);
create policy "product_movements_insert_operational" on public.product_movements for insert to authenticated
  with check (public.current_role() in ('operario', 'supervisor', 'admin') and created_by = (select auth.uid()));
create policy "product_movements_cancel_super_admin" on public.product_movements for update to authenticated
  using (public.is_super_admin()) with check (public.is_super_admin());

create view public.v_product_stock
with (security_invoker = true) as
select product_id, location_id, sum(qty) as quantity
from (
  select product_id, to_location_id as location_id, quantity as qty
  from public.product_movements
  where cancelled_at is null and to_location_id is not null
  union all
  select product_id, from_location_id as location_id, -quantity as qty
  from public.product_movements
  where cancelled_at is null and from_location_id is not null
) t
group by product_id, location_id
having sum(qty) <> 0;

-- RPC transaccional para salidas de PT: valida stock disponible y serializa
-- escrituras concurrentes, igual que create_outbound_movement para MP.
create or replace function public.create_product_outbound_movement(
  p_product_id uuid,
  p_quantity numeric,
  p_from_location_id uuid,
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
  perform pg_advisory_xact_lock(hashtext(p_product_id::text || p_from_location_id::text));

  select coalesce(sum(quantity), 0) into v_available
  from public.v_product_stock
  where product_id = p_product_id and location_id = p_from_location_id;

  if v_available < p_quantity then
    raise exception 'Stock insuficiente: disponible %, solicitado %', v_available, p_quantity;
  end if;

  insert into public.product_movements (
    movement_type, product_id, quantity, from_location_id, reference_doc, notes, created_by
  )
  values (
    'salida', p_product_id, p_quantity, p_from_location_id, p_reference_doc, p_notes, auth.uid()
  )
  returning id into v_id;

  return v_id;
end;
$$;

insert into public.locations (code, name, type) values
  ('PT-01', 'Almacén de producto terminado', 'almacen_pt');
