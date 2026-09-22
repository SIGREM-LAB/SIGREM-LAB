-- El inventario con la forma del formato unificado.
--
-- Devuelve `jsonb` y no columnas. Cada hoja tiene un juego de campos distinto:
-- una funcion por hoja serian seis funciones casi iguales, y una funcion con la
-- union de todas las columnas seria una fila con treinta huecos. Devolver el
-- renglon llaveado POR EL MISMO NOMBRE DE CAMPO que usa `columna_formato` deja
-- que el exportador haga una sola cosa: para cada columna de la hoja, escribir
-- `renglon->>campo` en su letra.
--
-- Es la misma forma en que el ETL lee, y la misma traduccion que ya hace
-- `private.clave_renglon` en el otro sentido: el esquema dice
-- `peso_frasco_vacio` y el formato dice `peso_vacio`.
--
-- SIN security definer, como las demas funciones de reporte.
create or replace function public.inventario_formato(
  p_almacen bigint,
  p_hoja    text
)
returns table (renglon jsonb)
language plpgsql
stable
set search_path = ''
as $$
declare
  v_clasificacion public.clasificacion_articulo;
  v_existe        boolean;
begin
  if not (select private.puede_reportar()) then
    raise exception 'Solo un responsable o un administrador puede generar reportes';
  end if;

  select true, hf.clasificacion into v_existe, v_clasificacion
  from public.hoja_formato hf where hf.hoja = p_hoja;

  -- Se rechaza en vez de devolver vacio. Una hoja mal escrita -«Materia
  -- biologica» en vez de «Material biologico», que es exactamente el error que
  -- tenia el ETL- no debe parecer un almacen sin existencias.
  if not coalesce(v_existe, false) then
    raise exception 'La hoja % no es del formato unificado', p_hoja;
  end if;

  return query
  select jsonb_strip_nulls(jsonb_build_object(
    -- Comunes. `sustancia` y `articulo` son la misma cosa con dos titulos: el
    -- formato llama «Sustancia quimica» a la columna de Reactivos y «Articulo»
    -- o «Nombre comun» a la de las demas hojas.
    'articulo',       a.nombre_canonico,
    'sustancia',      a.nombre_canonico,
    'especificacion', a.descripcion,
    'clasificacion',  a.clasificacion::text,
    'familia',        a.familia,
    'marca',          e.marca,
    'modelo',         e.modelo,
    'presentacion',   e.presentacion,
    'cantidad',       e.cantidad,
    'unidad',         a.unidad_base,
    'observaciones',  e.observaciones,

    -- Ubicacion: se reparte en los mismos componentes con que la armo el ETL,
    -- porque la etiqueta («Repisa 3 · Fila 2») es derivada y el formato pide
    -- las piezas sueltas.
    'sub_ubicacion',  u.componentes->>'sub_ubicacion',
    'mueble',         u.componentes->>'mueble',
    'repisa',         u.componentes->>'repisa',
    'fila_cajon',     u.componentes->>'fila_cajon',
    'coord_h',        u.componentes->>'coord_h',
    'coord_v',        u.componentes->>'coord_v',
    'coord_i',        u.componentes->>'coord_i',

    -- Reactivos.
    'peso_vacio',     e.peso_frasco_vacio,
    'peso_total',     e.peso_total,
    'color',          ar.color_almacenaje::text,
    'hoja_seguridad', ar.tiene_hoja_seguridad,
    'caracteristica_quimica', ar.caracteristica_quimica,
    'caracteristica_toxica',  ar.caracteristica_toxica,
    'riesgo_salud',           ar.riesgo_salud,
    'riesgo_reactividad',     ar.riesgo_reactividad,
    'riesgo_inflamabilidad',  ar.riesgo_inflamabilidad,
    'peligro_especial',       ar.peligro_especial,
    'implica_peligro',        ar.implica_actividad_peligro,

    -- El estado fisico ocupa tres columnas de casilla, no una de texto: asi lo
    -- pide el formato. `false` y no null cuando se sabe cual es, para que las
    -- otras dos casillas salgan marcadas como vacias a proposito.
    'solido',   case when ar.estado_fisico is null then null
                     else ar.estado_fisico = 'solido' end,
    'liquido',  case when ar.estado_fisico is null then null
                     else ar.estado_fisico = 'liquido' end,
    'gas',      case when ar.estado_fisico is null then null
                     else ar.estado_fisico = 'gas' end,

    -- Equipos.
    'numero_serie',      e.numero_serie,
    'numero_inventario', e.numero_inventario_uaeh,
    'laboratorio',       lab.nombre,
    'funcionamiento',    e.funcionamiento::text,
    'fecha_chequeo',     e.fecha_chequeo,
    'mantenimiento',     e.mantenimiento,

    -- Material biologico. Sin `temperatura`: esa columna no existe en la hoja
    -- real, y sin `grupo_taxonomico`: el esquema no tiene donde guardarlo, asi
    -- que se ignora igual que «No.».
    'origen_especie',      ab.origen_especie,
    'metodo_conservacion', e.metodo_conservacion,
    'fecha_recoleccion',   e.fecha_recoleccion,
    'fecha_preparacion',   e.fecha_preparacion,
    'responsable_muestra', e.responsable_muestra
  ))
  from public.existencia e
  join public.articulo a on a.id = e.articulo_id
  left join public.articulo_reactivo  ar  on ar.articulo_id  = a.id
  left join public.articulo_biologico ab  on ab.articulo_id  = a.id
  left join public.ubicacion          u   on u.id            = e.ubicacion_id
  left join public.laboratorio        lab on lab.id          = e.laboratorio_id
  where e.almacen_id = p_almacen
    and e.estado <> 'baja'
    -- Reactivos, Equipos y Material biologico tienen hoja propia. Las otras
    -- tres -Insumos, Material, Electronica- comparten forma y se separan por la
    -- clasificacion del renglon, igual que razona `private.hoja_de()`.
    and (case
           when v_clasificacion is not null then a.clasificacion = v_clasificacion
           when p_hoja = 'Insumos'     then a.clasificacion = 'insumo'
           when p_hoja = 'Material'    then a.clasificacion = 'material'
           when p_hoja = 'Electrónica' then a.clasificacion = 'componente'
           else false
         end)
  order by u.etiqueta nulls last, a.nombre_canonico;
end $$;

comment on function public.inventario_formato(bigint, text) is
  'El inventario de un almacen con la forma de una hoja del formato unificado.';

grant execute on function public.inventario_formato(bigint, text) to authenticated;
revoke execute on function public.inventario_formato(bigint, text) from anon, public;
