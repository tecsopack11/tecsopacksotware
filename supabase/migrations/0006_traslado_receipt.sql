-- Recepción de traslados internos: quién recibe y que confirme la recepción.
-- Un traslado ya no suma stock al destino de inmediato — queda "pendiente
-- de recepción" hasta que alguien en planta confirme que el material llegó.

alter table public.inventory_movements
  add column received_by uuid references public.profiles(id),
  add column received_at timestamptz;

create index inventory_movements_received_by_idx on public.inventory_movements (received_by);

-- El trigger de inmutabilidad debe permitir también fijar received_by/received_at.
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
    raise exception 'inventory_movements es un ledger inmutable: solo se permiten cancelaciones y confirmaciones de recepción';
  end if;
  return new;
end;
$$;

-- Cualquier rol operacional puede confirmar la recepción de un traslado
-- pendiente (y solo eso: no puede tocar cancelación ni el resto del ledger).
create policy "inventory_movements_confirm_receipt" on public.inventory_movements for update to authenticated
  using (
    movement_type = 'traslado'
    and cancelled_at is null
    and received_at is null
  )
  with check (
    public.current_role() in ('operario', 'supervisor', 'admin')
    and received_by = (select auth.uid())
    and received_at is not null
  );

-- El stock en destino de un traslado solo cuenta una vez confirmada la
-- recepción; el origen se descuenta de inmediato como antes.
create or replace view public.v_inventory_stock
with (security_invoker = true) as
select material_id, lot_id, location_id, sum(qty) as quantity
from (
  select material_id, lot_id, to_location_id as location_id, quantity as qty
  from public.inventory_movements
  where cancelled_at is null
    and to_location_id is not null
    and (movement_type <> 'traslado' or received_at is not null)
  union all
  select material_id, lot_id, from_location_id as location_id, -quantity as qty
  from public.inventory_movements
  where cancelled_at is null and from_location_id is not null
) t
group by material_id, lot_id, location_id
having sum(qty) <> 0;

-- Consumo acumulado por material/ubicación — base para mostrar "Consumido"
-- junto a "En piso" en las ubicaciones de área Proceso.
create view public.v_material_consumo_por_ubicacion
with (security_invoker = true) as
select material_id, from_location_id as location_id, sum(quantity) as consumido
from public.inventory_movements
where movement_type = 'consumo' and cancelled_at is null and from_location_id is not null
group by material_id, from_location_id;
