-- Editar una existencia desde la pantalla.
--
-- El alta ya entraba por `crear_existencia` (20260910120000_alta_existencia.sql),
-- pero una vez dentro el frasco quedaba congelado: cambiar de anaquel, corregir
-- una marca mal tecleada o anotar el mantenimiento de un equipo no tenia camino
-- desde la app. La unica forma era el dashboard, que es justo lo que este
-- proyecto no hace.
--
-- Esta migracion pone las dos piezas que faltaban: una para LEER lo que hoy
-- tiene la existencia con las llaves del perfil de captura, y otra para
-- ESCRIBIR lo que se corrigio. Las dos son el espejo de `crear_existencia` y
-- comparten con ella el principio que sostiene todo el formulario dinamico: el
-- renglon se arma recorriendo el PERFIL, nunca las llaves del payload.
--
-- DONDE ESTA LA RAYA. Aqui solo se edita el FRASCO: los campos con destino
-- `existencia.` y `ubicacion.`. Los del ARTICULO -nombre, unidad, CAS, rombo
-- NFPA, color, densidad, especie- no se tocan por este camino y se descartan si
-- llegan. Dos razones, y cualquiera de las dos basta:
--
--   1. El articulo se COMPARTE. Catorce frascos de acetona apuntan al mismo
--      renglon de `articulo`: corregir el CAS «del frasco que tengo abierto»
--      se lo cambiaria a los catorce sin que nadie lo pida.
--   2. Su RLS ya lo dice: `articulo_admin` y `articulo_reactivo_admin` son de
--      admin. Mandarlos desde un responsable no fallaria a medias -fallaria
--      entero, tirando tambien la correccion legitima del frasco-.
--
-- La pantalla los pinta deshabilitados, con su valor a la vista y la razon
-- escrita. Que se vean importa: son la ficha de seguridad del reactivo.
--
-- Migraciones hermanas:
--   20260910120000_alta_existencia.sql      (crear_existencia)
--   20260826130000_resolver_pendiente.sql   (los helpers private.*_de)
--   20260821120000_inventario_consulta.sql  (el grant update por columnas)


-- ---------------------------------------------------------------------------
-- public.valores_existencia
-- ---------------------------------------------------------------------------
-- Lo que hoy vale cada campo del perfil, para precargar el formulario.
--
-- Devuelve un jsonb llaveado por `campo` -las mismas llaves que consume
-- `actualizar_existencia`-, no por columna. Esa simetria es el punto: la
-- pantalla recibe y devuelve el mismo vocabulario, y no necesita un diccionario
-- de columnas en TypeScript que haya que recordar actualizar.
--
-- El valor se saca del PREFIJO de `destino`, no de un `case` por campo. Asi, un
-- campo nuevo en `campo_capturable` se precarga solo, igual que ya se pinta
-- solo. Solo tres campos necesitan trato propio, y los tres porque el
-- formulario habla de otra cosa que la columna:
--
--   existencia.laboratorio_id  -> el NOMBRE del laboratorio, que es lo que el
--                                 select ofrece y lo que `crear_existencia`
--                                 resuelve al guardar.
--   movimiento.carga_inicial   -> el saldo actual. No hay columna que leer: la
--                                 cantidad vive en la bitacora.
--   ubicacion.componentes.*    -> se busca por `campo` y NO por la ultima parte
--                                 del destino. Las llaves guardadas en
--                                 `ubicacion.componentes` son las que escriben
--                                 `private.ubicacion_de_renglon` y
--                                 `etl/destino.py`: `coord_h`, `coord_v`,
--                                 `coord_i`, que es el nombre del campo. El
--                                 destino del catalogo dice `.h`, `.v`, `.i`.
--                                 Leer por el destino devolveria null en las
--                                 tres coordenadas de Electronica, en silencio.
--
-- SECURITY INVOKER: la lectura de `existencia` es abierta a `authenticated`
-- -es lo que habilita el prestamo entre almacenes-, asi que esto se puede
-- consultar de cualquier bodega. Escribir es otra cosa, y de eso se ocupa la
-- funcion de abajo.
create or replace function public.valores_existencia(p_existencia bigint)
returns jsonb
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  v_existencia    jsonb;
  v_articulo      jsonb;
  v_reactivo      jsonb;
  v_biologico     jsonb;
  v_ubicacion     jsonb;
  v_laboratorio   text;
  v_cantidad      numeric(14,4);
  v_almacen       bigint;
  v_clasificacion public.clasificacion_articulo;
  v_valores       jsonb;
begin
  select to_jsonb(e), to_jsonb(a), to_jsonb(ar), to_jsonb(ab), to_jsonb(u),
         l.nombre, e.cantidad, e.almacen_id, a.clasificacion
    into v_existencia, v_articulo, v_reactivo, v_biologico, v_ubicacion,
         v_laboratorio, v_cantidad, v_almacen, v_clasificacion
    from public.existencia e
    join public.articulo a on a.id = e.articulo_id
    left join public.articulo_reactivo  ar on ar.articulo_id = a.id
    left join public.articulo_biologico ab on ab.articulo_id = a.id
    left join public.ubicacion   u on u.id = e.ubicacion_id
    left join public.laboratorio l on l.id = e.laboratorio_id
   where e.id = p_existencia;

  if not found then
    raise exception 'La existencia % no existe o no se puede leer', p_existencia
      using errcode = 'P0002';
  end if;

  select coalesce(jsonb_object_agg(f.campo, coalesce(v.valor, 'null'::jsonb)), '{}'::jsonb)
    into v_valores
    from public.formulario(v_almacen, v_clasificacion) f
    cross join lateral (
      select case
        when f.destino = 'existencia.laboratorio_id' then to_jsonb(v_laboratorio)
        when f.destino = 'movimiento.carga_inicial'  then to_jsonb(v_cantidad)
        when f.destino like 'ubicacion.componentes.%'
          then v_ubicacion -> 'componentes' -> f.campo
        when f.destino like 'ubicacion.%'
          then v_ubicacion -> split_part(f.destino, '.', 2)
        when f.destino like 'existencia.%'
          then v_existencia -> split_part(f.destino, '.', 2)
        when f.destino like 'articulo_reactivo.%'
          then v_reactivo -> split_part(f.destino, '.', 2)
        when f.destino like 'articulo_biologico.%'
          then v_biologico -> split_part(f.destino, '.', 2)
        when f.destino like 'articulo.%'
          then v_articulo -> split_part(f.destino, '.', 2)
        else null
      end
    ) as v(valor);

  return v_valores;
end $$;

comment on function public.valores_existencia(bigint) is
  'Lo que hoy vale cada campo del perfil de captura, para precargar la edicion. Mismas llaves que espera actualizar_existencia.';

revoke all     on function public.valores_existencia(bigint) from public, anon;
grant  execute on function public.valores_existencia(bigint) to authenticated;


-- ---------------------------------------------------------------------------
-- public.actualizar_existencia
-- ---------------------------------------------------------------------------
-- La correccion. Recibe lo que el formulario capturo, llaveado por el `campo`
-- que devolvio `public.formulario()`, y sostiene las mismas tres promesas que
-- el alta:
--
-- 1. La cantidad NO se escribe. Si lo capturado difiere del saldo, entra un
--    `movimiento` de tipo `ajuste_conteo` con la diferencia, que es como el
--    esquema registra un conteo fisico. El saldo lo mueve el trigger. Escribir
--    `existencia.cantidad` directo esta ademas revocado desde el 21 de agosto.
--
-- 2. SECURITY INVOKER. `existencia_edicion` exige `puede_escribir()` y el
--    almacen propio, asi que un responsable de N3 no puede corregir un frasco
--    de N4 ni un usuario de consulta corregir ninguno. Eso NO se comprueba
--    aqui: se comprueba solo, y esta funcion se limita a no estorbarlo.
--
-- 3. Todo o nada: la correccion y su ajuste de conteo van en la misma
--    transaccion. No hay forma de terminar con la ubicacion nueva y el saldo
--    viejo.
--
-- QUE SIGNIFICA CADA LLAVE. Presente con valor -> se escribe. Presente y vacia
-- -> se BORRA: editar tiene que poder quitar un dato que sobra, y un formulario
-- donde vaciar una casilla no hace nada es un formulario que miente. Ausente ->
-- no se toca. De ahi que la pantalla mande todos los campos del perfil, tambien
-- los que quedaron en blanco, mientras que el alta -donde vaciar no significa
-- nada- omite los suyos.
--
-- `p_motivo` es lo que queda escrito en la bitacora del ajuste. La pantalla lo
-- pide cuando la cantidad cambia, porque un renglon de auditoria que dice
-- "-3.5 L" sin decir por que obliga a preguntarle a quien lo hizo, y para
-- entonces ya nadie se acuerda.
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
  r                jsonb;
  v_almacen        bigint;
  v_clasificacion  public.clasificacion_articulo;
  v_saldo          numeric(14,4);
  v_contada        numeric(14,4);
  v_ubicacion      bigint;
  v_laboratorio    bigint;
  v_toca_ubicacion boolean;
  v_toca_lab       boolean;
  v_filas          integer;
begin
  select e.almacen_id, a.clasificacion, e.cantidad
    into v_almacen, v_clasificacion, v_saldo
    from public.existencia e
    join public.articulo a on a.id = e.articulo_id
   where e.id = p_existencia;

  if not found then
    raise exception 'La existencia % no existe', p_existencia
      using errcode = 'P0002';
  end if;

  -- El renglon se arma DEL PERFIL hacia el payload, igual que en el alta, y
  -- ademas se acota a lo que esta funcion sabe editar. El filtro por destino es
  -- lo que deja fuera los campos del articulo: no se rechaza el envio, se
  -- ignoran, que es lo mismo que hace `crear_existencia` con un campo que no
  -- esta en el perfil. Quien hable directo a la API con la anon key -que es
  -- publica y viaja dentro del binario- no consigue por aqui cambiarle el CAS a
  -- una sustancia que usan otros tres almacenes.
  select coalesce(
           jsonb_object_agg(private.clave_renglon(f.campo), p_valores -> f.campo),
           '{}'::jsonb)
    into r
    from public.formulario(v_almacen, v_clasificacion) f
   where p_valores ? f.campo
     and (f.destino like 'existencia.%' or f.destino like 'ubicacion.%');

  -- La ubicacion se rehace ENTERA o no se toca. Es una fila compartida
  -- -unique (almacen_id, etiqueta)- asi que no se edita: se resuelve la que
  -- corresponde a las partes capturadas y se apunta a ella, exactamente como en
  -- el alta. Editarla en su sitio le cambiaria el anaquel a todo lo que
  -- comparte esa etiqueta. Vaciar todas las partes deja la existencia sin
  -- ubicacion, que es lo que significa no saber donde esta.
  select exists (
           select 1
             from public.formulario(v_almacen, v_clasificacion) f
            where f.destino like 'ubicacion.%'
              and p_valores ? f.campo)
    into v_toca_ubicacion;

  if v_toca_ubicacion then
    v_ubicacion := private.ubicacion_de_renglon(v_almacen, r);
  end if;

  -- El laboratorio se resuelve por NOMBRE dentro del propio almacen, igual que
  -- el cargador, la depuracion y el alta. La FK compuesta de `existencia` ya
  -- impide que sea de otra bodega; acotar la busqueda evita el error antes.
  select exists (
           select 1
             from public.formulario(v_almacen, v_clasificacion) f
            where f.destino = 'existencia.laboratorio_id'
              and p_valores ? f.campo)
    into v_toca_lab;

  if v_toca_lab then
    select l.id into v_laboratorio
      from public.laboratorio l
     where l.almacen_id = v_almacen
       and public.norm_texto(l.nombre)
           = public.norm_texto(private.texto_de(r, 'laboratorio'));
  end if;

  -- Columna por columna, y cada una solo si su campo venia en el envio. Las que
  -- se nombran aqui son exactamente las del `grant update` por columnas del 21
  -- de agosto: `cantidad`, `codigo`, `almacen_id`, `articulo_id`, `carga_id` y
  -- `creado_en` no estan en ese grant, y nombrarlas fallaria por privilegios.
  -- `estado` si esta, pero no es un campo de captura: lo mueve el trigger que
  -- recalcula, o quien marca un frasco contaminado, que es otra accion.
  update public.existencia e set
    ubicacion_id   = case when v_toca_ubicacion then v_ubicacion  else e.ubicacion_id   end,
    laboratorio_id = case when v_toca_lab       then v_laboratorio else e.laboratorio_id end,
    marca          = case when r ? 'marca'  then private.texto_de(r, 'marca')  else e.marca  end,
    modelo         = case when r ? 'modelo' then private.texto_de(r, 'modelo') else e.modelo end,
    presentacion   = case when r ? 'presentacion'
                          then private.texto_de(r, 'presentacion') else e.presentacion end,
    cantidad_minima = case when r ? 'cantidad_minima'
                           then private.numero_de(r, 'cantidad_minima') else e.cantidad_minima end,
    peso_frasco_vacio = case when r ? 'peso_vacio'
                             then private.numero_de(r, 'peso_vacio') else e.peso_frasco_vacio end,
    peso_total     = case when r ? 'peso_total'
                          then private.numero_de(r, 'peso_total') else e.peso_total end,
    numero_serie   = case when r ? 'numero_serie'
                          then private.texto_de(r, 'numero_serie') else e.numero_serie end,
    numero_inventario_uaeh = case when r ? 'numero_inventario'
                                  then private.texto_de(r, 'numero_inventario')
                                  else e.numero_inventario_uaeh end,
    funcionamiento = case when r ? 'funcionamiento'
                          then private.funcionamiento_de(r) else e.funcionamiento end,
    mantenimiento  = case when r ? 'mantenimiento'
                          then private.texto_de(r, 'mantenimiento') else e.mantenimiento end,
    fecha_chequeo  = case when r ? 'fecha_chequeo'
                          then private.fecha_de(r, 'fecha_chequeo') else e.fecha_chequeo end,
    metodo_conservacion = case when r ? 'metodo_conservacion'
                               then private.texto_de(r, 'metodo_conservacion')
                               else e.metodo_conservacion end,
    temperatura    = case when r ? 'temperatura'
                          then private.texto_de(r, 'temperatura') else e.temperatura end,
    fecha_recoleccion = case when r ? 'fecha_recoleccion'
                             then private.fecha_de(r, 'fecha_recoleccion')
                             else e.fecha_recoleccion end,
    fecha_preparacion = case when r ? 'fecha_preparacion'
                             then private.fecha_de(r, 'fecha_preparacion')
                             else e.fecha_preparacion end,
    responsable_muestra = case when r ? 'responsable_muestra'
                               then private.texto_de(r, 'responsable_muestra')
                               else e.responsable_muestra end,
    fecha_adquisicion = case when r ? 'fecha_adquisicion'
                             then private.fecha_de(r, 'fecha_adquisicion')
                             else e.fecha_adquisicion end,
    fecha_caducidad = case when r ? 'fecha_caducidad'
                           then private.fecha_de(r, 'fecha_caducidad') else e.fecha_caducidad end,
    observaciones  = case when r ? 'observaciones'
                          then private.texto_de(r, 'observaciones') else e.observaciones end
  where e.id = p_existencia;

  -- La RLS niega por USING, y un USING falso no explota: esconde la fila. Sin
  -- esto, corregir un frasco de otro almacen devolveria el mismo "guardado" que
  -- una correccion buena, sin haber escrito nada. El aviso tiene que llegar a la
  -- pantalla.
  get diagnostics v_filas = row_count;
  if v_filas = 0 then
    raise exception 'No puedes editar la existencia %: pertenece a otro almacen', p_existencia
      using errcode = '42501';
  end if;

  -- El conteo fisico. Solo si el perfil pide cantidad -Equipos no la pide,
  -- regla 9: un renglon por equipo fisico- y solo si lo contado difiere del
  -- saldo. Un movimiento de cero lo prohibe `movimiento_cantidad_no_cero`, y
  -- ademas no seria noticia.
  if exists (select 1
               from public.formulario(v_almacen, v_clasificacion) f
              where f.destino = 'movimiento.carga_inicial'
                and p_valores ? f.campo)
  then
    v_contada := private.numero_de(
                   jsonb_build_object('cantidad', p_valores -> 'cantidad'), 'cantidad');

    if v_contada is not null and v_contada <> v_saldo then
      -- `almacen_id`, `cantidad_antes`, `cantidad_despues` y `usuario_id` los
      -- pone `private.aplicar_movimiento`; mandarlos desde aqui no serviria.
      insert into public.movimiento (existencia_id, tipo, cantidad, motivo)
      values (p_existencia, 'ajuste_conteo', v_contada - v_saldo,
              coalesce(nullif(btrim(p_motivo), ''), 'Ajuste al editar la existencia'));
    end if;
  end if;

  return query
    select e.id, e.codigo, e.cantidad
      from public.existencia e
     where e.id = p_existencia;
end $$;

comment on function public.actualizar_existencia(bigint, jsonb, text) is
  'Edicion desde la pantalla. Solo campos del frasco y su ubicacion; los del articulo se ignoran. La cantidad entra como ajuste_conteo.';

-- El `revoke all on all functions in schema public from anon` del baseline
-- corrio una sola vez y no alcanza a lo que se crea despues: Supabase deja
-- privilegios por omision que le dan EXECUTE a `anon` sobre cada funcion nueva
-- de `public`. Hay que quitarlo a mano, funcion por funcion.
revoke all     on function public.actualizar_existencia(bigint, jsonb, text) from public, anon;
grant  execute on function public.actualizar_existencia(bigint, jsonb, text) to authenticated;
