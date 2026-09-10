-- El alta de una existencia desde la pantalla.
--
-- Hasta hoy el inventario solo crecia por el cargador (etl/) y por la pantalla
-- de depuracion, que resuelve los renglones que el cargador no pudo. No habia
-- forma de dar de alta un frasco que llego ayer: el boton «Nueva existencia»
-- de Inventario era un `AccionPendiente` apagado.
--
-- Esta migracion pone la pieza que faltaba en la base. NO duplica la maquinaria
-- de `resolver_pendiente`: la reusa. Aquel trabajo —renglon suelto a articulo,
-- ficha normativa, ubicacion, existencia y movimiento, todo en una
-- transaccion— es exactamente el mismo, con la unica diferencia de quien
-- escribe el renglon: alla lo escribio el ETL y lo corrigio quien revisa; aca
-- lo teclea quien tiene el frasco en la mano.
--
-- Migracion hermana: 20260826130000_resolver_pendiente.sql
-- Perfiles de captura: 20260818120500_captura.sql


-- ---------------------------------------------------------------------------
-- Densidad
-- ---------------------------------------------------------------------------
-- Va en `articulo_reactivo` y no en `existencia` porque es una propiedad de la
-- SUSTANCIA, no del frasco: dos botellas de acetona del mismo grado tienen la
-- misma densidad, y capturarla por frasco seria pedir catorce veces el mismo
-- numero y admitir catorce respuestas distintas.
--
-- Solo tiene sentido en liquidos, pero el check no lo exige: `estado_fisico`
-- es anulable —hay articulos migrados sin el— y un check que dependiera de esa
-- columna rechazaria capturar la densidad antes que el estado. Que el
-- formulario la pida donde toca es trabajo del perfil de captura.
alter table public.articulo_reactivo
  add column densidad numeric(10,4)
    constraint articulo_reactivo_densidad_positiva
    check (densidad is null or densidad > 0);

comment on column public.articulo_reactivo.densidad is
  'g/mL. Propiedad de la sustancia, no del frasco. Relevante solo en liquidos.';


-- ---------------------------------------------------------------------------
-- Del nombre del campo al nombre en el renglon
-- ---------------------------------------------------------------------------
-- `campo_capturable.campo` y las llaves que leen los helpers de
-- `resolver_pendiente` son dos vocabularios que casi siempre coinciden. Casi:
-- tres nombres difieren, porque los helpers hablan el idioma de las columnas
-- del Excel y el catalogo el de la interfaz.
--
-- La traduccion vive aqui, en SQL, y no en el frontend a proposito. Si viviera
-- alla habria un diccionario en TypeScript que hay que recordar actualizar
-- cada vez que se agrega un campo, y olvidarlo no rompe la compilacion: manda
-- el valor con la llave equivocada y el campo se pierde en silencio.
create or replace function private.clave_renglon(p_campo text)
returns text
language sql
immutable
parallel safe
set search_path = ''
as $$
  select case p_campo
    -- `articulo_de_renglon` lee coalesce(sustancia, articulo).
    when 'nombre_articulo'      then 'articulo'
    -- `color_de` lee la llave 'color'.
    when 'color_almacenamiento' then 'color'
    -- Regla 13: el vacio va antes que el lleno. La columna se llama
    -- peso_frasco_vacio; el renglon del ETL, peso_vacio.
    when 'peso_frasco_vacio'    then 'peso_vacio'
    else p_campo
  end
$$;

grant execute on function private.clave_renglon(text) to authenticated;


-- ---------------------------------------------------------------------------
-- buscar_articulo tambien mira DENTRO del nombre
-- ---------------------------------------------------------------------------
-- El comentario de esta funcion dice que alimenta el «?Te refieres a alguno de
-- estos?» del alta. Con la pantalla ya escrita se ve que ahi no servia: al
-- teclear «acetona» no devolvia nada.
--
-- `similarity()` compara las CADENAS COMPLETAS, y los nombres canonicos de
-- reactivo son la cadena entera del formato:
--
--   «Acetona, liquido, grado A.C.S., pureza 99.5%»   -> 44 caracteres
--
-- Los trigramas de «acetona» son 7 de esos 44, asi que la similitud sale 0.21 y
-- no llega al umbral de 0.3. Y el umbral no es el problema: bajarlo lo bastante
-- para que entre un nombre de 44 caracteres deja pasar medio catalogo cuando el
-- nombre tiene 90, que tambien los hay. El problema es la medida.
--
-- `word_similarity(termino, texto)` mide otra cosa: cuanto del termino aparece
-- como una extension de palabras DENTRO del texto. Para el mismo par da 1.0, que
-- es la respuesta correcta —«acetona» esta ahi literalmente—.
--
-- Se toma la MAYOR de las dos, no se sustituye una por otra. Asi el cambio es
-- aditivo: nada de lo que coincidia antes deja de coincidir, y el otro
-- consumidor —`etl/catalogo.py:_parecidos`, que compara nombre largo contra
-- nombre largo con umbral 0.4— conserva sus coincidencias y solo puede ganar
-- alguna. Alli la lista es un AVISO y no decide nada, asi que errar hacia
-- ensenar de mas es el lado correcto.
create or replace function public.buscar_articulo(
  termino text,
  umbral  real default 0.3,
  maximo  int  default 10
)
returns table (
  articulo_id     bigint,
  nombre_canonico text,
  clasificacion   public.clasificacion_articulo,
  unidad_base     text,
  verificado      boolean,
  similitud       real,
  coincidio_por   text
)
language sql
stable
set search_path = ''
as $$
  with t as (select public.norm_texto(termino) as q)
  select distinct on (c.articulo_id)
         c.articulo_id, c.nombre_canonico, c.clasificacion,
         c.unidad_base, c.verificado, c.similitud, c.coincidio_por
  from (
    select a.id, a.nombre_canonico, a.clasificacion, a.unidad_base, a.verificado,
           greatest(
             extensions.similarity(public.norm_texto(a.nombre_canonico), t.q),
             extensions.word_similarity(t.q, public.norm_texto(a.nombre_canonico))
           ) as similitud,
           'nombre' as coincidio_por,
           a.id as articulo_id
    from public.articulo a, t
    where greatest(
            extensions.similarity(public.norm_texto(a.nombre_canonico), t.q),
            extensions.word_similarity(t.q, public.norm_texto(a.nombre_canonico))
          ) >= umbral

    union all

    select a.id, a.nombre_canonico, a.clasificacion, a.unidad_base, a.verificado,
           greatest(
             extensions.similarity(public.norm_texto(al.texto), t.q),
             extensions.word_similarity(t.q, public.norm_texto(al.texto))
           ) as similitud,
           'alias' as coincidio_por,
           a.id as articulo_id
    from public.articulo_alias al
    join public.articulo a on a.id = al.articulo_id, t
    where greatest(
            extensions.similarity(public.norm_texto(al.texto), t.q),
            extensions.word_similarity(t.q, public.norm_texto(al.texto))
          ) >= umbral
  ) c
  order by c.articulo_id, c.similitud desc
  limit maximo
$$;

comment on function public.buscar_articulo(text, real, int) is
  'Buscar-antes-de-crear. Alimenta el "?Te refieres a alguno de estos?" del alta. Mide por parecido de la cadena entera Y por aparicion del termino dentro del nombre; se queda con la mayor.';


-- ---------------------------------------------------------------------------
-- articulo_de_renglon, con dos anadidos
-- ---------------------------------------------------------------------------
-- Se reemplaza entera —`create or replace`, no un `alter`— porque es como se
-- cambia el cuerpo de una funcion. La migracion del 26 de agosto no se toca.
--
-- Cambio 1: `densidad`, que es columna nueva.
--
-- Cambio 2: un CAS capturado a mano gana sobre el que se extrae del nombre.
-- Antes solo existia el segundo camino, y era correcto para el ETL: alli el
-- nombre viene del Excel con «..., CAS: 67-64-1» pegado al final y no hay
-- columna aparte. Pero el perfil de reactivo SI tiene un campo `cas`, y quien
-- lo teclea espera que se guarde. Sin esto, el campo se pintaba, se llenaba y
-- se tiraba. El fallback se conserva: el cargador sigue dependiendo de el.
create or replace function private.articulo_de_renglon(p_hoja text, p_renglon jsonb)
returns bigint
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_nombre text := coalesce(private.texto_de(p_renglon, 'sustancia'),
                            private.texto_de(p_renglon, 'articulo'));
  v_descripcion text := private.texto_de(p_renglon, 'especificacion');
  v_unidad      text := private.texto_de(p_renglon, 'unidad');
  v_clasificacion public.clasificacion_articulo;
  v_articulo bigint;
begin
  if v_nombre is null then
    raise exception 'El renglon no dice que articulo es: falta «sustancia» o «articulo»'
      using errcode = '23502';
  end if;

  if v_unidad is null then
    raise exception 'El renglon no trae unidad, y la unidad es parte de la identidad del articulo'
      using errcode = '23502';
  end if;

  v_clasificacion := private.clasificacion_de(p_hoja, p_renglon);

  select id into v_articulo
    from public.articulo
   where nombre_canonico is not distinct from v_nombre
     and descripcion     is not distinct from v_descripcion
     and unidad_base     is not distinct from v_unidad;

  if v_articulo is null then
    select al.articulo_id into v_articulo
      from public.articulo_alias al
      join public.articulo a on a.id = al.articulo_id
     where al.texto = v_nombre
       and a.descripcion is not distinct from v_descripcion
       and a.unidad_base is not distinct from v_unidad
     limit 1;
  end if;

  if v_articulo is null then
    insert into public.articulo
      (nombre_canonico, descripcion, clasificacion, unidad_base, familia)
    values (v_nombre, v_descripcion, v_clasificacion, v_unidad,
            private.texto_de(p_renglon, 'familia'))
    returning id into v_articulo;

    if v_clasificacion = 'reactivo' then
      insert into public.articulo_reactivo
        (articulo_id, cas, estado_fisico, densidad, color_almacenaje,
         tiene_hoja_seguridad, caracteristica_toxica, caracteristica_quimica,
         riesgo_salud, riesgo_inflamabilidad, riesgo_reactividad,
         peligro_especial, implica_actividad_peligro)
      values (
        v_articulo,
        coalesce(
          private.texto_de(p_renglon, 'cas'),
          -- El separador va suelto —«CAS: 67-64-1», «CAS 112926-00-8»,
          -- «CAS. 5949-29-1»— pero la FORMA del numero no: un CAS mal formado
          -- es mejor ausente que inventado.
          substring(v_nombre from '(?i)CAS[ :.]*([0-9]{2,7}-[0-9]{2}-[0-9])')),
        private.estado_fisico_de(p_renglon),
        private.numero_de(p_renglon, 'densidad'),
        private.color_de(p_renglon),
        private.booleano_de(p_renglon, 'hoja_seguridad'),
        private.texto_de(p_renglon, 'caracteristica_toxica'),
        private.texto_de(p_renglon, 'caracteristica_quimica'),
        private.grado_de(p_renglon, 'riesgo_salud'),
        private.grado_de(p_renglon, 'riesgo_inflamabilidad'),
        private.grado_de(p_renglon, 'riesgo_reactividad'),
        private.texto_de(p_renglon, 'peligro_especial'),
        private.booleano_de(p_renglon, 'implica_peligro'))
      on conflict (articulo_id) do nothing;

    elsif v_clasificacion = 'materia_biologica' then
      insert into public.articulo_biologico (articulo_id, origen_especie)
      values (v_articulo, private.texto_de(p_renglon, 'origen_especie'))
      on conflict (articulo_id) do nothing;
    end if;
  end if;

  -- El catalogo aprende: cada texto con el que alguien nombro este articulo
  -- queda registrado, y la proxima corrida del cargador lo resuelve sin
  -- preguntar.
  --
  -- El origen sale del renglon en vez de estar fijo en 'migracion'. Con el fijo,
  -- un articulo tecleado en el alta quedaba registrado como venido de un
  -- archivo, y ese enum existe justamente para poder distinguirlos: el dia que
  -- haya que auditar de donde salio un nombre, «migracion» manda a buscar un
  -- Excel que nunca existio. El cargador no manda la llave y conserva su
  -- 'migracion' por omision, que es lo correcto para el.
  insert into public.articulo_alias (articulo_id, texto, origen)
  values (v_articulo, v_nombre,
          coalesce(private.texto_de(p_renglon, 'origen_alias')::public.origen_alias,
                   'migracion'))
  on conflict (articulo_id, texto) do nothing;

  return v_articulo;
end $$;


-- ---------------------------------------------------------------------------
-- Que hoja le toca a cada clasificacion
-- ---------------------------------------------------------------------------
-- `articulo_de_renglon` recibe el nombre de la hoja del formato y de ahi deduce
-- la clasificacion. La pantalla no tiene hojas: tiene el enum. Este es el
-- puente, y no es cosmetico: `clasificacion_de` compara contra 'materia
-- biologica' con espacio, asi que pasarle el valor del enum —que lleva guion
-- bajo— caeria en su rama por omision y daria de alta una muestra biologica
-- como insumo, sin un solo error.
create or replace function private.hoja_de(p_clasificacion public.clasificacion_articulo)
returns text
language sql
immutable
parallel safe
set search_path = ''
as $$
  select case p_clasificacion
    when 'reactivo'          then 'Reactivos'
    when 'equipo'            then 'Equipos'
    when 'materia_biologica' then 'Materia biológica'
    -- Las tres restantes no tienen hoja propia: su clasificacion viaja en el
    -- renglon, y `crear_existencia` la escribe ahi antes de llamar.
    else null
  end
$$;

grant execute on function private.hoja_de(public.clasificacion_articulo) to authenticated;


-- ---------------------------------------------------------------------------
-- public.crear_existencia
-- ---------------------------------------------------------------------------
-- Recibe lo que el formulario capturo, llaveado por el `campo` que devolvio
-- `public.formulario()`. Nada mas: si un campo no esta en el perfil no llega
-- aqui, y si llegara —porque alguien hable directo a la API con la anon key, que
-- es publica y esta dentro del binario— se descarta. Esa es la misma propiedad
-- que persiguen los perfiles de captura, sostenida tambien del lado del
-- servidor y no solo por la buena conducta de la pantalla.
--
-- Tres promesas, las mismas que `resolver_pendiente`:
--
-- 1. La cantidad entra por `movimiento`, tipo `carga_inicial`. Nunca se escribe
--    `existencia.cantidad`: la mantiene el trigger. Escribirla directo rompe la
--    bitacora y el saldo deja de cuadrar con los movimientos.
--
-- 2. SECURITY INVOKER. La RLS de `articulo`, `articulo_reactivo`, `ubicacion`,
--    `existencia` y `movimiento` se aplica igual que si la pantalla hiciera los
--    INSERT por su cuenta. Un responsable de N3 no puede crear en N4 aunque
--    mande su id, y un usuario de consulta no puede crear en ningun lado.
--
-- 3. Todo o nada. Una funcion es una transaccion: no hay forma de terminar con
--    un articulo creado y su existencia no, ni con una existencia en cero
--    porque el movimiento fallo.
--
-- Devuelve la existencia y su codigo. El codigo lo asigna el trigger
-- `existencia_asigna_codigo` y es lo que se imprime en la etiqueta, asi que la
-- pantalla lo necesita de vuelta para poder mostrarlo sin una segunda consulta.
create or replace function public.crear_existencia(
  p_almacen       bigint,
  p_clasificacion public.clasificacion_articulo,
  p_valores       jsonb
)
returns table (id bigint, codigo text)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  r            jsonb;
  v_existencia bigint;
  v_codigo     text;
  v_cantidad   numeric(14,4);
begin
  -- El renglon se arma DEL PERFIL hacia el payload, no al reves: se recorren
  -- los campos que este almacen pide para este tipo y se toma el valor si viene.
  -- Al reves —recorriendo las llaves del payload— un campo que el perfil no
  -- incluye llegaria intacto a los helpers y se guardaria.
  --
  -- El filtro es contra `formulario()` y NO contra `campo_capturable`: aquel es
  -- el perfil, este el catalogo entero. Filtrar por el catalogo dejaria pasar
  -- `numero_serie` en un reactivo, porque el campo existe —solo que en el perfil
  -- de equipos—, y entonces esto no comprobaria nada.
  select coalesce(
           jsonb_object_agg(private.clave_renglon(f.campo), p_valores -> f.campo),
           '{}'::jsonb)
    into r
    from public.formulario(p_almacen, p_clasificacion) f
   where p_valores ? f.campo;

  -- La clasificacion viaja en el renglon para las tres hojas que no la traen en
  -- el nombre. Se escribe aqui y no se toma del payload: es el argumento de la
  -- funcion, que es lo que ya se comprobo contra el perfil al pedir el
  -- formulario.
  r := r || jsonb_build_object('clasificacion', p_clasificacion::text);

  -- Regla 9: un renglon por equipo fisico. Su perfil no pide cantidad —pedirla
  -- invita a capturar 3 y perder la trazabilidad de a cual se le dio
  -- mantenimiento— y la hoja del formato tampoco tiene columna de unidad. Pero
  -- `articulo.unidad_base` es NOT NULL, asi que alguien tiene que ponerla.
  --
  -- Espejo exacto de `etl/rules/validar.py`, con los mismos dos valores y en
  -- minusculas como alli. Si esto se desviara del cargador, el mismo microscopio
  -- entraria como «pieza» por el ETL y como otra cosa por la pantalla, y serian
  -- DOS articulos: la unidad es parte de la identidad.
  --
  -- Va despues del filtro del perfil a proposito: asi manda esta regla y no lo
  -- que alguien mande por su cuenta a la API.
  if p_clasificacion = 'equipo' then
    r := r || '{"cantidad": 1, "unidad": "pieza"}'::jsonb;
  end if;

  -- De donde salio el nombre con que se llamo a este articulo. Aqui siempre es
  -- el buscador de la pantalla; el cargador no manda esta llave y se queda con
  -- su 'migracion'. Sin esto los dos caminos quedaban indistinguibles.
  r := r || '{"origen_alias": "busqueda"}'::jsonb;

  v_cantidad := private.numero_de(r, 'cantidad');

  insert into public.existencia
    (articulo_id, almacen_id, ubicacion_id, laboratorio_id,
     marca, modelo, presentacion, cantidad_minima,
     peso_frasco_vacio, peso_total,
     numero_serie, numero_inventario_uaeh, funcionamiento, mantenimiento,
     fecha_chequeo, metodo_conservacion, temperatura, fecha_recoleccion,
     fecha_preparacion, responsable_muestra,
     fecha_adquisicion, fecha_caducidad, observaciones)
  values (
    private.articulo_de_renglon(private.hoja_de(p_clasificacion), r),
    p_almacen,
    private.ubicacion_de_renglon(p_almacen, r),
    -- Igual que el cargador y que la depuracion: el laboratorio se resuelve por
    -- nombre dentro del propio almacen. La FK compuesta de `existencia` ya
    -- impide que sea de otro, pero acotar la busqueda evita el error antes.
    (select l.id from public.laboratorio l
      where l.almacen_id = p_almacen
        and public.norm_texto(l.nombre)
            = public.norm_texto(private.texto_de(r, 'laboratorio'))),
    private.texto_de(r, 'marca'),
    private.texto_de(r, 'modelo'),
    private.texto_de(r, 'presentacion'),
    private.numero_de(r, 'cantidad_minima'),
    private.numero_de(r, 'peso_vacio'),
    private.numero_de(r, 'peso_total'),
    private.texto_de(r, 'numero_serie'),
    private.texto_de(r, 'numero_inventario'),
    private.funcionamiento_de(r),
    private.texto_de(r, 'mantenimiento'),
    private.fecha_de(r, 'fecha_chequeo'),
    private.texto_de(r, 'metodo_conservacion'),
    private.texto_de(r, 'temperatura'),
    private.fecha_de(r, 'fecha_recoleccion'),
    private.fecha_de(r, 'fecha_preparacion'),
    private.texto_de(r, 'responsable_muestra'),
    private.fecha_de(r, 'fecha_adquisicion'),
    private.fecha_de(r, 'fecha_caducidad'),
    private.texto_de(r, 'observaciones'))
  returning existencia.id, existencia.codigo into v_existencia, v_codigo;

  -- En cero no se inserta —lo prohibe `movimiento_cantidad_no_cero`— y no hace
  -- falta: el trigger de alta ya dejo la existencia en `agotado`. Dar de alta
  -- algo que se acabo es legitimo; es como se registra un frasco vacio que
  -- sigue en el anaquel.
  if coalesce(v_cantidad, 0) <> 0 then
    -- `almacen_id`, `cantidad_antes`, `cantidad_despues` y `usuario_id` los
    -- pone `private.aplicar_movimiento`. Mandarlos desde aqui no serviria: los
    -- sobreescribe.
    insert into public.movimiento (existencia_id, tipo, cantidad, motivo)
    values (v_existencia, 'carga_inicial', v_cantidad, 'Alta desde Inventario');
  end if;

  return query select v_existencia, v_codigo;
end $$;

comment on function public.crear_existencia(
  bigint, public.clasificacion_articulo, jsonb) is
  'Alta desde la pantalla. Recibe los campos que devolvio formulario(). La cantidad entra por movimiento.';


-- ---------------------------------------------------------------------------
-- Permisos
-- ---------------------------------------------------------------------------
-- El `revoke all on all functions in schema public from anon` del baseline
-- corrio una sola vez y no alcanza a lo que se crea despues: Supabase deja
-- privilegios por omision que le dan EXECUTE a `anon` sobre cada funcion nueva
-- de `public`. Hay que quitarlo a mano, funcion por funcion.
revoke all on function public.crear_existencia(
  bigint, public.clasificacion_articulo, jsonb) from public, anon;
grant execute on function public.crear_existencia(
  bigint, public.clasificacion_articulo, jsonb) to authenticated;
