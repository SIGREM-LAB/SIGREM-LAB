-- Organizacion: almacenes, laboratorios derivados, perfiles de usuario
-- y los helpers que usan todas las politicas de RLS.

-- ---------------------------------------------------------------------------
-- Almacen: guarda el stock y es el ancla de los permisos de escritura.
-- Son cuatro: N3, N4, LUM, LE.
-- ---------------------------------------------------------------------------
create table public.almacen (
  id        bigint generated always as identity primary key,
  clave     text        not null unique,
  nombre    text        not null,
  activo    boolean     not null default true,
  creado_en timestamptz not null default now()
);

comment on table public.almacen is
  'Los 4 almacenes que guardan existencias. No confundir con laboratorio.';


-- ---------------------------------------------------------------------------
-- Laboratorio: donde se dan las practicas. Consume de un almacen pero no
-- guarda existencias propias. Analisis Sensorial es uno de estos, bajo N4.
-- ---------------------------------------------------------------------------
create table public.laboratorio (
  id         bigint generated always as identity primary key,
  almacen_id bigint  not null references public.almacen (id),
  nombre     text    not null,
  activo     boolean not null default true,
  unique (almacen_id, nombre)
);

create index laboratorio_almacen_id_idx on public.laboratorio (almacen_id);


-- ---------------------------------------------------------------------------
-- Perfil: extiende auth.users con rol y almacen.
-- ---------------------------------------------------------------------------
create table public.perfil (
  id         uuid primary key references auth.users (id) on delete cascade,
  nombre     text              not null,
  almacen_id bigint            references public.almacen (id),
  rol        public.rol_usuario not null default 'consulta',
  creado_en  timestamptz       not null default now(),

  -- Un responsable sin almacen no podria escribir en ningun lado: es un
  -- estado sin sentido, mejor imposible que silencioso.
  constraint perfil_responsable_con_almacen
    check (rol <> 'responsable' or almacen_id is not null)
);

create index perfil_almacen_id_idx on public.perfil (almacen_id);


-- ---------------------------------------------------------------------------
-- Helpers de RLS
-- ---------------------------------------------------------------------------
-- Sin estos, cada politica haria una subconsulta a perfil POR CADA FILA
-- evaluada. Marcadas `stable`, Postgres las evalua una vez por sentencia.
--
-- Son `security definer` porque necesitan leer perfil sin que la RLS de perfil
-- se aplique recursivamente. Solo leen el renglon del propio usuario que llama,
-- asi que no exponen datos de nadie mas.

create or replace function private.almacen_actual()
returns bigint
language sql
stable
security definer
set search_path = ''
as $$
  select almacen_id from public.perfil where id = (select auth.uid())
$$;

create or replace function private.rol_actual()
returns public.rol_usuario
language sql
stable
security definer
set search_path = ''
as $$
  select rol from public.perfil where id = (select auth.uid())
$$;

create or replace function private.es_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select rol = 'admin' from public.perfil where id = (select auth.uid())),
    false
  )
$$;

create or replace function private.puede_escribir()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select rol in ('admin', 'responsable') from public.perfil
      where id = (select auth.uid())),
    false
  )
$$;

-- PostgREST solo expone `public`, pero lo dejamos explicito.
grant usage on schema private to authenticated;
grant execute on function private.almacen_actual()  to authenticated;
grant execute on function private.rol_actual()      to authenticated;
grant execute on function private.es_admin()        to authenticated;
grant execute on function private.puede_escribir()  to authenticated;

revoke all on schema private from anon, public;
