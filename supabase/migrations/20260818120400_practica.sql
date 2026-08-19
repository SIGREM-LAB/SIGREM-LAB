-- Practicas: el modulo principal del sistema segun el prototipo, y el que
-- consume las existencias. Sin el, la base solo guarda; no descuenta.
--
-- Diseno: docs/specs/2026-08-18-depuracion-esquema-formato-unificado-design.md
--
-- La frontera con movimiento, que es lo que mas facil se enreda:
--   movimiento        responde CUANTO HAY. Se escribe cuando el saldo cambia.
--   practica_elemento responde QUIEN USO QUE. Lo lee el modulo de Reportes.
-- Un prestamo de equipo aparece en el segundo y no en el primero, porque no
-- cambia ninguna cantidad.

-- ---------------------------------------------------------------------------
-- Catalogos
-- ---------------------------------------------------------------------------
create table public.programa_educativo (
  id     bigint generated always as identity primary key,
  nombre text not null unique,
  activo boolean not null default true
);

create table public.asignatura (
  id                    bigint generated always as identity primary key,

  -- Nullable: hay asignaturas compartidas entre programas, y forzar el vinculo
  -- obligaria a duplicarlas una vez por programa.
  programa_educativo_id bigint references public.programa_educativo (id),

  nombre                text not null,
  activo                boolean not null default true,
  unique nulls not distinct (programa_educativo_id, nombre)
);

create index asignatura_programa_idx on public.asignatura (programa_educativo_id);


-- ---------------------------------------------------------------------------
-- Practica
-- ---------------------------------------------------------------------------
create table public.practica (
  id                    bigint generated always as identity primary key,
  folio                 text unique,        -- PRA-0001, lo pone el trigger
  programa_educativo_id bigint not null references public.programa_educativo (id),
  laboratorio_id        bigint not null references public.laboratorio (id),
  asignatura_id         bigint references public.asignatura (id),

  -- Desnormalizado a proposito, igual que en movimiento: la politica de RLS se
  -- evalua sin join. Lo escribe el trigger desde laboratorio_id, NO el cliente.
  almacen_id            bigint not null references public.almacen (id),

  fecha                 date not null default current_date,
  observaciones         text,               -- "descripcion adicional" del prototipo
  registrado_por        uuid not null references public.perfil (id),
  creado_en             timestamptz not null default now()
);

create index practica_almacen_fecha_idx on public.practica (almacen_id, fecha desc);
create index practica_laboratorio_idx   on public.practica (laboratorio_id);
create index practica_asignatura_idx    on public.practica (asignatura_id);
create index practica_programa_idx      on public.practica (programa_educativo_id);
create index practica_registrado_por_idx on public.practica (registrado_por);


-- ---------------------------------------------------------------------------
-- Folio de practica: PRA-0001, global y no por almacen
-- ---------------------------------------------------------------------------
create table private.folio_practica (
  id     smallint primary key default 1,
  ultimo integer not null default 0,
  constraint folio_practica_una_fila check (id = 1)
);

create or replace function private.asignar_practica()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  consecutivo integer;
begin
  if new.folio is null or new.folio = '' then
    -- insert ... on conflict do update ... returning es lo que evita que dos
    -- capturas simultaneas saquen el mismo folio.
    insert into private.folio_practica (id, ultimo) values (1, 1)
    on conflict (id) do update set ultimo = private.folio_practica.ultimo + 1
    returning ultimo into consecutivo;

    new.folio := 'PRA-' || lpad(consecutivo::text, 4, '0');
  end if;

  -- El cliente NO decide el almacen: se deriva del laboratorio. Si lo mandara
  -- el, podria falsearlo para registrar en el almacen de otro.
  if new.laboratorio_id is null then
    raise exception 'Una practica necesita laboratorio: de ahi sale su almacen';
  end if;

  select almacen_id into new.almacen_id
    from public.laboratorio where id = new.laboratorio_id;

  if new.almacen_id is null then
    raise exception 'El laboratorio % no existe', new.laboratorio_id;
  end if;

  new.registrado_por := coalesce(new.registrado_por, (select auth.uid()));
  return new;
end;
$$;

create trigger practica_asigna_folio
  before insert on public.practica
  for each row execute function private.asignar_practica();


-- ---------------------------------------------------------------------------
-- Observaciones generales: las nueve casillas del prototipo
-- ---------------------------------------------------------------------------
-- Como catalogo y no como nueve columnas booleanas. Nueve booleanos serian mas
-- cortos de escribir hoy y mas caros cada vez que alguien quiera una decima
-- casilla: migracion mas redespliegue del frontend. Como catalogo, agregar un
-- motivo es un insert. Es la misma decision que ya se tomo con campo_capturable.
create table public.motivo_observacion (
  clave    text primary key,
  etiqueta text not null,
  orden    integer not null,
  activo   boolean not null default true
);

create table public.practica_observacion (
  practica_id bigint not null references public.practica (id) on delete cascade,
  motivo      text   not null references public.motivo_observacion (clave),
  primary key (practica_id, motivo)
);

create index practica_observacion_motivo_idx on public.practica_observacion (motivo);


-- ---------------------------------------------------------------------------
-- practica_elemento
-- ---------------------------------------------------------------------------
create table public.practica_elemento (
  id             bigint generated always as identity primary key,
  practica_id    bigint not null references public.practica (id) on delete cascade,
  existencia_id  bigint not null references public.existencia (id),

  -- Desnormalizado para RLS, escrito por el trigger desde existencia.
  almacen_id     bigint not null references public.almacen (id),

  metodo_control public.metodo_control not null,

  -- Reactivos: se pesa antes y despues
  peso_inicial   numeric(14,4),
  peso_final     numeric(14,4),
  consumo        numeric(14,4)
                 generated always as (peso_inicial - peso_final) stored,

  -- Materiales: se entrega y se devuelve
  cantidad_entregada numeric(14,4),
  cantidad_devuelta  numeric(14,4),
  cantidad_danada    numeric(14,4),
  perdidas       numeric(14,4) generated always as (
                   cantidad_entregada
                   - coalesce(cantidad_devuelta, 0)
                   - coalesce(cantidad_danada, 0)
                 ) stored,

  -- Equipos: se presta y se regresa
  estado_salida     public.funcionamiento_equipo,
  estado_devolucion public.funcionamiento_equipo,

  observaciones  text,
  creado_en      timestamptz not null default now(),

  constraint practica_elemento_peso_coherente
    check (peso_final is null or peso_inicial is null or peso_final <= peso_inicial),
  constraint practica_elemento_devolucion_coherente
    check (cantidad_entregada is null
           or coalesce(cantidad_devuelta,0) + coalesce(cantidad_danada,0)
              <= cantidad_entregada),

  -- Union discriminada: impide que un reactivo traiga estado_devolucion lleno,
  -- o que un equipo traiga pesos. Sin esto, el formulario del frontend seria lo
  -- unico que evita renglones imposibles, y el frontend no es una garantia.
  constraint practica_elemento_campos_por_metodo check (
    case metodo_control
      when 'peso' then
        peso_inicial is not null and peso_final is not null
        and cantidad_entregada is null and cantidad_devuelta is null
        and cantidad_danada is null
        and estado_salida is null and estado_devolucion is null
      when 'cantidad' then
        cantidad_entregada is not null
        and peso_inicial is null and peso_final is null
        and estado_salida is null and estado_devolucion is null
      when 'prestamo' then
        estado_salida is not null
        and peso_inicial is null and peso_final is null
        and cantidad_entregada is null and cantidad_devuelta is null
        and cantidad_danada is null
    end
  )
);

create index practica_elemento_practica_idx   on public.practica_elemento (practica_id);
create index practica_elemento_existencia_idx on public.practica_elemento (existencia_id);
create index practica_elemento_almacen_idx    on public.practica_elemento (almacen_id);

comment on column public.practica_elemento.consumo is
  'Columna generada. La aritmetica vive en la base porque una resta que calcula el frontend es una resta que se puede equivocar en silencio.';


-- ---------------------------------------------------------------------------
-- Los dos triggers de practica_elemento, y el orden importa
-- ---------------------------------------------------------------------------
-- BEFORE: escribe almacen_id antes de que corra el WITH CHECK de la RLS.
create or replace function private.asignar_practica_elemento()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  select almacen_id into new.almacen_id
    from public.existencia where id = new.existencia_id;

  if new.almacen_id is null then
    raise exception 'La existencia % no existe', new.existencia_id;
  end if;

  return new;
end;
$$;

create trigger practica_elemento_asigna_almacen
  before insert on public.practica_elemento
  for each row execute function private.asignar_practica_elemento();

-- AFTER: necesita leer consumo y perdidas, que son columnas generadas y en
-- BEFORE todavia no existen.
create or replace function private.aplicar_practica_elemento()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  -- auth.uid() es NULL cuando no hay sesion: el ETL, un job del servidor o las
  -- pruebas. movimiento.usuario_id es NOT NULL, asi que sin respaldo eso
  -- reventaria con un error de constraint en vez de con algo que se entienda.
  -- El registrante de la practica es la atribucion correcta cuando no hay
  -- usuario actuando, y nunca es nulo.
  uid uuid := coalesce(
    (select auth.uid()),
    (select registrado_por from public.practica where id = new.practica_id)
  );
begin
  if new.metodo_control = 'peso' then
    if new.consumo > 0 then
      insert into public.movimiento (existencia_id, almacen_id, tipo, cantidad,
                                     cantidad_antes, cantidad_despues,
                                     practica_id, usuario_id, motivo)
      values (new.existencia_id, new.almacen_id, 'consumo', -new.consumo,
              0, 0, new.practica_id, uid, 'Consumo en practica');
    end if;

  elsif new.metodo_control = 'cantidad' then
    -- Dos filas y no una: la distincion entre lo daniado y lo perdido es
    -- justo lo que el formulario captura por separado.
    if coalesce(new.cantidad_danada, 0) > 0 then
      insert into public.movimiento (existencia_id, almacen_id, tipo, cantidad,
                                     cantidad_antes, cantidad_despues,
                                     practica_id, usuario_id, motivo)
      values (new.existencia_id, new.almacen_id, 'merma', -new.cantidad_danada,
              0, 0, new.practica_id, uid, 'Daniado en practica');
    end if;

    if new.perdidas > 0 then
      insert into public.movimiento (existencia_id, almacen_id, tipo, cantidad,
                                     cantidad_antes, cantidad_despues,
                                     practica_id, usuario_id, motivo)
      values (new.existencia_id, new.almacen_id, 'consumo', -new.perdidas,
              0, 0, new.practica_id, uid, 'No devuelto en practica');
    end if;

  elsif new.metodo_control = 'prestamo' then
    -- Sin movimiento: un equipo prestado y devuelto no cambia de cantidad, y
    -- un -1/+1 que se cancela es historia inventada. Lo que si cambia es en
    -- que estado regreso.
    if new.estado_devolucion is not null then
      update public.existencia
         set funcionamiento = new.estado_devolucion
       where id = new.existencia_id;
    end if;
  end if;

  return null;   -- after trigger: el valor de retorno se ignora
end;
$$;

create trigger practica_elemento_aplica_saldo
  after insert on public.practica_elemento
  for each row execute function private.aplicar_practica_elemento();


-- ---------------------------------------------------------------------------
-- La FK que llevaba tres semanas pendiente
-- ---------------------------------------------------------------------------
-- No se puede declarar en inventario.sql: practica_elemento referencia
-- existencia, asi que practica.sql va despues. La dependencia es circular
-- entre archivos y se cierra aqui.
alter table public.movimiento
  add constraint movimiento_practica_id_fkey
  foreign key (practica_id) references public.practica (id);


-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.programa_educativo   enable row level security;
alter table public.asignatura           enable row level security;
alter table public.practica             enable row level security;
alter table public.motivo_observacion   enable row level security;
alter table public.practica_observacion enable row level security;
alter table public.practica_elemento    enable row level security;

revoke all on public.programa_educativo, public.asignatura, public.practica,
              public.motivo_observacion, public.practica_observacion,
              public.practica_elemento from anon;
