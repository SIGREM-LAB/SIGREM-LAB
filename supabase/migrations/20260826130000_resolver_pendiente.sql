-- ---------------------------------------------------------------------------
-- Dar el visto bueno a un pendiente tiene que mover el inventario
-- ---------------------------------------------------------------------------
-- `carga_pendiente` nacio sabiendo apartar renglones y firmar quien los revisa,
-- pero no sabia cerrarlos. Marcar `resuelto` dejaba el renglon revisado y el
-- inventario igual que antes: el responsable de N3 podia recorrer sus 337
-- pendientes uno por uno, dar el visto bueno a los 337, y terminar con las
-- mismas 1278 existencias del primer dia. Revisado y cargado eran dos cosas
-- distintas y nada las ataba.
--
-- Esta migracion las ata. `resuelto` pasa a significar "esto ya esta en
-- existencia", y el unico camino para llegar ahi es
-- `public.resolver_pendiente()`. Lo que se revisa y NO debe cargarse tiene su
-- propio estado desde el primer dia: `descartado`.
--
-- Plan: docs/plans/2026-08-26-pantalla-depuracion-inventario.md
-- Tabla:  supabase/migrations/20260826120000_carga_pendiente.sql


-- ---------------------------------------------------------------------------
-- A donde fue a parar el renglon
-- ---------------------------------------------------------------------------
-- Columna nueva y no reutilizar `existencia_id`: son dos preguntas distintas.
-- `existencia_id` es CON CUAL CHOCO —lo que la pantalla pinta al lado para que
-- se pueda decidir— y `existencia_resuelta_id` es EN QUE SE CONVIRTIO. Cuando
-- el veredicto es "son dos frascos distintos" las dos apuntan a existencias
-- diferentes, y machacar la primera con la segunda borraria justo el dato que
-- explica por que hubo que preguntar.
alter table public.carga_pendiente
  add column existencia_resuelta_id bigint references public.existencia (id)
    on delete set null;

comment on column public.carga_pendiente.existencia_resuelta_id is
  'La existencia que salio de este renglon. NO es existencia_id, que es con cual choco.';

create index carga_pendiente_existencia_resuelta_idx
  on public.carga_pendiente (existencia_resuelta_id)
  where existencia_resuelta_id is not null;

-- El candado que convierte la promesa en invariante. Sin el, el cliente sigue
-- pudiendo `update carga_pendiente set estado = 'resuelto'` a secas —el grant
-- por columnas se lo permite— y volvemos al punto de partida: 337 renglones
-- revisados y el inventario intacto. `existencia_resuelta_id` NO esta en ese
-- grant, asi que la unica forma de satisfacer este check es pasar por la
-- funcion de abajo.
alter table public.carga_pendiente
  add constraint carga_pendiente_resuelto_con_existencia
  check (estado <> 'resuelto' or existencia_resuelta_id is not null);


-- ---------------------------------------------------------------------------
-- Un hueco que sale a la luz al crear articulos desde la pantalla
-- ---------------------------------------------------------------------------
-- `articulo_biologico` tiene su politica de alta para `puede_escribir()`;
-- `articulo_reactivo`, su gemela, se quedo solo con lectura y admin. La
-- asimetria no se notaba porque el unico que llenaba esa ficha era el cargador,
-- que corre con la llave de servicio y se salta la RLS.
--
-- Se nota en cuanto una persona resuelve un pendiente de Reactivos cuyo
-- articulo todavia no existe: puede crear el articulo —`articulo_alta` se lo
-- permite— pero no su ficha NOM, asi que el frasco entraria al inventario sin
-- rombo, sin CAS y sin color de almacenaje, y nadie mas que un admin podria
-- ponerselos. Misma latitud que la gemela: alta si, edicion solo admin.
create policy articulo_reactivo_alta on public.articulo_reactivo
  for insert to authenticated with check ((select private.puede_escribir()));


-- ---------------------------------------------------------------------------
-- El veredicto de quien revisa
-- ---------------------------------------------------------------------------
-- Solo dos, porque solo hay dos formas de que un renglon acabe DENTRO del
-- inventario. La tercera salida —no debe cargarse— no pasa por aqui: es
-- `estado = 'descartado'`, un UPDATE normal, y por eso no es un veredicto.
create type public.veredicto_pendiente as enum (
  'nueva',      -- son cosas distintas: el renglon se convierte en su propia existencia
  'duplicado'   -- es el mismo renglon de inventario: su cantidad se suma al que ya esta
);


-- ---------------------------------------------------------------------------
-- Leer el renglon crudo sin adivinar
-- ---------------------------------------------------------------------------
-- Los dos motivos guardan el renglon en formas distintas, y hay que contar con
-- las dos. `posible_duplicado` lo aparta ya normalizado —el renglon habia
-- pasado el validador y solo choco al escribirse—; `regla` lo aparta CRUDO, tal
-- como venia del Excel, porque quien revisa tiene que ver lo que decia el
-- archivo y no lo que el ETL alcanzo a interpretar antes de tropezar. Asi que
-- aqui llegan tanto `{"hoja_seguridad": true}` como `{"hoja_seguridad": "Si"}`,
-- y tanto `{"marca": null}` como `{"marca": "Sin marca"}`.
--
-- DONDE ESTA LA RAYA. Estos lectores conocen los vocabularios que el propio
-- ESQUEMA fija: las formas de decir "no tiene" (contrato §3), los seis colores,
-- los tres estados fisicos, los grados 0-4 del rombo. No hacen NADA de lo que
-- hace `etl/rules/normalizar.py`: ni corrigen «Respisa» por parecido, ni
-- deducen unidades, ni doblan marcas. Eso es trabajo del cargador, y si este
-- renglon esta aqui es justamente porque el cargador no pudo terminarlo.
--
-- Lo que no reconocen se queda en NULL en vez de detener la revision: son
-- campos secundarios de la ficha del articulo, y bloquear el visto bueno de un
-- frasco porque su color esta escrito raro seria cobrarle a una persona el
-- tiempo que esta pantalla existe para ahorrarle. Lo que si detiene todo es un
-- numero o una fecha ilegibles, porque de ahi sale el saldo.
create or replace function private.texto_de(p_renglon jsonb, p_clave text)
returns text
language sql
immutable
parallel safe
set search_path = ''
as $$
  -- Contrato ETL §3: todas estas se leen como NULL. Sin esto, la marca de 88
  -- renglones de N3 se guardaria literalmente como «Sin marca» y la etiqueta de
  -- su ubicacion saldria «N3 · Gabinete 309 · Repisa — · Fila —», que ademas
  -- inventa un anaquel nuevo en el que no cabe nada mas.
  select case
    when public.norm_texto(coalesce(btrim(p_renglon ->> p_clave), '')) = any (
      array['', '-', '—', 'sin serie', 'sin modelo', 'sin inventario',
            'sin marca', 's/n', 'n/a', 'na', 's/d', 'nd', 'sin dato',
            'no aplica', 'ninguno', 'ninguna'])
    then null
    else btrim(p_renglon ->> p_clave)
  end
$$;

create or replace function private.numero_de(p_renglon jsonb, p_clave text)
returns numeric
language plpgsql
immutable
parallel safe
set search_path = ''
as $$
declare crudo text := private.texto_de(p_renglon, p_clave);
begin
  if crudo is null then
    return null;
  end if;
  return crudo::numeric;
exception when invalid_text_representation then
  raise exception 'El campo «%» del renglon no es un numero: «%»', p_clave, crudo
    using errcode = '22P02';
end $$;

create or replace function private.fecha_de(p_renglon jsonb, p_clave text)
returns date
language plpgsql
immutable
parallel safe
set search_path = ''
as $$
declare crudo text := private.texto_de(p_renglon, p_clave);
begin
  if crudo is null then
    return null;
  end if;
  return crudo::date;
exception when invalid_datetime_format or datetime_field_overflow then
  raise exception 'El campo «%» del renglon no es una fecha: «%»', p_clave, crudo
    using errcode = '22007';
end $$;

-- «Si», «X», `true`: las tres formas con que el formato marca una casilla.
create or replace function private.booleano_de(p_renglon jsonb, p_clave text)
returns boolean
language sql
immutable
parallel safe
set search_path = ''
as $$
  select case public.norm_texto(coalesce(private.texto_de(p_renglon, p_clave), ''))
    when 'si'   then true
    when 'x'    then true
    when 'true' then true
    when '1'    then true
    when 'no'    then false
    when 'false' then false
    when '0'     then false
    else null
  end
$$;

-- El rombo NFPA va de 0 a 4 y el check de `articulo_reactivo` lo exige. El
-- Excel lo escribe «Grado 2: Riesgo moderado» y el renglon normalizado como 2:
-- el primer digito del 0 al 4 dice lo mismo en los dos casos.
create or replace function private.grado_de(p_renglon jsonb, p_clave text)
returns smallint
language sql
immutable
parallel safe
set search_path = ''
as $$
  select substring(private.texto_de(p_renglon, p_clave) from '[0-4]')::smallint
$$;

create or replace function private.color_de(p_renglon jsonb)
returns public.color_almacenaje
language sql
immutable
parallel safe
set search_path = ''
as $$
  select case public.norm_texto(coalesce(private.texto_de(p_renglon, 'color'), ''))
    when 'verde'    then 'verde'::public.color_almacenaje
    when 'rojo'     then 'rojo'::public.color_almacenaje
    when 'azul'     then 'azul'::public.color_almacenaje
    when 'blanco'   then 'blanco'::public.color_almacenaje
    when 'amarillo' then 'amarillo'::public.color_almacenaje
    when 'naranja'  then 'naranja'::public.color_almacenaje
    -- Regla 12: «NO TOXICO» no es un color. 143 renglones de N3 lo dicen.
    when 'no toxico' then 'verde'::public.color_almacenaje
    else null
  end
$$;

create or replace function private.estado_fisico_de(p_renglon jsonb)
returns public.estado_fisico
language sql
immutable
parallel safe
set search_path = ''
as $$
  -- El renglon normalizado trae el campo resuelto; el crudo trae las tres
  -- casillas del formato (columnas P, Q y R) con una sola marcada.
  select case
    when public.norm_texto(coalesce(private.texto_de(p_renglon, 'estado_fisico'), ''))
         in ('solido', 'liquido', 'gas')
      then public.norm_texto(private.texto_de(p_renglon, 'estado_fisico'))::public.estado_fisico
    when private.texto_de(p_renglon, 'solido')  is not null then 'solido'::public.estado_fisico
    when private.texto_de(p_renglon, 'liquido') is not null then 'liquido'::public.estado_fisico
    when private.texto_de(p_renglon, 'gas')     is not null then 'gas'::public.estado_fisico
    else null
  end
$$;

create or replace function private.funcionamiento_de(p_renglon jsonb)
returns public.funcionamiento_equipo
language sql
immutable
parallel safe
set search_path = ''
as $$
  select case public.norm_texto(coalesce(private.texto_de(p_renglon, 'funcionamiento'), ''))
    when 'correcto'        then 'correcto'::public.funcionamiento_equipo
    when 'presenta fallas' then 'presenta_fallas'::public.funcionamiento_equipo
    when 'presenta_fallas' then 'presenta_fallas'::public.funcionamiento_equipo
    else null
  end
$$;


-- ---------------------------------------------------------------------------
-- Que clasificacion es, igual que lo decide el cargador
-- ---------------------------------------------------------------------------
-- Espejo de `etl/destino.py:_clasificacion`. Tres hojas la traen en el nombre;
-- las demas tienen columna propia. Si esto se desviara del cargador, el mismo
-- renglon entraria como una cosa por el ETL y como otra por la pantalla.
create or replace function private.clasificacion_de(p_hoja text, p_renglon jsonb)
returns public.clasificacion_articulo
language sql
stable
set search_path = ''
as $$
  select case p_hoja
    when 'Reactivos'         then 'reactivo'::public.clasificacion_articulo
    when 'Equipos'           then 'equipo'::public.clasificacion_articulo
    when 'Materia biológica' then 'materia_biologica'::public.clasificacion_articulo
    else case public.norm_texto(coalesce(private.texto_de(p_renglon, 'clasificacion'), 'insumo'))
      when 'material'          then 'material'::public.clasificacion_articulo
      when 'insumo'            then 'insumo'::public.clasificacion_articulo
      when 'equipo'            then 'equipo'::public.clasificacion_articulo
      when 'reactivo'          then 'reactivo'::public.clasificacion_articulo
      when 'materia biologica' then 'materia_biologica'::public.clasificacion_articulo
      when 'componente'        then 'componente'::public.clasificacion_articulo
      else 'insumo'::public.clasificacion_articulo
    end
  end
$$;


-- ---------------------------------------------------------------------------
-- Que cosa es: resolver el articulo, o crearlo
-- ---------------------------------------------------------------------------
-- Espejo de `etl/catalogo.py:resolver`, y con la misma regla dura: SOLO
-- coincidencia exacta. Primero la identidad (nombre, descripcion, unidad), que
-- es la llave unica de `articulo`; despues el alias exacto, comprobando que no
-- contradiga descripcion ni unidad.
--
-- Deliberadamente NO se usa `buscar_articulo()`. Estas dos cadenas tienen
-- similitud altisima por trigramas y son DOS articulos:
--
--   Zinc en polvo, solido, pureza 95%, presentacion 500 g, CAS: 7440-66-6
--   Zinc en polvo, solido, pureza 93%, presentacion 500 g, CAS: 7440-66-6
--
-- Aceptar la mejor coincidencia difusa los fusionaria en silencio, con las
-- cantidades sumadas y sin un solo error. Fusionar es una decision humana y
-- tiene funcion propia: `public.fusionar_articulo()`. Lo que puede pasar aqui
-- es lo contrario —crear un articulo casi igual a uno que ya existe— y para eso
-- si hay red: nace `verificado = false` y cae en la cola de curacion del admin.
--
-- SECURITY INVOKER: crear un articulo pasa por `articulo_alta`, que exige
-- `puede_escribir()`. Un usuario de consulta no puede llegar aqui.
create or replace function private.articulo_de_renglon(p_hoja text, p_renglon jsonb)
returns bigint
language plpgsql
security invoker
set search_path = ''
as $$
declare
  -- Reactivos titula la columna «Sustancia quimica»; el resto de las hojas,
  -- «Articulo». Es el mismo campo.
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

  -- La unidad no es un adorno: es parte de la identidad del articulo, y por eso
  -- «el mismo articulo en dos unidades» aparta el renglon en vez de cargarlo.
  -- Crear un articulo sin unidad seria crear el problema que traia el renglon.
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

    -- Las extensiones 1:1 se llenan solo al crear, igual que en el cargador: si
    -- el articulo ya existia, su ficha normativa ya se capturo y este renglon no
    -- tiene por que reescribirla.
    if v_clasificacion = 'reactivo' then
      insert into public.articulo_reactivo
        (articulo_id, cas, estado_fisico, color_almacenaje, tiene_hoja_seguridad,
         caracteristica_toxica, caracteristica_quimica, riesgo_salud,
         riesgo_inflamabilidad, riesgo_reactividad, peligro_especial,
         implica_actividad_peligro)
      values (
        v_articulo,
        -- El CAS viene enterrado en la cadena larga de la sustancia. El
        -- separador va suelto —«CAS: 67-64-1», «CAS 112926-00-8», «CAS.
        -- 5949-29-1»— pero la FORMA del numero no: un CAS mal formado es mejor
        -- ausente que inventado.
        substring(v_nombre from '(?i)CAS[ :.]*([0-9]{2,7}-[0-9]{2}-[0-9])'),
        private.estado_fisico_de(p_renglon),
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
  -- preguntar. `migracion` y no `busqueda` porque el texto salio del archivo,
  -- no del buscador de la app.
  insert into public.articulo_alias (articulo_id, texto, origen)
  values (v_articulo, v_nombre, 'migracion')
  on conflict (articulo_id, texto) do nothing;

  return v_articulo;
end $$;


-- ---------------------------------------------------------------------------
-- Donde esta: resolver la ubicacion, o crearla
-- ---------------------------------------------------------------------------
-- Espejo de `etl/destino.py:etiqueta_de` + `upsert_ubicacion`. El orden de las
-- partes sale de esta lista y no de recorrer el jsonb: dos renglones con los
-- mismos componentes tienen que producir la MISMA etiqueta siempre, o el
-- `unique (almacen_id, etiqueta)` deja de agrupar y cada renglon se inventa su
-- propio anaquel.
--
-- SECURITY INVOKER: crear una ubicacion pasa por `ubicacion_escritura`, que
-- solo deja escribir en el almacen propio.
create or replace function private.ubicacion_de_renglon(p_almacen bigint, p_renglon jsonb)
returns bigint
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_partes      text[] := '{}';
  v_componentes jsonb  := '{}'::jsonb;
  v_ubicacion   bigint;
  v_valor       text;
  parte         record;
begin
  for parte in
    select *
      from (values ('sub_ubicacion', ''), ('mueble', ''), ('repisa', 'Repisa '),
                   ('fila_cajon', 'Fila '), ('coord_h', 'H'), ('coord_v', 'V'),
                   ('coord_i', 'I')) as t(campo, prefijo)
  loop
    v_valor := private.texto_de(p_renglon, parte.campo);
    if v_valor is not null then
      v_partes      := v_partes || (parte.prefijo || v_valor);
      v_componentes := v_componentes || jsonb_build_object(parte.campo, v_valor);
    end if;
  end loop;

  -- Un renglon sin una sola parte de ubicacion no tiene ubicacion. Inventarle
  -- una etiqueta vacia juntaria en un mismo anaquel imaginario todo lo que no
  -- dice donde esta.
  if cardinality(v_partes) = 0 then
    return null;
  end if;

  insert into public.ubicacion (almacen_id, etiqueta, componentes)
  values (p_almacen, array_to_string(v_partes, ' · '), v_componentes)
  -- `do update` y no `do nothing` para que el RETURNING devuelva la fila
  -- tambien cuando ya existia.
  on conflict (almacen_id, etiqueta) do update set etiqueta = excluded.etiqueta
  returning id into v_ubicacion;

  return v_ubicacion;
end $$;


-- ---------------------------------------------------------------------------
-- Cerrar el pendiente
-- ---------------------------------------------------------------------------
-- Es lo unico de todo esto que corre como SECURITY DEFINER, y por un motivo
-- estrecho: `existencia_resuelta_id` no esta en el `grant update` por columnas,
-- y un SECURITY INVOKER corre como `authenticated`, asi que no podria
-- escribirla. Es el mismo reparto que ya usan `private.asignar_codigo` y
-- `private.aplicar_movimiento`: el cliente pone lo que decide, la base pone lo
-- que constata.
--
-- Que no se salte ningun permiso descansa en dos cosas: vive en `private`, que
-- PostgREST no expone, y quien la llama ya paso por la RLS de
-- `carga_pendiente` en el UPDATE de mas abajo. El trigger de firma sigue
-- corriendo aqui —`auth.uid()` lee el JWT de la peticion, no el rol— asi que
-- `revisado_por` sale de quien pulso el boton.
create or replace function private.cerrar_pendiente(
  p_pendiente bigint, p_existencia bigint, p_nota text)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.carga_pendiente
     set estado                 = 'resuelto',
         existencia_resuelta_id = p_existencia,
         -- Sin nota nueva se conserva la que hubiera: quien resuelve no tiene
         -- por que estar obligado a reescribir lo que ya anoto.
         nota                   = coalesce(p_nota, nota)
   where id = p_pendiente
$$;


-- ---------------------------------------------------------------------------
-- public.resolver_pendiente: el visto bueno que si carga
-- ---------------------------------------------------------------------------
-- Recibe el pendiente con su renglon YA corregido por quien lo revisa, crea la
-- existencia (o le suma a la que choco) y cierra el pendiente. Todo en una
-- transaccion: o el inventario se mueve y el renglon queda cerrado, o no pasa
-- ninguna de las dos cosas.
--
-- Tres promesas:
--
-- 1. La cantidad entra por `movimiento`, tipo `carga_inicial`. Nunca se escribe
--    `existencia.cantidad`: la mantiene el trigger. Es el punto 5 del contrato
--    del ETL y aqui vale igual, porque este es el mismo trabajo hecho a mano.
--
-- 2. Corre con los privilegios de quien llama. SECURITY INVOKER, no DEFINER:
--    la RLS de `existencia`, `movimiento`, `ubicacion` y `articulo` se aplica
--    igual que si la pantalla hiciera los INSERT por su cuenta. Un responsable
--    de N3 no puede resolver un pendiente de N4 aunque conozca su id.
--
-- 3. Es idempotente. Resolver dos veces devuelve la misma existencia y no crea
--    otra: el UPDATE de arranque solo agarra el renglon si sigue `pendiente`, y
--    ese mismo UPDATE deja la fila bloqueada hasta el commit, asi que dos
--    pestañas abiertas sobre el mismo pendiente tampoco pueden colarse a la vez.
create or replace function public.resolver_pendiente(
  p_pendiente bigint,
  p_renglon   jsonb                      default null,
  p_veredicto public.veredicto_pendiente default 'nueva',
  p_nota      text                       default null
)
returns bigint
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v            public.carga_pendiente;
  v_estado     public.estado_pendiente;
  v_previa     bigint;
  r            jsonb;
  v_existencia bigint;
  v_cantidad   numeric(14,4);
begin
  -- Un solo UPDATE hace tres trabajos: comprueba el permiso (pasa por la RLS de
  -- `carga_pendiente` y por el grant por columnas), bloquea la fila hasta el
  -- commit, y guarda la correccion de quien revisa. Si devuelve cero filas hay
  -- tres explicaciones posibles y abajo se distinguen, porque a quien esta en
  -- la pantalla no le sirve el mismo mensaje para las tres.
  update public.carga_pendiente
     set renglon = coalesce(p_renglon, renglon)
   where id = p_pendiente
     and estado = 'pendiente'
  returning * into v;

  if not found then
    -- La lectura de `carga_pendiente` es abierta, asi que esto siempre ve la
    -- fila si existe.
    select estado, existencia_resuelta_id into v_estado, v_previa
      from public.carga_pendiente where id = p_pendiente;

    if v_estado is null then
      raise exception 'El pendiente % no existe', p_pendiente
        using errcode = 'P0002';
    elsif v_estado <> 'pendiente' then
      -- Idempotencia: ya se reviso. Devolver lo que salio de el, sin volver a
      -- cargar nada, es lo que hace que un doble clic o un reintento de la red
      -- no dupliquen la existencia.
      return v_previa;
    else
      raise exception 'El pendiente % es de otro almacen', p_pendiente
        using errcode = '42501';
    end if;
  end if;

  r := v.renglon;
  v_cantidad := private.numero_de(r, 'cantidad');

  if p_veredicto = 'duplicado' then
    if v.existencia_id is null then
      raise exception
        'El pendiente % no choca con ninguna existencia: no hay a cual sumarle',
        p_pendiente using errcode = '22023';
    end if;
    -- El veredicto es "esto ya esta cargado, es el mismo renglon de inventario".
    -- La existencia no se toca: lo unico que cambia es su saldo, y eso entra
    -- por el movimiento de abajo como cualquier otra entrada.
    v_existencia := v.existencia_id;
  else
    insert into public.existencia
      (articulo_id, almacen_id, ubicacion_id, laboratorio_id, carga_id,
       marca, modelo, presentacion, peso_frasco_vacio, peso_total,
       numero_serie, numero_inventario_uaeh, funcionamiento, mantenimiento,
       fecha_chequeo, metodo_conservacion, temperatura, fecha_recoleccion,
       fecha_preparacion, responsable_muestra, observaciones)
    values (
      private.articulo_de_renglon(v.hoja, r),
      v.almacen_id,
      private.ubicacion_de_renglon(v.almacen_id, r),
      -- Igual que el cargador: si el nombre no esta en el catalogo de
      -- laboratorios, se queda nulo. `norm_texto` es `strict`, asi que un
      -- renglon sin laboratorio no compara con nada y da null sin caso aparte.
      (select l.id from public.laboratorio l
        where l.almacen_id = v.almacen_id
          and public.norm_texto(l.nombre)
              = public.norm_texto(private.texto_de(r, 'laboratorio'))),
      -- El pendiente conserva de que corrida salio. Ojo con el cuadre de
      -- `carga.filas`, que cambia de forma: era existencias + pendientes, y
      -- pasa a ser existencias + pendientes sin resolver.
      v.carga_id,
      private.texto_de(r, 'marca'),
      private.texto_de(r, 'modelo'),
      private.texto_de(r, 'presentacion'),
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
      private.texto_de(r, 'observaciones'))
    returning id into v_existencia;
  end if;

  -- Punto 5 del contrato: la cantidad entra por movimiento, nunca directo. En
  -- cero no se inserta —`movimiento_cantidad_no_cero`— y no hace falta: el
  -- trigger de alta ya dejo la existencia en `agotado`.
  if coalesce(v_cantidad, 0) <> 0 then
    -- `almacen_id`, `cantidad_antes`, `cantidad_despues` y `usuario_id` los
    -- pone `private.aplicar_movimiento`. Mandarlos desde aqui no serviria: los
    -- sobreescribe.
    insert into public.movimiento (existencia_id, tipo, cantidad, motivo)
    values (v_existencia, 'carga_inicial', v_cantidad,
            format('Depuracion de %s · %s fila %s', v.archivo, v.hoja, v.fila));
  end if;

  perform private.cerrar_pendiente(p_pendiente, v_existencia, p_nota);
  return v_existencia;
end $$;

comment on function public.resolver_pendiente(
  bigint, jsonb, public.veredicto_pendiente, text) is
  'Cierra un renglon de carga_pendiente metiendolo a existencia. La cantidad entra por movimiento.';


-- ---------------------------------------------------------------------------
-- Permisos
-- ---------------------------------------------------------------------------
-- El `revoke all on all functions in schema public from anon` del baseline
-- corrio una sola vez y no alcanza a lo que se crea despues: Supabase deja
-- privilegios por omision que le dan EXECUTE a `anon` sobre cada funcion nueva
-- de `public`. Hay que quitarlo a mano, funcion por funcion.
revoke all on function public.resolver_pendiente(
  bigint, jsonb, public.veredicto_pendiente, text) from public, anon;
grant execute on function public.resolver_pendiente(
  bigint, jsonb, public.veredicto_pendiente, text) to authenticated;

-- Las de `private` no las expone PostgREST y `anon` no tiene USAGE sobre el
-- esquema, pero `authenticated` si necesita poder llamarlas: la funcion de
-- arriba corre como el usuario que la invoca.
grant execute on function private.texto_de(jsonb, text)            to authenticated;
grant execute on function private.numero_de(jsonb, text)           to authenticated;
grant execute on function private.fecha_de(jsonb, text)            to authenticated;
grant execute on function private.booleano_de(jsonb, text)         to authenticated;
grant execute on function private.grado_de(jsonb, text)            to authenticated;
grant execute on function private.color_de(jsonb)                  to authenticated;
grant execute on function private.estado_fisico_de(jsonb)          to authenticated;
grant execute on function private.funcionamiento_de(jsonb)         to authenticated;
grant execute on function private.clasificacion_de(text, jsonb)    to authenticated;
grant execute on function private.articulo_de_renglon(text, jsonb) to authenticated;
grant execute on function private.ubicacion_de_renglon(bigint, jsonb) to authenticated;
grant execute on function private.cerrar_pendiente(bigint, bigint, text) to authenticated;
