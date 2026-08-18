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
-- Un perfil vigente por clasificacion, con la opcion de sobreescribirlo en un
-- almacen concreto. Los layouts historicos son un asunto del ETL que lee
-- archivos viejos, no del formulario del dia a dia.
create table public.perfil_captura (
  id            bigint generated always as identity primary key,

  -- NULL = perfil default, aplica a todos los almacenes. Una fila con almacen
  -- lo sobreescribe. Como el formato ya esta unificado, esto son 6 perfiles en
  -- el seed en vez de 24, y dar de alta un quinto almacen no requiere ni una
  -- fila. El mecanismo por almacen se conserva para el dia que uno diverja.
  almacen_id    bigint references public.almacen (id),

  clasificacion public.clasificacion_articulo not null,
  nombre        text   not null,
  notas         text,
  unique nulls not distinct (almacen_id, clasificacion)
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
  -- Un perfil del almacen gana sobre el default (almacen_id nulo). `nulls last`
  -- es lo que impone esa precedencia: el especifico ordena primero.
  with elegido as (
    select id
      from public.perfil_captura
     where clasificacion = p_clasificacion
       and (almacen_id = p_almacen or almacen_id is null)
     order by almacen_id nulls last
     limit 1
  )
  select pc.campo,
         coalesce(pc.etiqueta, cc.etiqueta_default),
         cc.tipo_dato,
         cc.destino,
         cc.opciones,
         cc.ayuda,
         pc.obligatorio,
         pc.orden
    from elegido e
    join public.perfil_campo     pc on pc.perfil_id = e.id
    join public.campo_capturable cc on cc.campo = pc.campo
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

revoke all on public.campo_capturable, public.perfil_captura,
              public.perfil_campo from anon;
