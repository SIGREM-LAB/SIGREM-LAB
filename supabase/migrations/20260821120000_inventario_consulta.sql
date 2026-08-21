-- Pantalla de inventario en modo consulta: cierra dos huecos de escritura y
-- publica la vista que alimenta el listado.
--
-- Diseno: docs/specs/2026-08-21-pantalla-inventario-consulta-design.md

-- ---------------------------------------------------------------------------
-- Hueco A: las politicas de escritura no consultaban el rol
-- ---------------------------------------------------------------------------
-- Comparaban el almacen y nada mas. Un usuario de rol `consulta` al que se le
-- asigne un almacen -algo natural, para que la pantalla le arranque filtrada en
-- el suyo- quedaba con permiso de escritura, contra lo que promete la §12 del
-- spec del 18 de agosto. Hoy no se notaba porque lectura@ tiene almacen_id nulo
-- y `NULL = 1` es falso; el hueco estaba esperando a que alguien le asignara uno.
--
-- `puede_escribir()` es cierto para admin y responsable, asi que agregar el
-- conjunto no le quita nada a quien ya podia.

alter policy existencia_alta on public.existencia
  with check ((select private.puede_escribir())
              and ((select private.es_admin())
                   or almacen_id = (select private.almacen_actual())));

alter policy existencia_edicion on public.existencia
  using      ((select private.puede_escribir())
              and ((select private.es_admin())
                   or almacen_id = (select private.almacen_actual())))
  with check ((select private.puede_escribir())
              and ((select private.es_admin())
                   or almacen_id = (select private.almacen_actual())));

alter policy ubicacion_escritura on public.ubicacion
  using      ((select private.puede_escribir())
              and ((select private.es_admin())
                   or almacen_id = (select private.almacen_actual())))
  with check ((select private.puede_escribir())
              and ((select private.es_admin())
                   or almacen_id = (select private.almacen_actual())));

alter policy movimiento_alta on public.movimiento
  with check ((select private.puede_escribir())
              and ((select private.es_admin())
                   or almacen_id = (select private.almacen_actual())));


-- ---------------------------------------------------------------------------
-- Hueco B: el saldo se podia escribir directo, sin bitacora
-- ---------------------------------------------------------------------------
-- `existencia_edicion` autoriza un UPDATE sobre la fila entera y los dos
-- triggers del esquema son BEFORE INSERT, asi que nada impedia
-- `update existencia set cantidad = 99999`. Eso se salta la auditoria y ademas
-- permite reescribir el codigo impreso en la etiqueta del frasco.
--
-- OJO CON EL ORDEN. `revoke update (cantidad) ...` por si solo NO HACE NADA:
-- `authenticated` tiene UPDATE a nivel tabla por el `grant all` por omision de
-- Supabase, y un privilegio de tabla implica todas las columnas. Revocar una
-- columna suelta no le quita nada. Hay que revocar la tabla y devolver las
-- columnas editables.

revoke update on public.existencia from authenticated;

grant update (ubicacion_id, laboratorio_id, marca, modelo, presentacion,
              cantidad_minima, peso_frasco_vacio, peso_total, numero_serie,
              numero_inventario_uaeh, funcionamiento, mantenimiento, fecha_chequeo,
              metodo_conservacion, temperatura, fecha_recoleccion, fecha_preparacion,
              responsable_muestra, fecha_adquisicion, fecha_caducidad,
              estado, observaciones)
  on public.existencia to authenticated;

-- Quedan fuera: `cantidad` (la mantiene el trigger desde movimiento), `codigo`
-- (la identidad de la etiqueta), `almacen_id` (el ancla de los permisos),
-- `articulo_id` (que ES la cosa; solo se mueve por fusionar_articulo, de admin),
-- `carga_id` y `creado_en` (procedencia).

-- `estado` SI es editable: un responsable tiene que poder marcar un frasco como
-- contaminado o un equipo en mantenimiento. Lo que impide que abuse es este
-- trigger, porque `estado_calculado` respeta los tres estados manuales y
-- recalcula el resto: marcar `disponible` algo que esta en cero no sirve de nada.
--
-- De paso cierra un hueco silencioso: hasta ahora fijar `cantidad_minima` no
-- surtia efecto hasta el siguiente movimiento, porque nada recalculaba en un
-- UPDATE. Quien capture un minimo espera que el estado responda en el momento.
create or replace function private.recalcular_estado()
returns trigger
language plpgsql
security definer
set search_path = ''
as $funcion$
begin
  new.estado := private.estado_calculado(new.cantidad, new.cantidad_minima, new.estado);
  return new;
end;
$funcion$;

create trigger existencia_recalcula_estado
  before update on public.existencia
  for each row execute function private.recalcular_estado();


-- ---------------------------------------------------------------------------
-- La vista que alimenta el listado
-- ---------------------------------------------------------------------------
-- El listado une cuatro tablas, busca sobre tres campos y ordena por cualquier
-- columna. Contra los recursos embebidos de PostgREST eso se vuelve fragil: un
-- `or` que cruza una columna propia con una embebida pelea con la sintaxis, y
-- ordenar por el nombre exige que el embebido sea `!inner`. Aplanado, el
-- cliente vuelve a ser trivial.
--
-- `security_invoker = on` NO ES OPCIONAL y falla en silencio si se omite: sin
-- el, la vista corre como su dueno y publica el inventario entero a anon. Se
-- comprobo creando las dos variantes. La prueba en esquema.test.sql existe por
-- eso, porque una vista mal creada funciona igual de bien hasta el dia malo.
--
-- `nombre_norm` va como columna propia y no concatenada con marca y codigo: asi
-- el predicado empuja hasta `articulo` y usa articulo_nombre_trgm_idx. Una
-- concatenacion no la cubre ningun indice y obligaria a recorrer la tabla
-- entera calculando norm_texto por renglon.
create view public.existencia_listado
with (security_invoker = on) as
select e.id, e.codigo, e.marca, e.cantidad, e.estado, e.almacen_id,
       e.ubicacion_id, e.fecha_caducidad, e.creado_en,
       a.id as articulo_id,
       a.nombre_canonico, a.descripcion, a.clasificacion, a.unidad_base,
       al.clave   as almacen_clave,
       u.etiqueta as ubicacion,
       public.norm_texto(a.nombre_canonico)     as nombre_norm,
       public.norm_texto(coalesce(e.marca, '')) as marca_norm
from public.existencia e
join public.articulo a  on a.id  = e.articulo_id
join public.almacen  al on al.id = e.almacen_id
left join public.ubicacion u on u.id = e.ubicacion_id;

comment on view public.existencia_listado is
  'Listado plano para la pantalla de inventario. Hereda la RLS de existencia.';

grant select on public.existencia_listado to authenticated;
revoke all  on public.existencia_listado from anon;
