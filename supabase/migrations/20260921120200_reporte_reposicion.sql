-- El reporte de compras.
--
-- Dos funciones y no una, porque el libro lleva dos hojas y la segunda es la
-- que lo hace util el primer dia: al 21 de septiembre de 2026 hay 0 de 2,526
-- existencias con minimo, asi que la hoja de reposicion sale vacia, y un
-- reporte que sale vacio se abre una vez y no se vuelve a abrir.
-- `reporte_sin_minimo` contesta "estos son los que te faltan por definir".
--
-- SIN security definer, las dos. Es la linea que hace que la RLS de
-- `existencia` y `minimo_articulo` les aplique: una funcion `definer` correria
-- como su dueno, se saltaria la politica y publicaria el inventario de los
-- siete almacenes a cualquiera con la anon key, que viaja dentro del binario.
-- Falla en silencio -la funcion responde igual de bien-, igual que una vista
-- sin `security_invoker`.
--
-- El chequeo de rol no obliga a cambiar eso: `private.puede_reportar()` si es
-- definer y se llama desde dentro. Las dos cosas conviven.

create or replace function public.reporte_reposicion(
  p_almacen bigint  default null,
  p_dias    integer default 180
)
returns table (
  almacen        text,
  clasificacion  public.clasificacion_articulo,
  articulo       text,
  descripcion    text,
  unidad         text,
  total_fisico   numeric,
  vencido        numeric,
  vigente        numeric,
  minimo         numeric,
  faltante       numeric,
  envases        bigint,
  consumo        numeric,
  ultima_entrada date,
  ubicaciones    text
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
  with stock as (
    select e.articulo_id, e.almacen_id,
           sum(e.cantidad) as total_fisico,
           -- Tres columnas y no una. El faltante sale del vigente, pero las
           -- otras dos quedan a la vista para que el numero sea explicable:
           -- "tienes 2 L de acetona" cuando 1.5 L estan vencidos no es un dato,
           -- es una compra que no se hace hasta media practica.
           coalesce(sum(e.cantidad) filter (
             where e.fecha_caducidad is not null
               and e.fecha_caducidad < current_date), 0) as vencido,
           coalesce(sum(e.cantidad) filter (
             where e.estado not in ('contaminado', 'mantenimiento', 'baja')
               and (e.fecha_caducidad is null
                    or e.fecha_caducidad >= current_date)), 0) as vigente,
           count(*) as envases,
           string_agg(distinct u.etiqueta, ' · ') as ubicaciones
    from public.existencia e
    left join public.ubicacion u on u.id = e.ubicacion_id
    where p_almacen is null or e.almacen_id = p_almacen
    group by e.articulo_id, e.almacen_id
  ),
  gasto as (
    -- `carga_inicial` queda fuera por omision: no esta en la lista. Esta al
    -- frente del enum precisamente para que el primer reporte de consumo no
    -- cuente la carga de arranque como compra del semestre.
    select m.almacen_id, e.articulo_id, sum(-m.cantidad) as consumo
    from public.movimiento m
    join public.existencia e on e.id = m.existencia_id
    where m.tipo in ('consumo', 'merma')
      and m.ocurrido_en >= now() - make_interval(days => p_dias)
    group by m.almacen_id, e.articulo_id
  ),
  entrada as (
    select m.almacen_id, e.articulo_id, max(m.ocurrido_en)::date as ultima
    from public.movimiento m
    join public.existencia e on e.id = m.existencia_id
    where m.tipo = 'entrada'
    group by m.almacen_id, e.articulo_id
  )
  select al.clave,
         a.clasificacion,
         a.nombre_canonico,
         a.descripcion,
         a.unidad_base,
         coalesce(s.total_fisico, 0),
         coalesce(s.vencido, 0),
         coalesce(s.vigente, 0),
         ma.minimo,
         greatest(ma.minimo - coalesce(s.vigente, 0), 0),
         coalesce(s.envases, 0),
         coalesce(g.consumo, 0),
         en.ultima,
         s.ubicaciones
  from public.minimo_articulo ma
  join public.articulo a  on a.id  = ma.articulo_id
  join public.almacen  al on al.id = ma.almacen_id
  left join stock   s  on s.articulo_id  = ma.articulo_id and s.almacen_id  = ma.almacen_id
  left join gasto   g  on g.articulo_id  = ma.articulo_id and g.almacen_id  = ma.almacen_id
  left join entrada en on en.articulo_id = ma.articulo_id and en.almacen_id = ma.almacen_id
  where (p_almacen is null or ma.almacen_id = p_almacen)
    and coalesce(s.vigente, 0) < ma.minimo
  order by greatest(ma.minimo - coalesce(s.vigente, 0), 0) desc, a.nombre_canonico;
end $$;

comment on function public.reporte_reposicion(bigint, integer) is
  'Articulos bajo minimo. Hoja 1 del libro de compras.';


create or replace function public.reporte_sin_minimo(
  p_almacen bigint  default null,
  p_dias    integer default 180
)
returns table (
  almacen       text,
  clasificacion public.clasificacion_articulo,
  articulo      text,
  descripcion   text,
  unidad        text,
  vigente       numeric,
  consumo       numeric,
  envases       bigint
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
  -- Sale de `existencia` y NO de `movimiento`. Arrancar en el consumo parecia
  -- natural -la lista de trabajo ordenada por lo que mas se gasta- y el censo
  -- del 21 de septiembre lo desmintio: 2,525 movimientos y solo 3 que no son
  -- `carga_inicial`. Una hoja que arranque en `gasto` trae tres renglones, y el
  -- mecanismo inventado para resolver el arranque en frio necesitaria, el
  -- mismo, una historia que todavia no existe.
  with stock as (
    select e.articulo_id, e.almacen_id,
           coalesce(sum(e.cantidad) filter (
             where e.estado not in ('contaminado', 'mantenimiento', 'baja')
               and (e.fecha_caducidad is null
                    or e.fecha_caducidad >= current_date)), 0) as vigente,
           count(*) as envases
    from public.existencia e
    where e.estado <> 'baja'
      and (p_almacen is null or e.almacen_id = p_almacen)
    group by e.articulo_id, e.almacen_id
  ),
  gasto as (
    select m.almacen_id, e.articulo_id, sum(-m.cantidad) as consumo
    from public.movimiento m
    join public.existencia e on e.id = m.existencia_id
    where m.tipo in ('consumo', 'merma')
      and m.ocurrido_en >= now() - make_interval(days => p_dias)
      and (p_almacen is null or m.almacen_id = p_almacen)
    group by m.almacen_id, e.articulo_id
  )
  select al.clave, a.clasificacion, a.nombre_canonico, a.descripcion,
         a.unidad_base, s.vigente, coalesce(g.consumo, 0), s.envases
  from stock s
  join public.articulo a  on a.id  = s.articulo_id
  join public.almacen  al on al.id = s.almacen_id
  left join gasto g on g.articulo_id = s.articulo_id and g.almacen_id = s.almacen_id
  where not exists (
    select 1 from public.minimo_articulo ma
    where ma.articulo_id = s.articulo_id and ma.almacen_id = s.almacen_id
  )
  -- Consumo primero; envases cuando no hay consumo. Ocho frascos de algo es
  -- algo que se repone, uno probablemente no: es la mejor senal disponible
  -- mientras no haya historia. En cuanto practicas genere consumo real, el
  -- primer criterio toma el mando sin tocar una linea.
  order by coalesce(g.consumo, 0) desc, s.envases desc, a.nombre_canonico;
end $$;

comment on function public.reporte_sin_minimo(bigint, integer) is
  'Articulos sin minimo definido, ordenados por lo que conviene atender primero.';

grant execute on function public.reporte_reposicion(bigint, integer) to authenticated;
grant execute on function public.reporte_sin_minimo(bigint, integer)  to authenticated;
revoke execute on function public.reporte_reposicion(bigint, integer) from anon, public;
revoke execute on function public.reporte_sin_minimo(bigint, integer)  from anon, public;
