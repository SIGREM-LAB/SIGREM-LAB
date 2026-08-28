-- ---------------------------------------------------------------------------
-- Los renglones que el cargador no pudo resolver solo
-- ---------------------------------------------------------------------------
-- Hasta ahora el ETL era todo-o-nada: si una hoja traia un solo renglon que
-- violara una regla, la hoja entera se quedaba fuera. Con los archivos
-- sinteticos eso funcionaba —estaban hechos para pasar—; con el primer archivo
-- real no. El de N3 trae 1615 renglones y 113 que ninguna regla puede resolver
-- sin preguntarle a una persona: 88 con la cantidad en cajas o paquetes sin
-- decir de cuantas piezas, 17 con el mismo articulo en dos unidades, 8 con el
-- peso del frasco lleno por debajo del vacio. Todo-o-nada sobre ese archivo
-- carga CERO renglones, y el inventario de N3 se queda sin migrar por 113
-- renglones de 1615.
--
-- Esta tabla es la otra mitad del cargador. Lo que se puede decidir sin
-- preguntar entra a `existencia`; lo que no, aterriza aqui con su fila del
-- Excel, su valor crudo y la regla que violo, y espera a que el responsable del
-- almacen lo revise en pantalla. `existencia` no contiene nunca un dato que se
-- sepa malo, y ningun renglon se pierde en silencio.
--
-- El segundo motivo no es una regla rota, es un limite del modelo. La llave
-- natural de una existencia es (articulo, almacen, ubicacion, marca,
-- presentacion), y N3 tiene 20 frascos de Ergosterol en la misma gaveta, misma
-- marca, misma presentacion, cada uno con su peso. La llave no los distingue:
-- antes entraba uno y los otros 19 se descartaban sin un solo error. El archivo
-- no esta mal —esta capturando 20 frascos que existen—; es el modelo el que no
-- tiene donde ponerlos. La regla 9 resolvio esto para equipos exigiendo serie
-- por renglon; para reactivos no hay equivalente todavia. Hasta que lo haya,
-- esos 224 renglones tambien esperan aqui, y la pantalla pregunta lo unico que
-- se puede preguntar: ¿son 20 frascos, o es el mismo capturado 20 veces?
--
-- Plan de la pantalla que la consume:
-- docs/plans/2026-08-26-pantalla-depuracion-inventario.md

create type public.motivo_pendiente as enum (
  'regla',              -- viola una de las 13 reglas de captura o el contrato
  'posible_duplicado'   -- choca con una existencia ya cargada por la llave natural
);

create type public.estado_pendiente as enum (
  'pendiente',   -- nadie lo ha mirado
  'resuelto',    -- se corrigio y se le dio el visto bueno
  'descartado'   -- se miro y no debe cargarse (renglon repetido, articulo dado de baja)
);


create table public.carga_pendiente (
  id            bigint  generated always as identity primary key,
  almacen_id    bigint  not null references public.almacen (id),

  -- De que corrida salio. `on delete set null` y no cascade: si alguien borra
  -- la carga, el pendiente sigue siendo trabajo por hacer.
  carga_id      bigint  references public.carga (id) on delete set null,

  archivo       text    not null,
  hoja          text    not null,
  -- La fila del Excel, no un consecutivo propio: lo primero que hace quien
  -- revisa es abrir el archivo en esa fila.
  fila          integer not null,

  motivo        public.motivo_pendiente not null,

  -- El renglon crudo, tal como venia. La pantalla lo pinta y deja corregirlo;
  -- sin esto habria que volver al archivo para saber que decia.
  renglon       jsonb   not null,

  -- [{regla, columna, valor, detalle}]. Un renglon puede violar varias reglas a
  -- la vez —Material!F136 viola la 1 y el §6— y quien revisa mira el PRODUCTO,
  -- no la regla. Por eso una fila por renglon y las reglas dentro, y no una
  -- fila por problema: la pantalla es una lista de cosas que revisar, y esa
  -- lista tiene que tener tantos renglones como productos, no como defectos.
  problemas     jsonb   not null,

  -- Con cual choco, cuando el motivo es posible_duplicado. Es lo que permite a
  -- la pantalla mostrar los dos lado a lado.
  existencia_id bigint  references public.existencia (id) on delete set null,

  estado        public.estado_pendiente not null default 'pendiente',
  nota          text,
  revisado_por  uuid    references public.perfil (id),
  revisado_en   timestamptz,
  creado_en     timestamptz not null default now(),

  constraint carga_pendiente_fila_positiva check (fila > 0),

  constraint carga_pendiente_problemas_no_vacio
    check (jsonb_typeof(problemas) = 'array'
           and jsonb_array_length(problemas) > 0),

  constraint carga_pendiente_renglon_es_objeto
    check (jsonb_typeof(renglon) = 'object'),

  -- Un pendiente cerrado sin revisor es un pendiente que nadie miro. El trigger
  -- de abajo rellena las dos columnas; esto es el candado por si algun dia se
  -- escribe desde otro lado.
  constraint carga_pendiente_revisado_con_quien
    check (estado = 'pendiente'
           or (revisado_por is not null and revisado_en is not null)),

  -- El mismo renglon del mismo archivo es el mismo pendiente. Sin esto, cada
  -- corrida del cargador duplica la lista y el trabajo de revision ya hecho se
  -- pierde entre copias.
  constraint carga_pendiente_unico unique (almacen_id, archivo, hoja, fila)
);

-- La consulta de la pantalla: los pendientes de mi almacen, sin revisar.
create index carga_pendiente_almacen_estado_idx
  on public.carga_pendiente (almacen_id, estado);

create index carga_pendiente_carga_id_idx
  on public.carga_pendiente (carga_id);

create index carga_pendiente_existencia_id_idx
  on public.carga_pendiente (existencia_id)
  where existencia_id is not null;


-- ---------------------------------------------------------------------------
-- Quien reviso, lo pone la base
-- ---------------------------------------------------------------------------
-- `revisado_por` no se acepta del cliente por lo mismo que `movimiento.almacen_id`
-- lo pone un trigger: es la firma de quien dio el visto bueno, y un cliente que
-- puede escribirla puede firmar en nombre de otro. El BEFORE UPDATE la
-- sobreescribe siempre, mande lo que mande.
create or replace function private.firmar_revision()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.estado is distinct from old.estado then
    if new.estado = 'pendiente' then
      -- Reabrir un pendiente borra la firma anterior: ya no esta revisado.
      new.revisado_por := null;
      new.revisado_en  := null;
    else
      new.revisado_por := (select auth.uid());
      new.revisado_en  := pg_catalog.now();
    end if;
  end if;
  return new;
end $$;

create trigger carga_pendiente_firma_revision
  before update on public.carga_pendiente
  for each row execute function private.firmar_revision();


-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
-- A diferencia del baseline, las politicas van en el mismo archivo que crea la
-- tabla: aquel se escribio de una vez y se organizo por temas, pero una
-- migracion nueva que deja la tabla sin sus politicas es una tabla desprotegida
-- entre dos despliegues.
alter table public.carga_pendiente enable row level security;
revoke all on public.carga_pendiente from anon;

-- Lectura abierta, igual que `existencia`: el prestamo entre almacenes ya
-- obliga a que N4 vea el inventario de N3, y un renglon a medio revisar de N3
-- no es mas sensible que uno cargado.
create policy carga_pendiente_lectura on public.carga_pendiente
  for select to authenticated using (true);

-- Escribir un pendiente es escribir en un almacen: misma regla que `carga`.
create policy carga_pendiente_alta on public.carga_pendiente
  for insert to authenticated
  with check ((select private.puede_escribir())
              and ((select private.es_admin())
                   or almacen_id = (select private.almacen_actual())));

-- Revisar es lo que hace la pantalla, y solo sobre lo propio.
create policy carga_pendiente_revision on public.carga_pendiente
  for update to authenticated
  using      ((select private.es_admin())
              or almacen_id = (select private.almacen_actual()))
  with check ((select private.es_admin())
              or almacen_id = (select private.almacen_actual()));

-- Borrar no es una operacion de la pantalla: un pendiente que no debe cargarse
-- se marca `descartado`, que deja quien y cuando. Solo admin, igual que
-- `existencia`.
create policy carga_pendiente_borrado on public.carga_pendiente
  for delete to authenticated
  using ((select private.es_admin()));

-- La pantalla solo cambia estas tres. `archivo`, `hoja`, `fila`, `problemas` y
-- `motivo` son el hallazgo del cargador y no se editan desde el cliente; si
-- cambian, es porque el archivo se volvio a cargar.
--
-- OJO CON EL ORDEN, igual que en `existencia`: el revoke a nivel tabla tiene
-- que ir ANTES del grant por columnas, porque `authenticated` trae UPDATE
-- completo por el grant por omision y un grant por columnas no se lo quita.
revoke update on public.carga_pendiente from authenticated;
grant update (renglon, estado, nota) on public.carga_pendiente to authenticated;
