-- El minimo de reposicion, por articulo y almacen.
--
-- No por envase. `existencia` es un frasco -tiene codigo unico, peso_frasco_vacio
-- y peso_total-, y un minimo por frasco responde "este envase esta por
-- acabarse", que no es la pregunta de compras. La pregunta de compras es
-- "cuanta acetona queda en N3 en total": un envase casi vacio junto a siete
-- llenos dispara una alerta falsa, y ocho a la mitad no disparan ninguna, que
-- es justo cuando hay que comprar.
--
-- Sumar los envases del mismo articulo es valido por construccion, y eso ya
-- estaba resuelto: el comentario de `articulo.unidad_base` prohibe que la misma
-- sustancia se registre en g en un almacen y en kg en otro, precisamente para
-- que los totales agregados sean confiables. De ahi que esta tabla no lleve
-- columna de unidad: la hereda del articulo.
--
-- `existencia.cantidad_minima` NO se toca. Sigue alimentando
-- `private.estado_calculado` y el estado `stock_bajo` de la pantalla. Son dos
-- preguntas distintas que hoy conviven: "este envase va bajo" y "hay que
-- comprar". Decision D2 del spec del 21 de septiembre.
--
-- Al 21 de septiembre de 2026 hay 0 de 2,526 existencias con `cantidad_minima`
-- puesta, asi que en la practica aquel campo esta dormido y esta tabla nace sin
-- competencia.
create table public.minimo_articulo (
  articulo_id  bigint not null references public.articulo (id) on delete cascade,
  almacen_id   bigint not null references public.almacen (id),

  minimo       numeric(14,4) not null,
  nota         text,

  -- Informativo, no una frontera de permiso: quien puede escribir el renglon ya
  -- lo decide la politica por `almacen_id`. Por eso basta el default y no hace
  -- falta el trigger BEFORE que si necesitan `movimiento` y `practica_elemento`.
  --
  -- `auth.uid()` a secas, SIN envolver en `(select ...)`. Ese envoltorio es el
  -- truco que usan las politicas de RLS para que el planificador evalue la
  -- funcion una vez por consulta en vez de una por renglon; en un DEFAULT no es
  -- una optimizacion sino un error: «cannot use subquery in DEFAULT expression».
  definido_por uuid references public.perfil (id) default auth.uid(),
  definido_en  timestamptz not null default now(),

  primary key (articulo_id, almacen_id),

  -- `> 0` y no `>= 0`: un minimo de cero es un renglon que no dice nada. Lo que
  -- no se repone no lleva renglon.
  constraint minimo_articulo_positivo check (minimo > 0)
);

comment on table public.minimo_articulo is
  'Cuanto hay que mantener de un articulo en un almacen. Lo lee el reporte de reposicion.';

-- El reporte filtra por almacen antes que por nada.
create index minimo_articulo_almacen_idx on public.minimo_articulo (almacen_id);

alter table public.minimo_articulo enable row level security;

-- Misma forma que `existencia` desde el 14 de septiembre: el responsable ve el
-- suyo; admin y consulta, la Unidad entera, y `almacen_actual()` nulo es esa
-- senal.
create policy minimo_articulo_lectura on public.minimo_articulo
  for select to authenticated
  using (
    (select private.almacen_actual()) is null
    or almacen_id = (select private.almacen_actual())
  );

create policy minimo_articulo_escritura on public.minimo_articulo
  for all to authenticated
  using      ((select private.puede_escribir())
              and ((select private.es_admin())
                   or almacen_id = (select private.almacen_actual())))
  with check ((select private.puede_escribir())
              and ((select private.es_admin())
                   or almacen_id = (select private.almacen_actual())));

revoke all on public.minimo_articulo from anon;


-- ---------------------------------------------------------------------------
-- Quien puede generar reportes
-- ---------------------------------------------------------------------------
-- Mismo cuerpo que `private.puede_escribir()`, y a proposito NO se reutiliza
-- aquella. El dia que alguien decida que `consulta` si puede exportar va a
-- editar el cuerpo de `puede_escribir()` y le va a abrir la escritura del
-- inventario de paso, sin que nada falle ni nadie se entere. Dos reglas
-- distintas que hoy coinciden en el resultado no son la misma regla.
--
-- Un archivo sale del sistema, se reenvia y sobrevive a la baja del usuario;
-- una pantalla no. Por eso `consulta` sigue viendo el inventario y no puede
-- exportarlo.
create or replace function private.puede_reportar()
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

grant execute on function private.puede_reportar() to authenticated;
revoke execute on function private.puede_reportar() from anon, public;
