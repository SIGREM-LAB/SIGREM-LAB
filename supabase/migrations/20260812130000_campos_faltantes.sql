-- Campos que los Excel si traen y el esquema inicial no contemplaba.
-- Surge de revisar las 12 hojas columna por columna.

-- ---------------------------------------------------------------------------
-- Correccion de mapeo en reactivos
-- ---------------------------------------------------------------------------
-- El Excel tiene "Quimicas / caracteristica principal" y "Toxicas /
-- caracteristica principal". No hay ninguna caracteristica "fisica": lo fisico
-- son las casillas solido/liquido/gas, que ya resuelve estado_fisico.
alter table public.articulo_reactivo
  rename column caracteristica_fisica to caracteristica_toxica;

-- Columna 7.1-d del formato NOM. Varia por item en N4 (Si x290 / no x327),
-- constante en LUM y N3.
alter table public.articulo_reactivo
  add column implica_actividad_peligro boolean;


-- ---------------------------------------------------------------------------
-- Constantes de plantilla: suben al almacen
-- ---------------------------------------------------------------------------
-- `Uso principal`, `Zona de riesgo` y `Personas expuestas` son identicas en
-- cada renglon de cada archivo. Repetirlas ~2,500 veces por almacen no aporta
-- nada; el exportador de la NOM las reinyecta por renglon al generar el Excel.
alter table public.almacen
  add column uso_principal      text,
  add column zona_riesgo        text,
  add column personas_expuestas integer,
  -- LUM se subdivide en LUM-1 y LUM-2 en la columna Almacen de sus reactivos.
  add column padre_id           bigint references public.almacen (id);

create index almacen_padre_id_idx on public.almacen (padre_id);

-- La columna Almacen viene sucia: '4' (entero) en N4, 'LUM-1'/'LUM-2' en LUM,
-- y 'N1-1' en N3, que no es ninguno de los cuatro. Mismo patron que
-- articulo_alias: el texto crudo apunta al canonico.
create table public.almacen_alias (
  texto      text   primary key,
  almacen_id bigint not null references public.almacen (id)
);

create index almacen_alias_almacen_id_idx on public.almacen_alias (almacen_id);

alter table public.almacen_alias enable row level security;
revoke all on public.almacen_alias from anon;

create policy almacen_alias_lectura on public.almacen_alias
  for select to authenticated using (true);

-- Reapuntar un alias cambia a que almacen se migran cientos de filas: solo admin.
create policy almacen_alias_admin on public.almacen_alias
  for all to authenticated
  using ((select private.es_admin())) with check ((select private.es_admin()));


-- ---------------------------------------------------------------------------
-- Familia: como se navega el almacen de electronica
-- ---------------------------------------------------------------------------
-- 26 valores en LE: Resistencia, Capacitor, CI Logica Digital... Es una
-- propiedad de que ES la cosa, no del stock fisico.
alter table public.articulo add column familia text;

create index articulo_familia_idx on public.articulo (familia)
  where familia is not null;


-- ---------------------------------------------------------------------------
-- Existencia: campos por tipo de almacen
-- ---------------------------------------------------------------------------
alter table public.existencia
  -- Equipos (LUM y LE). El modelo acompana a la marca, que ya vive aqui.
  add column modelo            text,
  add column mantenimiento     text,
  add column fecha_chequeo     date,
  add column partida           text,

  -- Reactivos de LUM y N3: pesan el frasco y derivan la cantidad de la resta.
  -- N4 y la hoja 2025 de N3 capturan la cantidad directa y dejan esto nulo.
  -- PENDIENTE: confirmar con los responsables si el desglose se conserva o si
  -- solo interesa la cantidad final.
  add column peso_total        numeric(14,4),
  add column peso_frasco_vacio numeric(14,4),

  -- Materiales: N3 registra el turno que hizo la revision.
  add column revisado_por      text,
  add column observaciones     text;

comment on column public.existencia.peso_total is
  'Peso del frasco lleno. Solo lo capturan LUM y N3; la cantidad se deriva de peso_total - peso_frasco_vacio.';
