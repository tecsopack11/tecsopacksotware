-- Agrupación visual de materiales por categoría (Principales, Pigmentos,
-- Tintas, Solventes) para las casillas de inventario. Independiente de
-- material_type (que describe la naturaleza física del material).
create type public.material_category as enum ('principal', 'pigmento', 'tinta', 'solvente');

alter table public.materials
  add column category public.material_category not null default 'principal';

update public.materials set category = 'pigmento' where code like 'PIG-%';
update public.materials set category = 'tinta' where code like 'TIN-%';
update public.materials set category = 'solvente' where code = 'SOLV-01';
