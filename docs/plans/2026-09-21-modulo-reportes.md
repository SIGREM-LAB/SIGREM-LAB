# Módulo de Reportes, entrega 1 · Plan de implementación

> **Para agentes:** SUB-SKILL REQUERIDA: usa `superpowers:subagent-driven-development`
> (recomendado) o `superpowers:executing-plans` para ejecutar este plan tarea por
> tarea. Los pasos llevan casilla (`- [ ]`) para ir marcándolos.

**Meta:** la ruta `/reportes`, donde un responsable descarga cuatro Excel que le
sirven para decidir: qué comprar, qué se está venciendo, qué contar, y el
inventario en el formato unificado que el personal ya conoce.

**Arquitectura:** cinco migraciones aditivas agregan la tabla `minimo_articulo`
—el mínimo de reposición por artículo × almacén, que hoy no existe—, las dos
tablas que describen el formato unificado, y una función por reporte que
devuelve las filas ya con la forma de la hoja. Encima va una capa delgada de
cliente: un registro declarativo de reportes y **una sola** función `aExcel()`
que vuelca cualquiera de ellos a `.xlsx` con exceljs.

**Stack:** Postgres 17 + Supabase CLI + pgTAP para la base; React 19, MUI 9,
TanStack Query 5, react-hook-form 7 + zod 4, exceljs, Vitest + Testing Library
para la pantalla; pytest + openpyxl para la prueba de ida y vuelta.

**Spec:** `docs/specs/2026-09-21-modulo-reportes-design.md` — este plan discute
desde ahí; léelos juntos.

## Restricciones globales

- **Los commits los hace la persona, no el agente.** Cada tarea termina en un
  punto de commit: deja el árbol limpio y verde, di qué archivos tocaste, y
  **para**. No corras `git commit` ni `git add`.
- **Una dependencia nueva, y solo una: `exceljs`.** Ya está aprobada (§6 del
  spec). Cualquier otra se pregunta antes de instalar.
- **Identificadores del dominio en español**, igual que el esquema: `minimo`,
  `articulo`, `almacen`, `reporte`, `hoja`, `columna`. Comentarios y texto de
  usuario, también.
- **Los tipos se generan.** `pnpm gen:types` después de cada migración. Nunca
  editar `src/types/database.ts` a mano ni declarar a mano la forma de una fila.
- **El esquema sólo cambia por migración.** Archivos nuevos en
  `supabase/migrations/`. Una migración ya aplicada no se edita: se agrega otra.
  La ventana de reescribir el baseline se cerró el 18 de agosto.
- **Cada política de RLS lleva su prueba** en `supabase/tests/database/`.
- **Ninguna función de reporte lleva `security definer`.** Es lo que hace que la
  RLS de `existencia` les aplique. Va probado contra `pg_proc.prosecdef` en la
  Tarea 3, no confiado a la revisión de nadie.
- **Toda función nueva en `public` lleva su `revoke ... from anon`.** Postgres
  otorga `execute` a `PUBLIC` por defecto, y `anon` está dentro de `PUBLIC`: sin
  el revoke, la función queda expuesta a la llave que viaja en el binario. El
  `revoke all on all functions` del archivo de grants sólo alcanzó a las que ya
  existían.
- **MUI 9:** `<Grid size={{ xs: 12, md: 6 }}>`, nunca `<Grid item xs>`. Las
  props de sistema van en `sx`, no sueltas.
- **Ningún `.xlsx` de inventario real entra al commit.** El repositorio es
  público. Las pruebas usan datos sintéticos; los archivos reales de
  `etl/Datos-Reales-JD2026/` se leen pero no se copian ni se versionan.

## Nota sobre verificación en esta máquina

Dos cosas conocidas que cambian el orden de los pasos, no el diseño:

- **`supabase test db` no corre sin Docker.** Si Docker Desktop no está
  levantado, las pruebas pgTAP se verifican contra el remoto envolviéndolas en
  `begin; ... rollback;` — que es como ya están escritas ambos archivos.
- **`pnpm gen:types` lee el esquema local** (`--linked` apunta al proyecto
  vinculado) mientras la app apunta al remoto. Una migración no aparece en
  `src/types/database.ts` hasta que se aplica donde `gen:types` la lea. Si
  `typecheck` se queja de una tabla o función que acabas de crear, ese es el
  motivo: aplica la migración antes de volver a generar.
- **La conexión al remoto estaba dando timeout** el 21 de septiembre de 2026
  (`execute_sql` colgaba aunque el proyecto reportara `ACTIVE_HEALTHY`).
  Confírmala antes de empezar la Tarea 1.

---

## Estructura de archivos

**Migraciones** (`supabase/migrations/`, una por tarea 1–5):

| Archivo | Responsabilidad |
|---|---|
| `20260921120000_minimo_articulo.sql` | La tabla del mínimo, su RLS y `private.puede_reportar()` |
| `20260921120100_formato_unificado.sql` | `hoja_formato`, `columna_formato` y `formato_hoja()` |
| `20260921120200_reporte_reposicion.sql` | `reporte_reposicion()` y `reporte_sin_minimo()` |
| `20260921120300_reporte_caducidades.sql` | `reporte_caducidades()` y `reporte_conteo()` |
| `20260921120400_inventario_formato.sql` | `inventario_formato()` |

**Cliente** (`src/features/reportes/`):

| Archivo | Responsabilidad |
|---|---|
| `aExcel.ts` | La **única** pieza que importa exceljs. Filas → libro → descarga |
| `aExcel.test.ts` | Tipos reales, hoja de Parámetros, resalte |
| `paginacion.ts` | `traerTodo()`: rodea `max_rows`, o falla sin producir archivo |
| `paginacion.test.ts` | Que trae todo, y que al tope lanza en vez de truncar |
| `registro.ts` | Los cuatro reportes como datos: hojas, columnas, parámetros |
| `registro.test.ts` | Que cada `clave` del registro existe en el tipo de su RPC |
| `consultas.ts` | TanStack Query: generar un reporte, leer y guardar mínimos |
| `PaginaReportes.tsx` | La rejilla de tarjetas |
| `DialogoParametros.tsx` | Los parámetros de un reporte y el botón Generar |
| `PaginaMinimos.tsx` | Buscador, progreso y la tabla de mínimos |
| `TablaMinimos.tsx` | El cuerpo de esa tabla, y el tipo `ArticuloConMinimo` |
| `TablaMinimos.test.tsx` | Que guarda al salir del campo, no en cada tecla |
| `BotonExportar.tsx` | El botón de las dos pantallas de inventario |

`consultas.ts` importa `ArticuloConMinimo` de `TablaMinimos.tsx`. No hay ciclo:
la tabla no conoce las consultas — recibe sus filas y un `onGuardar` por props,
que es lo que la deja probarse sin red.

**Tocados:** `src/App.tsx` (rutas), `src/app/navegacion.ts` (menú),
`src/features/auth/RutaProtegida.tsx` (guardia nueva),
`src/features/inventario/PaginaInventario.tsx` y `PaginaInventarioGeneral.tsx`
(botón Exportar), `package.json` (exceljs),
`supabase/tests/database/{esquema,rls}.test.sql`,
`etl/tests/test_ida_y_vuelta.py` (nuevo).

---

## Tarea 1: La tabla del mínimo y `puede_reportar()`

**Archivos:**
- Crear: `supabase/migrations/20260921120000_minimo_articulo.sql`
- Modificar: `supabase/tests/database/esquema.test.sql`, `supabase/tests/database/rls.test.sql`

**Interfaces:**
- Consume: `private.almacen_actual()`, `private.es_admin()`, `private.puede_escribir()` del baseline.
- Produce: tabla `public.minimo_articulo (articulo_id, almacen_id, minimo, nota, definido_por, definido_en)` y `private.puede_reportar() returns boolean`.

- [ ] **Paso 1: Escribe las pruebas que fallan**

En `supabase/tests/database/esquema.test.sql`, antes de `select * from finish();`:

```sql
-- ---------------------------------------------------------------------------
-- minimo_articulo
-- ---------------------------------------------------------------------------
select has_table('public', 'minimo_articulo', 'minimo_articulo existe');

select col_is_pk(
  'public', 'minimo_articulo', array['articulo_id', 'almacen_id'],
  'La llave es el par articulo+almacen: un minimo por articulo en cada bodega'
);

select throws_ok(
  $$ insert into public.minimo_articulo (articulo_id, almacen_id, minimo)
     values ((select id from public.articulo limit 1),
             (select id from public.almacen where clave = 'N3'), 0) $$,
  '23514',
  null,
  'Un minimo de cero es un renglon que no dice nada: se rechaza'
);

select has_function(
  'private', 'puede_reportar', array[]::text[],
  'puede_reportar existe y va aparte de puede_escribir'
);
```

En `supabase/tests/database/rls.test.sql`, antes de `select pg_temp.como_postgres();`:

```sql
-- ---------------------------------------------------------------------------
-- minimo_articulo: se escribe solo en el almacen propio
-- ---------------------------------------------------------------------------
select pg_temp.como('n3@uaeh.local');

select lives_ok(
  $$ insert into public.minimo_articulo (articulo_id, almacen_id, minimo)
     values ((select id from public.articulo limit 1),
             (select id from public.almacen where clave = 'N3'), 100)
     on conflict do nothing $$,
  'El responsable de N3 define minimos en N3'
);

select throws_ok(
  $$ insert into public.minimo_articulo (articulo_id, almacen_id, minimo)
     values ((select id from public.articulo limit 1),
             (select id from public.almacen where clave = 'N4'), 100) $$,
  '42501',
  null,
  'El responsable de N3 NO define minimos en N4'
);

select pg_temp.como('lectura@uaeh.local');

select throws_ok(
  $$ insert into public.minimo_articulo (articulo_id, almacen_id, minimo)
     values ((select id from public.articulo limit 1),
             (select id from public.almacen where clave = 'N3'), 100) $$,
  '42501',
  null,
  'Un usuario de consulta no define minimos en ningun almacen'
);
```

Sube `select plan(84)` a `select plan(88)` en `esquema.test.sql` y
`select plan(158)` a `select plan(161)` en `rls.test.sql`.

- [ ] **Paso 2: Corre las pruebas y verifica que fallan**

```bash
supabase test db
```

Esperado: FAIL. `esquema.test.sql` se queja de que `public.minimo_articulo` no
existe; `rls.test.sql` también.

Si Docker no está levantado, corre el contenido de cada archivo contra el remoto
— ya vienen envueltos en `begin; ... rollback;`, así que no dejan rastro.

- [ ] **Paso 3: Escribe la migración**

`supabase/migrations/20260921120000_minimo_articulo.sql`:

```sql
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
create table public.minimo_articulo (
  articulo_id  bigint not null references public.articulo (id) on delete cascade,
  almacen_id   bigint not null references public.almacen (id),

  minimo       numeric(14,4) not null,
  nota         text,

  -- Informativo, no una frontera de permiso: quien puede escribir el renglon ya
  -- lo decide la politica por `almacen_id`. Por eso basta el default y no hace
  -- falta el trigger BEFORE que si necesitan `movimiento` y `practica_elemento`.
  definido_por uuid references public.perfil (id) default (select auth.uid()),
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
```

- [ ] **Paso 4: Aplica y corre las pruebas**

```bash
supabase db reset     # migraciones + seed desde cero
supabase test db
```

Esperado: PASS, los dos archivos en verde.

- [ ] **Paso 5: Regenera los tipos y verifica**

```bash
pnpm gen:types
pnpm typecheck && pnpm lint && pnpm build
```

Esperado: cero errores. `src/types/database.ts` ahora conoce `minimo_articulo`.

- [ ] **Paso 6: Punto de commit**

Archivos tocados: la migración nueva, los dos `.test.sql`, `src/types/database.ts`.
Deja el árbol limpio y **para**.

---

## Tarea 2: El formato unificado, en la base

**Archivos:**
- Crear: `supabase/migrations/20260921120100_formato_unificado.sql`
- Modificar: `supabase/tests/database/esquema.test.sql`
- Lee (no modifica): `etl/extract/formato.py`, un libro real de `etl/Datos-Reales-JD2026/`

**Interfaces:**
- Produce: `public.hoja_formato`, `public.columna_formato`, y
  `public.formato_hoja(p_hoja text) returns table (campo text, columna text, titulo text, orden integer)`.

**Por qué esto va en la base y no en un diccionario de TypeScript:** ya está
dictaminado. El comentario de `private.clave_renglon`
(`20260910120000_alta_existencia.sql:48`) explica que un diccionario en el
frontend hay que acordarse de actualizarlo, y olvidarlo no rompe la
compilación: manda el valor con la llave equivocada y **el campo se pierde en
silencio**.

- [ ] **Paso 1: Extrae los títulos reales del formato**

Las letras de columna están en `CAMPOS` de `etl/extract/formato.py`, pero **los
títulos no**: el ETL mapea por letra, no por encabezado. Sácalos de un libro
real. Guarda esto en el scratchpad, no en el repo:

```python
# scratchpad/titulos.py
from openpyxl import load_workbook
from etl.extract.formato import CAMPOS, FILA_ENCABEZADO, FILA_ENCABEZADO_DEFECTO

RUTA = "etl/Datos-Reales-JD2026/corregido/Almacén-Nivel-4/Inventario reactivos N4.xlsx"
libro = load_workbook(RUTA, data_only=True)

for hoja, campos in CAMPOS.items():
    if hoja not in libro.sheetnames:
        continue
    fila = FILA_ENCABEZADO.get(hoja, FILA_ENCABEZADO_DEFECTO)
    ws = libro[hoja]
    for orden, (campo, letra) in enumerate(campos.items(), start=1):
        titulo = ws[f"{letra}{fila}"].value
        print(f"  ('{hoja}', '{campo}', '{letra}', $${titulo}$$, 'texto', {orden}),")
```

Corre `python scratchpad/titulos.py` y pega la salida en el `insert` del Paso 3.
Para las hojas que ese libro no traiga, repite con los de Actopan y Huejutla.
**Si un título sale `None`**, la letra o la fila no cuadran: revisa contra el
archivo antes de seguir, no lo inventes.

- [ ] **Paso 2: Escribe las pruebas que fallan**

En `esquema.test.sql`:

```sql
-- ---------------------------------------------------------------------------
-- El formato unificado descrito en la base
-- ---------------------------------------------------------------------------
select has_table('public', 'hoja_formato',   'hoja_formato existe');
select has_table('public', 'columna_formato', 'columna_formato existe');

select is(
  (select count(*)::int from public.hoja_formato),
  6,
  'Las seis hojas del formato unificado, ni una mas'
);

select is(
  (select fila_encabezado from public.hoja_formato where hoja = 'Reactivos'),
  9,
  'Reactivos lleva el encabezado en la fila 9: arriba van las tres filas agrupadas de la NOM'
);

select is(
  (select columna from public.columna_formato
    where hoja = 'Reactivos' and campo = 'sustancia'),
  'H',
  'La sustancia de Reactivos va en la H, como la lee el ETL'
);

select is(
  (select count(*)::int from public.formato_hoja('Equipos')),
  12,
  'Equipos son doce columnas'
);
```

Sube `plan(88)` a `plan(93)`.

- [ ] **Paso 3: Corre las pruebas y verifica que fallan**

```bash
supabase test db
```

Esperado: FAIL, `public.hoja_formato` no existe.

- [ ] **Paso 4: Escribe la migración**

`supabase/migrations/20260921120100_formato_unificado.sql`:

```sql
-- El formato unificado, descrito para poder REGENERARLO.
--
-- El ETL ya sabe leerlo (`CAMPOS` en etl/extract/formato.py). Esto es el otro
-- sentido: que la app pueda escribir un libro que el personal reconozca -y que
-- el propio ETL pueda volver a leer-.
--
-- Va en la base y no en un diccionario de TypeScript por lo que ya razona el
-- comentario de `private.clave_renglon`: un mapa en el frontend hay que
-- acordarse de actualizarlo, y olvidarlo no rompe la compilacion; manda el
-- valor con la llave equivocada y el campo se pierde en silencio.
--
-- Se acepta que existan DOS copias -esta y la del ETL- y no se refactoriza
-- aquel: funciona y esta probado contra archivos reales de seis almacenes.
-- Lo que impide que se separen es la prueba de ida y vuelta de etl/tests/,
-- que exporta y vuelve a leer. Decision D10 del spec.
create table public.hoja_formato (
  hoja               text primary key,
  clasificacion      public.clasificacion_articulo,
  fila_encabezado    integer not null,
  celda_responsable  text not null,
  celda_periodo      text not null,
  celda_actualizado  text not null,
  orden              integer not null unique
);

comment on table public.hoja_formato is
  'Una fila por hoja del formato unificado. El orden es el de HOJAS_DE_DATOS del ETL.';

comment on column public.hoja_formato.clasificacion is
  'Nula en Insumos, Material y Electronica: esas tres traen la clasificacion en el renglon, no en la hoja. Es lo mismo que dice private.hoja_de().';

create table public.columna_formato (
  hoja    text not null references public.hoja_formato (hoja) on delete cascade,
  campo   text not null,
  columna text not null,
  titulo  text not null,

  -- El tipo va aqui y no se adivina en el cliente. Sin el, `cantidad` y
  -- `peso_vacio` saldrian como texto y el libro exportado reintroduciria por la
  -- puerta de salida lo que el ETL limpio en la de entrada -los originales
  -- traian «Un frasco» en columna numerica-.
  tipo    text not null default 'texto'
          check (tipo in ('texto', 'numero', 'entero', 'fecha')),

  orden   integer not null,

  primary key (hoja, campo),
  unique (hoja, columna)
);

comment on table public.columna_formato is
  'Que columna del Excel es que campo. Espejo de CAMPOS en etl/extract/formato.py.';

-- El orden es el de HOJAS_DE_DATOS y no el alfabetico: el catalogo de articulos
-- es global, asi que el orden en que se escriben las hojas tiene que ser
-- reproducible por la misma razon que lo es al leerlas.
insert into public.hoja_formato
  (hoja, clasificacion, fila_encabezado, celda_responsable, celda_periodo, celda_actualizado, orden)
values
  ('Reactivos',         'reactivo',          9, 'F4', 'B5', 'F5', 1),
  ('Insumos',            null,               8, 'F4', 'B5', 'F5', 2),
  ('Material',           null,               8, 'F4', 'B5', 'F5', 3),
  ('Equipos',           'equipo',            8, 'F4', 'B5', 'F5', 4),
  ('Materia biológica', 'materia_biologica', 8, 'F4', 'B5', 'F5', 5),
  ('Electrónica',        null,               8, 'F4', 'B5', 'F5', 6);

-- Las letras salen de CAMPOS; los titulos, del libro real (Paso 1).
--
-- El `insert` esta deliberadamente incompleto: sin renglones es un error de
-- sintaxis y la migracion no corre. Es el comportamiento que se quiere. Un
-- default vacio que se aplicara «por ahora» produciria un libro con
-- encabezados en blanco que nadie notaria hasta entregarlo.
--
-- El `tipo` va: 'numero' en cantidad, peso_vacio, peso_total; 'entero' en los
-- tres riesgos NFPA y las coordenadas; 'fecha' en fecha_chequeo,
-- fecha_recoleccion y fecha_preparacion; 'texto' en todo lo demas.
insert into public.columna_formato (hoja, campo, columna, titulo, tipo, orden) values
  -- ▼▼▼ PEGA AQUI la salida de scratchpad/titulos.py ▼▼▼
  -- Reactivos: sub_ubicacion B, mueble C, repisa D, fila_cajon E, color F,
  --   hoja_seguridad G, sustancia H, marca I, presentacion J, peso_vacio K,
  --   peso_total L, cantidad M, unidad N, solido P, liquido Q, gas R,
  --   caracteristica_quimica S, caracteristica_toxica T, riesgo_salud U,
  --   riesgo_reactividad V, riesgo_inflamabilidad W, peligro_especial X,
  --   implica_peligro Y, observaciones AB
  -- Insumos y Material (identicas): clasificacion B, articulo C,
  --   especificacion D, marca E, cantidad F, unidad G, presentacion H,
  --   sub_ubicacion I, mueble J, repisa K, fila_cajon L, observaciones M
  -- Equipos: articulo B, marca C, modelo D, numero_serie E,
  --   numero_inventario F, sub_ubicacion G, laboratorio H, mueble I,
  --   funcionamiento J, fecha_chequeo K, mantenimiento L, observaciones M
  -- Materia biológica: articulo B, origen_especie C, cantidad D, unidad E,
  --   presentacion F, metodo_conservacion G, temperatura H,
  --   fecha_recoleccion I, fecha_preparacion J, responsable_muestra K,
  --   sub_ubicacion L, mueble M, repisa N, observaciones O
  -- Electrónica: clasificacion B, familia C, articulo D, especificacion E,
  --   cantidad F, unidad G, presentacion H, sub_ubicacion I, mueble J,
  --   coord_h K, coord_v L, coord_i M, observaciones N
  ;

alter table public.hoja_formato    enable row level security;
alter table public.columna_formato enable row level security;

-- El formato no es dato de nadie: es la descripcion de un documento publico.
-- Se lee con sesion y no se escribe desde la app: cambiarlo es una migracion.
create policy hoja_formato_lectura on public.hoja_formato
  for select to authenticated using (true);

create policy columna_formato_lectura on public.columna_formato
  for select to authenticated using (true);

revoke insert, update, delete on public.hoja_formato    from authenticated;
revoke insert, update, delete on public.columna_formato from authenticated;
revoke all on public.hoja_formato    from anon;
revoke all on public.columna_formato from anon;


-- ---------------------------------------------------------------------------
-- Como se ve una hoja
-- ---------------------------------------------------------------------------
-- Mismo contrato que `public.formulario(almacen, clasificacion)`: la base dice
-- como se arma, el cliente solo lo dibuja.
create or replace function public.formato_hoja(p_hoja text)
returns table (campo text, columna text, titulo text, tipo text, orden integer)
language sql
stable
set search_path = ''
as $$
  select cf.campo, cf.columna, cf.titulo, cf.tipo, cf.orden
  from public.columna_formato cf
  where cf.hoja = p_hoja
  order by cf.orden
$$;

grant execute on function public.formato_hoja(text) to authenticated;
revoke execute on function public.formato_hoja(text) from anon, public;
```

- [ ] **Paso 5: Aplica y corre las pruebas**

```bash
supabase db reset && supabase test db
```

Esperado: PASS. Si `formato_hoja('Equipos')` no da 12, te faltó pegar una
columna del Paso 1.

- [ ] **Paso 6: Tipos y verificación**

```bash
pnpm gen:types && pnpm typecheck && pnpm lint && pnpm build
```

- [ ] **Paso 7: Punto de commit.** Borra `scratchpad/titulos.py`, no va al repo.

---

## Tarea 3: `reporte_reposicion()` y `reporte_sin_minimo()`

**Archivos:**
- Crear: `supabase/migrations/20260921120200_reporte_reposicion.sql`
- Modificar: `supabase/tests/database/esquema.test.sql`, `supabase/tests/database/rls.test.sql`

**Interfaces:**
- Consume: `public.minimo_articulo` (Tarea 1), `private.puede_reportar()` (Tarea 1).
- Produce: `public.reporte_reposicion(p_almacen bigint, p_dias integer)` y
  `public.reporte_sin_minimo(p_almacen bigint, p_dias integer)`, ambas
  `returns table`. Las columnas exactas están en el Paso 3; el registro del
  cliente (Tarea 8) depende de esos nombres.

- [ ] **Paso 1: Escribe las pruebas que fallan**

En `esquema.test.sql`:

```sql
-- ---------------------------------------------------------------------------
-- Las funciones de reporte NO son security definer
-- ---------------------------------------------------------------------------
-- Una funcion `definer` correria como su dueno, se saltaria la politica de
-- `existencia` y publicaria el inventario de los cuatro almacenes a cualquiera
-- con la anon key, que viaja dentro del binario. Falla en silencio -la funcion
-- responde igual de bien-, igual que la vista sin security_invoker. De ahi que
-- el seguro este aqui y no en la revision de nadie.
select is(
  (select bool_or(p.prosecdef)
     from pg_catalog.pg_proc p
     join pg_catalog.pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname like 'reporte\_%'),
  false,
  'Ninguna funcion de reporte es security definer'
);

-- ---------------------------------------------------------------------------
-- El vigente no cuenta lo que no se puede usar
-- ---------------------------------------------------------------------------
select is(
  (select vigente from public.reporte_reposicion(
     (select id from public.almacen where clave = 'N3'))
    where articulo = 'ACETONA-PRUEBA'),
  40::numeric(14,4),
  'Un envase contaminado y uno vencido no cuentan como stock usable'
);
```

Esa prueba necesita datos. Justo antes, monta el caso:

```sql
-- Tres envases del mismo articulo en N3: uno bueno, uno vencido, uno
-- contaminado. Solo el bueno es stock usable.
insert into public.articulo (nombre_canonico, clasificacion, unidad_base)
values ('ACETONA-PRUEBA', 'reactivo', 'mL');

insert into public.existencia (articulo_id, almacen_id, cantidad, fecha_caducidad, estado)
select a.id, al.id, v.cantidad, v.caduca, v.estado
from public.articulo a, public.almacen al,
     (values (40::numeric, null::date,        'disponible'::public.estado_existencia),
             (25::numeric, current_date - 1,  'disponible'::public.estado_existencia),
             (15::numeric, null::date,        'contaminado'::public.estado_existencia)
     ) as v(cantidad, caduca, estado)
where a.nombre_canonico = 'ACETONA-PRUEBA' and al.clave = 'N3';

insert into public.minimo_articulo (articulo_id, almacen_id, minimo)
select a.id, al.id, 100
from public.articulo a, public.almacen al
where a.nombre_canonico = 'ACETONA-PRUEBA' and al.clave = 'N3';
```

En `rls.test.sql`:

```sql
select pg_temp.como('lectura@uaeh.local');

select throws_ok(
  $$ select * from public.reporte_reposicion(null) $$,
  'P0001',
  'Solo un responsable o un administrador puede generar reportes',
  'Un usuario de consulta no genera reportes: el archivo sale del sistema'
);

select pg_temp.como('n3@uaeh.local');

select is_empty(
  $$ select * from public.reporte_reposicion(
       (select id from public.almacen where clave = 'N4')) $$,
  'El responsable de N3 no saca el reporte de N4 ni pidiendolo por id'
);
```

Sube `plan(93)` a `plan(95)` y `plan(161)` a `plan(163)`.

- [ ] **Paso 2: Corre y verifica que fallan**

```bash
supabase test db
```

Esperado: FAIL, `public.reporte_reposicion` no existe.

- [ ] **Paso 3: Escribe la migración**

`supabase/migrations/20260921120200_reporte_reposicion.sql`:

```sql
-- El reporte de compras.
--
-- Dos funciones y no una, porque el libro lleva dos hojas y la segunda es la
-- que lo hace util el primer dia: casi ningun minimo esta capturado, asi que
-- la hoja de reposicion sale vacia, y un reporte que sale vacio se abre una
-- vez y no se vuelve a abrir. `reporte_sin_minimo` contesta "estos son los que
-- de verdad gastas, empieza por ellos". Decision D4 del spec.
--
-- SIN security definer, las dos: la RLS de `existencia` y `minimo_articulo`
-- tiene que aplicarles. El chequeo de rol no obliga a cambiarlo, porque
-- `puede_reportar()` si es definer y se llama desde dentro.

create or replace function public.reporte_reposicion(
  p_almacen bigint  default null,
  p_dias    integer default 180
)
returns table (
  almacen        text,
  clasificacion  public.clasificacion_articulo,
  articulo       text,
  descripcion    text,
  unidad         text,
  total_fisico   numeric,
  vencido        numeric,
  vigente        numeric,
  minimo         numeric,
  faltante       numeric,
  envases        bigint,
  consumo        numeric,
  ultima_entrada date,
  ubicaciones    text
)
language plpgsql
stable
set search_path = ''
as $$
begin
  if not (select private.puede_reportar()) then
    raise exception 'Solo un responsable o un administrador puede generar reportes';
  end if;

  return query
  with stock as (
    select e.articulo_id, e.almacen_id,
           sum(e.cantidad) as total_fisico,
           -- Tres columnas y no una: el faltante sale del vigente, pero las
           -- otras dos quedan a la vista para que el numero sea explicable.
           -- "Tienes 2 L de acetona" cuando 1.5 L estan vencidos no es un
           -- dato, es una compra que no se hace hasta media practica.
           coalesce(sum(e.cantidad) filter (
             where e.fecha_caducidad is not null
               and e.fecha_caducidad < current_date), 0) as vencido,
           coalesce(sum(e.cantidad) filter (
             where e.estado not in ('contaminado', 'mantenimiento', 'baja')
               and (e.fecha_caducidad is null
                    or e.fecha_caducidad >= current_date)), 0) as vigente,
           count(*) as envases,
           string_agg(distinct u.etiqueta, ' · ') as ubicaciones
    from public.existencia e
    left join public.ubicacion u on u.id = e.ubicacion_id
    where p_almacen is null or e.almacen_id = p_almacen
    group by e.articulo_id, e.almacen_id
  ),
  gasto as (
    -- `carga_inicial` queda fuera por omision: no esta en la lista. Esta al
    -- frente del enum precisamente para que el primer reporte de consumo no
    -- cuente la carga de arranque como compra del semestre.
    select m.almacen_id, e.articulo_id, sum(-m.cantidad) as consumo
    from public.movimiento m
    join public.existencia e on e.id = m.existencia_id
    where m.tipo in ('consumo', 'merma')
      and m.ocurrido_en >= now() - make_interval(days => p_dias)
    group by m.almacen_id, e.articulo_id
  ),
  entrada as (
    select m.almacen_id, e.articulo_id, max(m.ocurrido_en)::date as ultima
    from public.movimiento m
    join public.existencia e on e.id = m.existencia_id
    where m.tipo = 'entrada'
    group by m.almacen_id, e.articulo_id
  )
  select al.clave,
         a.clasificacion,
         a.nombre_canonico,
         a.descripcion,
         a.unidad_base,
         coalesce(s.total_fisico, 0),
         coalesce(s.vencido, 0),
         coalesce(s.vigente, 0),
         ma.minimo,
         greatest(ma.minimo - coalesce(s.vigente, 0), 0),
         coalesce(s.envases, 0),
         coalesce(g.consumo, 0),
         en.ultima,
         s.ubicaciones
  from public.minimo_articulo ma
  join public.articulo a  on a.id  = ma.articulo_id
  join public.almacen  al on al.id = ma.almacen_id
  left join stock   s  on s.articulo_id  = ma.articulo_id and s.almacen_id  = ma.almacen_id
  left join gasto   g  on g.articulo_id  = ma.articulo_id and g.almacen_id  = ma.almacen_id
  left join entrada en on en.articulo_id = ma.articulo_id and en.almacen_id = ma.almacen_id
  where (p_almacen is null or ma.almacen_id = p_almacen)
    and coalesce(s.vigente, 0) < ma.minimo
  order by greatest(ma.minimo - coalesce(s.vigente, 0), 0) desc, a.nombre_canonico;
end $$;

comment on function public.reporte_reposicion(bigint, integer) is
  'Articulos bajo minimo. Hoja 1 del libro de compras.';


create or replace function public.reporte_sin_minimo(
  p_almacen bigint  default null,
  p_dias    integer default 180
)
returns table (
  almacen       text,
  clasificacion public.clasificacion_articulo,
  articulo      text,
  descripcion   text,
  unidad        text,
  vigente       numeric,
  consumo       numeric,
  envases       bigint
)
language plpgsql
stable
set search_path = ''
as $$
begin
  if not (select private.puede_reportar()) then
    raise exception 'Solo un responsable o un administrador puede generar reportes';
  end if;

  return query
  with gasto as (
    select m.almacen_id, e.articulo_id, sum(-m.cantidad) as consumo
    from public.movimiento m
    join public.existencia e on e.id = m.existencia_id
    where m.tipo in ('consumo', 'merma')
      and m.ocurrido_en >= now() - make_interval(days => p_dias)
      and (p_almacen is null or m.almacen_id = p_almacen)
    group by m.almacen_id, e.articulo_id
  ),
  stock as (
    select e.articulo_id, e.almacen_id,
           coalesce(sum(e.cantidad) filter (
             where e.estado not in ('contaminado', 'mantenimiento', 'baja')
               and (e.fecha_caducidad is null
                    or e.fecha_caducidad >= current_date)), 0) as vigente,
           count(*) as envases
    from public.existencia e
    group by e.articulo_id, e.almacen_id
  )
  select al.clave, a.clasificacion, a.nombre_canonico, a.descripcion,
         a.unidad_base, coalesce(s.vigente, 0), g.consumo, coalesce(s.envases, 0)
  from gasto g
  join public.articulo a  on a.id  = g.articulo_id
  join public.almacen  al on al.id = g.almacen_id
  left join stock s on s.articulo_id = g.articulo_id and s.almacen_id = g.almacen_id
  where not exists (
    select 1 from public.minimo_articulo ma
    where ma.articulo_id = g.articulo_id and ma.almacen_id = g.almacen_id
  )
  -- Descendente: la lista de trabajo empieza por lo que mas se gasta.
  order by g.consumo desc, a.nombre_canonico;
end $$;

comment on function public.reporte_sin_minimo(bigint, integer) is
  'Articulos que se consumen y no tienen minimo. Hoja 2: la lista de trabajo.';

grant execute on function public.reporte_reposicion(bigint, integer) to authenticated;
grant execute on function public.reporte_sin_minimo(bigint, integer)  to authenticated;
revoke execute on function public.reporte_reposicion(bigint, integer) from anon, public;
revoke execute on function public.reporte_sin_minimo(bigint, integer)  from anon, public;
```

- [ ] **Paso 4: Aplica y corre las pruebas**

```bash
supabase db reset && supabase test db
```

Esperado: PASS. Si `vigente` da 80 en vez de 40, el `filter` no está excluyendo
el vencido o el contaminado — revisa que el `coalesce` envuelva al `sum`
completo y no al revés.

- [ ] **Paso 5: Tipos y verificación**

```bash
pnpm gen:types && pnpm typecheck && pnpm lint && pnpm build
```

- [ ] **Paso 6: Punto de commit.**

---

## Tarea 4: `reporte_caducidades()` y `reporte_conteo()`

**Archivos:**
- Crear: `supabase/migrations/20260921120300_reporte_caducidades.sql`
- Modificar: `supabase/tests/database/esquema.test.sql`

**Interfaces:**
- Produce: `public.reporte_caducidades(p_almacen bigint, p_dias integer)` y
  `public.reporte_conteo(p_almacen bigint, p_con_cantidad boolean)`.

- [ ] **Paso 1: Escribe las pruebas que fallan**

```sql
-- El gradiente es la informacion: un corte en "vencido / no vencido" esconde
-- que algo vence pasado manana. Por eso una sola hoja ordenada por dias
-- restantes, con los vencidos arriba en negativo.
select is(
  (select dias_restantes from public.reporte_caducidades(
     (select id from public.almacen where clave = 'N3'), 90) limit 1),
  -1,
  'Lo ya vencido sale primero y con dias negativos'
);

-- El conteo ciego: sin la cantidad del sistema, quien cuenta no puede copiar
-- el numero que ya estaba, y la diferencia que salga es real.
select is(
  (select count(*)::int from public.reporte_conteo(
     (select id from public.almacen where clave = 'N3'), false)
    where cantidad_sistema is not null),
  0,
  'Con p_con_cantidad en false la cantidad del sistema va nula, no omitida'
);
```

Sube `plan(95)` a `plan(97)`.

- [ ] **Paso 2: Corre y verifica que fallan**

```bash
supabase test db
```

Esperado: FAIL, `public.reporte_caducidades` no existe.

- [ ] **Paso 3: Escribe la migración**

```sql
-- Caducidades y hoja de conteo.

create or replace function public.reporte_caducidades(
  p_almacen bigint  default null,
  p_dias    integer default 90
)
returns table (
  almacen         text,
  codigo          text,
  clasificacion   public.clasificacion_articulo,
  articulo        text,
  marca           text,
  presentacion    text,
  cantidad        numeric,
  unidad          text,
  fecha_caducidad date,
  dias_restantes  integer,
  ubicacion       text,
  estado          public.estado_existencia
)
language plpgsql
stable
set search_path = ''
as $$
begin
  if not (select private.puede_reportar()) then
    raise exception 'Solo un responsable o un administrador puede generar reportes';
  end if;

  return query
  select al.clave, e.codigo, a.clasificacion, a.nombre_canonico, e.marca,
         e.presentacion, e.cantidad, a.unidad_base, e.fecha_caducidad,
         (e.fecha_caducidad - current_date)::integer,
         u.etiqueta, e.estado
  from public.existencia e
  join public.articulo a  on a.id  = e.articulo_id
  join public.almacen  al on al.id = e.almacen_id
  left join public.ubicacion u on u.id = e.ubicacion_id
  where e.fecha_caducidad is not null
    and e.fecha_caducidad <= current_date + p_dias
    -- Lo dado de baja ya no es inventario, igual que en `almacen_resumen`.
    and e.estado <> 'baja'
    and (p_almacen is null or e.almacen_id = p_almacen)
  order by e.fecha_caducidad, a.nombre_canonico;
end $$;

comment on function public.reporte_caducidades(bigint, integer) is
  'Vencidos y por vencer, en una sola hoja ordenada por dias restantes.';


create or replace function public.reporte_conteo(
  p_almacen      bigint  default null,
  p_con_cantidad boolean default false
)
returns table (
  almacen          text,
  ubicacion        text,
  codigo           text,
  clasificacion    public.clasificacion_articulo,
  articulo         text,
  descripcion      text,
  marca            text,
  presentacion     text,
  unidad           text,
  cantidad_sistema numeric
)
language plpgsql
stable
set search_path = ''
as $$
begin
  if not (select private.puede_reportar()) then
    raise exception 'Solo un responsable o un administrador puede generar reportes';
  end if;

  return query
  select al.clave, u.etiqueta, e.codigo, a.clasificacion, a.nombre_canonico,
         a.descripcion, e.marca, e.presentacion, a.unidad_base,
         -- La columna existe siempre y va nula cuando el conteo es ciego. Que
         -- la forma de la fila no dependa del parametro es lo que deja que el
         -- registro del cliente declare las columnas una sola vez.
         case when p_con_cantidad then e.cantidad else null end
  from public.existencia e
  join public.articulo a  on a.id  = e.articulo_id
  join public.almacen  al on al.id = e.almacen_id
  left join public.ubicacion u on u.id = e.ubicacion_id
  where e.estado <> 'baja'
    and (p_almacen is null or e.almacen_id = p_almacen)
  -- Por ubicacion y no alfabetico: la lista sigue el recorrido fisico del
  -- almacen, que es como se cuenta. `nulls last` deja al final lo que no tiene
  -- sitio asignado, que es justo lo que hay que ir a buscar.
  order by u.etiqueta nulls last, a.nombre_canonico;
end $$;

comment on function public.reporte_conteo(bigint, boolean) is
  'Hoja para el conteo fisico, ordenada por ubicacion. La cantidad del sistema es opcional.';

grant execute on function public.reporte_caducidades(bigint, integer) to authenticated;
grant execute on function public.reporte_conteo(bigint, boolean)      to authenticated;
revoke execute on function public.reporte_caducidades(bigint, integer) from anon, public;
revoke execute on function public.reporte_conteo(bigint, boolean)      from anon, public;
```

- [ ] **Paso 4: Aplica, prueba, tipos**

```bash
supabase db reset && supabase test db
pnpm gen:types && pnpm typecheck && pnpm lint && pnpm build
```

- [ ] **Paso 5: Punto de commit.**

---

## Tarea 5: `inventario_formato()`

**Archivos:**
- Crear: `supabase/migrations/20260921120400_inventario_formato.sql`
- Modificar: `supabase/tests/database/esquema.test.sql`

**Interfaces:**
- Consume: `public.hoja_formato` y `public.columna_formato` (Tarea 2).
- Produce: `public.inventario_formato(p_almacen bigint, p_hoja text) returns table (renglon jsonb)`.

**Por qué `jsonb` y no columnas:** cada hoja tiene un juego de campos distinto.
Una función por hoja serían seis funciones casi iguales; una función con la
unión de todas las columnas sería una fila con treinta huecos. Devolver el
renglón llaveado **por el mismo nombre de campo que usa `columna_formato`** deja
que el exportador haga una sola cosa: para cada columna de la hoja, escribir
`renglon->>campo` en su letra. Es la misma forma en que el ETL lee.

- [ ] **Paso 1: Escribe la prueba que falla**

```sql
select is(
  (select renglon->>'sustancia'
     from public.inventario_formato(
       (select id from public.almacen where clave = 'N3'), 'Reactivos')
    where renglon->>'sustancia' = 'ACETONA-PRUEBA' limit 1),
  'ACETONA-PRUEBA',
  'El renglon de Reactivos se llavea por los campos del formato, no por los del esquema'
);
```

Sube `plan(97)` a `plan(98)`.

- [ ] **Paso 2: Corre y verifica que falla**

```bash
supabase test db
```

Esperado: FAIL, `public.inventario_formato` no existe.

- [ ] **Paso 3: Escribe la migración**

```sql
-- El inventario con la forma del formato unificado.
--
-- Llaveado por el campo del formato -`sustancia`, `peso_vacio`, `color`- y no
-- por el del esquema, que es la misma traduccion que ya hace
-- `private.clave_renglon` en el otro sentido.
create or replace function public.inventario_formato(
  p_almacen bigint,
  p_hoja    text
)
returns table (renglon jsonb)
language plpgsql
stable
set search_path = ''
as $$
declare
  v_clasificacion public.clasificacion_articulo;
begin
  if not (select private.puede_reportar()) then
    raise exception 'Solo un responsable o un administrador puede generar reportes';
  end if;

  select hf.clasificacion into v_clasificacion
  from public.hoja_formato hf where hf.hoja = p_hoja;

  if not found then
    raise exception 'La hoja % no es del formato unificado', p_hoja;
  end if;

  return query
  select jsonb_strip_nulls(jsonb_build_object(
    -- Comunes a todas las hojas.
    'articulo',      a.nombre_canonico,
    'sustancia',     a.nombre_canonico,   -- Reactivos titula la misma columna asi
    'especificacion', a.descripcion,
    'clasificacion', a.clasificacion::text,
    'familia',       a.familia,
    'marca',         e.marca,
    'modelo',        e.modelo,
    'presentacion',  e.presentacion,
    'cantidad',      e.cantidad,
    'unidad',        a.unidad_base,
    'observaciones', e.observaciones,
    -- Ubicacion: se reparte en los mismos componentes con que la armo el ETL.
    'sub_ubicacion', u.componentes->>'sub_ubicacion',
    'mueble',        u.componentes->>'mueble',
    'repisa',        u.componentes->>'repisa',
    'fila_cajon',    u.componentes->>'fila_cajon',
    'coord_h',       u.componentes->>'coord_h',
    'coord_v',       u.componentes->>'coord_v',
    'coord_i',       u.componentes->>'coord_i',
    -- Reactivos.
    'peso_vacio',    e.peso_frasco_vacio,
    'peso_total',    e.peso_total,
    'color',         ar.color_almacenaje::text,
    'hoja_seguridad', ar.tiene_hoja_seguridad,
    'caracteristica_quimica', ar.caracteristica_quimica,
    'caracteristica_toxica',  ar.caracteristica_toxica,
    'riesgo_salud',           ar.riesgo_salud,
    'riesgo_reactividad',     ar.riesgo_reactividad,
    'riesgo_inflamabilidad',  ar.riesgo_inflamabilidad,
    'peligro_especial',       ar.peligro_especial,
    'implica_peligro',        ar.implica_actividad_peligro,
    'solido',   ar.estado_fisico = 'solido',
    'liquido',  ar.estado_fisico = 'liquido',
    'gas',      ar.estado_fisico = 'gas',
    -- Equipos.
    'numero_serie',       e.numero_serie,
    'numero_inventario',  e.numero_inventario_uaeh,
    'laboratorio',        lab.nombre,
    'funcionamiento',     e.funcionamiento::text,
    'fecha_chequeo',      e.fecha_chequeo,
    'mantenimiento',      e.mantenimiento,
    -- Materia biologica.
    'origen_especie',       ab.origen_especie,
    'metodo_conservacion',  e.metodo_conservacion,
    'temperatura',          e.temperatura,
    'fecha_recoleccion',    e.fecha_recoleccion,
    'fecha_preparacion',    e.fecha_preparacion,
    'responsable_muestra',  e.responsable_muestra
  ))
  from public.existencia e
  join public.articulo a on a.id = e.articulo_id
  left join public.articulo_reactivo  ar  on ar.articulo_id = a.id
  left join public.articulo_biologico ab  on ab.articulo_id = a.id
  left join public.ubicacion          u   on u.id  = e.ubicacion_id
  left join public.laboratorio        lab on lab.id = e.laboratorio_id
  where e.almacen_id = p_almacen
    and e.estado <> 'baja'
    -- Reactivos, Equipos y Materia biologica tienen hoja propia. Las otras tres
    -- -Insumos, Material, Electronica- comparten forma y se separan por la
    -- clasificacion del renglon, igual que razona `private.hoja_de()`.
    and (case
           when v_clasificacion is not null then a.clasificacion = v_clasificacion
           when p_hoja = 'Insumos'     then a.clasificacion = 'insumo'
           when p_hoja = 'Material'    then a.clasificacion = 'material'
           when p_hoja = 'Electrónica' then a.clasificacion = 'componente'
         end)
  order by u.etiqueta nulls last, a.nombre_canonico;
end $$;

comment on function public.inventario_formato(bigint, text) is
  'El inventario de un almacen con la forma de una hoja del formato unificado.';

grant execute on function public.inventario_formato(bigint, text) to authenticated;
revoke execute on function public.inventario_formato(bigint, text) from anon, public;
```

- [ ] **Paso 4: Aplica, prueba, tipos**

```bash
supabase db reset && supabase test db
pnpm gen:types && pnpm typecheck && pnpm lint && pnpm build
```

- [ ] **Paso 5: Punto de commit.** Aquí termina la base. Las siete tareas
  siguientes son de cliente.

---

## Tarea 6: `traerTodo()`, la paginación que no trunca

**Archivos:**
- Crear: `src/features/reportes/paginacion.ts`, `src/features/reportes/paginacion.test.ts`

**Interfaces:**
- Produce: `traerTodo<T>(pagina: (desde: number, hasta: number) => Promise<{ data: T[] | null; error: unknown }>): Promise<T[]>` y la constante `TOPE = 50_000`.

Va **antes** que `aExcel()` a propósito: es la pieza que decide si el archivo
sale completo o no sale, y quiero verla en verde antes de que exista algo que
escriba archivos.

- [ ] **Paso 1: Escribe las pruebas que fallan**

```ts
// src/features/reportes/paginacion.test.ts
import { describe, expect, it } from 'vitest'

import { TOPE, traerTodo } from './paginacion'

/** Una fuente falsa de `n` filas que respeta el rango que le piden. */
function fuente(n: number) {
  return async (desde: number, hasta: number) => ({
    data: Array.from(
      { length: Math.max(0, Math.min(hasta, n - 1) - desde + 1) },
      (_, i) => ({ id: desde + i }),
    ),
    error: null,
  })
}

describe('traerTodo', () => {
  it('trae las 2600 filas completas y no las 1000 de max_rows', async () => {
    const filas = await traerTodo(fuente(2600))
    expect(filas).toHaveLength(2600)
    expect(filas.at(-1)).toEqual({ id: 2599 })
  })

  it('una sola página cuando hay menos de 1000', async () => {
    expect(await traerTodo(fuente(7))).toHaveLength(7)
  })

  it('no pide una página de más cuando el total es múltiplo exacto', async () => {
    let llamadas = 0
    const contada = (desde: number, hasta: number) => {
      llamadas += 1
      return fuente(2000)(desde, hasta)
    }
    await traerTodo(contada)
    // 2 llenas + 1 vacía que confirma el final. Menos sería adivinar.
    expect(llamadas).toBe(3)
  })

  it('al llegar al tope lanza, en vez de devolver un reporte a medias', async () => {
    await expect(traerTodo(fuente(TOPE + 1))).rejects.toThrow(/demasiado grande/i)
  })

  it('propaga el error de la fuente sin envolverlo', async () => {
    const rota = async () => ({ data: null, error: new Error('pum') })
    await expect(traerTodo(rota)).rejects.toThrow('pum')
  })
})
```

- [ ] **Paso 2: Corre y verifica que fallan**

```bash
pnpm test -- paginacion
```

Esperado: FAIL, no existe `./paginacion`.

- [ ] **Paso 3: Escribe la implementación**

```ts
// src/features/reportes/paginacion.ts

/**
 * `max_rows = 1000` en supabase/config.toml, y aplica tambien a las RPC. Un
 * reporte de reactivos de N3 son ~2,600 renglones: volveria con 1,000 SIN
 * AVISAR, en un Excel perfectamente formado con autofiltro y todo, al que le
 * faltan dos tercios del inventario.
 *
 * Es el mismo modo de fallo que la vista sin `security_invoker` que «funciona
 * igual de bien hasta el dia malo». De ahi la regla:
 *
 *   Un archivo truncado en silencio es peor que un error.
 */
const POR_PAGINA = 1000

/** Por encima de esto algo esta mal en los parametros, no en el inventario. */
export const TOPE = 50_000

export async function traerTodo<T>(
  pagina: (
    desde: number,
    hasta: number,
  ) => PromiseLike<{ data: T[] | null; error: unknown }>,
): Promise<T[]> {
  const filas: T[] = []

  for (let desde = 0; ; desde += POR_PAGINA) {
    const { data, error } = await pagina(desde, desde + POR_PAGINA - 1)
    if (error) throw error

    const lote = data ?? []
    filas.push(...lote)

    // Una pagina incompleta es el final. Parar en `length === 0` costaria una
    // consulta de mas en cada reporte; parar antes de tiempo devolveria datos
    // incompletos, que es justo lo que esto existe para evitar.
    if (lote.length < POR_PAGINA) return filas

    if (filas.length >= TOPE) {
      throw new Error(
        `El reporte es demasiado grande: supera ${TOPE.toLocaleString('es-MX')} renglones. ` +
          'Acota el almacén o el periodo y vuelve a intentarlo.',
      )
    }
  }
}
```

- [ ] **Paso 4: Corre y verifica que pasan**

```bash
pnpm test -- paginacion
```

Esperado: PASS, cinco pruebas.

- [ ] **Paso 5: Punto de commit.**

---

## Tarea 7: `aExcel()`

**Archivos:**
- Crear: `src/features/reportes/aExcel.ts`, `src/features/reportes/aExcel.test.ts`
- Modificar: `package.json` (agregar `exceljs`)

**Interfaces:**
- Consume: nada de tareas anteriores.
- Produce:
  ```ts
  export type Columna = {
    clave: string
    titulo: string
    tipo: 'texto' | 'numero' | 'entero' | 'fecha'
    ancho?: number
    vacia?: boolean
    resaltar?: (fila: Record<string, unknown>) => 'alerta' | 'aviso' | null
  }
  export type HojaLista = { nombre: string; columnas: Columna[]; filas: Record<string, unknown>[] }
  export async function aExcel(opciones: {
    titulo: string
    parametros: { etiqueta: string; valor: string }[]
    hojas: HojaLista[]
  }): Promise<ArrayBuffer>
  export function descargar(buffer: ArrayBuffer, nombre: string): void
  ```
  Las tareas 8–11 dependen de estos nombres exactos.

- [ ] **Paso 1: Instala la dependencia**

```bash
pnpm add exceljs
```

Es la única dependencia nueva de todo el plan y está aprobada en la §6 del spec.
Se eligió sobre SheetJS porque la versión comunitaria de aquél casi no da
estilos, y son justo los que separan un Excel de un CSV renombrado.

- [ ] **Paso 2: Escribe las pruebas que fallan**

```ts
// src/features/reportes/aExcel.test.ts
import ExcelJS from 'exceljs'
import { describe, expect, it } from 'vitest'

import { aExcel } from './aExcel'

async function abrir(buffer: ArrayBuffer) {
  const libro = new ExcelJS.Workbook()
  await libro.xlsx.load(buffer)
  return libro
}

const BASE = {
  titulo: 'Caducidades',
  parametros: [
    { etiqueta: 'Almacén', valor: 'N3' },
    { etiqueta: 'Horizonte', valor: '90 días' },
  ],
  hojas: [
    {
      nombre: 'Caducidades',
      columnas: [
        { clave: 'articulo', titulo: 'Artículo', tipo: 'texto' as const },
        { clave: 'cantidad', titulo: 'Cantidad', tipo: 'numero' as const },
        { clave: 'caduca', titulo: 'Caduca', tipo: 'fecha' as const },
        { clave: 'conteo', titulo: 'Conteo', tipo: 'texto' as const, vacia: true },
      ],
      filas: [
        { articulo: 'Acetona', cantidad: 40.5, caduca: '2026-12-01' },
        { articulo: 'Etanol', cantidad: 12, caduca: '2026-09-01' },
      ],
    },
  ],
}

describe('aExcel', () => {
  it('escribe la hoja de Parámetros primero', async () => {
    const libro = await abrir(await aExcel(BASE))
    expect(libro.worksheets[0].name).toBe('Parámetros')
    expect(libro.worksheets[1].name).toBe('Caducidades')
  })

  it('registra en Parámetros con qué filtros salió', async () => {
    const libro = await abrir(await aExcel(BASE))
    const texto = JSON.stringify(libro.getWorksheet('Parámetros')?.getSheetValues())
    expect(texto).toContain('Almacén')
    expect(texto).toContain('N3')
    expect(texto).toContain('90 días')
  })

  it('escribe los números como número, no como texto', async () => {
    const libro = await abrir(await aExcel(BASE))
    const celda = libro.getWorksheet('Caducidades')?.getCell('B2')
    expect(typeof celda?.value).toBe('number')
    expect(celda?.value).toBe(40.5)
  })

  it('escribe las fechas como fecha, no como texto', async () => {
    const libro = await abrir(await aExcel(BASE))
    const celda = libro.getWorksheet('Caducidades')?.getCell('C2')
    expect(celda?.value).toBeInstanceOf(Date)
  })

  it('deja vacía la columna marcada, pero con su encabezado', async () => {
    const libro = await abrir(await aExcel(BASE))
    const hoja = libro.getWorksheet('Caducidades')
    expect(hoja?.getCell('D1').value).toBe('Conteo')
    expect(hoja?.getCell('D2').value).toBeFalsy()
  })

  it('congela el encabezado y pone autofiltro', async () => {
    const libro = await abrir(await aExcel(BASE))
    const hoja = libro.getWorksheet('Caducidades')
    expect(hoja?.views?.[0]).toMatchObject({ state: 'frozen', ySplit: 1 })
    expect(hoja?.autoFilter).toBeTruthy()
  })

  it('resalta la fila que la columna marca como alerta', async () => {
    const conResalte = {
      ...BASE,
      hojas: [
        {
          ...BASE.hojas[0],
          columnas: BASE.hojas[0].columnas.map((c) =>
            c.clave === 'cantidad'
              ? { ...c, resaltar: (f: Record<string, unknown>) =>
                  Number(f.cantidad) < 20 ? ('alerta' as const) : null }
              : c,
          ),
        },
      ],
    }
    const libro = await abrir(await aExcel(conResalte))
    const hoja = libro.getWorksheet('Caducidades')
    expect(hoja?.getCell('B3').fill).toBeTruthy()   // Etanol, 12
    expect(hoja?.getCell('B2').fill?.type).toBeUndefined() // Acetona, 40.5
  })
})
```

- [ ] **Paso 3: Corre y verifica que fallan**

```bash
pnpm test -- aExcel
```

Esperado: FAIL, no existe `./aExcel`.

- [ ] **Paso 4: Escribe la implementación**

```ts
// src/features/reportes/aExcel.ts
import ExcelJS from 'exceljs'

/**
 * La UNICA pieza del sistema que sabe de exceljs. Todo lo demas -el registro,
 * las pantallas, las consultas- habla de filas y columnas, no de libros.
 */

export type TipoColumna = 'texto' | 'numero' | 'entero' | 'fecha'

export type Columna = {
  clave: string
  titulo: string
  tipo: TipoColumna
  ancho?: number
  /** Sale con encabezado y sin datos: es para anotar a mano. */
  vacia?: boolean
  resaltar?: (fila: Record<string, unknown>) => 'alerta' | 'aviso' | null
}

export type HojaLista = {
  nombre: string
  columnas: Columna[]
  filas: Record<string, unknown>[]
}

/** Rojo y ámbar suaves: se leen impresos en blanco y negro sin taparse. */
const RELLENO = {
  alerta: 'FFFFD9D9',
  aviso: 'FFFFF0C7',
} as const

export async function aExcel(opciones: {
  titulo: string
  parametros: { etiqueta: string; valor: string }[]
  hojas: HojaLista[]
}): Promise<ArrayBuffer> {
  const libro = new ExcelJS.Workbook()
  libro.created = new Date()

  // Siempre primero. El destinatario es uno mismo, asi que no lleva membrete,
  // pero si lleva esto: un archivo en Descargas dentro de tres meses sin saber
  // con que filtros salio no vale nada.
  const portada = libro.addWorksheet('Parámetros')
  portada.columns = [{ width: 28 }, { width: 52 }]
  portada.addRow([opciones.titulo]).font = { bold: true, size: 14 }
  portada.addRow([])
  for (const { etiqueta, valor } of opciones.parametros) {
    const fila = portada.addRow([etiqueta, valor])
    fila.getCell(1).font = { bold: true }
  }

  for (const hoja of opciones.hojas) {
    const ws = libro.addWorksheet(hoja.nombre)

    ws.columns = hoja.columnas.map((c) => ({
      header: c.titulo,
      key: c.clave,
      width: c.ancho ?? anchoDe(c),
    }))
    ws.getRow(1).font = { bold: true }
    ws.views = [{ state: 'frozen', ySplit: 1 }]
    ws.autoFilter = {
      from: { row: 1, column: 1 },
      to: { row: 1, column: hoja.columnas.length },
    }

    for (const fila of hoja.filas) {
      const agregada = ws.addRow(
        Object.fromEntries(
          hoja.columnas.map((c) => [c.clave, c.vacia ? null : convertir(fila[c.clave], c.tipo)]),
        ),
      )

      hoja.columnas.forEach((c, i) => {
        const token = c.resaltar?.(fila)
        if (!token) return
        agregada.getCell(i + 1).fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: RELLENO[token] },
        }
      })
    }
  }

  return libro.xlsx.writeBuffer() as Promise<ArrayBuffer>
}

/**
 * El tipo real importa, y no es cosmetica: los Excel originales traian
 * «Un frasco» en columna numerica. El formato nuevo no puede reintroducir por
 * la puerta de salida lo que el ETL limpio en la de entrada.
 */
function convertir(valor: unknown, tipo: TipoColumna) {
  if (valor === null || valor === undefined || valor === '') return null

  switch (tipo) {
    case 'numero':
    case 'entero': {
      const n = Number(valor)
      // Un texto donde se esperaba numero se deja como texto en vez de
      // convertirse en NaN: el dato malo se ve, el NaN se disimula.
      return Number.isFinite(n) ? n : String(valor)
    }
    case 'fecha': {
      const d = new Date(String(valor))
      return Number.isNaN(d.getTime()) ? String(valor) : d
    }
    default:
      return String(valor)
  }
}

function anchoDe(c: Columna) {
  if (c.tipo === 'fecha') return 14
  if (c.tipo === 'numero' || c.tipo === 'entero') return 12
  return Math.max(14, Math.min(48, c.titulo.length + 6))
}

/**
 * La descarga. Va aparte de `aExcel` para que las pruebas puedan inspeccionar
 * el libro sin tocar el DOM.
 */
export function descargar(buffer: ArrayBuffer, nombre: string) {
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
  const url = URL.createObjectURL(blob)
  const enlace = document.createElement('a')
  enlace.href = url
  enlace.download = nombre
  enlace.click()
  URL.revokeObjectURL(url)
}
```

- [ ] **Paso 5: Corre y verifica que pasan**

```bash
pnpm test -- aExcel
pnpm typecheck && pnpm lint && pnpm build
```

Esperado: PASS, siete pruebas. Si `build` se queja del tamaño del bundle, eso lo
resuelve la Tarea 9 con la carga diferida de la ruta.

- [ ] **Paso 6: Punto de commit.**

---

## Tarea 8: El registro y las consultas

**Archivos:**
- Crear: `src/features/reportes/registro.ts`, `src/features/reportes/registro.test.ts`, `src/features/reportes/consultas.ts`

**Interfaces:**
- Consume: `Columna` de `aExcel.ts` (Tarea 7); las cuatro RPC de las tareas 3–5.
- Produce: `REPORTES: Reporte[]`, `nombreDeArchivo(reporte, almacenClave)`, y los hooks `useGenerarReporte()`, `useMinimos(almacenId)`, `useGuardarMinimo()`.

- [ ] **Paso 1: Escribe la prueba que falla**

```ts
// src/features/reportes/registro.test.ts
import { describe, expect, it } from 'vitest'

import { nombreDeArchivo, REPORTES } from './registro'

describe('registro de reportes', () => {
  it('los cuatro reportes de la entrega 1', () => {
    expect(REPORTES.map((r) => r.id)).toEqual([
      'reposicion', 'caducidades', 'conteo', 'inventario',
    ])
  })

  it('ningún id repetido: es la llave de la ruta y de la caché', () => {
    expect(new Set(REPORTES.map((r) => r.id)).size).toBe(REPORTES.length)
  })

  it('toda columna con datos tiene clave; solo las vacías pueden no tenerla', () => {
    for (const reporte of REPORTES) {
      for (const hoja of reporte.hojas) {
        for (const columna of hoja.columnas) {
          if (!columna.vacia) expect(columna.clave).toBeTruthy()
          expect(columna.titulo).toBeTruthy()
        }
      }
    }
  })

  it('el nombre del archivo es determinista y lleva almacén y fecha', () => {
    const nombre = nombreDeArchivo(REPORTES[0], 'N3', new Date('2026-09-21T10:00:00'))
    expect(nombre).toBe('SIGREM-N3-reposicion-2026-09-21.xlsx')
  })
})
```

- [ ] **Paso 2: Corre y verifica que falla**

```bash
pnpm test -- registro
```

Esperado: FAIL, no existe `./registro`.

- [ ] **Paso 3: Escribe el registro**

```ts
// src/features/reportes/registro.ts
import type { Columna } from './aExcel'

/**
 * Un reporte es DATOS, no codigo. Agregar el de equipos con fallas es una
 * migracion y un objeto en este arreglo: ningun componente nuevo, ninguna
 * pantalla nueva.
 *
 * Es el mismo patron que `formulario(almacen, clasificacion)`, que decide que
 * campos pedir desde la base en vez de con condicionales en React.
 */

export type Parametro =
  | { clave: string; etiqueta: string; tipo: 'almacen' }
  | { clave: string; etiqueta: string; tipo: 'dias'; opciones: number[]; porDefecto: number }
  | { clave: string; etiqueta: string; tipo: 'casilla'; porDefecto: boolean; ayuda?: string }

export type HojaReporte = {
  nombre: string
  rpc: string
  columnas: Columna[]
}

export type Reporte = {
  id: string
  titulo: string
  descripcion: string
  icono: string
  color: string
  parametros: Parametro[]
  hojas: HojaReporte[]
}

const bajoMinimo = (f: Record<string, unknown>) =>
  Number(f.faltante) > 0 ? ('alerta' as const) : null

export const REPORTES: Reporte[] = [
  {
    id: 'reposicion',
    titulo: 'Reposición y compras',
    descripcion: 'Qué falta para llegar al mínimo, y cuánto se consumió',
    icono: 'mdi:cart-arrow-down',
    color: 'institucional.main',
    parametros: [
      { clave: 'p_almacen', etiqueta: 'Almacén', tipo: 'almacen' },
      {
        clave: 'p_dias', etiqueta: 'Periodo de consumo', tipo: 'dias',
        opciones: [90, 180, 365], porDefecto: 180,
      },
    ],
    hojas: [
      {
        nombre: 'Reposición',
        rpc: 'reporte_reposicion',
        columnas: [
          { clave: 'almacen', titulo: 'Almacén', tipo: 'texto' },
          { clave: 'clasificacion', titulo: 'Clasificación', tipo: 'texto' },
          { clave: 'articulo', titulo: 'Artículo', tipo: 'texto', ancho: 44 },
          { clave: 'descripcion', titulo: 'Descripción', tipo: 'texto', ancho: 36 },
          { clave: 'unidad', titulo: 'Unidad', tipo: 'texto' },
          { clave: 'total_fisico', titulo: 'Total físico', tipo: 'numero' },
          { clave: 'vencido', titulo: 'Vencido', tipo: 'numero' },
          { clave: 'vigente', titulo: 'Vigente', tipo: 'numero' },
          { clave: 'minimo', titulo: 'Mínimo', tipo: 'numero' },
          { clave: 'faltante', titulo: 'Faltante', tipo: 'numero', resaltar: bajoMinimo },
          { clave: 'envases', titulo: 'Envases', tipo: 'entero' },
          { clave: 'consumo', titulo: 'Consumo del periodo', tipo: 'numero' },
          { clave: 'ultima_entrada', titulo: 'Última entrada', tipo: 'fecha' },
          { clave: 'ubicaciones', titulo: 'Ubicaciones', tipo: 'texto', ancho: 38 },
        ],
      },
      {
        // La hoja que hace util el reporte el primer dia, cuando la otra sale
        // vacia porque casi no hay minimos capturados.
        nombre: 'Sin mínimo definido',
        rpc: 'reporte_sin_minimo',
        columnas: [
          { clave: 'almacen', titulo: 'Almacén', tipo: 'texto' },
          { clave: 'clasificacion', titulo: 'Clasificación', tipo: 'texto' },
          { clave: 'articulo', titulo: 'Artículo', tipo: 'texto', ancho: 44 },
          { clave: 'descripcion', titulo: 'Descripción', tipo: 'texto', ancho: 36 },
          { clave: 'unidad', titulo: 'Unidad', tipo: 'texto' },
          { clave: 'vigente', titulo: 'Vigente', tipo: 'numero' },
          { clave: 'consumo', titulo: 'Consumo del periodo', tipo: 'numero' },
          { clave: 'envases', titulo: 'Envases', tipo: 'entero' },
        ],
      },
    ],
  },
  {
    id: 'caducidades',
    titulo: 'Caducidades',
    descripcion: 'Lo vencido y lo que está por vencer',
    icono: 'mdi:calendar-alert',
    color: 'secondary.main',
    parametros: [
      { clave: 'p_almacen', etiqueta: 'Almacén', tipo: 'almacen' },
      {
        clave: 'p_dias', etiqueta: 'Horizonte', tipo: 'dias',
        opciones: [30, 60, 90, 180], porDefecto: 90,
      },
    ],
    hojas: [
      {
        nombre: 'Caducidades',
        rpc: 'reporte_caducidades',
        columnas: [
          { clave: 'almacen', titulo: 'Almacén', tipo: 'texto' },
          { clave: 'codigo', titulo: 'Código', tipo: 'texto' },
          { clave: 'clasificacion', titulo: 'Clasificación', tipo: 'texto' },
          { clave: 'articulo', titulo: 'Artículo', tipo: 'texto', ancho: 44 },
          { clave: 'marca', titulo: 'Marca', tipo: 'texto' },
          { clave: 'presentacion', titulo: 'Presentación', tipo: 'texto' },
          { clave: 'cantidad', titulo: 'Cantidad', tipo: 'numero' },
          { clave: 'unidad', titulo: 'Unidad', tipo: 'texto' },
          { clave: 'fecha_caducidad', titulo: 'Caduca', tipo: 'fecha' },
          {
            clave: 'dias_restantes', titulo: 'Días restantes', tipo: 'entero',
            // El gradiente es la informacion: vencido en rojo, por vencer en
            // ambar, y el resto sin resalte.
            resaltar: (f) =>
              Number(f.dias_restantes) < 0 ? 'alerta'
              : Number(f.dias_restantes) <= 15 ? 'aviso'
              : null,
          },
          { clave: 'ubicacion', titulo: 'Ubicación', tipo: 'texto', ancho: 30 },
          { clave: 'estado', titulo: 'Estado', tipo: 'texto' },
        ],
      },
    ],
  },
  {
    id: 'conteo',
    titulo: 'Hoja de conteo físico',
    descripcion: 'Para recorrer el almacén e ir anotando',
    icono: 'mdi:clipboard-list-outline',
    color: 'secondary.light',
    parametros: [
      { clave: 'p_almacen', etiqueta: 'Almacén', tipo: 'almacen' },
      {
        clave: 'p_con_cantidad',
        etiqueta: 'Mostrar la cantidad del sistema',
        tipo: 'casilla',
        porDefecto: false,
        ayuda:
          'Sin ella el conteo es ciego: quien cuenta no puede copiar el número ' +
          'que ya estaba, y la diferencia que salga es real.',
      },
    ],
    hojas: [
      {
        nombre: 'Conteo',
        rpc: 'reporte_conteo',
        columnas: [
          { clave: 'ubicacion', titulo: 'Ubicación', tipo: 'texto', ancho: 30 },
          { clave: 'codigo', titulo: 'Código', tipo: 'texto' },
          { clave: 'articulo', titulo: 'Artículo', tipo: 'texto', ancho: 44 },
          { clave: 'descripcion', titulo: 'Descripción', tipo: 'texto', ancho: 36 },
          { clave: 'marca', titulo: 'Marca', tipo: 'texto' },
          { clave: 'presentacion', titulo: 'Presentación', tipo: 'texto' },
          { clave: 'unidad', titulo: 'Unidad', tipo: 'texto' },
          { clave: 'cantidad_sistema', titulo: 'Cantidad del sistema', tipo: 'numero' },
          { clave: 'conteo', titulo: 'Conteo', tipo: 'texto', vacia: true, ancho: 16 },
          { clave: 'nota', titulo: 'Observaciones', tipo: 'texto', vacia: true, ancho: 34 },
        ],
      },
    ],
  },
  {
    id: 'inventario',
    titulo: 'Inventario en formato unificado',
    descripcion: 'El libro que el personal ya conoce, una hoja por clasificación',
    icono: 'mdi:file-table-outline',
    color: 'grey.600',
    parametros: [{ clave: 'p_almacen', etiqueta: 'Almacén', tipo: 'almacen' }],
    // Las hojas y columnas de este reporte NO se declaran aqui: salen de
    // `formato_hoja()` en la base. Decision D9 del spec, la misma razon que
    // razona el comentario de `private.clave_renglon`.
    hojas: [],
  },
]

/**
 * Determinista a proposito: el mismo reporte del mismo almacen el mismo dia
 * produce el mismo nombre, asi que dos descargas no se acumulan como
 * «reporte (3).xlsx».
 */
export function nombreDeArchivo(reporte: Reporte, almacen: string, hoy = new Date()) {
  const fecha = [
    hoy.getFullYear(),
    String(hoy.getMonth() + 1).padStart(2, '0'),
    String(hoy.getDate()).padStart(2, '0'),
  ].join('-')
  return `SIGREM-${almacen}-${reporte.id}-${fecha}.xlsx`
}
```

- [ ] **Paso 4: Corre y verifica que pasan**

```bash
pnpm test -- registro
```

Esperado: PASS, cuatro pruebas.

- [ ] **Paso 5: Escribe las consultas**

```ts
// src/features/reportes/consultas.ts
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { supabase } from '@/lib/supabase'
import { aExcel, descargar, type Columna, type HojaLista } from './aExcel'
import { traerTodo } from './paginacion'
import { nombreDeArchivo, type Reporte } from './registro'

/**
 * Genera y descarga. Va como mutacion y no como query: no es un dato que se
 * cachea, es una accion con efecto -un archivo en Descargas- que se dispara
 * cuando alguien pulsa el boton.
 */
export function useGenerarReporte() {
  return useMutation({
    mutationFn: async (v: {
      reporte: Reporte
      parametros: Record<string, unknown>
      almacenClave: string
      etiquetas: { etiqueta: string; valor: string }[]
    }) => {
      const hojas: HojaLista[] =
        v.reporte.id === 'inventario'
          ? await hojasDelFormato(v.parametros.p_almacen as number)
          : await Promise.all(
              v.reporte.hojas.map(async (h) => ({
                nombre: h.nombre,
                columnas: h.columnas,
                filas: await traerTodo<Record<string, unknown>>((desde, hasta) =>
                  supabase.rpc(h.rpc, v.parametros).range(desde, hasta),
                ),
              })),
            )

      const buffer = await aExcel({
        titulo: v.reporte.titulo,
        parametros: v.etiquetas,
        hojas,
      })
      descargar(buffer, nombreDeArchivo(v.reporte, v.almacenClave))
    },
  })
}

/**
 * El formato unificado: las hojas y sus columnas salen de la base, no del
 * registro. Un libro por almacen con una hoja por clasificacion, que es como
 * los almacenes entregan de verdad -lo dice el docstring de `leer_libro` en el
 * ETL, tras haberse tropezado con el archivo real de N3-.
 */
async function hojasDelFormato(almacenId: number): Promise<HojaLista[]> {
  const { data: definicion, error } = await supabase
    .from('hoja_formato')
    .select('hoja, orden')
    .order('orden')
  if (error) throw error

  return Promise.all(
    (definicion ?? []).map(async ({ hoja }) => {
      const { data: columnas, error: errorColumnas } = await supabase.rpc('formato_hoja', {
        p_hoja: hoja,
      })
      if (errorColumnas) throw errorColumnas

      const renglones = await traerTodo<{ renglon: Record<string, unknown> }>(
        (desde, hasta) =>
          supabase
            .rpc('inventario_formato', { p_almacen: almacenId, p_hoja: hoja })
            .range(desde, hasta),
      )

      return {
        nombre: hoja,
        // El tipo viene de la base. Mapearlo todo a texto haria que `cantidad`
        // y `peso_vacio` salieran como cadena, que es exactamente el defecto
        // que el ETL limpio al entrar.
        columnas: (columnas ?? []).map((c) => ({
          clave: c.campo,
          titulo: c.titulo,
          tipo: c.tipo as Columna['tipo'],
        })),
        filas: renglones.map((r) => r.renglon),
      }
    }),
  )
}

/** Los mínimos del almacén, con el artículo al que cuelgan. */
export function useMinimos(almacenId: number | null) {
  return useQuery({
    queryKey: ['minimos', almacenId],
    enabled: almacenId !== null,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('minimo_articulo')
        .select('articulo_id, minimo, nota, articulo:articulo_id (nombre_canonico, clasificacion, unidad_base)')
        .eq('almacen_id', almacenId as number)
      if (error) throw error
      return data
    },
  })
}

/**
 * Alta y edicion en una: la llave es el par (articulo, almacen), asi que un
 * upsert es exactamente la operacion. Borrar el renglon es poner el minimo en
 * nulo desde la pantalla.
 */
export function useGuardarMinimo() {
  const cliente = useQueryClient()
  return useMutation({
    mutationFn: async (v: { articuloId: number; almacenId: number; minimo: number | null }) => {
      if (v.minimo === null) {
        const { error } = await supabase
          .from('minimo_articulo')
          .delete()
          .eq('articulo_id', v.articuloId)
          .eq('almacen_id', v.almacenId)
        if (error) throw error
        return
      }

      const { error } = await supabase.from('minimo_articulo').upsert({
        articulo_id: v.articuloId,
        almacen_id: v.almacenId,
        minimo: v.minimo,
      })
      if (error) throw error
    },
    onSuccess: (_, v) => {
      cliente.invalidateQueries({ queryKey: ['minimos', v.almacenId] })
    },
  })
}
```

- [ ] **Paso 6: Verifica**

```bash
pnpm test && pnpm typecheck && pnpm lint && pnpm build
```

- [ ] **Paso 7: Punto de commit.**

---

## Tarea 9: La pantalla `/reportes` y el menú

**Archivos:**
- Crear: `src/features/reportes/PaginaReportes.tsx`, `src/features/reportes/DialogoParametros.tsx`
- Modificar: `src/app/navegacion.ts`, `src/app/navegacion.test.ts`, `src/App.tsx`, `src/features/auth/RutaProtegida.tsx`

**Interfaces:**
- Consume: `REPORTES` (Tarea 8), `useGenerarReporte()` (Tarea 8).
- Produce: la guardia `SoloOperacion` exportada desde `RutaProtegida.tsx`.

- [ ] **Paso 1: Escribe la prueba del menú que falla**

En `src/app/navegacion.test.ts`:

```ts
it('un usuario de consulta no ve Reportes: el archivo sale del sistema', () => {
  const rutas = menuDeNavegacion('consulta', false).map((i) => i.ruta)
  expect(rutas).not.toContain('/reportes')
})

it('responsable y admin sí la ven, y encendida', () => {
  for (const rol of ['responsable', 'admin'] as const) {
    const entrada = menuDeNavegacion(rol, rol === 'responsable').find(
      (i) => i.ruta === '/reportes',
    )
    expect(entrada?.disponible).toBe(true)
  }
})
```

- [ ] **Paso 2: Corre y verifica que falla**

```bash
pnpm test -- navegacion
```

Esperado: FAIL. Hoy `/reportes` está en `comunes` para los tres roles y con
`disponible: false`.

- [ ] **Paso 3: Cambia el menú**

En `src/app/navegacion.ts`, saca la entrada de `/reportes` del arreglo `comunes`
y agrégala condicionada. Reemplaza el objeto de Reportes dentro de `comunes`
por nada, y justo después de construir `comunes`:

```ts
  // Reportes no la ve `consulta`. Un archivo sale del sistema, se reenvia y
  // sobrevive a la baja del usuario; una pantalla no. Esconder la entrada es
  // comodidad: lo que de verdad lo impide es que las funciones de reporte se
  // nieguen a correr sin `private.puede_reportar()`.
  const conReportes: ItemMenu[] =
    rol === 'consulta' || rol === undefined
      ? comunes
      : [
          ...comunes,
          {
            ruta: '/reportes',
            etiqueta: 'Reportes',
            icono: 'mdi:chart-box-outline',
            grupo: 'administracion',
            descripcion: 'Compras, caducidades, conteo y el formato unificado',
            color: 'secondary.light',
            disponible: true,
          },
        ]

  if (rol !== 'admin') return conReportes

  return [
    ...conReportes,
    // …las dos entradas de admin que ya estaban, sin tocar
  ]
```

- [ ] **Paso 4: Corre y verifica que pasa**

```bash
pnpm test -- navegacion
```

- [ ] **Paso 5: Agrega la guardia**

En `src/features/auth/RutaProtegida.tsx`, junto a `SoloAdmin`:

```tsx
/**
 * Reportes: responsable y admin, no consulta.
 *
 * Como `SoloAdmin`, esto es comodidad y no seguridad: quien edite el bundle
 * llega a la ruta igual. Lo que de verdad lo impide es que cada funcion de
 * reporte arranque comprobando `private.puede_reportar()`. La guardia existe
 * para que un usuario de consulta no entre a una pantalla que le va a fallar
 * en cada boton.
 */
export function SoloOperacion() {
  const { data: perfil, isPending, isError } = usePerfil()

  if (isPending) {
    return <Aviso icono="mdi:chart-box-outline" texto="Comprobando tus permisos…" />
  }

  if (isError) {
    return (
      <Aviso
        icono="mdi:cloud-off-outline"
        texto="No se pudo comprobar tu perfil. Revisa la conexión y vuelve a cargar la página."
      />
    )
  }

  if (perfil?.rol !== 'admin' && perfil?.rol !== 'responsable') {
    return <Navigate to="/" replace />
  }

  return <Outlet />
}
```

- [ ] **Paso 6: Escribe el diálogo de parámetros**

```tsx
// src/features/reportes/DialogoParametros.tsx
import {
  Alert, Button, Checkbox, Dialog, DialogActions, DialogContent, DialogTitle,
  FormControlLabel, MenuItem, Stack, TextField, Typography,
} from '@mui/material'
import { useState } from 'react'

import { usePerfil } from '@/features/auth/usePerfil'
import { useGenerarReporte } from './consultas'
import type { Reporte } from './registro'

export function DialogoParametros({
  reporte,
  onCerrar,
}: {
  reporte: Reporte
  onCerrar: () => void
}) {
  const perfil = usePerfil()
  const generar = useGenerarReporte()

  // Los valores de arranque salen del propio registro. Un `useState` por
  // parametro obligaria a tocar este componente cada vez que se agregue un
  // reporte, que es justo lo que el registro existe para evitar.
  const [valores, setValores] = useState<Record<string, unknown>>(() =>
    Object.fromEntries(
      reporte.parametros.map((p) => [
        p.clave,
        p.tipo === 'almacen' ? (perfil.data?.almacen?.id ?? null)
        : p.tipo === 'dias' ? p.porDefecto
        : p.porDefecto,
      ]),
    ),
  )

  const almacenClave = perfil.data?.almacen?.clave ?? 'UCL'

  return (
    <Dialog open onClose={onCerrar} fullWidth maxWidth="sm">
      <DialogTitle>{reporte.titulo}</DialogTitle>

      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          {reporte.parametros.map((p) => {
            if (p.tipo === 'almacen') {
              return (
                <TextField
                  key={p.clave}
                  label={p.etiqueta}
                  value={almacenClave}
                  disabled
                  helperText="Tu almacén. La RLS no deja generar el de otro."
                />
              )
            }

            if (p.tipo === 'dias') {
              return (
                <TextField
                  key={p.clave}
                  select
                  label={p.etiqueta}
                  value={valores[p.clave]}
                  onChange={(e) =>
                    setValores((v) => ({ ...v, [p.clave]: Number(e.target.value) }))
                  }
                >
                  {p.opciones.map((d) => (
                    <MenuItem key={d} value={d}>
                      {d} días
                    </MenuItem>
                  ))}
                </TextField>
              )
            }

            return (
              <Stack key={p.clave}>
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={Boolean(valores[p.clave])}
                      onChange={(e) =>
                        setValores((v) => ({ ...v, [p.clave]: e.target.checked }))
                      }
                    />
                  }
                  label={p.etiqueta}
                />
                {p.ayuda && (
                  <Typography sx={{ color: 'text.secondary', fontSize: 13, pl: 4 }}>
                    {p.ayuda}
                  </Typography>
                )}
              </Stack>
            )
          })}

          {/* La mitad visible de la regla de la Tarea 6: si algo falla, se ve
              el error y NO se descarga nada. Nunca un .xlsx a medias. */}
          {generar.isError && (
            <Alert severity="error">
              No se generó el archivo. {(generar.error as Error).message}
            </Alert>
          )}
        </Stack>
      </DialogContent>

      <DialogActions>
        <Button onClick={onCerrar}>Cancelar</Button>
        <Button
          variant="contained"
          loading={generar.isPending}
          onClick={() =>
            generar.mutate(
              {
                reporte,
                parametros: valores,
                almacenClave,
                etiquetas: [
                  { etiqueta: 'Almacén', valor: almacenClave },
                  ...reporte.parametros
                    .filter((p) => p.tipo !== 'almacen')
                    .map((p) => ({
                      etiqueta: p.etiqueta,
                      valor: String(valores[p.clave]),
                    })),
                  { etiqueta: 'Generado', valor: new Date().toLocaleString('es-MX') },
                  { etiqueta: 'Por', valor: perfil.data?.nombre ?? '' },
                ],
              },
              { onSuccess: onCerrar },
            )
          }
        >
          Generar
        </Button>
      </DialogActions>
    </Dialog>
  )
}
```

- [ ] **Paso 7: Escribe la pantalla**

```tsx
// src/features/reportes/PaginaReportes.tsx
import { Icon } from '@iconify/react'
import { Button, Card, CardActionArea, Grid, Stack, Typography } from '@mui/material'
import { useState } from 'react'
import { Link } from 'react-router-dom'

import { EncabezadoPagina } from '@/app/EncabezadoPagina'
import { DialogoParametros } from './DialogoParametros'
import { REPORTES, type Reporte } from './registro'

export function PaginaReportes() {
  const [abierto, setAbierto] = useState<Reporte | null>(null)

  return (
    <Stack spacing={2}>
      <EncabezadoPagina
        titulo="Reportes"
        descripcion="Exporta a Excel lo que necesitas para decidir"
      />

      <Grid container spacing={2}>
        {REPORTES.map((reporte) => (
          <Grid key={reporte.id} size={{ xs: 12, sm: 6, md: 4 }}>
            <Card variant="outlined" sx={{ height: '100%' }}>
              <CardActionArea
                onClick={() => setAbierto(reporte)}
                sx={{ p: 2, height: '100%', alignItems: 'flex-start' }}
              >
                <Stack spacing={1}>
                  <Icon icon={reporte.icono} width={28} />
                  <Typography sx={{ fontWeight: 600 }}>{reporte.titulo}</Typography>
                  <Typography sx={{ color: 'text.secondary', fontSize: 14 }}>
                    {reporte.descripcion}
                  </Typography>
                </Stack>
              </CardActionArea>

              {/* El responsable llega a los minimos desde «quiero saber que
                  comprar», no desde el inventario. Por eso el enlace vive en
                  esta tarjeta y no en otra pantalla. */}
              {reporte.id === 'reposicion' && (
                <Button
                  component={Link}
                  to="/reportes/minimos"
                  size="small"
                  startIcon={<Icon icon="mdi:target" />}
                  sx={{ m: 1 }}
                >
                  Definir mínimos
                </Button>
              )}
            </Card>
          </Grid>
        ))}
      </Grid>

      {abierto && (
        <DialogoParametros reporte={abierto} onCerrar={() => setAbierto(null)} />
      )}
    </Stack>
  )
}
```

- [ ] **Paso 8: Conecta la ruta**

En `src/App.tsx`, dentro del `<Route element={<Layout />}>` y después de
`/practicas`:

```tsx
                    {/* Con guardia de rol, al reves que /practicas: ahi los tres
                        roles entran y la RLS impide escribir. Aqui el usuario de
                        consulta no tiene nada que hacer, porque todas las
                        funciones le van a responder con excepcion. */}
                    <Route element={<SoloOperacion />}>
                      <Route path="/reportes" element={<PaginaReportes />} />
                    </Route>
```

Importa `PaginaReportes` con `lazy()` y envuélvela en `<Suspense>`: exceljs es
la dependencia más pesada del proyecto y quien no entra al módulo no tiene por
qué pagarla.

- [ ] **Paso 9: Verifica**

```bash
pnpm test && pnpm typecheck && pnpm lint && pnpm build
```

Esperado: cero errores, y el bundle de `/reportes` separado en su propio chunk.

- [ ] **Paso 10: Punto de commit.**

---

## Tarea 10: La pantalla de mínimos

**Archivos:**
- Crear: `src/features/reportes/PaginaMinimos.tsx`, `src/features/reportes/TablaMinimos.tsx`, `src/features/reportes/TablaMinimos.test.tsx`
- Modificar: `src/App.tsx`

**Interfaces:**
- Consume: `useMinimos()`, `useGuardarMinimo()` (Tarea 8).

**Por qué una tabla editable y no una ida y vuelta por Excel:** el mínimo por
artículo recortó el volumen un orden de magnitud respecto al mínimo por envase
— son cientos de renglones por almacén, no miles. Eso cabe en una pantalla con
MUI y `react-hook-form`, que ya están instalados, sin abrir la caja de leer
archivos, validar y resolver conflictos. Decisión D5 del spec.

- [ ] **Paso 1: Escribe la prueba que falla**

```tsx
// src/features/reportes/TablaMinimos.test.tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { TablaMinimos } from './TablaMinimos'

const ARTICULOS = [
  { articulo_id: 1, nombre: 'Acetona', clasificacion: 'reactivo', unidad: 'mL', minimo: null },
  { articulo_id: 2, nombre: 'Etanol', clasificacion: 'reactivo', unidad: 'mL', minimo: 500 },
]

describe('TablaMinimos', () => {
  it('guarda al salir del campo, no en cada tecla', async () => {
    const guardar = vi.fn()
    render(<TablaMinimos articulos={ARTICULOS} onGuardar={guardar} />)

    const campo = screen.getAllByRole('spinbutton')[0]
    await userEvent.type(campo, '250')
    expect(guardar).not.toHaveBeenCalled()

    await userEvent.tab()
    expect(guardar).toHaveBeenCalledWith({ articuloId: 1, minimo: 250 })
  })

  it('vaciar el campo borra el mínimo, no lo pone en cero', async () => {
    const guardar = vi.fn()
    render(<TablaMinimos articulos={ARTICULOS} onGuardar={guardar} />)

    const campo = screen.getAllByRole('spinbutton')[1]
    await userEvent.clear(campo)
    await userEvent.tab()
    // `minimo > 0` es restriccion de la tabla: un cero explotaria en el insert.
    expect(guardar).toHaveBeenCalledWith({ articuloId: 2, minimo: null })
  })

  it('no guarda si el valor no cambió', async () => {
    const guardar = vi.fn()
    render(<TablaMinimos articulos={ARTICULOS} onGuardar={guardar} />)
    await userEvent.click(screen.getAllByRole('spinbutton')[1])
    await userEvent.tab()
    expect(guardar).not.toHaveBeenCalled()
  })
})
```

- [ ] **Paso 2: Corre y verifica que falla**

```bash
pnpm test -- TablaMinimos
```

Esperado: FAIL, no existe `./TablaMinimos`.

- [ ] **Paso 3: Implementa `TablaMinimos`**

```tsx
// src/features/reportes/TablaMinimos.tsx
import {
  Table, TableBody, TableCell, TableHead, TableRow, TextField, Typography,
} from '@mui/material'

export type ArticuloConMinimo = {
  articulo_id: number
  nombre: string
  clasificacion: string
  unidad: string
  minimo: number | null
}

/**
 * Una fila por articulo, con el minimo editable.
 *
 * Guarda en `onBlur` y solo si cambio. En cada tecla serian tres escrituras
 * para teclear «250», y la tercera pisaria a las dos anteriores sin que el
 * orden de llegada este garantizado.
 */
export function TablaMinimos({
  articulos,
  onGuardar,
}: {
  articulos: ArticuloConMinimo[]
  onGuardar: (v: { articuloId: number; minimo: number | null }) => void
}) {
  return (
    <Table size="small">
      <TableHead>
        <TableRow>
          <TableCell>Artículo</TableCell>
          <TableCell>Clasificación</TableCell>
          <TableCell>Unidad</TableCell>
          <TableCell align="right">Mínimo</TableCell>
        </TableRow>
      </TableHead>

      <TableBody>
        {articulos.map((a) => (
          <TableRow key={a.articulo_id} hover>
            <TableCell>{a.nombre}</TableCell>
            <TableCell>
              <Typography sx={{ color: 'text.secondary', fontSize: 13 }}>
                {a.clasificacion}
              </Typography>
            </TableCell>
            <TableCell>{a.unidad}</TableCell>
            <TableCell align="right" sx={{ width: 160 }}>
              <TextField
                type="number"
                size="small"
                defaultValue={a.minimo ?? ''}
                slotProps={{ htmlInput: { min: 0, step: 'any', 'aria-label': `Mínimo de ${a.nombre}` } }}
                onBlur={(e) => {
                  const texto = e.target.value.trim()

                  // Vacio BORRA el minimo. Nunca cero: la restriccion
                  // `minimo_articulo_positivo` lo rechaza, y «no repongo esto»
                  // se dice quitando el renglon, no poniendolo en cero.
                  const nuevo = texto === '' ? null : Number(texto)

                  if (nuevo !== null && !Number.isFinite(nuevo)) return
                  if (nuevo === a.minimo) return

                  onGuardar({ articuloId: a.articulo_id, minimo: nuevo })
                }}
              />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
```

- [ ] **Paso 4: Corre las pruebas de la tabla**

```bash
pnpm test -- TablaMinimos
```

Esperado: PASS, tres pruebas.

- [ ] **Paso 5: Implementa `PaginaMinimos`**

```tsx
// src/features/reportes/PaginaMinimos.tsx
import { Icon } from '@iconify/react'
import { Alert, Button, Stack, TextField, Typography } from '@mui/material'
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'

import { EncabezadoPagina } from '@/app/EncabezadoPagina'
import { usePerfil } from '@/features/auth/usePerfil'
import { normalizarTermino } from '@/features/inventario/presentacion'
import { TablaMinimos } from './TablaMinimos'
import { useArticulosDelAlmacen, useGuardarMinimo } from './consultas'

export function PaginaMinimos() {
  const perfil = usePerfil()
  const almacenId = perfil.data?.almacen?.id ?? null

  const [termino, setTermino] = useState('')
  const articulos = useArticulosDelAlmacen(almacenId)
  const guardar = useGuardarMinimo()

  const visibles = useMemo(() => {
    const q = normalizarTermino(termino)
    if (!q) return articulos.data ?? []
    return (articulos.data ?? []).filter((a) => normalizarTermino(a.nombre).includes(q))
  }, [articulos.data, termino])

  const conMinimo = (articulos.data ?? []).filter((a) => a.minimo !== null).length
  const total = articulos.data?.length ?? 0

  return (
    <Stack spacing={2}>
      <EncabezadoPagina
        titulo="Mínimos de reposición"
        descripcion="Cuánto hay que mantener de cada artículo en tu almacén"
      />

      {/* El progreso a la vista. Es un trabajo incremental y verlo avanzar es
          lo que hace que se termine: no hace falta capturarlos todos para que
          el reporte de compras sirva. */}
      <Alert severity={conMinimo === 0 ? 'info' : 'success'} icon={<Icon icon="mdi:target" />}>
        {conMinimo} de {total} artículos tienen mínimo definido.{' '}
        {conMinimo === 0
          ? 'Genera el reporte de reposición: su segunda hoja te dice por cuáles empezar.'
          : 'El reporte de compras ya funciona con estos.'}
      </Alert>

      <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
        <TextField
          size="small"
          placeholder="Buscar artículo…"
          value={termino}
          onChange={(e) => setTermino(e.target.value)}
          sx={{ maxWidth: 360 }}
        />
        <Button component={Link} to="/reportes" startIcon={<Icon icon="mdi:arrow-left" />}>
          Volver a Reportes
        </Button>
      </Stack>

      {guardar.isError && (
        <Alert severity="error">No se pudo guardar el mínimo. {String(guardar.error)}</Alert>
      )}

      <TablaMinimos
        articulos={visibles}
        onGuardar={(v) => guardar.mutate({ ...v, almacenId: almacenId as number })}
      />
    </Stack>
  )
}
```

Agrega a `consultas.ts` el hook que alimenta la tabla — los artículos que el
almacén tiene en existencia, con su mínimo si ya lo tiene:

```ts
/**
 * Los articulos presentes en el almacen, con su minimo. `minimo_articulo` es un
 * `left join` y no el origen: la pantalla existe para capturar los que NO lo
 * tienen, asi que partir de esa tabla mostraria solo lo ya hecho.
 */
export function useArticulosDelAlmacen(almacenId: number | null) {
  return useQuery({
    queryKey: ['articulos-con-minimo', almacenId],
    enabled: almacenId !== null,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('existencia_listado')
        .select('articulo_id, nombre_canonico, clasificacion, unidad_base')
        .eq('almacen_id', almacenId as number)
      if (error) throw error

      const { data: minimos, error: errorMinimos } = await supabase
        .from('minimo_articulo')
        .select('articulo_id, minimo')
        .eq('almacen_id', almacenId as number)
      if (errorMinimos) throw errorMinimos

      const porArticulo = new Map(minimos?.map((m) => [m.articulo_id, Number(m.minimo)]))

      // `existencia_listado` trae un renglon por envase; la pantalla es por
      // articulo. Se colapsa aqui y no en la base porque la vista ya existe y
      // sirve a la pantalla de inventario tal cual.
      const unicos = new Map<number, ArticuloConMinimo>()
      for (const e of data ?? []) {
        if (unicos.has(e.articulo_id)) continue
        unicos.set(e.articulo_id, {
          articulo_id: e.articulo_id,
          nombre: e.nombre_canonico,
          clasificacion: e.clasificacion,
          unidad: e.unidad_base,
          minimo: porArticulo.get(e.articulo_id) ?? null,
        })
      }
      return [...unicos.values()].sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))
    },
  })
}
```

- [ ] **Paso 6: Conecta la ruta**

En `src/App.tsx`, dentro del mismo `<SoloOperacion />`:

```tsx
                      <Route path="/reportes/minimos" element={<PaginaMinimos />} />
```

Y enlaza a ella desde la tarjeta de «Reposición y compras» en `PaginaReportes`:
el responsable llega desde «quiero saber qué comprar», no desde el inventario.

- [ ] **Paso 7: Verifica**

```bash
pnpm test && pnpm typecheck && pnpm lint && pnpm build
```

- [ ] **Paso 8: Punto de commit.**

---

## Tarea 11: El botón «Exportar» de las dos pantallas de inventario

**Archivos:**
- Modificar: `src/features/inventario/PaginaInventario.tsx`, `src/features/inventario/PaginaInventarioGeneral.tsx`

**Interfaces:**
- Consume: `useGenerarReporte()` y el reporte `inventario` de `REPORTES` (Tarea 8).

Es el botón que lleva pendiente desde el spec del 9 de septiembre, donde quedó
anotado como «Exportar. Sigue pendiente en las dos».

- [ ] **Paso 1: Localiza los botones apagados**

```bash
grep -rn "Exportar" src/features/inventario/
```

Están dibujados como `AccionPendiente`. El cambio es sustituir cada uno por un
botón real que dispare `useGenerarReporte()` con el reporte `inventario` y el
almacén de la pantalla.

- [ ] **Paso 2: Escribe el botón**

Crea `src/features/reportes/BotonExportar.tsx` y úsalo en las dos pantallas, en
lugar de duplicar la lógica:

```tsx
// src/features/reportes/BotonExportar.tsx
import { Icon } from '@iconify/react'
import { Button, Tooltip } from '@mui/material'

import { usePerfil } from '@/features/auth/usePerfil'
import { useGenerarReporte } from './consultas'
import { REPORTES } from './registro'

const INVENTARIO = REPORTES.find((r) => r.id === 'inventario')!

/**
 * El boton que llevaba pendiente desde el spec del 9 de septiembre.
 *
 * `almacenId` en null significa «todos los almacenes» en el filtro de
 * Inventario general. No hay archivo que sirva para eso: el formato unificado
 * es UN LIBRO POR ALMACEN -asi los entregan de verdad, lo dice el docstring de
 * `leer_libro`-, y uno solo no puede representar cuatro. El boton se deshabilita
 * y dice por que, en vez de exportar algo que el ETL no podria releer.
 */
export function BotonExportar({
  almacenId,
  almacenClave,
}: {
  almacenId: number | null
  almacenClave: string | null
}) {
  const perfil = usePerfil()
  const generar = useGenerarReporte()

  if (almacenId === null || almacenClave === null) {
    return (
      <Tooltip title="Elige un almacén: el formato unificado es un libro por almacén">
        <span>
          <Button disabled startIcon={<Icon icon="mdi:file-excel-outline" />}>
            Exportar
          </Button>
        </span>
      </Tooltip>
    )
  }

  return (
    <Button
      startIcon={<Icon icon="mdi:file-excel-outline" />}
      loading={generar.isPending}
      onClick={() =>
        generar.mutate({
          reporte: INVENTARIO,
          parametros: { p_almacen: almacenId },
          almacenClave,
          etiquetas: [
            { etiqueta: 'Almacén', valor: almacenClave },
            { etiqueta: 'Generado', valor: new Date().toLocaleString('es-MX') },
            { etiqueta: 'Por', valor: perfil.data?.nombre ?? '' },
          ],
        })
      }
    >
      Exportar
    </Button>
  )
}
```

- [ ] **Paso 3: Sustituye los dos `AccionPendiente`**

En `PaginaInventario.tsx` el almacén es el del perfil —la guardia
`ConAlmacenPropio` ya garantiza que existe—:

```tsx
<BotonExportar
  almacenId={perfil.data?.almacen?.id ?? null}
  almacenClave={perfil.data?.almacen?.clave ?? null}
/>
```

En `PaginaInventarioGeneral.tsx` sale del filtro activo:

```tsx
<BotonExportar
  almacenId={filtros.almacenId === 'todos' ? null : filtros.almacenId}
  almacenClave={
    filtros.almacenId === 'todos'
      ? null
      : (almacenes.data?.find((a) => a.id === filtros.almacenId)?.clave ?? null)
  }
/>
```

- [ ] **Paso 4: Verifica**

```bash
pnpm test && pnpm typecheck && pnpm lint && pnpm build
```

Esperado: cero errores. ESLint marca `AccionPendiente` si quedó importada sin
uso en alguna de las dos pantallas.

- [ ] **Paso 5: Punto de commit.**

---

## Tarea 12: La prueba de ida y vuelta

**Archivos:**
- Crear: `etl/tests/test_ida_y_vuelta.py`, `etl/tests/fixtures/generar_libro.md`

**Interfaces:**
- Consume: `etl.extract.formato.leer_libro`, y un `.xlsx` producido por el
  exportador de la Tarea 7.

Esta es la prueba que convierte «igual al formato que el personal conoce» en
algo comprobable, y la que impide que las dos definiciones del formato —la de
`CAMPOS` y la de `columna_formato`— se separen sin que nadie se entere.

- [ ] **Paso 1: Genera el libro de prueba**

Con la app corriendo en local sobre `supabase db reset` (datos de la semilla,
sintéticos), entra como `n3@uaeh.local`, ve a `/reportes`, genera el reporte
«Inventario en formato unificado» para N3 y guarda el archivo en
`etl/tests/fixtures/N3-formato.xlsx`.

Documenta el procedimiento en `etl/tests/fixtures/generar_libro.md` para que se
pueda regenerar cuando cambie el formato.

**El archivo sí se versiona**, y puede: sale de la semilla, no de un inventario
real. El repositorio es público y ningún `.xlsx` de inventario real entra al
commit — este no lo es. Verifica antes de agregarlo que no traiga nada que no
esté en `supabase/seed.sql`.

- [ ] **Paso 2: Escribe la prueba**

```python
# etl/tests/test_ida_y_vuelta.py
"""El exportador produce lo que el ETL sabe leer.

Es lo unico que impide que las dos definiciones del formato -CAMPOS aqui y
columna_formato en la base- se separen sin que nadie se entere. Decision D10
del spec del 21 de septiembre.
"""
from pathlib import Path

import pytest

from etl.extract.formato import CAMPOS, HOJAS_DE_DATOS, leer_libro

LIBRO = Path(__file__).parent / "fixtures" / "N3-formato.xlsx"


@pytest.fixture(scope="module")
def hojas():
    if not LIBRO.exists():
        pytest.skip(f"Falta {LIBRO}. Ver fixtures/generar_libro.md")
    return leer_libro(LIBRO, almacen="N3")


def test_el_etl_abre_lo_que_exporto_la_app(hojas):
    """Si esto falla, el exportador dejo de producir el formato unificado."""
    assert hojas, "leer_libro no encontro ninguna hoja de datos"


def test_las_hojas_salen_en_el_orden_del_formato(hojas):
    nombres = [h.nombre for h in hojas]
    assert nombres == [h for h in HOJAS_DE_DATOS if h in nombres]


def test_el_preambulo_trae_lo_que_escribio_la_app(hojas):
    for hoja in hojas:
        assert hoja.actualizado, f"{hoja.nombre}: F5 vacia"


def test_cada_renglon_se_llavea_por_los_campos_del_formato(hojas):
    """Un renglon con llaves que CAMPOS no conoce es una columna desalineada."""
    for hoja in hojas:
        conocidas = set(CAMPOS[hoja.nombre])
        for renglon in hoja.renglones:
            assert set(renglon) <= conocidas, (
                f"{hoja.nombre}: llaves que el ETL no reconoce: "
                f"{set(renglon) - conocidas}"
            )


def test_los_reactivos_traen_sustancia(hojas):
    reactivos = next((h for h in hojas if h.nombre == "Reactivos"), None)
    if reactivos is None or not reactivos.renglones:
        pytest.skip("La semilla no tiene reactivos en N3")
    assert all(r.get("sustancia") for r in reactivos.renglones)
```

- [ ] **Paso 3: Corre y verifica**

```bash
pytest etl/tests/test_ida_y_vuelta.py -v
```

Esperado: PASS. Si `test_cada_renglon_se_llavea_por_los_campos_del_formato`
falla, una columna de `columna_formato` tiene una letra que no coincide con
`CAMPOS`: esa es exactamente la divergencia que esta prueba existe para
encontrar. Corrígela en la migración (una **nueva**, no editando la de la Tarea
2, que ya está aplicada).

- [ ] **Paso 4: Verificación completa**

```bash
pnpm typecheck && pnpm lint && pnpm build
pnpm test
supabase test db
pytest
```

Los cinco en cero. Es la primera vez en el plan que corren todos juntos.

- [ ] **Paso 5: Punto de commit.** Fin de la entrega 1.

---

## Después de esto

Las tres entregas restantes, cada una con su propio spec (§11 del spec vigente):
consumo y académico, formato NOM-005-STPS, y el resto de las alertas. Con el
registro ya en pie, cada alerta nueva es una migración y un objeto en `REPORTES`.
