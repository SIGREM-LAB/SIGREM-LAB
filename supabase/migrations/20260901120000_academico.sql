-- El plan academico: que asignaturas lleva cada programa, en que semestre, y
-- que practicas define el plan de estudios para cada asignatura.
--
-- Diseno: docs/specs/2026-09-01-panel-academico-design.md
--
-- La frontera con la tabla `practica`, que es lo que mas facil se enreda:
--   practica_catalogo  responde QUE PRACTICAS EXISTEN. Lo carga el admin.
--   practica           responde QUE PASO. La registra el responsable, y sus
--                      triggers descuentan existencias.
-- La primera es del plan de estudios; la segunda es un hecho ocurrido. Por eso
-- `practica` no se renombra pese a que el nombre corto le pega mejor a la otra:
-- arrastraria movimiento.practica_id, practica_elemento, practica_observacion,
-- dos triggers, el generador de folios y cinco politicas.

-- ---------------------------------------------------------------------------
-- La tabla puente, y por que el semestre vive aqui
-- ---------------------------------------------------------------------------
-- "Bioquimica" es 2do en un programa, 6to en otro y 3ro en un tercero. Una
-- columna `semestre` en `asignatura` no tendria un valor correcto que poner: el
-- semestre no es un atributo de la asignatura, es de la pareja.
--
-- Asi ademas se respeta lo que el esquema ya habia decidido en
-- 20260818120400_practica.sql: la asignatura existe una sola vez, y forzar el
-- vinculo obligaria a duplicarla una vez por programa.
create table public.programa_asignatura (
  programa_educativo_id bigint not null
    references public.programa_educativo (id) on delete cascade,
  asignatura_id         bigint not null
    references public.asignatura (id) on delete cascade,

  -- Nullable a proposito: el catalogo del prototipo trae "Optativa" como
  -- semestre de Biologia Marina y Biotecnologia. No es un numero, y forzar uno
  -- obligaria a inventarlo. NULL = optativa.
  semestre              smallint,

  primary key (programa_educativo_id, asignatura_id),
  constraint programa_asignatura_semestre_valido
    check (semestre is null or semestre between 1 and 12)
);

create index programa_asignatura_asignatura_idx
  on public.programa_asignatura (asignatura_id);

comment on table public.programa_asignatura is
  'Que asignaturas lleva cada programa y en que semestre. El semestre vive aqui y no en asignatura porque depende de la pareja.';


-- ---------------------------------------------------------------------------
-- Se migra lo que hubiera, y despues se tira la columna
-- ---------------------------------------------------------------------------
-- Al 1 de septiembre `asignatura` esta vacia y ningun codigo de src/ ni de etl/
-- la lee, pero una migracion no puede asumirlo. El semestre entra nulo porque
-- ese dato nunca existio: no hay de donde sacarlo.
insert into public.programa_asignatura (programa_educativo_id, asignatura_id, semestre)
select programa_educativo_id, id, null
  from public.asignatura
 where programa_educativo_id is not null;

-- Se lleva por delante el unique (programa_educativo_id, nombre) y el indice
-- asignatura_programa_idx, que dependen de ella.
alter table public.asignatura drop column programa_educativo_id;

-- El unico va sobre norm_texto y no sobre nombre: sin esto "Bioquimica" y
-- "Bioquimica" con acento son dos asignaturas, y a las tres semanas hay cuatro.
-- norm_texto es immutable —por eso base.sql la declaro con el diccionario
-- explicito— asi que se puede indexar.
create unique index asignatura_nombre_norm_idx
  on public.asignatura (public.norm_texto(nombre));


-- ---------------------------------------------------------------------------
-- El catalogo de practicas
-- ---------------------------------------------------------------------------
-- Solo identidad: numero, nombre y de que asignatura es. Sin receta de
-- materiales a proposito. Una receta cambia cada semestre, y el dia que el
-- formulario de registro llega precargado con cantidades viejas el responsable
-- corrige a mano y deja de confiar en lo precargado.
create table public.practica_catalogo (
  id            bigint generated always as identity primary key,
  asignatura_id bigint   not null references public.asignatura (id),
  numero        smallint not null,
  nombre        text     not null,
  activo        boolean  not null default true,
  creado_en     timestamptz not null default now(),

  unique (asignatura_id, numero),

  -- Llave candidata redundante con la PK a primera vista. Es lo que permite la
  -- FK compuesta de practica: sin ella no hay forma declarativa de exigir que
  -- la practica elegida sea de la asignatura elegida. Mismo truco que
  -- laboratorio.unique (id, almacen_id).
  unique (id, asignatura_id)
);

create index practica_catalogo_asignatura_idx
  on public.practica_catalogo (asignatura_id);

-- Sin `on delete cascade` en asignatura_id: retirar una practica es
-- activo = false, igual que en almacen, laboratorio y motivo_observacion.

comment on table public.practica_catalogo is
  'Las practicas que define el plan de estudios. No confundir con practica, que es una sesion ya ocurrida que descuenta existencias.';


-- ---------------------------------------------------------------------------
-- Los dos enganches con practica
-- ---------------------------------------------------------------------------
alter table public.practica
  add column practica_catalogo_id bigint references public.practica_catalogo (id);

create index practica_catalogo_id_idx on public.practica (practica_catalogo_id);

-- Las dos son FK compuestas con MATCH SIMPLE, que es el default: si
-- asignatura_id es NULL la restriccion se satisface sin verificar nada. Eso es
-- exactamente lo que hace falta, porque practica.asignatura_id es nullable y
-- debe seguir siendolo; pero en cuanto se llena, la base garantiza que la
-- combinacion es real.
--
-- NO cambiar a MATCH FULL: romperia el registro de practicas sin asignatura, y
-- lo haria en silencio. Hay una prueba en esquema.test.sql que lo vigila.
alter table public.practica
  add constraint practica_pareja_valida
  foreign key (programa_educativo_id, asignatura_id)
  references public.programa_asignatura (programa_educativo_id, asignatura_id);

alter table public.practica
  add constraint practica_catalogo_coincide
  foreign key (practica_catalogo_id, asignatura_id)
  references public.practica_catalogo (id, asignatura_id);


-- ---------------------------------------------------------------------------
-- vincular_asignatura: dos inserts que tienen que ser uno
-- ---------------------------------------------------------------------------
-- Crear una asignatura nueva son dos escrituras —la fila y el vinculo— y desde
-- el cliente no son atomicas: si la segunda falla queda una asignatura
-- huerfana flotando en el autocompletar de "vincular".
--
-- security invoker y no definer: la funcion no le presta a nadie privilegios
-- que no tenga. La RLS de asignatura y de programa_asignatura sigue mandando, y
-- un responsable que la llame recibe 42501. Mismo criterio que
-- resolver_pendiente.
create or replace function public.vincular_asignatura(
  p_programa bigint,
  p_nombre   text,
  p_semestre smallint default null
)
returns bigint
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_nombre     text := btrim(p_nombre);
  v_asignatura bigint;
begin
  if v_nombre is null or v_nombre = '' then
    raise exception 'La asignatura necesita nombre';
  end if;

  -- Busca por la forma normalizada, que es la que el indice unico protege.
  -- Capturar "Bioquimica" cuando ya existe "Bioquimica" con acento reusa la que
  -- hay en vez de chocar contra el indice: es la razon principal de que esto
  -- sea una funcion y no dos llamadas desde el cliente.
  select id into v_asignatura
    from public.asignatura
   where public.norm_texto(nombre) = public.norm_texto(v_nombre);

  if v_asignatura is null then
    insert into public.asignatura (nombre) values (v_nombre)
    returning id into v_asignatura;
  end if;

  insert into public.programa_asignatura (programa_educativo_id, asignatura_id, semestre)
  values (p_programa, v_asignatura, p_semestre);

  return v_asignatura;
end;
$$;

comment on function public.vincular_asignatura(bigint, text, smallint) is
  'Crea la asignatura si no existe y la vincula al programa, en una sola transaccion. Busca por norm_texto para no duplicar por acentos.';

-- El `alter default privileges` de la migracion de grants cubre tablas, no
-- funciones, y una funcion nueva es ejecutable por PUBLIC salvo que se revoque.
revoke all on function public.vincular_asignatura(bigint, text, smallint)
  from public, anon;
grant execute on function public.vincular_asignatura(bigint, text, smallint)
  to authenticated;


-- ---------------------------------------------------------------------------
-- RLS: catalogo cerrado, todos leen y solo el admin escribe
-- ---------------------------------------------------------------------------
-- Ninguna de las dos lleva almacen_id, y es deliberado. El plan de estudios no
-- pertenece a un almacen: la misma "Quimica Analitica, 3ro" la surten N3 y N4
-- segun donde se de la clase. Desnormalizar un almacen aqui inventaria una
-- pertenencia que no existe, y rompería el caso real de una asignatura que
-- consume de dos almacenes.
--
-- La lectura abierta a todo authenticated es lo que hara funcionar la pantalla
-- de registro de practicas: si un responsable no pudiera leer el catalogo, sus
-- tres selects saldrian vacios. Mismo razonamiento que campo_capturable.
alter table public.programa_asignatura enable row level security;
alter table public.practica_catalogo   enable row level security;

create policy programa_asignatura_lectura on public.programa_asignatura
  for select to authenticated using (true);
create policy programa_asignatura_admin on public.programa_asignatura
  for all to authenticated
  using ((select private.es_admin())) with check ((select private.es_admin()));

create policy practica_catalogo_lectura on public.practica_catalogo
  for select to authenticated using (true);
create policy practica_catalogo_admin on public.practica_catalogo
  for all to authenticated
  using ((select private.es_admin())) with check ((select private.es_admin()));

revoke all on public.programa_asignatura, public.practica_catalogo from anon;
