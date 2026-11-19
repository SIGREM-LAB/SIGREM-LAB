-- El responsable del almacen corrige el NOMBRE del articulo.
--
-- Hasta aqui `actualizar_existencia` editaba solo el frasco y descartaba en
-- silencio los campos del articulo (20260911120000_editar_existencia.sql). Eso
-- dejaba un nombre mal capturado -una errata, un «Acido» sin acento, un
-- «Matraz 250» sin decir de que- esperando al admin, que es el unico con RLS
-- sobre `articulo`.
--
-- DECISION (19 de noviembre de 2026, Daniel): el responsable puede corregir el
-- nombre, y el cambio vale PARA TODOS. El articulo es catalogo global: si N3
-- renombra «Acetona», N4 lo ve renombrado tambien. Se considero permitirlo solo
-- cuando el articulo fuera exclusivo de su almacen, o separar el articulo al
-- renombrar, y se descartaron: lo primero dejaba sin resolver justo los
-- articulos mas usados, y lo segundo duplica el catalogo y rompe los totales
-- entre almacenes.
--
-- Solo el NOMBRE. CAS, unidad, especificacion, rombo NFPA y densidad siguen
-- siendo de admin y se siguen descartando: son la ficha de seguridad, y la
-- unidad ademas define que suma con que.
--
-- COMO. `articulo` sigue con su RLS de admin; no se abre una politica de
-- update a los responsables, porque una politica no puede decir «solo la
-- columna del nombre, y solo de un articulo que tenga frascos en tu almacen».
-- En su lugar:
--
--   private.renombrar_articulo  SECURITY DEFINER, con las comprobaciones
--                               dentro: puede escribir, y el frasco por el que
--                               entra es de su almacen (o es admin).
--
--   public.actualizar_existencia  pasa a ser una envoltura: corrige el frasco
--                               con la funcion de siempre -movida a
--                               `private.actualizar_frasco` sin tocarle una
--                               linea- y, si el perfil pide el nombre y vino en
--                               el envio, lo renombra. Todo en la misma
--                               transaccion: si el renombre falla, la
--                               correccion del frasco tambien se deshace.
--
-- Mover la funcion en vez de reescribirla evita copiar sus 150 lineas y que
-- dos versiones del mismo cuerpo terminen divergiendo.


-- ---------------------------------------------------------------------------
-- La correccion del frasco, tal cual, fuera de la API
-- ---------------------------------------------------------------------------
-- `alter function` conserva el cuerpo, el `security invoker`, el search_path y
-- los privilegios (execute para authenticated, nada para anon). Sigue siendo
-- INVOKER: la RLS de `existencia_edicion` sigue mandando. Al quedar en
-- `private`, PostgREST ya no la expone.
alter function public.actualizar_existencia(bigint, jsonb, text) set schema private;
alter function private.actualizar_existencia(bigint, jsonb, text) rename to actualizar_frasco;

comment on function private.actualizar_frasco(bigint, jsonb, text) is
  'Correccion del frasco y su ubicacion. La llama public.actualizar_existencia; los campos del articulo se ignoran aqui.';


-- ---------------------------------------------------------------------------
-- private.renombrar_articulo
-- ---------------------------------------------------------------------------
-- Entra por la EXISTENCIA, no por el articulo: es la existencia la que dice de
-- que almacen es quien corrige. Un responsable de N3 renombra un articulo
-- porque tiene un frasco de el en N3, no porque sepa su id.
--
-- SECURITY DEFINER porque la RLS de `articulo` es de admin. Por eso las
-- comprobaciones van aqui adentro y no se le dejan a nadie mas.
create or replace function private.renombrar_articulo(p_existencia bigint, p_nombre text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_almacen  bigint;
  v_articulo bigint;
  v_nombre   text := btrim(p_nombre);
begin
  if not private.puede_escribir() then
    raise exception 'No tienes permiso para renombrar articulos'
      using errcode = '42501';
  end if;

  select e.almacen_id, e.articulo_id
    into v_almacen, v_articulo
    from public.existencia e
   where e.id = p_existencia;

  if not found then
    raise exception 'La existencia % no existe', p_existencia
      using errcode = 'P0002';
  end if;

  if not private.es_admin() and v_almacen is distinct from private.almacen_actual() then
    raise exception 'No puedes renombrar el articulo de la existencia %: pertenece a otro almacen',
      p_existencia
      using errcode = '42501';
  end if;

  if v_nombre is null or v_nombre = '' then
    raise exception 'El nombre del articulo no puede quedar vacio'
      using errcode = '22023';
  end if;

  update public.articulo a
     set nombre_canonico = v_nombre
   where a.id = v_articulo
     and a.nombre_canonico is distinct from v_nombre;

exception
  -- `articulo_identidad`: nombre + especificacion + unidad. Si ya hay otro con
  -- esa terna, son el mismo articulo capturado dos veces, y unirlos (mover sus
  -- frascos) es trabajo de curacion del admin, no de un renombre.
  when unique_violation then
    raise exception 'Ya existe otro articulo llamado «%» con la misma especificacion y unidad. Pidele al administrador que los una.',
      v_nombre
      using errcode = '23505';
end $$;

comment on function private.renombrar_articulo(bigint, text) is
  'Renombra el articulo de una existencia. Para el responsable de ese almacen o el admin; el nombre cambia en todos los almacenes.';

-- La envoltura es INVOKER, asi que authenticated necesita execute. Llamarla
-- directo no da nada de mas: `private` no se expone por PostgREST y las
-- comprobaciones viven adentro.
revoke all     on function private.renombrar_articulo(bigint, text) from public, anon;
grant  execute on function private.renombrar_articulo(bigint, text) to authenticated;


-- ---------------------------------------------------------------------------
-- public.actualizar_existencia
-- ---------------------------------------------------------------------------
-- Misma firma y mismo retorno que antes: la pantalla y los tipos generados no
-- notan el cambio.
--
-- El nombre se reconoce por el DESTINO del perfil, como todo lo demas: si el
-- perfil de este almacen y esta clasificacion no pide el nombre, la llave se
-- ignora aunque venga.
create or replace function public.actualizar_existencia(
  p_existencia bigint,
  p_valores    jsonb,
  p_motivo     text default null
)
returns table (id bigint, codigo text, cantidad numeric)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_campo text;
begin
  -- Primero el frasco: es la que ya avisa con 42501 cuando la existencia es de
  -- otro almacen, antes de intentar renombrar nada.
  perform 1 from private.actualizar_frasco(p_existencia, p_valores, p_motivo);

  select f.campo
    into v_campo
    from public.existencia e
    join public.articulo a on a.id = e.articulo_id
   cross join lateral public.formulario(e.almacen_id, a.clasificacion) f
   where e.id = p_existencia
     and f.destino = 'articulo.nombre_canonico'
     and p_valores ? f.campo
   limit 1;

  if v_campo is not null then
    perform private.renombrar_articulo(p_existencia, p_valores ->> v_campo);
  end if;

  return query
    select e.id, e.codigo, e.cantidad
      from public.existencia e
     where e.id = p_existencia;
end $$;

comment on function public.actualizar_existencia(bigint, jsonb, text) is
  'Edicion desde la pantalla: el frasco y su ubicacion, y el nombre del articulo (que cambia para todos). La cantidad entra como ajuste_conteo.';

revoke all     on function public.actualizar_existencia(bigint, jsonb, text) from public, anon;
grant  execute on function public.actualizar_existencia(bigint, jsonb, text) to authenticated;
