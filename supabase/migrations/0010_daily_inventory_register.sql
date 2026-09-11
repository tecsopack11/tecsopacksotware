-- Registro diario masivo de materia prima. Guarda entradas y salidas de todas
-- las filas en una sola transacción y distribuye las salidas entre lotes FIFO.
create or replace function public.create_daily_inventory_register(
  p_location_id uuid,
  p_record_date date,
  p_responsible text,
  p_observations text,
  p_rows jsonb
)
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_row jsonb;
  v_material_id uuid;
  v_entry numeric;
  v_exit numeric;
  v_available numeric;
  v_remaining numeric;
  v_take numeric;
  v_lot record;
  v_lot_id uuid;
  v_count integer := 0;
  v_notes text;
  v_is_sale boolean := left(coalesce(p_observations, ''), 10) = '[VENTA_MP]';
  v_clean_observations text;
begin
  if v_user_id is null then
    raise exception 'Sesión no válida';
  end if;

  if p_record_date is null or p_record_date > (now() at time zone 'America/Bogota')::date then
    raise exception 'La fecha del registro no puede estar en el futuro';
  end if;

  if nullif(btrim(p_responsible), '') is null then
    raise exception 'El responsable es obligatorio';
  end if;

  if jsonb_typeof(p_rows) <> 'array' or jsonb_array_length(p_rows) = 0 then
    raise exception 'No hay movimientos para guardar';
  end if;

  if not exists (
    select 1 from public.locations
    where id = p_location_id and active and type in ('bodega', 'piso')
  ) then
    raise exception 'La ubicación seleccionada no es válida';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(p_rows) item
    group by item->>'material_id'
    having count(*) > 1
  ) then
    raise exception 'Un material aparece repetido en el registro';
  end if;

  v_clean_observations := case
    when v_is_sale then substring(coalesce(p_observations, '') from 11)
    else coalesce(p_observations, '')
  end;

  v_notes := concat_ws(
    ' · ',
    'Registro diario ' || p_record_date::text,
    'Responsable: ' || btrim(p_responsible),
    case when v_is_sale then 'Venta de materia prima' end,
    nullif(btrim(v_clean_observations), '')
  );

  -- Primero valida todas las filas y bloquea cada inventario afectado.
  for v_row in select value from jsonb_array_elements(p_rows)
  loop
    begin
      v_material_id := (v_row->>'material_id')::uuid;
      v_entry := coalesce((v_row->>'entry')::numeric, 0);
      v_exit := coalesce((v_row->>'exit')::numeric, 0);
    exception when others then
      raise exception 'Una fila contiene datos inválidos';
    end;

    if v_entry < 0 or v_exit < 0 or (v_entry = 0 and v_exit = 0) then
      raise exception 'Las cantidades deben ser positivas';
    end if;

    if v_is_sale and v_entry > 0 then
      raise exception 'Una venta de materia prima solo puede registrar salidas';
    end if;

    if not exists (select 1 from public.materials where id = v_material_id and active) then
      raise exception 'Uno de los materiales no existe o está inactivo';
    end if;

    perform pg_advisory_xact_lock(hashtext(v_material_id::text || p_location_id::text));

    select coalesce(sum(quantity), 0) into v_available
    from public.v_inventory_stock
    where material_id = v_material_id and location_id = p_location_id;

    if v_exit > v_available + v_entry then
      raise exception 'Stock insuficiente para %: disponible %, salida %',
        (select name from public.materials where id = v_material_id),
        v_available + v_entry,
        v_exit;
    end if;
  end loop;

  -- Entradas: un lote automático por material y día, sin digitación adicional.
  for v_row in select value from jsonb_array_elements(p_rows)
  loop
    v_material_id := (v_row->>'material_id')::uuid;
    v_entry := coalesce((v_row->>'entry')::numeric, 0);

    if v_entry > 0 then
      insert into public.material_lots (
        material_id, lot_code, received_date, supplier, created_by
      ) values (
        v_material_id,
        'REG-' || to_char(p_record_date, 'YYYYMMDD'),
        p_record_date,
        'Registro rápido',
        v_user_id
      )
      on conflict (material_id, lot_code) do nothing
      returning id into v_lot_id;

      if v_lot_id is null then
        select id into v_lot_id
        from public.material_lots
        where material_id = v_material_id
          and lot_code = 'REG-' || to_char(p_record_date, 'YYYYMMDD');
      end if;

      insert into public.inventory_movements (
        movement_type, material_id, lot_id, quantity, to_location_id,
        reference_doc, notes, created_by
      ) values (
        'entrada', v_material_id, v_lot_id, v_entry, p_location_id,
        'REG-' || to_char(p_record_date, 'YYYYMMDD'), v_notes, v_user_id
      );
      v_count := v_count + 1;
    end if;
  end loop;

  -- Salidas: descuenta primero los lotes más antiguos.
  for v_row in select value from jsonb_array_elements(p_rows)
  loop
    v_material_id := (v_row->>'material_id')::uuid;
    v_exit := coalesce((v_row->>'exit')::numeric, 0);
    v_remaining := v_exit;

    if v_exit > 0 then
      for v_lot in
        select stock.lot_id, stock.quantity
        from public.v_inventory_stock stock
        left join public.material_lots lot on lot.id = stock.lot_id
        where stock.material_id = v_material_id
          and stock.location_id = p_location_id
          and stock.quantity > 0
        order by lot.received_date nulls last, lot.created_at nulls last, stock.lot_id nulls last
      loop
        exit when v_remaining <= 0;
        v_take := least(v_remaining, v_lot.quantity);

        insert into public.inventory_movements (
          movement_type, material_id, lot_id, quantity, from_location_id,
          reference_doc, reason_code, notes, created_by
        ) values (
          'salida', v_material_id, v_lot.lot_id, v_take, p_location_id,
          case when v_is_sale then 'VENTA-MP-' else 'REG-' end || to_char(p_record_date, 'YYYYMMDD'),
          case when v_is_sale then 'VENTA_MP' end,
          v_notes, v_user_id
        );

        v_remaining := v_remaining - v_take;
        v_count := v_count + 1;
      end loop;

      if v_remaining > 0 then
        raise exception 'No fue posible distribuir toda la salida del material';
      end if;
    end if;
  end loop;

  return v_count;
end;
$$;

revoke execute on function public.create_daily_inventory_register(uuid, date, text, text, jsonb)
  from public, anon;
grant execute on function public.create_daily_inventory_register(uuid, date, text, text, jsonb)
  to authenticated;
