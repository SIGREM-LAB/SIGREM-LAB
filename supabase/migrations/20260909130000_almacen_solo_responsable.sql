-- El almacen es exclusivo del responsable.
--
-- `perfil_responsable_con_almacen`, del baseline, ya dice una mitad: un
-- responsable no puede quedarse sin almacen, porque seria alguien con permiso
-- de escritura y ningun sitio donde escribir. Faltaba la otra mitad: nadie mas
-- puede tener uno. Las dos juntas hacen la equivalencia — hay almacen si y
-- solo si el rol es responsable.
--
-- Por que no es cosmetico: `ConAlmacenPropio` decide a que pantalla entra cada
-- quien mirando si hay almacen, no el rol. Un admin con almacen aterriza en
-- Inventario, que es la pantalla de UNA bodega, cuando su ambito es la Unidad
-- entera y le toca Inventario general. Con esta restriccion la guardia vuelve
-- a ser exacta sin tocarla: tener almacen y ser responsable pasan a ser lo
-- mismo.
--
-- Es la misma clase de hueco que cerro 20260821120000, donde un usuario de
-- consulta con almacen asignado se colaba a escribir. Aquel se tapo en las
-- politicas; este se tapa en la forma del dato, que es donde ya no vuelve.

-- La limpieza va antes del constraint: sin ella el ALTER TABLE falla contra
-- las filas que ya existen. Vaciar ese almacen no le quita permisos a nadie.
-- Todas las politicas que consultan `almacen_actual()` son de escritura y van
-- precedidas de `es_admin()` o de `puede_escribir()`: la primera es cierta
-- para el admin pase lo que pase, y la segunda es falsa para consulta pase lo
-- que pase. Solo el responsable depende de ese valor, y a el no se le toca.
update public.perfil
   set almacen_id = null
 where rol <> 'responsable'
   and almacen_id is not null;

alter table public.perfil
  add constraint perfil_almacen_solo_responsable
  check (rol = 'responsable' or almacen_id is null);
