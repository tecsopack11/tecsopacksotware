-- Weekly physical counts. Snapshots and completed records cannot be edited by clients.
create table public.inventory_audit_schedule (
  id boolean primary key default true check(id),
  starts_on date not null default ((now() at time zone 'America/Bogota')::date + ((5-extract(isodow from now() at time zone 'America/Bogota')::int+7)%7))
);
insert into public.inventory_audit_schedule(id) values(true);
create table public.inventory_audits (
  id uuid primary key default gen_random_uuid(),
  due_date date not null unique check(extract(isodow from due_date)=5),
  started_at timestamptz not null default now(),
  started_by uuid not null references public.profiles(id),
  completed_at timestamptz,
  completed_by uuid references public.profiles(id),
  responsible text not null,
  items jsonb not null,
  check ((completed_at is null) = (completed_by is null))
);
alter table public.inventory_audit_schedule enable row level security;
alter table public.inventory_audits enable row level security;
create policy audit_schedule_read on public.inventory_audit_schedule for select to authenticated using (exists(select 1 from public.profiles where id=auth.uid() and active and role in ('admin','supervisor')));
create policy audits_read on public.inventory_audits for select to authenticated using (exists(select 1 from public.profiles where id=auth.uid() and active and role in ('admin','supervisor')));
revoke all on public.inventory_audits, public.inventory_audit_schedule from anon, authenticated;
grant select on public.inventory_audits, public.inventory_audit_schedule to authenticated;

create function public.start_inventory_audit(p_due_date date) returns uuid
language plpgsql security definer set search_path='' as $$
declare v_id uuid; v_items jsonb; v_name text;
begin
  select full_name into v_name from public.profiles where id=auth.uid() and active and role in ('admin','supervisor');
  if not found then raise exception 'No autorizado'; end if;
  if p_due_date is null or extract(isodow from p_due_date)<>5 or p_due_date>(now() at time zone 'America/Bogota')::date or p_due_date<(select starts_on from public.inventory_audit_schedule) then raise exception 'Fecha de auditoría inválida'; end if;
  select jsonb_agg(jsonb_build_object('key', m.id::text||':'||l.id::text, 'material',m.name,'code',m.code,'unit',m.unit_of_measure,'location',l.name,'expected',coalesce(s.quantity,0)) order by l.name,m.name)
  into v_items from public.materials m cross join public.locations l
  left join (select material_id,location_id,sum(quantity) quantity from public.v_inventory_stock group by material_id,location_id) s on s.material_id=m.id and s.location_id=l.id
  where (m.active and l.active or coalesce(s.quantity,0)<>0) and l.type in ('bodega','piso','maquina');
  if v_items is null then raise exception 'No hay materiales ni ubicaciones para contar'; end if;
  insert into public.inventory_audits(due_date,started_by,responsible,items) values(p_due_date,auth.uid(),v_name,v_items)
  on conflict(due_date) do nothing returning id into v_id;
  if v_id is null then select id into v_id from public.inventory_audits where due_date=p_due_date; end if;
  return v_id;
end $$;

create function public.complete_inventory_audit(p_id uuid,p_counts jsonb) returns void
language plpgsql security definer set search_path='' as $$
declare v_a public.inventory_audits; v_item jsonb; v_count jsonb; v_qty numeric; v_result jsonb := '[]'; v_name text;
begin
  select full_name into v_name from public.profiles where id=auth.uid() and active and role in ('admin','supervisor');
  if not found then raise exception 'No autorizado'; end if;
  select * into v_a from public.inventory_audits where id=p_id for update;
  if not found or v_a.completed_at is not null then raise exception 'La auditoría no está abierta'; end if;
  if p_counts is null or jsonb_typeof(p_counts)<>'array' then raise exception 'Conteo inválido'; end if;
  if jsonb_array_length(p_counts)<>jsonb_array_length(v_a.items) then raise exception 'Debe contar todos los materiales'; end if;
  for v_item in select value from jsonb_array_elements(v_a.items) loop
    if (select count(*) from jsonb_array_elements(p_counts) where value->>'key'=v_item->>'key')<>1 then raise exception 'Conteo incompleto o duplicado'; end if;
    select value into v_count from jsonb_array_elements(p_counts) where value->>'key'=v_item->>'key';
    if jsonb_typeof(v_count->'physical') is distinct from 'number' then raise exception 'Cantidad física inválida'; end if;
    v_qty := (v_count->>'physical')::numeric;
    if v_qty<0 or v_qty>999999999 or scale(v_qty)>3 then raise exception 'Cantidad inválida: use hasta tres decimales'; end if;
    if v_qty<>(v_item->>'expected')::numeric and nullif(btrim(v_count->>'reason'),'') is null then raise exception 'Explique cada diferencia'; end if;
    v_result := v_result || jsonb_build_array(v_item || jsonb_build_object('physical',v_qty,'difference',v_qty-(v_item->>'expected')::numeric,'reason',left(coalesce(v_count->>'reason',''),2000)));
  end loop;
  update public.inventory_audits set items=v_result,completed_at=now(),completed_by=auth.uid(),responsible=v_name where id=p_id;
end $$;
revoke all on function public.start_inventory_audit(date), public.complete_inventory_audit(uuid,jsonb) from public,anon;
grant execute on function public.start_inventory_audit(date), public.complete_inventory_audit(uuid,jsonb) to authenticated;
