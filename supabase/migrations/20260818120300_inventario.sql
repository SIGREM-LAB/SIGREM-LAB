-- Inventario: ubicaciones, cargas, existencias y la bitacora de movimientos.
--
-- Diseno: docs/specs/2026-08-18-depuracion-esquema-formato-unificado-design.md
--
-- Orden de creacion: ubicacion -> carga -> existencia -> estado_calculado ->
-- triggers -> movimiento. `carga` va antes de `existencia` por la FK.

-- ---------------------------------------------------------------------------
-- Ubicacion
-- ---------------------------------------------------------------------------
-- El formato unificado pide la ubicacion en columnas separadas (regla 5):
-- sub-ubicacion, mueble, repisa y fila o cajon; Electronica agrega la posicion
-- dentro del mueble en horizontal, vertical e interior.
--
-- Una etiqueta legible para mostrar y buscar, y las partes estructuradas en
-- jsonb para filtrar. Las llaves son las columnas del formato:
--   {"sub_ubicacion":"LUM-2","mueble":"Anaquel 4","repisa":"2",
--    "fila_cajon":"3","h":"2","v":"4","i":"1"}
--
-- No hay llave `anaquel`: el formato unifico a Mueble, y "Anaquel 2" es un
-- VALOR de mueble, igual que "Gabinete 301", "Refrigerador" o "Separador 3".
create table public.ubicacion (
  id          bigint generated always as identity primary key,
  almacen_id  bigint not null references public.almacen (id),
  etiqueta    text   not null,
  componentes jsonb  not null default '{}'::jsonb,
  unique (almacen_id, etiqueta),

  -- Llave candidata para la FK compuesta de existencia.
  unique (id, almacen_id)
);

create index ubicacion_almacen_id_idx  on public.ubicacion (almacen_id);
create index ubicacion_componentes_idx on public.ubicacion using gin (componentes);


-- ---------------------------------------------------------------------------
-- Carga: de que archivo salio cada renglon
-- ---------------------------------------------------------------------------
-- Cada hoja del formato trae Almacen / Responsable / Periodo / Actualizado el
-- en el encabezado, y hasta ahora eso se tiraba. Una fila por archivo cargado:
-- es lo que contesta "este numero salio de tal archivo, entregado tal dia, por
-- tal persona" cuando alguien lo reclame.
create table public.carga (
  id             bigint generated always as identity primary key,
  almacen_id     bigint not null references public.almacen (id),
  archivo        text   not null,
  hoja           text   not null,
  periodo        text,
  actualizado_el date,
  responsable    text,
  filas          integer,
  cargado_por    uuid references public.perfil (id),
  cargado_en     timestamptz not null default now()
);

create index carga_almacen_id_idx  on public.carga (almacen_id);
create index carga_cargado_por_idx on public.carga (cargado_por);


-- ---------------------------------------------------------------------------
-- Existencia: donde esta y cuanto hay
-- ---------------------------------------------------------------------------
create table public.existencia (
  id                     bigint generated always as identity primary key,
  articulo_id            bigint not null references public.articulo (id),
  almacen_id             bigint not null references public.almacen (id),
  ubicacion_id           bigint,
  laboratorio_id         bigint,
  carga_id               bigint references public.carga (id),

  -- Lo que se imprime en la etiqueta QR. Se pega a la existencia, no al
  -- articulo: etiquetas el frasco fisico, no el concepto.
  codigo                 text unique,

  marca                  text,
  modelo                 text,
  presentacion           text,

  -- Nunca se escribe directo: la mantiene el trigger desde movimiento.
  cantidad               numeric(14,4) not null default 0,
  cantidad_minima        numeric(14,4),

  -- Reactivos que se pesan (LUM y N3). Regla 13: el vacio va ANTES que el
  -- lleno. N3 y LUM los tenian invertidos entre si, y juntar los archivos sin
  -- un orden acordado dejaba la mitad de los pesos al reves sin que se notara.
  -- N4 captura la cantidad directa y deja estos dos nulos.
  peso_frasco_vacio      numeric(14,4),
  peso_total             numeric(14,4),

  -- Equipos
  numero_serie           text,
  numero_inventario_uaeh text,
  funcionamiento         public.funcionamiento_equipo,
  mantenimiento          text,
  fecha_chequeo          date,

  -- Materia biologica
  metodo_conservacion    text,
  temperatura            text,   -- "4 grados C", "Ambiente": condicion, no medicion
  fecha_recoleccion      date,
  fecha_preparacion      date,
  responsable_muestra    text,

  -- No vienen en el formato: se capturan en la app. La caducidad es
  -- informativa y NUNCA toca el estado (decisiones D2 y D5 del spec): hay
  -- reactivos caducados hace anios que siguen sirviendo y se usan en practicas.
  fecha_adquisicion      date,
  fecha_caducidad        date,

  estado                 public.estado_existencia not null default 'disponible',
  observaciones          text,
  creado_en              timestamptz not null default now(),

  constraint existencia_cantidad_no_negativa check (cantidad >= 0),
  constraint existencia_minimo_no_negativo
    check (cantidad_minima is null or cantidad_minima >= 0),
  constraint existencia_caducidad_posterior
    check (fecha_caducidad is null
           or fecha_adquisicion is null
           or fecha_caducidad >= fecha_adquisicion),

  -- El trigger genera el codigo, asi que la columna no puede ser NOT NULL;
  -- el check lo exige despues de que el trigger corrio.
  constraint existencia_codigo_presente check (codigo is not null),

  -- Sin esto, nada impide que una existencia de N3 apunte a un anaquel o a un
  -- laboratorio de N4. Con la FK compuesta es imposible por construccion, sin
  -- triggers ni validacion en la app.
  foreign key (ubicacion_id,   almacen_id) references public.ubicacion   (id, almacen_id),
  foreign key (laboratorio_id, almacen_id) references public.laboratorio (id, almacen_id)
);

create index existencia_articulo_id_idx  on public.existencia (articulo_id);
create index existencia_almacen_id_idx   on public.existencia (almacen_id);
create index existencia_ubicacion_id_idx on public.existencia (ubicacion_id);
create index existencia_carga_id_idx     on public.existencia (carga_id);

create index existencia_laboratorio_idx on public.existencia (laboratorio_id)
  where laboratorio_id is not null;

-- Regla 10 del formato: la serie y el numero de inventario no se repiten entre
-- renglones. Hoy en N4 tres numeros de serie se repiten en 30 equipos y nada lo
-- impide. Parciales porque el ETL normaliza 'Sin serie', 'Sin inventario' y '-'
-- a NULL, y hacen falta tantos NULL como equipos sin identificar haya.
create unique index existencia_numero_serie_uniq
  on public.existencia (numero_serie) where numero_serie is not null;
create unique index existencia_numero_inventario_uniq
  on public.existencia (numero_inventario_uaeh) where numero_inventario_uaeh is not null;

-- "?Que hay que reponer en mi almacen?" es la consulta del dia a dia, y solo
-- interesan unas pocas filas: indice parcial en vez de indice completo.
create index existencia_por_atender_idx on public.existencia (almacen_id, estado)
  where estado in ('stock_bajo', 'agotado');

create index existencia_caducidad_idx on public.existencia (fecha_caducidad)
  where fecha_caducidad is not null;

comment on column public.existencia.peso_total is
  'Peso del frasco lleno. Solo lo capturan LUM y N3; la cantidad se deriva de peso_total - peso_frasco_vacio.';
comment on column public.existencia.fecha_caducidad is
  'Informativa. NO entra en el calculo del estado: hay reactivos caducados que siguen sirviendo.';


-- ---------------------------------------------------------------------------
-- Estado calculado, en un solo lugar
-- ---------------------------------------------------------------------------
-- Vivia dentro del trigger de movimiento, y eso dejaba un hueco: una existencia
-- insertada con cantidad 0 (regla 6: celda vacia significa cero) se quedaba en
-- 'disponible' porque ningun movimiento habia corrido. Extraida, la usan los
-- dos triggers.
--
-- Nota que `fecha_caducidad` NO aparece aqui. Es deliberado.
create or replace function private.estado_calculado(
  p_cantidad numeric,
  p_minimo   numeric,
  p_estado   public.estado_existencia
) returns public.estado_existencia
language sql
immutable
parallel safe
set search_path = ''
as $$
  select case
    -- Un estado puesto a mano manda sobre el calculado.
    when p_estado in ('contaminado','mantenimiento','baja') then p_estado
    when p_cantidad = 0 then 'agotado'::public.estado_existencia
    when p_minimo is not null and p_cantidad <= p_minimo
      then 'stock_bajo'::public.estado_existencia
    else 'disponible'::public.estado_existencia
  end
$$;


-- ---------------------------------------------------------------------------
-- Codigo por almacen: N3-00042
-- ---------------------------------------------------------------------------
create table private.folio_almacen (
  almacen_id bigint primary key references public.almacen (id),
  ultimo     integer not null default 0
);

create or replace function private.asignar_codigo()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  consecutivo integer;
  clave_alm   text;
begin
  if new.codigo is null or new.codigo = '' then
    -- insert ... on conflict do update ... returning es lo que evita que dos
    -- altas simultaneas saquen el mismo folio.
    insert into private.folio_almacen (almacen_id, ultimo)
    values (new.almacen_id, 1)
    on conflict (almacen_id) do update set ultimo = private.folio_almacen.ultimo + 1
    returning ultimo into consecutivo;

    select clave into clave_alm from public.almacen where id = new.almacen_id;
    new.codigo := clave_alm || '-' || lpad(consecutivo::text, 5, '0');
  end if;

  new.estado := private.estado_calculado(new.cantidad, new.cantidad_minima, new.estado);
  return new;
end;
$$;

create trigger existencia_asigna_codigo
  before insert on public.existencia
  for each row execute function private.asignar_codigo();


-- ---------------------------------------------------------------------------
-- Movimiento: la bitacora
-- ---------------------------------------------------------------------------
-- Es de SOLO INSERCION. Un error no se corrige borrando historia sino
-- insertando un movimiento de ajuste.
create table public.movimiento (
  id               bigint generated always as identity primary key,
  existencia_id    bigint not null references public.existencia (id),

  -- Desnormalizado a proposito: permite que la politica de RLS se evalue sin
  -- un join a existencia. Lo escribe el trigger, NO el cliente: si el cliente
  -- lo mandara, podria falsearlo para escribir en el almacen de otro.
  almacen_id       bigint not null references public.almacen (id),

  tipo             public.tipo_movimiento not null,
  cantidad         numeric(14,4) not null,   -- con signo
  cantidad_antes   numeric(14,4) not null,
  cantidad_despues numeric(14,4) not null,

  -- La FK a practica no se puede declarar aqui: practica_elemento referencia
  -- existencia, asi que practica.sql va despues. Se agrega alla.
  practica_id      bigint,

  usuario_id       uuid not null references public.perfil (id),
  motivo           text,
  ocurrido_en      timestamptz not null default now(),

  constraint movimiento_cantidad_no_cero check (cantidad <> 0)
);

create index movimiento_existencia_id_idx on public.movimiento (existencia_id);
create index movimiento_usuario_id_idx    on public.movimiento (usuario_id);
create index movimiento_practica_id_idx   on public.movimiento (practica_id)
  where practica_id is not null;

-- Los reportes filtran por almacen y rango de fechas.
create index movimiento_almacen_fecha_idx on public.movimiento (almacen_id, ocurrido_en desc);


-- ---------------------------------------------------------------------------
-- Aplicar el movimiento al saldo
-- ---------------------------------------------------------------------------
create or replace function private.aplicar_movimiento()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  saldo   numeric(14,4);
  minimo  numeric(14,4);
  alm     bigint;
  edo     public.estado_existencia;
  nuevo   numeric(14,4);
begin
  -- `for update` bloquea la fila: sin esto, dos movimientos simultaneos leen
  -- el mismo saldo y uno de los dos se pierde.
  select cantidad, cantidad_minima, almacen_id, estado
    into saldo, minimo, alm, edo
    from public.existencia
   where id = new.existencia_id
     for update;

  if not found then
    raise exception 'La existencia % no existe', new.existencia_id;
  end if;

  nuevo := saldo + new.cantidad;

  if nuevo < 0 then
    raise exception
      'El movimiento dejaria la existencia % en %; la cantidad no puede ser negativa',
      new.existencia_id, nuevo;
  end if;

  -- Los tres campos que el cliente NO decide.
  new.almacen_id       := alm;
  new.cantidad_antes   := saldo;
  new.cantidad_despues := nuevo;
  new.usuario_id       := coalesce(new.usuario_id, (select auth.uid()));

  update public.existencia
     set cantidad = nuevo,
         estado   = private.estado_calculado(nuevo, minimo, edo)
   where id = new.existencia_id;

  return new;
end;
$$;

-- BEFORE: necesita escribir en NEW antes de que la fila se inserte, y antes de
-- que se evalue el WITH CHECK de la RLS sobre almacen_id.
create trigger movimiento_aplica_saldo
  before insert on public.movimiento
  for each row execute function private.aplicar_movimiento();


-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.ubicacion  enable row level security;
alter table public.carga      enable row level security;
alter table public.existencia enable row level security;
alter table public.movimiento enable row level security;

revoke all on public.ubicacion, public.carga,
              public.existencia, public.movimiento from anon;

grant execute on function private.estado_calculado(
  numeric, numeric, public.estado_existencia) to authenticated;
