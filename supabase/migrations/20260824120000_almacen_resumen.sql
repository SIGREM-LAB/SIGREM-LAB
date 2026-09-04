-- ---------------------------------------------------------------------------
-- El resumen por almacen que alimenta el menu principal
-- ---------------------------------------------------------------------------
-- El menu principal muestra, por almacen, cuanto hay y como esta repartido
-- entre los seis estados. Hasta ahora esa cuenta se hacia en el navegador:
-- `almacen(..., existencia(id))` traia UN RENGLON POR EXISTENCIA solo para
-- medir el largo del arreglo. Con las 164 de la semilla se nota poco; con el
-- inventario de los cuatro almacenes cargado son miles de renglones por cada
-- visita al menu, para pintar veinte numeros.
--
-- Agregado aqui, la misma pantalla se resuelve con una consulta que devuelve
-- cuatro renglones.
--
-- `security_invoker = on` NO ES OPCIONAL, por lo mismo que en
-- `existencia_listado`: sin el, la vista corre como su dueno, se salta la RLS
-- de `existencia` y publica el tamano del inventario a la anon key, que va
-- dentro del binario. Falla en silencio -la vista responde igual de bien-, asi
-- que el seguro esta en esquema.test.sql y no en la revision de nadie.
--
-- `left join`: un almacen recien dado de alta todavia no tiene existencias, y
-- tiene que aparecer con sus ceros en vez de desaparecer del menu.
--
-- `activo` va como columna y no como filtro: esconder renglones dentro de una
-- vista hace que las cuentas no cuadren sin que se vea por que. Quien la
-- consulta decide, igual que ya hace el selector de almacenes.
create view public.almacen_resumen
with (security_invoker = on) as
select al.id,
       al.clave,
       al.nombre,
       al.activo,
       -- Lo dado de baja ya no es inventario: no entra en el total.
       count(e.id) filter (where e.estado <> 'baja')         as total,
       count(e.id) filter (where e.estado = 'disponible')    as disponible,
       count(e.id) filter (where e.estado = 'stock_bajo')    as stock_bajo,
       count(e.id) filter (where e.estado = 'agotado')       as agotado,
       count(e.id) filter (where e.estado = 'contaminado')   as contaminado,
       count(e.id) filter (where e.estado = 'mantenimiento') as mantenimiento,
       count(e.id) filter (where e.estado = 'baja')          as baja
from public.almacen al
left join public.existencia e on e.almacen_id = al.id
group by al.id, al.clave, al.nombre, al.activo;

comment on view public.almacen_resumen is
  'Conteo por almacen y estado para el menu principal. Hereda la RLS de existencia.';

grant select on public.almacen_resumen to authenticated;
revoke all  on public.almacen_resumen from anon;
