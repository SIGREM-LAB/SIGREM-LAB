-- Inventario: ubicaciones, existencias y la bitacora de movimientos.

-- ---------------------------------------------------------------------------
-- Ubicacion
-- ---------------------------------------------------------------------------
-- Cada almacen habla un idioma distinto: reactivos usa anaquel/repisa/fila,
-- N3 usa "Gabinete 301", N4 usa "410", LE usa "Separador 1" mas coordenadas
-- H/V/I. En vez de cuatro tablas o una con ocho columnas medio vacias:
-- una etiqueta legible para mostrar y buscar, y las partes estructuradas en
-- jsonb para filtrar cuando haga falta.
create table public.ubicacion (
  id          bigint generated always as identity primary key,
  almacen_id  bigint not null references public.almacen (id),
  etiqueta    text   not null,
  componentes jsonb  not null default '{}'::jsonb,
  unique (almacen_id, etiqueta)
);

create index ubicacion_almacen_id_idx  on public.ubicacion (almacen_id);
create index ubicacion_componentes_idx on public.ubicacion using gin (componentes);


-- ---------------------------------------------------------------------------
-- Existencia: donde esta y cuanto hay
-- ---------------------------------------------------------------------------
create table public.existencia (
  id                     bigint generated always as identity primary key,
  articulo_id            bigint not null references public.articulo (id),
  almacen_id             bigint not null references public.almacen (id),
  ubicacion_id           bigint references public.ubicacion (id),

  -- Lo que se imprime en la etiqueta QR. Se pega a la existencia, no al
  -- articulo: etiquetas el frasco fisico, no el concepto.
  codigo                 text not null unique,

  marca                  text,
  presentacion           text,

  -- Nunca se escribe directo: la mantiene el trigger desde movimiento.
  cantidad               numeric(14,4) not null default 0,
  cantidad_minima        numeric(14,4),

  numero_serie           text,
  numero_inventario_uaeh text,
  fecha_adquisicion      date,
  fecha_caducidad        date,

  -- Arranca en por_confirmar: migrada del Excel, sin conteo fisico. El primer
  -- ajuste_conteo la mueve a un estado real.
  estado                 public.estado_existencia not null default 'por_confirmar',
  creado_en              timestamptz not null default now(),

  constraint existencia_cantidad_no_negativa check (cantidad >= 0),
  constraint existencia_minimo_no_negativo
    check (cantidad_minima is null or cantidad_minima >= 0),
  constraint existencia_caducidad_posterior
    check (fecha_caducidad is null
           or fecha_adquisicion is null
           or fecha_caducidad >= fecha_adquisicion)
);

create index existencia_articulo_id_idx  on public.existencia (articulo_id);
create index existencia_almacen_id_idx   on public.existencia (almacen_id);
create index existencia_ubicacion_id_idx on public.existencia (ubicacion_id);

-- "?Que hay que reponer en mi almacen?" es la consulta del dia a dia, y solo
-- interesan unas pocas filas: indice parcial en vez de indice completo.
create index existencia_por_atender_idx on public.existencia (almacen_id, estado)
  where estado in ('por_confirmar', 'stock_bajo', 'agotado');

create index existencia_caducidad_idx on public.existencia (fecha_caducidad)
  where fecha_caducidad is not null;

create index existencia_num_inventario_idx on public.existencia (numero_inventario_uaeh)
  where numero_inventario_uaeh is not null;


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
  if new.codigo is not null and new.codigo <> '' then
    return new;   -- el ETL puede traer su propio codigo
  end if;

  insert into private.folio_almacen (almacen_id, ultimo)
  values (new.almacen_id, 1)
  on conflict (almacen_id) do update set ultimo = private.folio_almacen.ultimo + 1
  returning ultimo into consecutivo;

  select clave into clave_alm from public.almacen where id = new.almacen_id;

  new.codigo := clave_alm || '-' || lpad(consecutivo::text, 5, '0');
  return new;
end;
$$;

create trigger existencia_asigna_codigo
  before insert on public.existencia
  for each row execute function private.asignar_codigo();

-- El trigger necesita poder generar el codigo, pero `codigo` es NOT NULL.
alter table public.existencia alter column codigo drop not null;
alter table public.existencia add constraint existencia_codigo_presente
  check (codigo is not null);


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
  practica_id      bigint,                   -- la FK llega en v2 con practica
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
         estado = case
           -- Un estado puesto a mano manda sobre el calculado.
           when edo in ('contaminado', 'mantenimiento', 'baja') then edo
           when nuevo = 0 then 'agotado'::public.estado_existencia
           when minimo is not null and nuevo <= minimo then 'stock_bajo'::public.estado_existencia
           else 'disponible'::public.estado_existencia
         end
   where id = new.existencia_id;

  return new;
end;
$$;

-- BEFORE: necesita escribir en NEW antes de que la fila se inserte, y antes de
-- que se evalue el WITH CHECK de la RLS sobre almacen_id.
create trigger movimiento_aplica_saldo
  before insert on public.movimiento
  for each row execute function private.aplicar_movimiento();
