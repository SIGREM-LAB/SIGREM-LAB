-- El inventario ICSA pertenece a un almacen propio, no a una sub-ubicacion de
-- N3. Sus constantes NOM se dejan nulas hasta que el responsable las confirme.
insert into public.almacen (clave, nombre)
values ('ICSA', 'ICSA')
on conflict (clave) do nothing;
