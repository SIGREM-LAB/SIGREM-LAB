-- Perfiles de captura: que campos aplican a cada (almacen x tipo).
--
-- El problema que resuelve: el mismo tipo de cosa se captura distinto segun el
-- almacen. LUM y N3 pesan los frascos de reactivo y derivan la cantidad;
-- N4 la captura directa. LE navega por familia y coordenadas H/V/I; los demas
-- por anaquel. Los equipos de LUM llevan mantenimiento y fecha de chequeo;
-- los de LE llevan numero de serie y numero de inventario institucional.
--
-- Meter esas reglas en condicionales de React las pudre: agregar un almacen o
-- mover un campo obligaria a tocar y redesplegar el frontend. Aqui son datos.
--
-- Ademas cierra una fuga por construccion: si el formulario arma su payload
-- desde la lista de campos del perfil, un campo fuera del perfil sencillamente
-- no existe en el envio. No hay nada que ocultar mal.

-- ---------------------------------------------------------------------------
-- Vocabulario: que campos existen y como se pintan
-- ---------------------------------------------------------------------------
create table public.campo_capturable (
  campo            text primary key,
  etiqueta_default text not null,
  tipo_dato        text not null
                   check (tipo_dato in ('texto','numero','fecha','booleano','seleccion')),
  -- Donde aterriza el valor. Lo usan por igual el formulario y el ETL.
  destino          text not null,
  opciones         text[],
  ayuda            text,

  constraint campo_seleccion_con_opciones
    check (tipo_dato <> 'seleccion' or opciones is not null)
);

comment on table public.campo_capturable is
  'Catalogo cerrado de campos. Evita que un perfil declare un campo que no existe.';


-- ---------------------------------------------------------------------------
-- El perfil
-- ---------------------------------------------------------------------------
-- Un perfil vigente por (almacen x clasificacion). Los layouts historicos
-- (N3 tiene dos hojas de reactivos con columnas distintas) son un asunto del
-- ETL que lee archivos viejos, no del formulario del dia a dia.
create table public.perfil_captura (
  id            bigint generated always as identity primary key,
  almacen_id    bigint not null references public.almacen (id),
  clasificacion public.clasificacion_articulo not null,
  nombre        text   not null,
  notas         text,
  unique (almacen_id, clasificacion)
);

create index perfil_captura_almacen_id_idx on public.perfil_captura (almacen_id);


create table public.perfil_campo (
  perfil_id   bigint  not null references public.perfil_captura (id) on delete cascade,
  campo       text    not null references public.campo_capturable (campo),
  etiqueta    text,              -- null = usar etiqueta_default
  obligatorio boolean not null default false,
  orden       integer not null,
  primary key (perfil_id, campo)
);

create index perfil_campo_campo_idx on public.perfil_campo (campo);


-- ---------------------------------------------------------------------------
-- Lo que consume el formulario
-- ---------------------------------------------------------------------------
create or replace function public.formulario(
  p_almacen       bigint,
  p_clasificacion public.clasificacion_articulo
)
returns table (
  campo       text,
  etiqueta    text,
  tipo_dato   text,
  destino     text,
  opciones    text[],
  ayuda       text,
  obligatorio boolean,
  orden       integer
)
language sql
stable
set search_path = ''
as $$
  select pc.campo,
         coalesce(pc.etiqueta, cc.etiqueta_default),
         cc.tipo_dato,
         cc.destino,
         cc.opciones,
         cc.ayuda,
         pc.obligatorio,
         pc.orden
  from public.perfil_captura p
  join public.perfil_campo   pc on pc.perfil_id = p.id
  join public.campo_capturable cc on cc.campo = pc.campo
  where p.almacen_id = p_almacen
    and p.clasificacion = p_clasificacion
  order by pc.orden
$$;

comment on function public.formulario(bigint, public.clasificacion_articulo) is
  'Devuelve los campos del alta para un almacen y tipo. El frontend pinta esto, no lo decide.';


-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.campo_capturable enable row level security;
alter table public.perfil_captura   enable row level security;
alter table public.perfil_campo     enable row level security;

revoke all on public.campo_capturable, public.perfil_captura, public.perfil_campo from anon;

-- Todos leen: el formulario necesita el perfil para armarse.
create policy campo_capturable_lectura on public.campo_capturable
  for select to authenticated using (true);
create policy perfil_captura_lectura on public.perfil_captura
  for select to authenticated using (true);
create policy perfil_campo_lectura on public.perfil_campo
  for select to authenticated using (true);

-- Cambiar la forma de un formulario afecta a todo un almacen: solo admin.
create policy campo_capturable_admin on public.campo_capturable
  for all to authenticated
  using ((select private.es_admin())) with check ((select private.es_admin()));
create policy perfil_captura_admin on public.perfil_captura
  for all to authenticated
  using ((select private.es_admin())) with check ((select private.es_admin()));
create policy perfil_campo_admin on public.perfil_campo
  for all to authenticated
  using ((select private.es_admin())) with check ((select private.es_admin()));
