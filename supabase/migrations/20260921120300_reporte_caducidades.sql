-- Caducidades y hoja de conteo fisico.
--
-- Las dos SIN security definer, por lo mismo que las de reposicion: la RLS de
-- `existencia` tiene que aplicarles, y el chequeo de rol se delega en
-- `private.puede_reportar()`, que si es definer.

-- ---------------------------------------------------------------------------
-- Caducidades
-- ---------------------------------------------------------------------------
-- Una sola hoja, ordenada por dias restantes, con los vencidos arriba en
-- negativo. Se prefirio a dos hojas separadas -«vencidos» y «por vencer»-
-- porque EL GRADIENTE ES LA INFORMACION: un corte binario esconde que algo
-- vence pasado manana, que es justo lo que hay que ver.
--
-- Limite conocido al 21 de septiembre de 2026: este reporte sale vacio, y no
-- por falta de carga. `fecha_caducidad` esta en 0 de 2,526 existencias porque
-- EL FORMATO UNIFICADO NO TIENE COLUMNA DE CADUCIDAD en ninguna de sus seis
-- hojas, asi que el ETL nunca tuvo de donde llenarla. El campo si existe en
-- `campo_capturable` -«Informativa: un reactivo caducado no se bloquea»- y el
-- alta y la edicion lo ofrecen, asi que se puede llenar a mano desde hoy.
--
-- La funcion se construye igual porque queda lista para ese dia y porque cuesta
-- una funcion. Lo que NO se hace es entregar un Excel en blanco: el cliente
-- detecta el caso y avisa, en vez de dar un archivo que parece un inventario
-- sano.
create or replace function public.reporte_caducidades(
  p_almacen bigint  default null,
  p_dias    integer default 90
)
returns table (
  almacen         text,
  codigo          text,
  clasificacion   public.clasificacion_articulo,
  articulo        text,
  marca           text,
  presentacion    text,
  cantidad        numeric,
  unidad          text,
  fecha_caducidad date,
  dias_restantes  integer,
  ubicacion       text,
  estado          public.estado_existencia
)
language plpgsql
stable
set search_path = ''
as $$
begin
  if not (select private.puede_reportar()) then
    raise exception 'Solo un responsable o un administrador puede generar reportes';
  end if;

  return query
  select al.clave, e.codigo, a.clasificacion, a.nombre_canonico, e.marca,
         e.presentacion, e.cantidad, a.unidad_base, e.fecha_caducidad,
         (e.fecha_caducidad - current_date)::integer,
         u.etiqueta, e.estado
  from public.existencia e
  join public.articulo a  on a.id  = e.articulo_id
  join public.almacen  al on al.id = e.almacen_id
  left join public.ubicacion u on u.id = e.ubicacion_id
  where e.fecha_caducidad is not null
    and e.fecha_caducidad <= current_date + p_dias
    -- Lo dado de baja ya no es inventario, igual que en `almacen_resumen`.
    and e.estado <> 'baja'
    and (p_almacen is null or e.almacen_id = p_almacen)
  order by e.fecha_caducidad, a.nombre_canonico;
end $$;

comment on function public.reporte_caducidades(bigint, integer) is
  'Vencidos y por vencer, en una sola hoja ordenada por dias restantes.';


-- ---------------------------------------------------------------------------
-- Hoja de conteo fisico
-- ---------------------------------------------------------------------------
-- Ordenada por ubicacion y no alfabeticamente: la lista sigue el recorrido
-- fisico del almacen, que es como se cuenta. Al 21 de septiembre las 2,526
-- existencias tienen ubicacion, asi que el recorrido sale completo.
--
-- `p_con_cantidad` decide si se imprime lo que el sistema cree tener. Con ella
-- el conteo es mas rapido -se verifica y solo se anota donde no cuadra-; sin
-- ella es ciego, quien cuenta no puede copiar el numero que ya estaba, y la
-- diferencia que salga es real. Es lo unico que hace que un porcentaje de
-- exactitud signifique algo. La decision se toma al generar, no aqui.
create or replace function public.reporte_conteo(
  p_almacen      bigint  default null,
  p_con_cantidad boolean default false
)
returns table (
  almacen          text,
  ubicacion        text,
  codigo           text,
  clasificacion    public.clasificacion_articulo,
  articulo         text,
  descripcion      text,
  marca            text,
  presentacion     text,
  unidad           text,
  cantidad_sistema numeric
)
language plpgsql
stable
set search_path = ''
as $$
begin
  if not (select private.puede_reportar()) then
    raise exception 'Solo un responsable o un administrador puede generar reportes';
  end if;

  return query
  select al.clave, u.etiqueta, e.codigo, a.clasificacion, a.nombre_canonico,
         a.descripcion, e.marca, e.presentacion, a.unidad_base,
         -- La columna existe SIEMPRE y va nula cuando el conteo es ciego. Que
         -- la forma de la fila no dependa del parametro es lo que deja que el
         -- registro del cliente declare sus columnas una sola vez.
         case when p_con_cantidad then e.cantidad else null end
  from public.existencia e
  join public.articulo a  on a.id  = e.articulo_id
  join public.almacen  al on al.id = e.almacen_id
  left join public.ubicacion u on u.id = e.ubicacion_id
  where e.estado <> 'baja'
    and (p_almacen is null or e.almacen_id = p_almacen)
  -- `nulls last` deja al final lo que no tiene sitio asignado, que es justo lo
  -- que hay que ir a buscar.
  order by u.etiqueta nulls last, a.nombre_canonico;
end $$;

comment on function public.reporte_conteo(bigint, boolean) is
  'Hoja para el conteo fisico, ordenada por ubicacion. La cantidad del sistema es opcional.';

grant execute on function public.reporte_caducidades(bigint, integer) to authenticated;
grant execute on function public.reporte_conteo(bigint, boolean)      to authenticated;
revoke execute on function public.reporte_caducidades(bigint, integer) from anon, public;
revoke execute on function public.reporte_conteo(bigint, boolean)      from anon, public;
