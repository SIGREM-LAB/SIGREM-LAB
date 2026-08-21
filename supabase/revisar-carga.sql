-- Revisión de una carga. Solo lectura: no escribe nada.
--
--   psql "$DATABASE_URL" -f supabase/revisar-carga.sql
--
-- También se puede pegar por bloques en el editor SQL de Studio
-- (http://127.0.0.1:54323 en local).
--
-- Está en dos partes. La primera son VISTAS del dato, para mirarlo con ojos.
-- La segunda son INVARIANTES: consultas que tienen que salir vacías. Un
-- renglón ahí es un defecto, no una curiosidad.


-- ===========================================================================
-- PARTE 1 · Qué entró
-- ===========================================================================

-- 1.1 Resumen
select 'resumen' as bloque,
       (select count(*) from public.carga)       as cargas,
       (select count(*) from public.articulo)    as articulos,
       (select count(*) from public.existencia)  as existencias,
       (select count(*) from public.movimiento)  as movimientos,
       (select count(*) from public.ubicacion)   as ubicaciones,
       (select count(*) from public.articulo_alias)     as alias,
       (select count(*) from public.articulo_reactivo)  as detalle_reactivo,
       (select count(*) from public.articulo_biologico) as detalle_biologico;


-- 1.2 Cuadre por archivo: lo que dijo la carga contra lo que hay
-- `filas` es lo que el cargador declaró; `existencias` lo que quedó. Si no
-- coinciden, algún renglón se colapsó contra una existencia previa.
select c.archivo,
       c.hoja,
       c.responsable,
       c.actualizado_el,
       c.filas                as declaradas,
       count(e.id)            as existencias,
       c.filas - count(e.id)  as diferencia
  from public.carga c
  left join public.existencia e on e.carga_id = c.id
 group by c.id, c.archivo, c.hoja, c.responsable, c.actualizado_el, c.filas
 order by c.archivo;


-- 1.3 Existencias por almacén y estado
select a.clave           as almacen,
       e.estado,
       count(*)          as existencias,
       round(sum(e.cantidad), 2) as cantidad_total
  from public.existencia e
  join public.almacen a on a.id = e.almacen_id
 group by a.clave, e.estado
 order by a.clave, e.estado;


-- 1.4 Artículos por clasificación
select clasificacion,
       count(*)                                as articulos,
       count(*) filter (where not verificado)  as sin_verificar,
       count(distinct unidad_base)             as unidades_distintas
  from public.articulo
 group by clasificacion
 order by articulos desc;


-- 1.5 LA PRUEBA QUE IMPORTA: artículos con más de una existencia
-- Son los que la deduplicación tuvo que resolver. Si esta consulta sale vacía,
-- cada renglón creó su propio artículo y la deduplicación no funcionó.
select a.nombre_canonico,
       a.unidad_base,
       count(*)                                   as existencias,
       string_agg(distinct al.clave, ', ' order by al.clave) as almacenes,
       string_agg(distinct coalesce(e.marca, 'sin marca'), ', ') as marcas
  from public.existencia e
  join public.articulo a  on a.id = e.articulo_id
  join public.almacen  al on al.id = e.almacen_id
 group by a.id, a.nombre_canonico, a.unidad_base
having count(*) > 1
 order by count(*) desc, a.nombre_canonico;


-- 1.6 El caso del zinc: mismo CAS, DOS artículos
-- La pureza cambia la sustancia. Si aquí sale un solo renglón, el cargador
-- fusionó por parecido y eso es exactamente lo que no debe hacer.
select a.id, a.nombre_canonico, r.cas, a.unidad_base
  from public.articulo a
  join public.articulo_reactivo r on r.articulo_id = a.id
 where r.cas = '7440-66-6'
 order by a.nombre_canonico;


-- 1.7 Reactivos con su detalle NOM-005-STPS
select a.nombre_canonico,
       r.cas,
       r.estado_fisico,
       r.color_almacenaje,
       r.tiene_hoja_seguridad          as hoja_seg,
       r.riesgo_salud                  as azul,
       r.riesgo_inflamabilidad         as rojo,
       r.riesgo_reactividad            as amarillo,
       r.implica_actividad_peligro     as peligro
  from public.articulo_reactivo r
  join public.articulo a on a.id = r.articulo_id
 order by a.nombre_canonico
 limit 20;


-- 1.8 Los reactivos que se pesan: la cantidad sale de la resta
select a.nombre_canonico,
       e.marca,
       e.peso_frasco_vacio  as vacio,
       e.peso_total         as lleno,
       e.peso_total - e.peso_frasco_vacio as resta,
       e.cantidad,
       a.unidad_base
  from public.existencia e
  join public.articulo a on a.id = e.articulo_id
 where e.peso_frasco_vacio is not null
 order by a.nombre_canonico
 limit 20;


-- 1.9 Equipos: identidad y estado
select al.clave                as almacen,
       a.nombre_canonico       as equipo,
       e.marca, e.modelo,
       e.numero_serie          as serie,
       e.numero_inventario_uaeh as inventario,
       e.funcionamiento,
       l.nombre                as laboratorio,
       u.etiqueta              as ubicacion
  from public.existencia e
  join public.articulo a  on a.id = e.articulo_id
  join public.almacen  al on al.id = e.almacen_id
  left join public.laboratorio l on l.id = e.laboratorio_id
  left join public.ubicacion   u on u.id = e.ubicacion_id
 where a.clasificacion = 'equipo'
 order by al.clave, a.nombre_canonico;


-- 1.10 Las ubicaciones que se crearon, con sus componentes en jsonb
select al.clave as almacen,
       u.etiqueta,
       u.componentes,
       count(e.id) as existencias
  from public.ubicacion u
  join public.almacen al on al.id = u.almacen_id
  left join public.existencia e on e.ubicacion_id = u.id
 group by u.id, al.clave, u.etiqueta, u.componentes
 order by count(e.id) desc, al.clave, u.etiqueta
 limit 20;


-- 1.11 La bitácora: quién cargó qué
select m.tipo,
       count(*)                        as movimientos,
       count(distinct m.usuario_id)    as usuarios,
       min(p.nombre)                   as quien,
       round(sum(m.cantidad), 2)       as cantidad_total
  from public.movimiento m
  join public.perfil p on p.id = m.usuario_id
 group by m.tipo;


-- 1.12 La cola de curación del admin: artículos que creó la carga
select clasificacion, count(*) as por_verificar
  from public.articulo
 where not verificado
 group by clasificacion
 order by por_verificar desc;


-- ===========================================================================
-- PARTE 2 · Invariantes: TODAS estas consultas deben salir VACÍAS
-- ===========================================================================

-- 2.1 Una existencia cuyo laboratorio no es de su almacén.
-- La FK compuesta lo hace imposible; si aparece algo, el esquema cambió.
select e.id, e.codigo, 'laboratorio de otro almacen' as falla
  from public.existencia e
  join public.laboratorio l on l.id = e.laboratorio_id
 where l.almacen_id <> e.almacen_id;

-- 2.2 Lo mismo para la ubicación.
select e.id, e.codigo, 'ubicacion de otro almacen' as falla
  from public.existencia e
  join public.ubicacion u on u.id = e.ubicacion_id
 where u.almacen_id <> e.almacen_id;

-- 2.3 Series o números de inventario repetidos (regla 10).
select numero_serie as valor, count(*), 'serie repetida' as falla
  from public.existencia where numero_serie is not null
 group by numero_serie having count(*) > 1
union all
select numero_inventario_uaeh, count(*), 'inventario repetido'
  from public.existencia where numero_inventario_uaeh is not null
 group by numero_inventario_uaeh having count(*) > 1;

-- 2.4 El saldo no cuadra con la bitácora.
-- `existencia.cantidad` la mantiene el trigger desde `movimiento`; si difiere
-- de la suma, alguien escribió la cantidad directo.
select e.id, e.codigo, e.cantidad, coalesce(sum(m.cantidad), 0) as segun_bitacora
  from public.existencia e
  left join public.movimiento m on m.existencia_id = e.id
 group by e.id, e.codigo, e.cantidad
having e.cantidad <> coalesce(sum(m.cantidad), 0);

-- 2.5 El estado no corresponde a la cantidad.
-- Un estado puesto a mano (contaminado, mantenimiento, baja) manda; los demás
-- los calcula private.estado_calculado.
select e.id, e.codigo, e.cantidad, e.cantidad_minima, e.estado
  from public.existencia e
 where e.estado not in ('contaminado', 'mantenimiento', 'baja')
   and e.estado <> case
         when e.cantidad = 0 then 'agotado'
         when e.cantidad_minima is not null and e.cantidad <= e.cantidad_minima
           then 'stock_bajo'
         else 'disponible'
       end::public.estado_existencia;

-- 2.6 Pesos al revés (regla 13): el lleno tiene que superar al vacío.
select id, codigo, peso_frasco_vacio, peso_total
  from public.existencia
 where peso_frasco_vacio is not null and peso_total is not null
   and peso_total <= peso_frasco_vacio;

-- 2.7 Un reactivo sin su detalle NOM, o un detalle sin reactivo.
select a.id, a.nombre_canonico, 'reactivo sin detalle NOM' as falla
  from public.articulo a
  left join public.articulo_reactivo r on r.articulo_id = a.id
 where a.clasificacion = 'reactivo' and r.articulo_id is null
union all
select a.id, a.nombre_canonico, 'detalle NOM en algo que no es reactivo'
  from public.articulo_reactivo r
  join public.articulo a on a.id = r.articulo_id
 where a.clasificacion <> 'reactivo';

-- 2.8 Una existencia sin código, o dos con el mismo.
select codigo, count(*) as repetidos
  from public.existencia
 group by codigo having count(*) > 1 or codigo is null;

-- 2.9 Un movimiento de carga sin firmar, o firmado por alguien que no es
-- el cargador. `movimiento.usuario_id` es not null, así que esto solo puede
-- salir con filas si alguien cargó con otro perfil.
select m.id, m.tipo, p.nombre, u.email
  from public.movimiento m
  join public.perfil p on p.id = m.usuario_id
  join auth.users u on u.id = p.id
 where m.tipo = 'carga_inicial' and u.email <> 'carga@uaeh.local';

-- 2.10 Una existencia huérfana: sin carga que la explique.
-- Todo lo que entra por el ETL lleva su carga_id. Una existencia sin él salió
-- de otro lado (la app, o un insert a mano).
select id, codigo, creado_en
  from public.existencia
 where carga_id is null;

-- 2.11 Texto con espacios sobrantes o dobles (regla 3), que el ETL debió
-- haber limpiado antes de insertar.
select 'existencia.marca' as columna, marca as valor from public.existencia
 where marca <> btrim(marca) or marca like '%  %'
union all
select 'existencia.observaciones', observaciones from public.existencia
 where observaciones <> btrim(observaciones) or observaciones like '%  %'
union all
select 'articulo.nombre_canonico', nombre_canonico from public.articulo
 where nombre_canonico <> btrim(nombre_canonico) or nombre_canonico like '%  %'
union all
select 'ubicacion.etiqueta', etiqueta from public.ubicacion
 where etiqueta <> btrim(etiqueta) or etiqueta like '%  %';
