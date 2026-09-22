-- Fecha operativa para respetar registros diarios de días anteriores.
alter table public.inventory_movements add column effective_date date;
alter table public.inventory_movements add column valuation_sequence bigint generated always as identity;
update public.inventory_movements set effective_date=(created_at at time zone 'America/Bogota')::date;
do $$
declare r record; v_date date;
begin
  for r in select id,reference_doc from public.inventory_movements
    where reference_doc ~ '^(REG-|VENTA-MP-)[0-9]{8}$'
  loop
    begin
      v_date := to_date(right(r.reference_doc,8),'YYYYMMDD');
      if to_char(v_date,'YYYYMMDD')=right(r.reference_doc,8) then
        update public.inventory_movements set effective_date=v_date where id=r.id;
      end if;
    exception when datetime_field_overflow then null;
    end;
  end loop;
end;
$$;
alter table public.inventory_movements alter column effective_date set not null;
alter table public.inventory_movements alter column effective_date
  set default (now() at time zone 'America/Bogota')::date;

-- Costos por recepción, con revisiones inmutables. El inventario físico
-- continúa siendo el ledger existente; un precio ausente nunca equivale a cero.
create table public.material_cost_revisions (
  id uuid primary key default gen_random_uuid(),
  movement_id uuid not null references public.inventory_movements(id),
  revision integer not null check (revision > 0),
  purchase_date date not null,
  supplier text not null check (length(btrim(supplier)) between 1 and 200),
  invoice text not null check (length(btrim(invoice)) between 1 and 200),
  shipment text not null default '' check (length(shipment) <= 200),
  currency text not null check (currency in ('COP', 'USD', 'EUR')),
  exchange_rate numeric(18,6) not null check (exchange_rate > 0 and exchange_rate < 1000000),
  unit_price numeric(18,6) not null check (unit_price > 0 and unit_price < 1000000000),
  discount numeric(18,2) not null default 0 check (discount >= 0 and discount < 1000000000000),
  freight numeric(18,2) not null default 0 check (freight >= 0 and freight < 1000000000000),
  insurance numeric(18,2) not null default 0 check (insurance >= 0 and insurance < 1000000000000),
  duties numeric(18,2) not null default 0 check (duties >= 0 and duties < 1000000000000),
  other_costs numeric(18,2) not null default 0 check (other_costs >= 0 and other_costs < 1000000000000),
  recoverable_tax numeric(18,2) not null default 0 check (recoverable_tax >= 0 and recoverable_tax < 1000000000000),
  allocation_note text not null default '' check (length(allocation_note) <= 1000),
  status text not null check (status in ('provisional', 'confirmed')),
  reason text not null check (length(btrim(reason)) between 3 and 1000),
  total_cop numeric(24,6) not null check (total_cop > 0 and total_cop < 100000000000000),
  created_at timestamptz not null default clock_timestamp(),
  created_by uuid not null references public.profiles(id),
  unique (movement_id, revision),
  check (currency <> 'COP' or exchange_rate = 1)
);
alter table public.material_cost_revisions enable row level security;
revoke all on public.material_cost_revisions from anon, authenticated;
grant select on public.material_cost_revisions to authenticated;
create policy "costs_read_management" on public.material_cost_revisions
  for select to authenticated using (
    exists (select 1 from public.profiles where id = (select auth.uid())
      and active and role in ('supervisor', 'admin'))
  );

create or replace function public.save_material_cost(
  p_movement_id uuid, p_expected_revision integer, p_cost jsonb
) returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_m public.inventory_movements;
  v_cost public.material_cost_revisions;
  v_revision integer;
  v_id uuid;
begin
  if not exists (select 1 from public.profiles where id = auth.uid()
    and active and role in ('supervisor', 'admin')) then
    raise exception 'No tienes permiso para registrar costos';
  end if;
  select * into v_m from public.inventory_movements where id = p_movement_id for update;
  if not found or v_m.cancelled_at is not null or v_m.movement_type <> 'entrada' then
    raise exception 'La entrada no existe, está cancelada o no admite costos';
  end if;
  if not exists (select 1 from public.locations where id = v_m.to_location_id
    and type in ('bodega', 'piso', 'maquina')) or v_m.from_location_id is not null then
    raise exception 'Solo se pueden valorar recepciones de materia prima en bodega o producción';
  end if;
  select coalesce(max(revision), 0) into v_revision
    from public.material_cost_revisions where movement_id = p_movement_id;
  if p_expected_revision is null or p_expected_revision <> v_revision then
    raise exception 'El costo cambió mientras lo editabas. Recarga la página';
  end if;
  v_cost := jsonb_populate_record(null::public.material_cost_revisions, p_cost);
  if v_cost.purchase_date > (now() at time zone 'America/Bogota')::date then
    raise exception 'La fecha de compra no puede estar en el futuro';
  end if;
  if v_cost.discount >= v_m.quantity * v_cost.unit_price then
    raise exception 'El descuento debe ser menor al valor de la mercancía';
  end if;
  if coalesce(v_cost.freight,0) + coalesce(v_cost.insurance,0) + coalesce(v_cost.duties,0)
     + coalesce(v_cost.other_costs,0) > 0 and nullif(btrim(v_cost.allocation_note),'') is null then
    raise exception 'Explica cómo se asignaron los gastos a esta entrada';
  end if;
  insert into public.material_cost_revisions (
    movement_id, revision, purchase_date, supplier, invoice, shipment, currency,
    exchange_rate, unit_price, discount, freight, insurance, duties, other_costs,
    recoverable_tax, allocation_note, status, reason, total_cop, created_by
  ) values (
    p_movement_id, v_revision + 1, v_cost.purchase_date, btrim(v_cost.supplier),
    btrim(v_cost.invoice), coalesce(v_cost.shipment,''), v_cost.currency,
    v_cost.exchange_rate, v_cost.unit_price, v_cost.discount, v_cost.freight,
    v_cost.insurance, v_cost.duties, v_cost.other_costs, v_cost.recoverable_tax,
    coalesce(v_cost.allocation_note,''), v_cost.status, btrim(v_cost.reason),
    (v_m.quantity * v_cost.unit_price - v_cost.discount) * v_cost.exchange_rate
      + v_cost.freight + v_cost.insurance + v_cost.duties + v_cost.other_costs,
    auth.uid()
  ) returning id into v_id;
  return v_id;
end;
$$;

-- La clave de solicitud evita duplicar una compra por doble envío o reintento.
alter table public.inventory_movements add column purchase_request_id uuid unique,
  add column purchase_request_payload jsonb;
create or replace function public.create_costed_material_purchase(
  p_request_id uuid, p_receipt jsonb, p_cost jsonb
) returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_material uuid := (p_receipt->>'material_id')::uuid;
  v_location uuid := (p_receipt->>'to_location_id')::uuid;
  v_quantity numeric := (p_receipt->>'quantity')::numeric;
  v_lot_code text := btrim(p_receipt->>'lot_code');
  v_lot uuid;
  v_id uuid;
begin
  if not exists (select 1 from public.profiles where id = auth.uid()
    and active and role in ('supervisor','admin')) then
    raise exception 'No tienes permiso para registrar compras';
  end if;
  if p_request_id is null then raise exception 'Falta la identificación de la solicitud'; end if;
  perform pg_advisory_xact_lock(hashtext(p_request_id::text));
  select id into v_id from public.inventory_movements
    where purchase_request_id = p_request_id and created_by = auth.uid();
  if found then
    if (select purchase_request_payload from public.inventory_movements where id=v_id)
      is distinct from jsonb_build_array(p_receipt,p_cost) then
      raise exception 'Esta compra ya fue guardada. Inicia una nueva compra para otros datos';
    end if;
    return v_id;
  end if;
  if v_quantity is null or v_quantity <= 0 or v_quantity >= 1000000000
    or v_quantity <> round(v_quantity,3) or v_quantity::text = 'NaN' then
    raise exception 'Cantidad inválida (máximo tres decimales)';
  end if;
  if v_lot_code is null or length(v_lot_code) not between 1 and 100 then
    raise exception 'El lote es obligatorio';
  end if;
  if not exists (select 1 from public.materials where id = v_material and active)
    or not exists (select 1 from public.locations where id = v_location and active
      and type in ('bodega','piso')) then
    raise exception 'Material o destino inválido';
  end if;
  perform pg_advisory_xact_lock(hashtext(v_material::text || v_location::text));
  insert into public.material_lots(material_id,lot_code,supplier,received_date,created_by)
    values(v_material,v_lot_code,p_cost->>'supplier',(p_cost->>'purchase_date')::date,auth.uid())
    on conflict(material_id,lot_code) do nothing returning id into v_lot;
  if v_lot is null then
    select id into v_lot from public.material_lots where material_id=v_material and lot_code=v_lot_code;
  end if;
  insert into public.inventory_movements (
    movement_type,material_id,lot_id,quantity,to_location_id,reference_doc,created_by,purchase_request_id,purchase_request_payload
  ) values ('entrada',v_material,v_lot,v_quantity,v_location,p_cost->>'invoice',auth.uid(),p_request_id,jsonb_build_array(p_receipt,p_cost))
    returning id into v_id;
  perform public.save_material_cost(v_id,0,p_cost);
  return v_id;
end;
$$;

-- Una sola instantánea evita paginaciones parciales y lecturas desfasadas entre
-- movimientos y costos. La valoración operativa se reconstruye sin escribir OP.
create or replace function public.material_cost_snapshot()
returns jsonb language plpgsql security definer stable set search_path = '' as $$
begin
  if not exists (select 1 from public.profiles where id = auth.uid()
    and active and role in ('supervisor','admin')) then
    raise exception 'No tienes permiso para consultar costos';
  end if;
  return jsonb_build_object(
    'materials', (select coalesce(jsonb_agg(to_jsonb(m)), '[]'::jsonb)
      from (select id,name,code,unit_of_measure,active from public.materials) m),
    'locations', (select coalesce(jsonb_agg(to_jsonb(l)), '[]'::jsonb)
      from (select id,name,type,active from public.locations) l),
    'movements', (select coalesce(jsonb_agg(to_jsonb(m) order by m.created_at,m.id), '[]'::jsonb)
      from (select id,material_id,quantity,movement_type,from_location_id,to_location_id,
        created_at,effective_date,valuation_sequence,cancelled_at,received_at,reference_doc,lot_id from public.inventory_movements) m),
    'costs', (select coalesce(jsonb_agg(to_jsonb(c)), '[]'::jsonb)
      from (select distinct on (movement_id) * from public.material_cost_revisions
        order by movement_id,revision desc) c)
  );
end;
$$;
revoke all on function public.save_material_cost(uuid,integer,jsonb) from public, anon;
revoke all on function public.create_costed_material_purchase(uuid,jsonb,jsonb) from public, anon;
revoke all on function public.material_cost_snapshot() from public, anon;
grant execute on function public.save_material_cost(uuid,integer,jsonb) to authenticated;
grant execute on function public.create_costed_material_purchase(uuid,jsonb,jsonb) to authenticated;
grant execute on function public.material_cost_snapshot() to authenticated;

-- Captura simplificada del precio en el registro diario. El operario puede
-- informar el precio de su propia entrada, sin consultar costos de otras áreas.
create or replace function public.record_entry_price(
  p_movement_id uuid, p_unit_price numeric, p_purchase_date date
) returns void language plpgsql security definer set search_path = '' as $$
declare v_m public.inventory_movements;
begin
  if not exists (select 1 from public.profiles where id = auth.uid() and active) then
    raise exception 'Sesión no válida';
  end if;
  select * into v_m from public.inventory_movements where id=p_movement_id for update;
  if not found or v_m.created_by <> auth.uid() or v_m.cancelled_at is not null
    or v_m.movement_type <> 'entrada' or v_m.from_location_id is not null then
    raise exception 'Solo puedes informar el precio inicial de tus propias entradas';
  end if;
  if not exists (select 1 from public.locations where id=v_m.to_location_id
    and type in ('bodega','piso','maquina')) then raise exception 'Destino inválido'; end if;
  if exists (select 1 from public.material_cost_revisions where movement_id=p_movement_id) then
    raise exception 'La entrada ya tiene precio. Usa la corrección de costos';
  end if;
  if p_purchase_date is null or p_purchase_date > (now() at time zone 'America/Bogota')::date
    or p_unit_price is null or p_unit_price <= 0 or p_unit_price >= 1000000000 then
    raise exception 'Fecha o precio inválido';
  end if;
  insert into public.material_cost_revisions (
    movement_id,revision,purchase_date,supplier,invoice,currency,exchange_rate,
    unit_price,status,reason,total_cop,created_by
  ) values (
    p_movement_id,1,p_purchase_date,'Sin informar',coalesce(v_m.reference_doc,'Registro diario'),
    'COP',1,p_unit_price,'provisional','Precio informado al recibir; pendiente validar gastos',
    v_m.quantity*p_unit_price,auth.uid()
  );
end;
$$;
revoke all on function public.record_entry_price(uuid,numeric,date) from public,anon;
grant execute on function public.record_entry_price(uuid,numeric,date) to authenticated;

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
  v_movement_id uuid;
  v_price numeric;
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
  for v_row in select value from jsonb_array_elements(p_rows) order by value->>'material_id'
  loop
    begin
      v_material_id := (v_row->>'material_id')::uuid;
      v_entry := coalesce((v_row->>'entry')::numeric, 0);
      v_exit := coalesce((v_row->>'exit')::numeric, 0);
    exception when others then
      raise exception 'Una fila contiene datos inválidos';
    end;

    v_price := nullif(v_row->>'unit_price','')::numeric;
    if v_entry > 0 and (v_price is null or v_price <= 0 or v_price >= 1000000000) then
      raise exception 'Indica un precio mayor que cero para cada entrada';
    end if;
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
  for v_row in select value from jsonb_array_elements(p_rows) order by value->>'material_id'
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
        reference_doc, notes, created_by, effective_date
      ) values (
        'entrada', v_material_id, v_lot_id, v_entry, p_location_id,
        'REG-' || to_char(p_record_date, 'YYYYMMDD'), v_notes, v_user_id, p_record_date
      ) returning id into v_movement_id;
      perform public.record_entry_price(v_movement_id,(v_row->>'unit_price')::numeric,p_record_date);
      v_count := v_count + 1;
    end if;
  end loop;

  -- Salidas: descuenta primero los lotes más antiguos.
  for v_row in select value from jsonb_array_elements(p_rows) order by value->>'material_id'
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
          reference_doc, reason_code, notes, created_by, effective_date
        ) values (
          'salida', v_material_id, v_lot.lot_id, v_take, p_location_id,
          case when v_is_sale then 'VENTA-MP-' else 'REG-' end || to_char(p_record_date, 'YYYYMMDD'),
          case when v_is_sale then 'VENTA_MP' end,
          v_notes, v_user_id, p_record_date
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


create or replace function public.protect_cost_movement_fields()
returns trigger language plpgsql set search_path='' as $$
begin
  if new.purchase_request_id is distinct from old.purchase_request_id
    or new.effective_date is distinct from old.effective_date
    or new.valuation_sequence is distinct from old.valuation_sequence
    or new.purchase_request_payload is distinct from old.purchase_request_payload then
    raise exception 'La fecha operativa y la identificación de compra son inmutables';
  end if;
  return new;
end;
$$;
create trigger protect_cost_movement_fields before update on public.inventory_movements
  for each row execute function public.protect_cost_movement_fields();

create table public.material_daily_requests (
  id uuid primary key,
  created_by uuid not null references public.profiles(id),
  payload jsonb not null,
  movement_count integer not null,
  created_at timestamptz not null default now()
);
alter table public.material_daily_requests enable row level security;
revoke all on public.material_daily_requests from public,anon,authenticated;

create or replace function public.create_priced_daily_inventory_register(
  p_request_id uuid, p_location_id uuid, p_record_date date,
  p_responsible text, p_observations text, p_rows jsonb
) returns integer language plpgsql security definer set search_path='' as $$
declare
  v_payload jsonb := jsonb_build_array(p_location_id,p_record_date,p_responsible,p_observations,p_rows);
  v_previous public.material_daily_requests;
  v_count integer;
begin
  if p_request_id is null or not exists (
    select 1 from public.profiles where id=auth.uid() and active
  ) then raise exception 'Sesión o solicitud inválida'; end if;
  perform pg_advisory_xact_lock(hashtext(p_request_id::text));
  select * into v_previous from public.material_daily_requests where id=p_request_id;
  if found then
    if v_previous.created_by<>auth.uid() or v_previous.payload<>v_payload then
      raise exception 'Esta solicitud ya fue guardada. Recarga para iniciar otro registro';
    end if;
    return v_previous.movement_count;
  end if;
  v_count := public.create_daily_inventory_register(p_location_id,p_record_date,p_responsible,p_observations,p_rows);
  insert into public.material_daily_requests(id,created_by,payload,movement_count)
    values(p_request_id,auth.uid(),v_payload,v_count);
  return v_count;
end;
$$;
revoke all on function public.create_priced_daily_inventory_register(uuid,uuid,date,text,text,jsonb) from public,anon;
grant execute on function public.create_priced_daily_inventory_register(uuid,uuid,date,text,text,jsonb) to authenticated;
