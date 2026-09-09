-- El modulo de Practicas: lo que hace falta para que la pantalla /practicas
-- pueda registrar una sesion completa.
--
-- Diseno: docs/specs/2026-09-03-modulo-practicas-design.md
--
-- Casi todo esto es aditivo. El unico `create or replace` es sobre la vista del
-- listado, y solo para agregarle una columna al final.
--
-- La excepcion, deliberada: se aprieta `practica_observacion_escritura`, que
-- arrastra el mismo hueco de rol que esta migracion tuvo que cerrar en su
-- gemela nueva. Ver la seccion de RLS, al final.
--
-- Los tres huecos que cierra, en orden de gravedad:
--   1. `practica_elemento.metodo_control` lo declaraba el cliente y nada lo
--      ataba a la clasificacion del articulo. Un equipo se podia registrar como
--      consumido por peso.
--   2. Registrar una practica eran 1+N+M escrituras sueltas: si la tercera
--      fallaba quedaban dos elementos ya aplicados, con su `movimiento` escrito
--      -que es de solo insercion- colgando de una practica que el responsable
--      no puede corregir.
--   3. No habia borrador, y `practica_elemento` no admite filas a medias.

-- ---------------------------------------------------------------------------
-- El metodo de control, en un solo lugar
-- ---------------------------------------------------------------------------
-- El mapa no es una opinion: sale de lo que cada clasificacion ya declara que
-- captura en perfil_campo. `reactivo` es la unica que pide peso_frasco_vacio y
-- peso_total -regla 13 del formato-, asi que es la unica que se pesa. `equipo`
-- es la unica sin `cantidad` y con `funcionamiento`: la regla 9 pide un renglon
-- por equipo fisico, asi que siempre es 1 y lo unico que cambia al devolverlo
-- es en que estado volvio. Eso es exactamente un prestamo.
--
-- `immutable` para poder usarla dentro de la vista sin costo por fila.
create or replace function public.metodo_de_control(
  p_clasificacion public.clasificacion_articulo
) returns public.metodo_control
language sql
immutable
parallel safe
set search_path = ''
as $$
  select case p_clasificacion
    when 'reactivo' then 'peso'::public.metodo_control
    when 'equipo'   then 'prestamo'::public.metodo_control
    else 'cantidad'::public.metodo_control
  end
$$;

comment on function public.metodo_de_control(public.clasificacion_articulo) is
  'Que metodo de control le toca a cada clasificacion. Fuente unica: la usan la vista del listado y registrar_practica, asi que el panel del frontend y lo que se guarda no pueden discrepar.';

-- El `alter default privileges` de la migracion de grants cubre tablas, no
-- funciones, y una funcion nueva es ejecutable por PUBLIC salvo que se revoque.
revoke all on function public.metodo_de_control(public.clasificacion_articulo)
  from public, anon;
grant execute on function public.metodo_de_control(public.clasificacion_articulo)
  to authenticated;


-- ---------------------------------------------------------------------------
-- La vista del listado gana una columna, al final
-- ---------------------------------------------------------------------------
-- Al final y no en medio porque `create or replace view` es lo unico que
-- Postgres admite sin recrear la vista, y solo acepta columnas nuevas al final.
-- Recrearla obligaria a un `drop ... cascade` y a repetir `security_invoker`,
-- que es el detalle que falla en silencio: sin el, la vista corre como su dueno
-- y publica el inventario entero a anon. Hay una prueba en esquema.test.sql que
-- lo vigila, y existe justo porque una vista mal creada funciona igual de bien
-- hasta el dia malo.
create or replace view public.existencia_listado
with (security_invoker = on) as
select e.id, e.codigo, e.marca, e.cantidad, e.estado, e.almacen_id,
       e.ubicacion_id, e.fecha_caducidad, e.creado_en,
       a.id as articulo_id,
       a.nombre_canonico, a.descripcion, a.clasificacion, a.unidad_base,
       al.clave   as almacen_clave,
       u.etiqueta as ubicacion,
       public.norm_texto(a.nombre_canonico)     as nombre_norm,
       public.norm_texto(coalesce(e.marca, '')) as marca_norm,
       public.metodo_de_control(a.clasificacion) as metodo_control
from public.existencia e
join public.articulo a  on a.id  = e.articulo_id
join public.almacen  al on al.id = e.almacen_id
left join public.ubicacion u on u.id = e.ubicacion_id;

-- `create or replace view` conserva los privilegios, pero repetirlos es barato
-- y deja el archivo autoexplicativo.
grant select on public.existencia_listado to authenticated;
revoke all  on public.existencia_listado from anon;


-- ---------------------------------------------------------------------------
-- Los motivos aprenden a que metodo aplican
-- ---------------------------------------------------------------------------
-- Podria ser un switch de nueve lineas en el frontend. Va como columna por la
-- misma razon por la que los motivos son un catalogo y no nueve booleanos:
-- mover "No tenemos" a los materiales tiene que ser un update, no una migracion
-- mas un redespliegue. Es la misma decision que ya se tomo con campo_capturable.
--
-- El default con los tres es lo que hace que esta migracion no rompa lo que ya
-- este cargado: un motivo existente sigue saliendo en todos los paneles hasta
-- que alguien decida otra cosa.
alter table public.motivo_observacion
  add column metodos public.metodo_control[] not null
    default array['peso','cantidad','prestamo']::public.metodo_control[];

alter table public.motivo_observacion
  add constraint motivo_observacion_metodos_no_vacio
  check (cardinality(metodos) > 0);

comment on column public.motivo_observacion.metodos is
  'En que paneles se ofrece este motivo. Es para armar la interfaz, NO una restriccion: no se valida contra el metodo del elemento, porque cambiar esto no debe volver ilegal una practica que fue correcta el dia que se capturo.';

-- El `orden` se rehace porque el sembrado saca los tres prestamos antes que
-- Contaminado y Se termino, y el diseno los pone al final.
--
-- El panel de cantidad lleva los tres consumibles ademas de Material daniado, y
-- es el unico punto donde esto se aparta del mockup. La razon es la asimetria
-- del error: una casilla de mas cuesta un renglon en un panel que ya tiene
-- barra de desplazamiento; una de menos empuja a escribir "se acabo la caja de
-- pipetas" en Otro y en el texto libre, que es precisamente lo que el catalogo
-- venia a evitar.
update public.motivo_observacion m
   set orden = v.orden, metodos = v.metodos
  from (values
    ('no_tenemos',       1, array['peso','cantidad']::public.metodo_control[]),
    ('contaminado',      2, array['peso','cantidad']::public.metodo_control[]),
    ('se_termino',       3, array['peso','cantidad']::public.metodo_control[]),
    ('material_daniado', 4, array['cantidad']::public.metodo_control[]),
    ('equipo_daniado',   5, array['prestamo']::public.metodo_control[]),
    ('prestamo_n4',      6, array['peso','cantidad','prestamo']::public.metodo_control[]),
    ('prestamo_n3',      7, array['peso','cantidad','prestamo']::public.metodo_control[]),
    ('prestamo_lum',     8, array['peso','cantidad','prestamo']::public.metodo_control[]),
    ('otro',             9, array['peso','cantidad','prestamo']::public.metodo_control[])
  ) as v(clave, orden, metodos)
 where m.clave = v.clave;


-- ---------------------------------------------------------------------------
-- Las observaciones son del producto, no de la sesion
-- ---------------------------------------------------------------------------
-- "Contaminado" es una propiedad del frasco; "Equipo daniado", de ese equipo.
-- Colgadas de la practica -que es donde estan hoy, en practica_observacion- una
-- sesion con tres productos que marca Contaminado no dice cual se contamino, y
-- el modulo de Reportes se queda sin poder responderlo.
--
-- practica_observacion NO se borra: nada la lee -solo aparece en los tipos
-- generados- asi que dejarla no cuesta nada, y borrarla seria una migracion
-- destructiva sobre una tabla con dos politicas ya probadas.
create table public.practica_elemento_observacion (
  practica_elemento_id bigint not null
    references public.practica_elemento (id) on delete cascade,
  motivo               text   not null references public.motivo_observacion (clave),
  primary key (practica_elemento_id, motivo)
);

create index practica_elemento_observacion_motivo_idx
  on public.practica_elemento_observacion (motivo);

-- Sin almacen_id desnormalizado, por lo mismo que practica_observacion: son dos
-- columnas, y una tercera solo para la RLS sale mas cara que el exists.
-- practica_elemento_id es la primera columna de la llave primaria, asi que la
-- subconsulta resuelve por indice sin necesidad de uno nuevo.


-- ---------------------------------------------------------------------------
-- El borrador
-- ---------------------------------------------------------------------------
-- La opcion natural -practica.estado en 'borrador'/'finalizada'- no cabe.
-- practica_elemento tiene un check que exige los campos completos segun el
-- metodo, y un trigger AFTER INSERT que descuenta el inventario en el acto. Un
-- producto "Pendiente" no es una fila valida de esa tabla, y para que lo fuera
-- habria que aflojar el check y condicionar los dos triggers: cuatro piezas ya
-- probadas, tocadas para dar soporte a algo que ni siquiera es un hecho
-- ocurrido. Y el check aflojado se queda aflojado para siempre, incluso para
-- las practicas finalizadas, que es donde de verdad importa.
--
-- Asi, `practica` conserva su invariante: una fila en practica es un hecho
-- ocurrido, completo, en una sola transaccion.
create table public.practica_borrador (
  -- Uno por persona. La pantalla captura una practica a la vez, y una llave
  -- primaria sobre usuario_id hace que "recuperar mi borrador" sea un select
  -- sin ambiguedad y que guardar sea un upsert sin carreras.
  usuario_id     uuid primary key references public.perfil (id) on delete cascade,

  -- Opaco para la base a proposito. Lo que va dentro lleva su propio `version`
  -- y el frontend descarta lo que no entienda: un borrador que se pierde es una
  -- molestia, un practica_elemento incompleto que se cuela a Reportes es un
  -- dato malo.
  contenido      jsonb not null,
  actualizado_en timestamptz not null default now()
);

comment on table public.practica_borrador is
  'La captura a medio hacer, una por persona. No es una practica: es la hoja de trabajo de quien la esta llenando.';

create or replace function private.asignar_borrador()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- El cliente NO decide de quien es el borrador. Al reves que en movimiento
  -- -donde el valor del cliente gana y lo que protege es almacen_id- aqui la
  -- RLS se ancla justo en usuario_id, asi que el trigger lo impone.
  --
  -- El coalesce al reves cubre a quien corre sin sesion: el ETL, un job o las
  -- pruebas, donde auth.uid() es NULL.
  new.usuario_id     := coalesce((select auth.uid()), new.usuario_id);
  new.actualizado_en := now();
  return new;
end;
$$;

create trigger practica_borrador_asigna_dueno
  before insert or update on public.practica_borrador
  for each row execute function private.asignar_borrador();


-- ---------------------------------------------------------------------------
-- registrar_practica: 1 cabecera + N elementos + M observaciones, atomico
-- ---------------------------------------------------------------------------
-- security invoker y no definer: la funcion no le presta a nadie privilegios
-- que no tenga. La RLS de practica y de practica_elemento sigue mandando, y un
-- usuario de rol consulta que la llame recibe 42501. Mismo criterio que
-- vincular_asignatura y resolver_pendiente.
-- `p_observaciones` va al final y con default porque es el unico argumento
-- opcional, y el generador de tipos lo refleja: un argumento con default sale
-- como `p_observaciones?: string` y el cliente puede omitirlo. Sin el default
-- sale como `string` a secas, y mandarle null desde TypeScript obligaria a una
-- mentira -`null as unknown as string`- para complacer una firma que la base si
-- admite nula.
create or replace function public.registrar_practica(
  p_programa          bigint,
  p_laboratorio       bigint,
  p_asignatura        bigint,
  p_practica_catalogo bigint,
  p_fecha             date,
  p_elementos         jsonb,
  p_observaciones     text default null
) returns text
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_practica bigint;
  v_folio    text;
  v_elemento jsonb;
  v_metodo   public.metodo_control;
  v_id       bigint;
  v_motivo   text;
begin
  if p_elementos is null
     or jsonb_typeof(p_elementos) <> 'array'
     or jsonb_array_length(p_elementos) = 0 then
    raise exception 'Una practica necesita al menos un producto';
  end if;

  -- folio, almacen_id y registrado_por los pone practica_asigna_folio. Se
  -- omiten a proposito: las tres son NOT NULL, y en Postgres los constraints se
  -- comprueban DESPUES de los triggers BEFORE ROW, asi que omitirlas es
  -- correcto y ademas es la unica forma de que el cliente no las falsee.
  insert into public.practica (programa_educativo_id, laboratorio_id, asignatura_id,
                               practica_catalogo_id, fecha, observaciones)
  values (p_programa, p_laboratorio, p_asignatura, p_practica_catalogo,
          coalesce(p_fecha, current_date), p_observaciones)
  returning id, folio into v_practica, v_folio;

  for v_elemento in select * from jsonb_array_elements(p_elementos)
  loop
    -- El metodo lo decide la base leyendo QUE ES la cosa. Lo que mande el
    -- cliente en el json se ignora: es el hueco que esta migracion cierra.
    select public.metodo_de_control(a.clasificacion)
      into v_metodo
      from public.existencia e
      join public.articulo  a on a.id = e.articulo_id
     where e.id = (v_elemento->>'existencia_id')::bigint;

    if v_metodo is null then
      raise exception 'La existencia % no existe', v_elemento->>'existencia_id';
    end if;

    -- Los `case` son lo que hace que un peso_inicial mandado sobre un equipo se
    -- descarte ANTES de llegar al check, en vez de reventar contra
    -- practica_elemento_campos_por_metodo con un mensaje que nadie entiende.
    insert into public.practica_elemento (
      practica_id, existencia_id, metodo_control,
      peso_inicial, peso_final,
      cantidad_entregada, cantidad_devuelta, cantidad_danada,
      estado_salida, estado_devolucion,
      observaciones)
    values (
      v_practica,
      (v_elemento->>'existencia_id')::bigint,
      v_metodo,
      case when v_metodo = 'peso' then (v_elemento->>'peso_inicial')::numeric end,
      case when v_metodo = 'peso' then (v_elemento->>'peso_final')::numeric end,
      case when v_metodo = 'cantidad' then (v_elemento->>'cantidad_entregada')::numeric end,
      case when v_metodo = 'cantidad' then (v_elemento->>'cantidad_devuelta')::numeric end,
      case when v_metodo = 'cantidad' then (v_elemento->>'cantidad_danada')::numeric end,
      case when v_metodo = 'prestamo'
           then (v_elemento->>'estado_salida')::public.funcionamiento_equipo end,
      case when v_metodo = 'prestamo'
           then (v_elemento->>'estado_devolucion')::public.funcionamiento_equipo end,
      nullif(btrim(coalesce(v_elemento->>'observaciones', '')), ''))
    returning id into v_id;

    for v_motivo in
      select jsonb_array_elements_text(coalesce(v_elemento->'motivos', '[]'::jsonb))
    loop
      insert into public.practica_elemento_observacion (practica_elemento_id, motivo)
      values (v_id, v_motivo)
      on conflict do nothing;
    end loop;
  end loop;

  return v_folio;
end;
$$;

comment on function public.registrar_practica(bigint, bigint, bigint, bigint, date, jsonb, text) is
  'Registra una practica completa en una transaccion y devuelve su folio. El metodo de control lo deriva de la clasificacion del articulo: lo que mande el cliente se ignora.';

revoke all on function public.registrar_practica(
  bigint, bigint, bigint, bigint, date, jsonb, text) from public, anon;
grant execute on function public.registrar_practica(
  bigint, bigint, bigint, bigint, date, jsonb, text) to authenticated;


-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
-- Nota de rendimiento: toda llamada a funcion va envuelta en (select ...). Sin
-- eso Postgres la evalua una vez POR FILA en vez de una vez por sentencia.
alter table public.practica_elemento_observacion enable row level security;
alter table public.practica_borrador            enable row level security;

revoke all on public.practica_elemento_observacion,
              public.practica_borrador from anon;

-- Calcado de practica_observacion: la politica va contra el elemento padre.
create policy practica_elemento_observacion_lectura
  on public.practica_elemento_observacion
  for select to authenticated using (true);

-- `puede_escribir()` va PRIMERO y no solo el almacen. Es el mismo hueco A que
-- cerro la migracion del 21 de agosto en existencia, ubicacion y movimiento: un
-- usuario de rol `consulta` al que se le asigne un almacen -algo natural, para
-- que su pantalla arranque filtrada- quedaria con permiso de escritura. Hoy no
-- se nota porque lectura@ tiene almacen_id nulo y `NULL = 1` es falso; el hueco
-- espera a que alguien le asigne uno.
create policy practica_elemento_observacion_escritura
  on public.practica_elemento_observacion
  for all to authenticated
  using ((select private.puede_escribir())
         and exists (select 1 from public.practica_elemento e
                      where e.id = practica_elemento_id
                        and ((select private.es_admin())
                             or e.almacen_id = (select private.almacen_actual()))))
  with check ((select private.puede_escribir())
              and exists (select 1 from public.practica_elemento e
                           where e.id = practica_elemento_id
                             and ((select private.es_admin())
                                  or e.almacen_id = (select private.almacen_actual()))));

-- Y su gemela vieja, que se le escapo al barrido del 21 de agosto por la misma
-- razon por la que este archivo casi la repite: `practica_observacion` no la
-- lee nadie todavia, asi que nadie la miro. Se aprieta aqui, mientras se tiene
-- el contexto delante, en vez de heredarle el hueco al siguiente. Apretar una
-- politica sobre una tabla sin uso no rompe nada, y `puede_escribir()` es
-- cierto para admin y responsable: a quien ya podia no le quita nada.
alter policy practica_observacion_escritura on public.practica_observacion
  using ((select private.puede_escribir())
         and exists (select 1 from public.practica p
                      where p.id = practica_id
                        and ((select private.es_admin())
                             or p.almacen_id = (select private.almacen_actual()))))
  with check ((select private.puede_escribir())
              and exists (select 1 from public.practica p
                           where p.id = practica_id
                             and ((select private.es_admin())
                                  or p.almacen_id = (select private.almacen_actual()))));

-- El borrador es de quien lo escribe, y de nadie mas. SIN politica de admin, y
-- es deliberado: un admin no tiene por que leer la captura a medio hacer de un
-- responsable. No es un dato del sistema, es su hoja de trabajo. Lo que el
-- admin si ve -y corrige- es la practica ya finalizada.
create policy practica_borrador_propio on public.practica_borrador
  for all to authenticated
  using      (usuario_id = (select auth.uid()))
  with check (usuario_id = (select auth.uid()));
