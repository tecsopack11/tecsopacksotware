-- Ajustes de performance en RLS detectados por el advisor de Supabase:
-- 1. auth.uid() sin envolver en (select ...) se reevalúa por fila.
-- 2. Políticas "for all" duplican la evaluación de SELECT ya cubierta por
--    una política "select_all" separada.

-- ---- profiles ----
drop policy if exists "profiles_select_own_or_admin" on public.profiles;
drop policy if exists "profiles_update_own_no_role_change" on public.profiles;
drop policy if exists "profiles_admin_manage" on public.profiles;

create policy "profiles_select" on public.profiles
  for select to authenticated
  using (id = (select auth.uid()) or public.current_role() = 'admin');

create policy "profiles_update" on public.profiles
  for update to authenticated
  using (id = (select auth.uid()) or public.current_role() = 'admin')
  with check (
    public.current_role() = 'admin'
    or (id = (select auth.uid()) and role = (select role from public.profiles where id = (select auth.uid())))
  );

create policy "profiles_insert_admin" on public.profiles
  for insert to authenticated
  with check (public.current_role() = 'admin');

create policy "profiles_delete_admin" on public.profiles
  for delete to authenticated
  using (public.current_role() = 'admin');

-- ---- catálogos: separar SELECT (todos) de escritura (solo admin) ----
drop policy if exists "materials_write_admin" on public.materials;
create policy "materials_insert_admin" on public.materials for insert to authenticated with check (public.current_role() = 'admin');
create policy "materials_update_admin" on public.materials for update to authenticated using (public.current_role() = 'admin') with check (public.current_role() = 'admin');
create policy "materials_delete_admin" on public.materials for delete to authenticated using (public.current_role() = 'admin');

drop policy if exists "machines_write_admin" on public.machines;
create policy "machines_insert_admin" on public.machines for insert to authenticated with check (public.current_role() = 'admin');
create policy "machines_update_admin" on public.machines for update to authenticated using (public.current_role() = 'admin') with check (public.current_role() = 'admin');
create policy "machines_delete_admin" on public.machines for delete to authenticated using (public.current_role() = 'admin');

drop policy if exists "locations_write_admin" on public.locations;
create policy "locations_insert_admin" on public.locations for insert to authenticated with check (public.current_role() = 'admin');
create policy "locations_update_admin" on public.locations for update to authenticated using (public.current_role() = 'admin') with check (public.current_role() = 'admin');
create policy "locations_delete_admin" on public.locations for delete to authenticated using (public.current_role() = 'admin');

drop policy if exists "downtime_reasons_write_admin" on public.downtime_reasons;
create policy "downtime_reasons_insert_admin" on public.downtime_reasons for insert to authenticated with check (public.current_role() = 'admin');
create policy "downtime_reasons_update_admin" on public.downtime_reasons for update to authenticated using (public.current_role() = 'admin') with check (public.current_role() = 'admin');
create policy "downtime_reasons_delete_admin" on public.downtime_reasons for delete to authenticated using (public.current_role() = 'admin');

drop policy if exists "shift_catalog_write_admin" on public.shift_catalog;
create policy "shift_catalog_insert_admin" on public.shift_catalog for insert to authenticated with check (public.current_role() = 'admin');
create policy "shift_catalog_update_admin" on public.shift_catalog for update to authenticated using (public.current_role() = 'admin') with check (public.current_role() = 'admin');
create policy "shift_catalog_delete_admin" on public.shift_catalog for delete to authenticated using (public.current_role() = 'admin');

-- ---- auth.uid() -> (select auth.uid()) en policies de captura operativa ----
drop policy if exists "inventory_movements_insert_operational" on public.inventory_movements;
create policy "inventory_movements_insert_operational" on public.inventory_movements for insert to authenticated
  with check (public.current_role() in ('operario', 'supervisor', 'admin') and created_by = (select auth.uid()));

drop policy if exists "shift_instances_insert_operational" on public.shift_instances;
create policy "shift_instances_insert_operational" on public.shift_instances for insert to authenticated
  with check (public.current_role() in ('operario', 'supervisor', 'admin') and created_by = (select auth.uid()));

drop policy if exists "machine_downtime_events_insert_operational" on public.machine_downtime_events;
create policy "machine_downtime_events_insert_operational" on public.machine_downtime_events for insert to authenticated
  with check (public.current_role() in ('operario', 'supervisor', 'admin') and created_by = (select auth.uid()));

drop policy if exists "production_counts_insert_operational" on public.production_counts;
create policy "production_counts_insert_operational" on public.production_counts for insert to authenticated
  with check (public.current_role() in ('operario', 'supervisor', 'admin') and created_by = (select auth.uid()));

-- ---- índices en foreign keys señalados por el advisor de performance ----
create index if not exists inventory_movements_cancelled_by_idx on public.inventory_movements (cancelled_by);
create index if not exists inventory_movements_created_by_idx on public.inventory_movements (created_by);
create index if not exists inventory_movements_lot_id_idx on public.inventory_movements (lot_id);
create index if not exists locations_machine_id_idx on public.locations (machine_id);
create index if not exists machine_downtime_events_closed_by_idx on public.machine_downtime_events (closed_by);
create index if not exists machine_downtime_events_created_by_idx on public.machine_downtime_events (created_by);
create index if not exists machine_downtime_events_reason_id_idx on public.machine_downtime_events (reason_id);
create index if not exists machine_downtime_events_shift_instance_id_idx on public.machine_downtime_events (shift_instance_id);
create index if not exists material_lots_created_by_idx on public.material_lots (created_by);
create index if not exists materials_created_by_idx on public.materials (created_by);
create index if not exists production_counts_created_by_idx on public.production_counts (created_by);
create index if not exists production_counts_machine_id_idx on public.production_counts (machine_id);
create index if not exists shift_instances_created_by_idx on public.shift_instances (created_by);
create index if not exists shift_instances_operator_id_idx on public.shift_instances (operator_id);
create index if not exists shift_instances_shift_id_idx on public.shift_instances (shift_id);
