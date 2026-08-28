-- p_lot_id y p_to_location_id son legítimamente opcionales (salida/consumo no
-- siempre tienen lote o destino); agregar default null para que el generador
-- de tipos de Supabase los marque como opcionales en el cliente TypeScript.
create or replace function public.create_outbound_movement(
  p_movement_type public.movement_type,
  p_material_id uuid,
  p_lot_id uuid default null,
  p_quantity numeric default null,
  p_from_location_id uuid default null,
  p_to_location_id uuid default null,
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

  if p_quantity is null or p_quantity <= 0 then
    raise exception 'La cantidad debe ser mayor a 0';
  end if;

  if p_from_location_id is null then
    raise exception 'La ubicación de origen es obligatoria';
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
