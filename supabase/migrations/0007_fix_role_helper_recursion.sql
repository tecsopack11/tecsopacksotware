-- current_role() / is_super_admin() consultan public.profiles internamente.
-- Al estar marcadas "security invoker" quedan sujetas a las políticas RLS de
-- profiles, y esas políticas (profiles_select, profiles_update) vuelven a
-- llamar a current_role() dentro de su propia condición OR. SQL no garantiza
-- el corto-circuito del OR en cláusulas RLS, así que el planner puede
-- reevaluar current_role() dentro de sí misma hasta agotar el stack de
-- Postgres ("stack depth limit exceeded" / error 54001) — se veía, por
-- ejemplo, como el historial de movimientos vacío para cualquier usuario
-- que no fuera dueño de la fila consultada.
--
-- El arreglo estándar de Supabase: marcar estas funciones "security definer"
-- para que su consulta interna a profiles no vuelva a pasar por RLS. Es
-- seguro porque ambas solo devuelven el rol/flag del usuario autenticado
-- (auth.uid()), nunca datos de otro usuario.

create or replace function public.current_role()
returns public.user_role
language sql
security definer
stable
set search_path = ''
as $$
  select role from public.profiles where id = auth.uid();
$$;

create or replace function public.is_super_admin()
returns boolean
language sql
security definer
stable
set search_path = ''
as $$
  select coalesce((select p.is_super_admin from public.profiles p where p.id = auth.uid()), false);
$$;
