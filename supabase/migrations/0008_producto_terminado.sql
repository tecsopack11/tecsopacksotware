-- Nuevo tipo de ubicación para Producto Terminado. Se aplica en su propia
-- migración porque Postgres no permite usar un valor de enum recién creado
-- dentro de la misma transacción en que se agregó.

alter type public.location_type add value 'almacen_pt';
