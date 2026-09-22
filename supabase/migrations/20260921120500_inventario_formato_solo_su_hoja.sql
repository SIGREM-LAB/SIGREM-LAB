-- El renglon no lleva ni una llave que su hoja no tenga.
--
-- La version anterior armaba un `jsonb` con todos los campos de las seis hojas
-- y dejaba que `jsonb_strip_nulls` limpiara. Funciona mientras lo que sobra sea
-- nulo, y para Reactivos no lo era: `articulo` y `clasificacion` salian con
-- valor en una hoja que no tiene esas columnas.
--
-- Al exportador le daba igual -solo escribe las columnas que `columna_formato`
-- declara-, pero un contrato que depende de que el consumidor ignore lo que
-- sobra es un contrato que se rompe el dia que alguien recorra las llaves. Y la
-- prueba de ida y vuelta compara justamente conjuntos de llaves.
--
-- Ahora el filtro lo pone `columna_formato`, que ya es la autoridad sobre que
-- columna existe en cada hoja. La funcion no puede emitir de mas aunque el
-- `jsonb_build_object` crezca: lo que no este declarado, no sale.
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
  with campos as (
    select coalesce(array_agg(cf.campo), array[]::text[]) as lista
    from public.columna_formato cf
    where cf.hoja = p_hoja
  )
  select coalesce(
           (select jsonb_object_agg(t.k, t.v)
            from jsonb_each(bruto.obj) as t(k, v)
            where t.k = any(c.lista)),
           '{}'::jsonb)
  from public.existencia e
  join public.articulo a on a.id = e.articulo_id
  left join public.articulo_reactivo  ar  on ar.articulo_id = a.id
  left join public.articulo_biologico ab  on ab.articulo_id = a.id
  left join public.ubicacion          u   on u.id           = e.ubicacion_id
  left join public.laboratorio        lab on lab.id         = e.laboratorio_id
  cross join campos c
  cross join lateral (
    select jsonb_strip_nulls(jsonb_build_object(
      -- `sustancia` y `articulo` son la misma cosa con dos titulos: el formato
      -- llama «Sustancia quimica» a la columna de Reactivos y «Articulo» o
      -- «Nombre comun» a la de las demas hojas. Las dos van, y el filtro de
      -- arriba deja pasar solo la que esa hoja declara.
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

      -- Ubicacion: las piezas sueltas con que el ETL arma la etiqueta, porque
      -- «Repisa 3 · Fila 2» es derivada y el formato pide las columnas.
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

      -- El estado fisico ocupa tres columnas de casilla, no una de texto: asi
      -- lo pide el formato. `false` y no null cuando se sabe cual es, para que
      -- las otras dos salgan marcadas como vacias a proposito.
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
      -- real. Sin `grupo_taxonomico`: el esquema no tiene donde guardarlo, asi
      -- que se ignora igual que «No.».
      'origen_especie',      ab.origen_especie,
      'metodo_conservacion', e.metodo_conservacion,
      'fecha_recoleccion',   e.fecha_recoleccion,
      'fecha_preparacion',   e.fecha_preparacion,
      'responsable_muestra', e.responsable_muestra
    )) as obj
  ) bruto
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
