-- Super Admin: un nivel por encima de "admin" que es el único que puede
-- borrar catálogos o cancelar movimientos. Se modela como un flag sobre
-- profiles (no como un rol nuevo) porque un Super Admin sigue teniendo
-- todos los permisos de admin, más la capacidad de borrar.

alter table public.profiles
  add column is_super_admin boolean not null default false;

-- Bootstrap: el admin de prueba existente queda como el primer Super Admin.
-- Se hace ANTES de crear el trigger de protección más abajo, porque ese
-- trigger exige que quien haga el cambio ya sea Super Admin.
update public.profiles set is_super_admin = true
where id = '0b4cfd71-f830-4164-a57a-238b7c75beb6';

create or replace function public.is_super_admin()
returns boolean
language sql
security invoker
stable
set search_path = ''
as $$
  select coalesce((select p.is_super_admin from public.profiles p where p.id = auth.uid()), false);
$$;

-- Solo un Super Admin puede otorgar o quitar el flag a otro usuario. RLS por
-- sí sola no puede restringir un UPDATE a nivel de columna, así que se hace
-- con un trigger (mismo patrón que protect_movement_immutability).
create or replace function public.protect_super_admin_column()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.is_super_admin is distinct from old.is_super_admin and not public.is_super_admin() then
    raise exception 'Solo un Super Admin puede otorgar o quitar el rol de Super Admin';
  end if;
  return new;
end;
$$;

create trigger protect_profiles_super_admin
  before update on public.profiles
  for each row execute function public.protect_super_admin_column();

-- Borrar catálogos: antes cualquier admin podía, ahora solo Super Admin.
drop policy "materials_delete_admin" on public.materials;
create policy "materials_delete_super_admin" on public.materials for delete to authenticated
  using (public.is_super_admin());

drop policy "machines_delete_admin" on public.machines;
create policy "machines_delete_super_admin" on public.machines for delete to authenticated
  using (public.is_super_admin());

drop policy "locations_delete_admin" on public.locations;
create policy "locations_delete_super_admin" on public.locations for delete to authenticated
  using (public.is_super_admin());

drop policy "downtime_reasons_delete_admin" on public.downtime_reasons;
create policy "downtime_reasons_delete_super_admin" on public.downtime_reasons for delete to authenticated
  using (public.is_super_admin());

drop policy "shift_catalog_delete_admin" on public.shift_catalog;
create policy "shift_catalog_delete_super_admin" on public.shift_catalog for delete to authenticated
  using (public.is_super_admin());

drop policy "profiles_delete_admin" on public.profiles;
create policy "profiles_delete_super_admin" on public.profiles for delete to authenticated
  using (public.is_super_admin());

-- Cancelar un movimiento de inventario es, en la práctica, "borrar" su
-- efecto — antes lo podía hacer supervisor o admin, ahora solo Super Admin.
drop policy "inventory_movements_cancel_supervisor" on public.inventory_movements;
create policy "inventory_movements_cancel_super_admin" on public.inventory_movements for update to authenticated
  using (public.is_super_admin())
  with check (public.is_super_admin());
