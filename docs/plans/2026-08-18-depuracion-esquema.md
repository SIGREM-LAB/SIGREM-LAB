# Depuracion del esquema · Plan de implementacion

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reemplazar las 7 migraciones actuales por un baseline coherente con el formato unificado de inventarios, agregando el modulo de practicas, y dejarlo aplicado en el proyecto remoto de Supabase.

**Architecture:** Se reescribe el baseline en 7 migraciones nuevas (`base`, `organizacion`, `catalogo`, `inventario`, `practica`, `captura`, `rls`) en vez de parchear encima. Cada tarea entrega una migracion con su prueba pgTAP y deja `supabase db reset` + `supabase test db` en verde antes de commitear. El primer `db push` al remoto es la ultima tarea y es el punto de no retorno.

**Tech Stack:** Postgres 17 (Supabase), pgTAP, Supabase CLI, TypeScript + Vite + MUI, `@supabase/supabase-js`.

**Spec:** `docs/specs/2026-08-18-depuracion-esquema-formato-unificado-design.md`

## Global Constraints

- **Postgres 17.** `unique nulls not distinct` y `generated always as (...) stored` estan disponibles y el plan los usa.
- **El esquema solo cambia por migracion.** Nunca desde el dashboard.
- **Los tipos se generan, no se escriben.** `pnpm gen:types` despues de cada migracion. Nunca editar `src/types/database.ts` a mano.
- **Cada politica de RLS lleva su prueba** en `supabase/tests/database/`. La RLS es la unica seguridad real: la `anon key` viaja en el bundle.
- **Identificadores del dominio en espanol y sin acentos** (`existencia`, `almacen`, `caracteristica_toxica`, `cantidad_danada`). Comentarios en espanol, sin acentos, igual que las migraciones actuales.
- **Toda funcion nueva lleva `set search_path = ''`** y referencias calificadas (`public.x`, `extensions.y`). Sin esto, un `search_path` manipulado cambia a que tabla apunta la funcion.
- **Los helpers en politicas van envueltos en `(select ...)`** para que Postgres los evalue una vez por sentencia y no una vez por renglon.
- **Toda columna que aparezca en una politica lleva indice.**
- **`referencia/prototipo/` no se toca.**
- Antes de dar cualquier tarea por terminada: `pnpm typecheck && pnpm lint && pnpm build`, `supabase db reset`, `supabase test db`. Los cuatro en cero.

## Cambio de layout respecto al esquema actual

Hoy `enable row level security` vive en `rls.sql`, junto con las politicas. En este plan **el `enable row level security` y el `revoke all ... from anon` se mueven al archivo de cada tabla**, inmediatamente despues de su `create table`; en `rls.sql` quedan solo los `create policy`.

La razon es que la prueba de cobertura (`ninguna tabla de public se queda sin RLS`) es un invariante que debe ser cierto en **todos** los commits, no solo en el ultimo. Con el layout actual, las tareas 2 a 6 dejarian tablas sin RLS y la suite en rojo hasta la tarea 7. Ademas el modo de falla es el correcto: una tabla con RLS activa y sin politicas niega todo, en vez de quedar abierta.

## Estructura de archivos

| Archivo | Responsabilidad |
|---|---|
| `supabase/migrations/20260818120000_base.sql` | Extensiones, esquema `private`, `norm_texto`, los 9 enums |
| `supabase/migrations/20260818120100_organizacion.sql` | `almacen`, `laboratorio`, `perfil`, helpers de RLS |
| `supabase/migrations/20260818120200_catalogo.sql` | `articulo`, `articulo_alias`, `articulo_reactivo`, `articulo_biologico`, `buscar_articulo()` |
| `supabase/migrations/20260818120300_inventario.sql` | `ubicacion`, `carga`, `existencia`, `estado_calculado()`, triggers, `movimiento` |
| `supabase/migrations/20260818120400_practica.sql` | `programa_educativo`, `asignatura`, `practica`, `motivo_observacion`, `practica_observacion`, `practica_elemento`, triggers, FK de `movimiento.practica_id` |
| `supabase/migrations/20260818120500_captura.sql` | `campo_capturable`, `perfil_captura`, `perfil_campo`, `formulario()` |
| `supabase/migrations/20260818120600_rls.sql` | Todas las politicas |
| `supabase/seed.sql` | Almacenes, laboratorios, catalogos cerrados, 6 perfiles de captura, usuarios de prueba |
| `supabase/tests/database/esquema.test.sql` | Enums, restricciones, triggers, columnas generadas |
| `supabase/tests/database/rls.test.sql` | Politicas |
| `CLAUDE.md` | La excepcion fechada de la reescritura del baseline |

**Se borran:** las 7 migraciones `202608121*` y el `rls.test.sql` actual (prueba `almacen_alias` y `por_confirmar`, que dejan de existir). Ambos viven en git: `1295949`, `83e47f3`.

---

### Task 1: Baseline vacio y enums

Deja el repo con un unico archivo de migracion que crea extensiones, el esquema `private`, `norm_texto()` y los 9 enums. Todo lo demas se borra para que las tareas siguientes construyan sobre limpio.

**Files:**
- Create: `supabase/migrations/20260818120000_base.sql`
- Create: `supabase/tests/database/esquema.test.sql`
- Delete: `supabase/migrations/20260812120000_base.sql`, `20260812120100_organizacion.sql`, `20260812120200_catalogo.sql`, `20260812120300_inventario.sql`, `20260812120400_rls.sql`, `20260812130000_campos_faltantes.sql`, `20260812130100_perfiles_captura.sql`
- Delete: `supabase/tests/database/rls.test.sql`
- Modify: `supabase/seed.sql` (se vacia; cada tarea le va agregando su parte)

**Interfaces:**
- Consumes: nada.
- Produces: los tipos `public.rol_usuario`, `public.clasificacion_articulo`, `public.estado_fisico`, `public.estado_existencia`, `public.tipo_movimiento`, `public.origen_alias`, `public.color_almacenaje`, `public.funcionamiento_equipo`, `public.metodo_control`; la funcion `public.norm_texto(text) returns text`; el esquema `private`.

- [ ] **Step 1: Crear la rama de trabajo**

```bash
git checkout -b feat/depuracion-esquema-formato-unificado
```

- [ ] **Step 2: Borrar el baseline viejo y las pruebas que lo prueban**

```bash
git rm supabase/migrations/20260812120000_base.sql \
       supabase/migrations/20260812120100_organizacion.sql \
       supabase/migrations/20260812120200_catalogo.sql \
       supabase/migrations/20260812120300_inventario.sql \
       supabase/migrations/20260812120400_rls.sql \
       supabase/migrations/20260812130000_campos_faltantes.sql \
       supabase/migrations/20260812130100_perfiles_captura.sql \
       supabase/tests/database/rls.test.sql
```

- [ ] **Step 3: Vaciar el seed**

`supabase db reset` corre el seed despues de las migraciones. Si el seed sigue insertando en tablas que ya no existen, el reset truena y ninguna tarea puede verificarse. Se vacia y cada tarea le agrega su seccion.

Contenido completo de `supabase/seed.sql`:

```sql
-- Datos semilla. Se corre despues de las migraciones en cada `supabase db reset`.
-- Cada tarea del plan de depuracion le agrega su seccion.
```

- [ ] **Step 4: Escribir la prueba de los enums (falla)**

Crear `supabase/tests/database/esquema.test.sql`. Este archivo crece en cada tarea; en esta empieza con 4 pruebas.

```sql
-- Pruebas de estructura: enums, restricciones, triggers y columnas generadas.
-- Se corren con: supabase test db
--
-- Complementa rls.test.sql, que prueba las politicas. Aqui se prueba que el
-- esquema no deje pasar datos imposibles; alla, que no deje pasar a quien no debe.

begin;
create extension if not exists pgtap with schema extensions;

select plan(4);

-- Los valores de un enum son un contrato con el ETL y con el frontend. Si
-- alguien agrega o quita uno sin actualizar el resto, esto lo detiene.
select set_eq(
  $$ select unnest(enum_range(null::public.clasificacion_articulo))::text $$,
  array['reactivo','material','insumo','equipo','componente','materia_biologica'],
  'clasificacion_articulo tiene una entrada por hoja del formato unificado'
);

-- por_confirmar se quito: la carga de hoy ES el conteo inicial.
select set_eq(
  $$ select unnest(enum_range(null::public.estado_existencia))::text $$,
  array['disponible','stock_bajo','agotado','contaminado','mantenimiento','baja'],
  'estado_existencia ya no incluye por_confirmar'
);

-- carga_inicial va al frente para que los reportes de consumo no lo cuenten
-- como compra del mes.
select set_eq(
  $$ select unnest(enum_range(null::public.tipo_movimiento))::text $$,
  array['carga_inicial','entrada','consumo','merma','ajuste_conteo',
        'prestamo','devolucion','baja'],
  'tipo_movimiento incluye carga_inicial'
);

-- La forma de dos argumentos de unaccent es la unica inmutable, y por eso la
-- unica indexable. Es el error clasico al montar busqueda difusa en espanol.
select is(
  public.norm_texto('Ácido Succínico'),
  'acido succinico',
  'norm_texto baja a minusculas y quita acentos'
);

select * from finish();
rollback;
```

- [ ] **Step 5: Correr la prueba para verificar que falla**

```bash
supabase db reset && supabase test db
```

Esperado: FALLA. Sin `base.sql` no existe ningun tipo `public.*` ni `public.norm_texto`, asi que el archivo truena al preparar las consultas (`type "public.clasificacion_articulo" does not exist`).

- [ ] **Step 6: Escribir `20260818120000_base.sql`**

Extensiones, esquema `private` y `norm_texto()` se copian sin cambios del `20260812120000_base.sql` borrado (recuperable con `git show 267c0b7^:supabase/migrations/20260812120000_base.sql`). Los enums son los de la §4.1 del spec, que los trae completos y comentados.

Los tres cambios respecto al archivo viejo: `clasificacion_articulo` gana `materia_biologica`, `estado_existencia` pierde `por_confirmar`, `tipo_movimiento` gana `carga_inicial` al frente. Y los tres enums nuevos: `color_almacenaje`, `funcionamiento_equipo`, `metodo_control`.

- [ ] **Step 7: Correr la prueba para verificar que pasa**

```bash
supabase db reset && supabase test db
```

Esperado: `esquema.test.sql .. ok`, 4/4.

- [ ] **Step 8: Commit**

```bash
git add -A supabase/
git commit -m "refactor(db)!: reiniciar el baseline con los enums del formato unificado

Se borran las 7 migraciones de agosto 12 y se empieza un baseline nuevo. La
justificacion esta en la seccion 3 del spec: cero registros cargados, remoto
vacio y sin historial de migraciones, y Postgres no tiene alter type drop value
para quitar por_confirmar por parche.

clasificacion_articulo gana materia_biologica (el formato unificado tiene una
hoja para ella), estado_existencia pierde por_confirmar, y tipo_movimiento gana
carga_inicial. Entran color_almacenaje, funcionamiento_equipo y metodo_control."
```

---

### Task 2: Organizacion

`almacen` sin `padre_id`, sin la tabla `almacen_alias`, y `laboratorio` con la llave candidata que habilita las FK compuestas de la tarea 4.

**Files:**
- Create: `supabase/migrations/20260818120100_organizacion.sql`
- Modify: `supabase/tests/database/esquema.test.sql`
- Modify: `supabase/seed.sql`

**Interfaces:**
- Consumes: `public.rol_usuario` (Task 1).
- Produces: `public.almacen (id, clave, nombre, activo, uso_principal, zona_riesgo, personas_expuestas, creado_en)` con `unique (clave)`; `public.laboratorio (id, almacen_id, nombre, activo)` con `unique (almacen_id, nombre)` y `unique (id, almacen_id)`; `public.perfil (id, nombre, almacen_id, rol, creado_en)`; y los helpers `private.almacen_actual() returns bigint`, `private.rol_actual() returns public.rol_usuario`, `private.es_admin() returns boolean`, `private.puede_escribir() returns boolean`.

- [ ] **Step 1: Escribir las pruebas (fallan)**

En `esquema.test.sql`, subir `plan(4)` a `plan(7)` y agregar antes de `select * from finish();`:

```sql
-- ---------------------------------------------------------------------------
-- Organizacion
-- ---------------------------------------------------------------------------

-- almacen_alias existia para mapear el texto sucio de la columna Almacen
-- ('4', 'n4', 'N1-1'). En el formato unificado el almacen lo dice el nombre del
-- archivo, asi que la tabla sobra. Si alguien la revive, esto lo detiene.
select hasnt_table('public', 'almacen_alias',
  'almacen_alias no existe: la sub-ubicacion es ubicacion, no almacen');

select hasnt_column('public', 'almacen', 'padre_id',
  'almacen no tiene padre_id: LUM-1 y LUM-2 son sub-ubicaciones');

-- Redundante con la PK a primera vista, pero es lo que permite la FK compuesta
-- de existencia. Sin esta llave candidata no hay forma declarativa de exigir
-- que el laboratorio de una existencia pertenezca a su mismo almacen.
select col_is_unique('public', 'laboratorio', array['id','almacen_id'],
  'laboratorio(id, almacen_id) es unico: habilita la FK compuesta de existencia');
```

- [ ] **Step 2: Correr para verificar que fallan**

```bash
supabase db reset && supabase test db
```

Esperado: FALLA con `relation "public.laboratorio" does not exist` en `col_is_unique`. Las dos pruebas `hasnt_*` pasan por accidente (nada existe todavia); eso es correcto y seguiran pasando cuando la tabla exista.

- [ ] **Step 3: Escribir `20260818120100_organizacion.sql`**

Se recupera el archivo viejo como base y se le aplican los cambios:

```bash
git show 267c0b7^:supabase/migrations/20260812120100_organizacion.sql \
  > supabase/migrations/20260818120100_organizacion.sql
```

Cambios a aplicar sobre esa copia:

1. En `create table public.almacen`, agregar las cuatro columnas que la migracion `130000` anadia por parche, menos `padre_id`:

```sql
  uso_principal      text,
  zona_riesgo        text,
  personas_expuestas integer,
```

2. En `create table public.laboratorio`, agregar la segunda llave candidata:

```sql
  unique (almacen_id, nombre),
  -- Redundante con la PK a primera vista, pero es lo que permite la FK
  -- compuesta de existencia: sin esta llave candidata no hay forma declarativa
  -- de exigir que el laboratorio de una existencia sea de su mismo almacen.
  unique (id, almacen_id)
```

3. Al final del archivo, activar RLS de las tres tablas (las politicas van en `rls.sql`, Task 7):

```sql
-- RLS se activa aqui, junto a la tabla, y no en rls.sql: la prueba de cobertura
-- es un invariante que debe ser cierto en todos los commits. Sin politicas la
-- tabla niega todo, que es el modo de falla correcto.
alter table public.almacen     enable row level security;
alter table public.laboratorio enable row level security;
alter table public.perfil      enable row level security;

revoke all on public.almacen, public.laboratorio, public.perfil from anon;
```

4. **No** copiar nada de `almacen_alias`, ni `padre_id`, ni su indice.

- [ ] **Step 4: Escribir la seccion de seed**

Agregar a `supabase/seed.sql`:

```sql
-- ---------------------------------------------------------------------------
-- Almacenes
-- ---------------------------------------------------------------------------
-- uso_principal, zona_riesgo y personas_expuestas son constantes por almacen:
-- venian identicas en cada renglon de cada archivo. El exportador NOM las
-- reinyecta por renglon al generar el Excel.
insert into public.almacen (clave, nombre, uso_principal, zona_riesgo, personas_expuestas) values
  ('N3',  'Almacen Nivel 3',                        'Practicas de laboratorio en UCL', 'Laboratorio', 80),
  ('N4',  'Almacen Nivel 4',                        'Practicas de laboratorio en UCL', 'Laboratorio', 80),
  ('LUM', 'Almacen LUM',                            'Practicas de laboratorio en UCL', 'Laboratorio', 80),
  ('LE',  'Almacen del Laboratorio de Electronica', 'Practicas de laboratorio en UCL', 'Laboratorio', 40);

insert into public.laboratorio (almacen_id, nombre)
select id, 'Analisis Sensorial' from public.almacen where clave = 'N4'
union all
select id, 'Laboratorio de ensenianza 5' from public.almacen where clave = 'N4'
union all
select id, 'Caracterizacion y procesamiento' from public.almacen where clave = 'LUM'
union all
select id, 'Laboratorio de Electronica' from public.almacen where clave = 'LE';
```

Los tres laboratorios extra salen de la columna `Laboratorio` de la hoja Equipos del formato.

Y a continuacion, en el mismo archivo, los usuarios de prueba: se copia sin cambios el bloque `do $$ ... $$` del seed viejo (`git show 267c0b7^:supabase/seed.sql`), que crea `admin@uaeh.local`, `n3@`, `n4@`, `lum@`, `le@` y `lectura@` con `sigrem2026` en `auth.users`, `auth.identities` y `public.perfil`.

Van aqui y no en la tarea de RLS aunque solo las pruebas de politicas los usen por rol: `movimiento.usuario_id` y `carga.cargado_por` son `not null` con FK a `perfil`, asi que las pruebas de la Task 4 no pueden insertar un movimiento si no hay ni un perfil en la base.

- [ ] **Step 5: Correr para verificar que pasan**

```bash
supabase db reset && supabase test db
```

Esperado: 7/7.

- [ ] **Step 6: Commit**

```bash
git add supabase/
git commit -m "feat(db): organizacion sin almacen_alias ni padre_id

La sub-ubicacion (LUM-1, LUM-2, N1-1) es parte de la ubicacion y el almacen lo
dice el nombre del archivo, asi que ya no hay texto sucio que mapear.

laboratorio gana unique(id, almacen_id): es lo que permite que existencia
declare una FK compuesta y sea imposible apuntar a un laboratorio de otro
almacen. RLS se activa junto a cada tabla para que la prueba de cobertura sea
cierta en todos los commits."
```

---

### Task 3: Catalogo

`articulo` con restriccion de identidad, `articulo_reactivo` con CAS y los renombres, y `articulo_biologico`.

**Files:**
- Create: `supabase/migrations/20260818120200_catalogo.sql`
- Modify: `supabase/tests/database/esquema.test.sql`

**Interfaces:**
- Consumes: `public.clasificacion_articulo`, `public.estado_fisico`, `public.color_almacenaje`, `public.norm_texto` (Task 1); `public.perfil` (Task 2).
- Produces: `public.articulo (id, nombre_canonico, descripcion, clasificacion, unidad_base, familia, verificado, creado_por, creado_en)` con `constraint articulo_identidad`; `public.articulo_alias (id, articulo_id, texto, origen, creado_en)`; `public.articulo_reactivo (articulo_id, cas, estado_fisico, color_almacenaje, tiene_hoja_seguridad, caracteristica_quimica, caracteristica_toxica, riesgo_salud, riesgo_inflamabilidad, riesgo_reactividad, peligro_especial, implica_actividad_peligro)`; `public.articulo_biologico (articulo_id, origen_especie)`; `public.buscar_articulo(termino text, umbral real, maximo int)`.

- [ ] **Step 1: Escribir las pruebas (fallan)**

Subir a `plan(15)` y agregar:

```sql
-- ---------------------------------------------------------------------------
-- Catalogo
-- ---------------------------------------------------------------------------
select pg_temp.como_postgres();

insert into public.articulo (nombre_canonico, descripcion, clasificacion, unidad_base)
values ('Matraz volumetrico', '1000 mL, clase A, con tapon', 'material', 'pieza');

-- El formato separa Articulo + Especificacion. Ese par, mas la unidad, ES el
-- articulo: dos matraces de distinto volumen son dos articulos.
select lives_ok(
  $$ insert into public.articulo (nombre_canonico, descripcion, clasificacion, unidad_base)
     values ('Matraz volumetrico', '250 mL, forma baja', 'material', 'pieza') $$,
  'Mismo nombre con especificacion distinta son dos articulos'
);

select throws_ok(
  $$ insert into public.articulo (nombre_canonico, descripcion, clasificacion, unidad_base)
     values ('Matraz volumetrico', '1000 mL, clase A, con tapon', 'material', 'pieza') $$,
  '23505',
  null,
  'Mismo nombre y misma especificacion se rechaza'
);

-- La parte que importa de `nulls not distinct`: sin el, dos filas con
-- especificacion vacia se cuelan como distintas y el catalogo se duplica solo.
insert into public.articulo (nombre_canonico, descripcion, clasificacion, unidad_base)
values ('Papel filtro', null, 'insumo', 'pieza');

select throws_ok(
  $$ insert into public.articulo (nombre_canonico, descripcion, clasificacion, unidad_base)
     values ('Papel filtro', null, 'insumo', 'pieza') $$,
  '23505',
  null,
  'Dos articulos sin especificacion no se cuelan como distintos (nulls not distinct)'
);

-- El CAS identifica el compuesto, no el grado: el esquema define que
-- "Zinc en polvo 95%" y "93%" son dos articulos, y los dos son CAS 7440-66-6.
select lives_ok(
  $$ with a as (
       insert into public.articulo (nombre_canonico, clasificacion, unidad_base)
       values ('Zinc en polvo, solido, pureza 95%', 'reactivo', 'g'),
              ('Zinc en polvo, solido, pureza 93%', 'reactivo', 'g')
       returning id)
     insert into public.articulo_reactivo (articulo_id, cas) select id, '7440-66-6' from a $$,
  'Dos articulos pueden compartir el mismo CAS'
);

-- El formato pregunta "Existencia de hoja de seguridad": si la tienes, no si la
-- necesitas. Con el nombre viejo un false era ambiguo.
select has_column('public', 'articulo_reactivo', 'tiene_hoja_seguridad',
  'articulo_reactivo tiene tiene_hoja_seguridad, no requiere_hoja_seguridad');

select hasnt_column('public', 'articulo_reactivo', 'clasificacion_ghs',
  'clasificacion_ghs se fue: no existe en el formato que se va a capturar');

select hasnt_column('public', 'articulo_reactivo', 'uso_principal',
  'uso_principal se fue de articulo_reactivo: vive en almacen');

select is(
  (select count(*)::int from public.buscar_articulo('matras', 0.3, 10)),
  2,
  'buscar_articulo encuentra los dos matraces pese a la errata y la falta de acento'
);
```

Este bloque necesita los helpers `pg_temp.como_postgres()`. Agregarlos al inicio de `esquema.test.sql`, despues del `create extension`, con el mismo cuerpo que tenian en el `rls.test.sql` borrado (`git show 267c0b7^:supabase/tests/database/rls.test.sql`):

```sql
create function pg_temp.como_postgres() returns void
language plpgsql as $$
begin
  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims', null, true);
end $$;
```

- [ ] **Step 2: Correr para verificar que fallan**

```bash
supabase db reset && supabase test db
```

Esperado: FALLA con `relation "public.articulo" does not exist`.

- [ ] **Step 3: Escribir `20260818120200_catalogo.sql`**

Base recuperable con `git show 267c0b7^:supabase/migrations/20260812120200_catalogo.sql`. Los DDL completos y comentados estan en la §4.3 del spec. Cambios respecto al archivo viejo:

1. `articulo` gana `familia text` (venia por parche en `130000`) y `constraint articulo_identidad unique nulls not distinct (nombre_canonico, descripcion, unidad_base)`.
2. `articulo_reactivo` gana `cas text` con `create index articulo_reactivo_cas_idx on public.articulo_reactivo (cas) where cas is not null` — **indice normal, no unique**.
3. `color_almacenamiento text` pasa a `color_almacenaje public.color_almacenaje`.
4. `requiere_hoja_seguridad` pasa a `tiene_hoja_seguridad`.
5. `caracteristica_fisica` se llama `caracteristica_toxica` desde el principio (el rename de `130000` deja de existir), y entra `implica_actividad_peligro boolean`.
6. Se van `uso_principal` y `clasificacion_ghs`.
7. Nueva tabla `articulo_biologico`.
8. `buscar_articulo()` se copia sin cambios.
9. Al final: `enable row level security` y `revoke all ... from anon` de las cuatro tablas.

- [ ] **Step 4: Correr para verificar que pasan**

```bash
supabase db reset && supabase test db
```

Esperado: 15/15.

- [ ] **Step 5: Commit**

```bash
git add supabase/
git commit -m "feat(db): catalogo con identidad de articulo, CAS y materia biologica

articulo gana unique nulls not distinct (nombre_canonico, descripcion,
unidad_base). El formato separa Articulo + Especificacion y ese par es la
identidad; sin nulls not distinct dos filas con especificacion vacia se cuelan
como distintas y el catalogo se duplica solo.

articulo_reactivo gana el CAS, que hoy viene enterrado en la cadena larga
('...CAS: 5144-89-8') y es el unico identificador universal de una sustancia.
Con indice normal, no unique: el CAS identifica el compuesto, no el grado, y dos
purezas del mismo zinc lo comparten.

requiere_hoja_seguridad pasa a tiene_hoja_seguridad, porque el formato pregunta
si la hoja existe, no si hace falta. Se van clasificacion_ghs (no esta en el
formato) y uso_principal (duplicado con almacen)."
```

---

### Task 4: Inventario

`ubicacion` con las llaves del formato, `carga` para trazabilidad, `existencia` con FK compuestas y unicos parciales, `estado_calculado()` compartido, y `movimiento`.

**Files:**
- Create: `supabase/migrations/20260818120300_inventario.sql`
- Modify: `supabase/tests/database/esquema.test.sql`

**Interfaces:**
- Consumes: `public.almacen`, `public.laboratorio`, `public.perfil` (Task 2); `public.articulo` (Task 3); `public.estado_existencia`, `public.tipo_movimiento`, `public.funcionamiento_equipo` (Task 1).
- Produces: `public.ubicacion (id, almacen_id, etiqueta, componentes)`; `public.carga (id, almacen_id, archivo, hoja, periodo, actualizado_el, responsable, filas, cargado_por, cargado_en)`; `public.existencia` con todas las columnas de la §4.4 del spec; `public.movimiento (id, existencia_id, almacen_id, tipo, cantidad, cantidad_antes, cantidad_despues, practica_id, usuario_id, motivo, ocurrido_en)`; `private.estado_calculado(p_cantidad numeric, p_minimo numeric, p_estado public.estado_existencia) returns public.estado_existencia`; `private.folio_almacen`; los triggers `existencia_asigna_codigo` y `movimiento_aplica_saldo`.

- [ ] **Step 1: Escribir las pruebas (fallan)**

Subir a `plan(30)` y agregar. Este es el bloque mas importante del plan: son los huecos que el esquema de hoy deja abiertos.

```sql
-- ---------------------------------------------------------------------------
-- Inventario
-- ---------------------------------------------------------------------------
select pg_temp.como_postgres();

create function pg_temp.id_almacen(clave text) returns bigint
language sql as $$ select id from public.almacen where almacen.clave = $1 $$;

insert into public.articulo (id, nombre_canonico, clasificacion, unidad_base)
overriding system value
values (900001, 'Acido succinico, solido, grado reactivo', 'reactivo', 'g'),
       (900002, 'Agitador vortex',                        'equipo',   'pieza');

insert into public.ubicacion (id, almacen_id, etiqueta, componentes)
overriding system value
values (900001, pg_temp.id_almacen('N3'), 'Anaquel 2 / 3 / 4',
        '{"sub_ubicacion":"N3","mueble":"Anaquel 2","repisa":"3","fila_cajon":"4"}'),
       (900002, pg_temp.id_almacen('N4'), 'Gabinete 301',
        '{"sub_ubicacion":"N4","mueble":"Gabinete 301"}');

-- Hoy nada impide que una existencia de N3 apunte a un anaquel de N4. Con la FK
-- compuesta es imposible por construccion, sin triggers ni validacion en la app.
select throws_ok(
  $$ insert into public.existencia (articulo_id, almacen_id, ubicacion_id)
     values (900001, pg_temp.id_almacen('N3'), 900002) $$,
  '23503',
  null,
  'Una existencia de N3 no puede apuntar a una ubicacion de N4'
);

select lives_ok(
  $$ insert into public.existencia (articulo_id, almacen_id, ubicacion_id)
     values (900001, pg_temp.id_almacen('N3'), 900001) $$,
  'Una existencia de N3 si puede apuntar a una ubicacion de N3'
);

-- Regla 6 del formato: celda vacia significa cero. El estado tiene que salir
-- coherente aunque ningun movimiento haya corrido todavia.
select is(
  (select estado::text from public.existencia
    where articulo_id = 900001 and ubicacion_id = 900001),
  'agotado',
  'Una existencia recien creada con cantidad 0 nace agotada, no disponible'
);

select matches(
  (select codigo from public.existencia
    where articulo_id = 900001 and ubicacion_id = 900001),
  '^N3-\d{5}$',
  'El codigo del QR lleva la clave del almacen y cinco digitos'
);

-- Regla 10: la serie y el numero de inventario no se repiten entre renglones.
-- Hoy en N4 tres numeros de serie se repiten en 30 equipos y nada lo impide.
insert into public.existencia (id, articulo_id, almacen_id, numero_serie, numero_inventario_uaeh)
overriding system value
values (900101, 900002, pg_temp.id_almacen('N4'), '10017662023004', '5311308867');

select throws_ok(
  $$ insert into public.existencia (articulo_id, almacen_id, numero_serie)
     values (900002, pg_temp.id_almacen('N4'), '10017662023004') $$,
  '23505',
  null,
  'Dos equipos no pueden compartir numero de serie'
);

select throws_ok(
  $$ insert into public.existencia (articulo_id, almacen_id, numero_inventario_uaeh)
     values (900002, pg_temp.id_almacen('N4'), '5311308867') $$,
  '23505',
  null,
  'Dos equipos no pueden compartir numero de inventario UAEH'
);

-- El ETL normaliza 'Sin serie' y '—' a NULL, y el unico parcial tiene que
-- dejar pasar tantos NULL como haga falta.
select lives_ok(
  $$ insert into public.existencia (articulo_id, almacen_id, numero_serie)
     values (900002, pg_temp.id_almacen('N4'), null),
            (900002, pg_temp.id_almacen('N4'), null) $$,
  'Varias existencias sin numero de serie conviven: el unico es parcial'
);

-- La cantidad nunca se escribe directo. La carga inicial pasa por movimiento
-- para que exista bitacora desde el primer renglon.
select lives_ok(
  $$ insert into public.movimiento (existencia_id, tipo, cantidad, cantidad_antes,
                                    cantidad_despues, almacen_id, usuario_id)
     values (900101, 'carga_inicial', 1, 0, 0, pg_temp.id_almacen('N4'),
             (select id from public.perfil limit 1)) $$,
  'La carga inicial se registra como movimiento'
);

select is(
  (select cantidad from public.existencia where id = 900101),
  1::numeric(14,4),
  'El trigger aplica la carga inicial al saldo'
);

select is(
  (select estado::text from public.existencia where id = 900101),
  'disponible',
  'Con saldo y sin minimo, el estado queda disponible'
);

-- Un reactivo caducado hace anios sigue disponible: la caducidad es
-- informativa y no bloquea. Decisiones D2 y D5 del spec.
select is(
  private.estado_calculado(50, 10, 'disponible'),
  'disponible'::public.estado_existencia,
  'estado_calculado no mira la caducidad: un caducado con saldo sigue disponible'
);

select is(
  private.estado_calculado(5, 10, 'disponible'),
  'stock_bajo'::public.estado_existencia,
  'Por debajo del minimo, stock_bajo'
);

select is(
  private.estado_calculado(0, 10, 'contaminado'),
  'contaminado'::public.estado_existencia,
  'Un estado puesto a mano manda sobre el calculado'
);

select hasnt_column('public', 'existencia', 'partida',
  'partida se fue: es del catalogo de compras, no del inventario');

select hasnt_column('public', 'existencia', 'revisado_por',
  'revisado_por se fue: quien reviso lo dice movimiento.usuario_id');
```

- [ ] **Step 2: Correr para verificar que fallan**

```bash
supabase db reset && supabase test db
```

Esperado: FALLA con `relation "public.ubicacion" does not exist`.

- [ ] **Step 3: Escribir `20260818120300_inventario.sql`**

Base recuperable con `git show 267c0b7^:supabase/migrations/20260812120300_inventario.sql`. Los DDL completos estan en la §4.4 del spec. **Orden dentro del archivo:** `ubicacion` → `carga` → `existencia` → `estado_calculado` → triggers → `movimiento`. `carga` va antes de `existencia` por la FK.

Cambios respecto al archivo viejo, mas alla de los DDL del spec:

1. `ubicacion` gana `unique (id, almacen_id)`.
2. `existencia` gana las FK compuestas, los dos unicos parciales, `laboratorio_id`, `carga_id`, `funcionamiento`, los cinco campos de materia biologica, y `modelo`/`mantenimiento`/`fecha_chequeo`/`peso_total`/`peso_frasco_vacio`/`observaciones` (que venian por parche en `130000`). Se van `partida` y `revisado_por`.
3. Nueva funcion `private.estado_calculado()`, con el cuerpo de la §4.4 del spec.
4. `private.asignar_codigo()` se extiende para fijar tambien el estado. Cuerpo completo:

```sql
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
    insert into private.folio_almacen (almacen_id, ultimo)
    values (new.almacen_id, 1)
    on conflict (almacen_id) do update set ultimo = private.folio_almacen.ultimo + 1
    returning ultimo into consecutivo;

    select clave into clave_alm from public.almacen where id = new.almacen_id;
    new.codigo := clave_alm || '-' || lpad(consecutivo::text, 5, '0');
  end if;

  -- Sin esto, una existencia creada con cantidad 0 (regla 6: celda vacia
  -- significa cero) se quedaria en 'disponible', porque ningun movimiento
  -- corrio todavia para recalcularla.
  new.estado := private.estado_calculado(new.cantidad, new.cantidad_minima, new.estado);
  return new;
end;
$$;

create trigger existencia_asigna_codigo
  before insert on public.existencia
  for each row execute function private.asignar_codigo();
```

5. `private.aplicar_movimiento()` se copia del archivo viejo, sustituyendo su `case` interno por la llamada a `private.estado_calculado(nuevo, minimo, edo)`.
6. `movimiento.practica_id` se declara **sin FK**; la FK se agrega en Task 5.
7. Al final: `enable row level security` y `revoke all ... from anon` de `ubicacion`, `carga`, `existencia`, `movimiento`.
8. `grant execute on function private.estado_calculado(numeric, numeric, public.estado_existencia) to authenticated;`

- [ ] **Step 4: Correr para verificar que pasan**

```bash
supabase db reset && supabase test db
```

Esperado: 30/30.

- [ ] **Step 5: Commit**

```bash
git add supabase/
git commit -m "feat(db): inventario con FK compuestas, unicos de serie y tabla carga

Dos llaves foraneas compuestas cierran un hueco que hoy esta abierto: nada
impide que una existencia de N3 apunte a un anaquel o a un laboratorio de N4.
Con (ubicacion_id, almacen_id) y (laboratorio_id, almacen_id) es imposible por
construccion, sin triggers ni validacion en la app.

Unicos parciales en numero_serie y numero_inventario_uaeh (regla 10 del
formato: hoy en N4 tres series se repiten en 30 equipos). Parciales porque el
ETL normaliza 'Sin serie' a NULL.

estado_calculado() se extrae del trigger de movimiento y se usa tambien al
insertar la existencia: sin eso, una existencia con cantidad 0 nacia
'disponible'. La funcion no mira la caducidad a proposito (D2/D5): un reactivo
caducado que sigue sirviendo sigue disponible.

La tabla carga guarda el encabezado de cada hoja (archivo, periodo, actualizado
el, responsable), que hoy se tira. Es lo que contesta de que archivo salio un
numero cuando alguien lo reclame.

Se van partida y revisado_por."
```

---

### Task 5: Practicas

El modulo que el prototipo llama principal y que en la base no existe.

**Files:**
- Create: `supabase/migrations/20260818120400_practica.sql`
- Modify: `supabase/tests/database/esquema.test.sql`
- Modify: `supabase/seed.sql`

**Interfaces:**
- Consumes: `public.laboratorio` (Task 2); `public.existencia`, `public.movimiento` (Task 4); `public.metodo_control`, `public.funcionamiento_equipo` (Task 1).
- Produces: `public.programa_educativo (id, nombre, activo)`; `public.asignatura (id, programa_educativo_id, nombre, activo)`; `public.practica (id, folio, programa_educativo_id, laboratorio_id, asignatura_id, almacen_id, fecha, observaciones, registrado_por, creado_en)`; `public.motivo_observacion (clave, etiqueta, orden, activo)`; `public.practica_observacion (practica_id, motivo)`; `public.practica_elemento` con las columnas generadas `consumo` y `perdidas`; `private.folio_practica`.

- [ ] **Step 1: Escribir las pruebas (fallan)**

Subir a `plan(40)` y agregar:

```sql
-- ---------------------------------------------------------------------------
-- Practicas
-- ---------------------------------------------------------------------------
select pg_temp.como_postgres();

insert into public.existencia (id, articulo_id, almacen_id)
overriding system value
values (900201, 900001, pg_temp.id_almacen('N3')),   -- reactivo, se pesa
       (900202, 900001, pg_temp.id_almacen('N3')),   -- material, por cantidad
       (900203, 900002, pg_temp.id_almacen('N3'));   -- equipo, prestamo

insert into public.movimiento (existencia_id, tipo, cantidad, cantidad_antes,
                               cantidad_despues, almacen_id, usuario_id)
values (900201, 'carga_inicial', 500, 0, 0, pg_temp.id_almacen('N3'),
        (select id from public.perfil limit 1)),
       (900202, 'carga_inicial',  20, 0, 0, pg_temp.id_almacen('N3'),
        (select id from public.perfil limit 1)),
       (900203, 'carga_inicial',   1, 0, 0, pg_temp.id_almacen('N3'),
        (select id from public.perfil limit 1));

insert into public.practica (id, programa_educativo_id, laboratorio_id, registrado_por)
overriding system value
values (900301,
        (select id from public.programa_educativo limit 1),
        (select id from public.laboratorio
          where almacen_id = pg_temp.id_almacen('N3') limit 1),
        (select id from public.perfil limit 1));

select matches(
  (select folio from public.practica where id = 900301),
  '^PRA-\d{4}$',
  'El folio de la practica lo pone el trigger'
);

-- El almacen_id lo escribe el trigger desde el laboratorio, igual que en
-- movimiento: si lo mandara el cliente podria falsearlo.
select is(
  (select a.clave from public.practica p join public.almacen a on a.id = p.almacen_id
    where p.id = 900301),
  'N3',
  'El trigger deriva almacen_id del laboratorio de la practica'
);

-- Union discriminada: un reactivo con estado_devolucion es un renglon imposible.
select throws_ok(
  $$ insert into public.practica_elemento
       (practica_id, existencia_id, metodo_control, peso_inicial, peso_final,
        estado_devolucion)
     values (900301, 900201, 'peso', 100, 90, 'correcto') $$,
  '23514',
  null,
  'Un elemento por peso no puede traer estado_devolucion'
);

select throws_ok(
  $$ insert into public.practica_elemento
       (practica_id, existencia_id, metodo_control, peso_inicial, peso_final)
     values (900301, 900201, 'peso', 90, 100) $$,
  '23514',
  null,
  'El peso final no puede ser mayor que el inicial'
);

-- La aritmetica vive en la base. El bug de la semana del 11 de agosto fue una
-- resta al reves que no daba error.
insert into public.practica_elemento
  (practica_id, existencia_id, metodo_control, peso_inicial, peso_final)
values (900301, 900201, 'peso', 196.8, 139.8);

select is(
  (select consumo from public.practica_elemento
    where existencia_id = 900201),
  57.0::numeric(14,4),
  'consumo es columna generada: 196.8 - 139.8'
);

select is(
  (select cantidad from public.existencia where id = 900201),
  443.0::numeric(14,4),
  'El consumo por peso descuenta del saldo via movimiento'
);

-- Dos columnas para danada y perdidas, dos movimientos: juntarlas en uno solo
-- desperdiciaria la distincion que el formulario si captura.
insert into public.practica_elemento
  (practica_id, existencia_id, metodo_control,
   cantidad_entregada, cantidad_devuelta, cantidad_danada)
values (900301, 900202, 'cantidad', 10, 7, 2);

select is(
  (select perdidas from public.practica_elemento where existencia_id = 900202),
  1.0::numeric(14,4),
  'perdidas es columna generada: 10 - 7 - 2'
);

select set_eq(
  $$ select tipo::text || ':' || cantidad::text from public.movimiento
      where existencia_id = 900202 and tipo <> 'carga_inicial' $$,
  array['merma:-2.0000','consumo:-1.0000'],
  'Un elemento por cantidad genera merma por lo daniado y consumo por lo perdido'
);

-- Un equipo prestado y devuelto no cambia de cantidad. Una fila -1/+1 que se
-- cancela seria historia inventada.
insert into public.practica_elemento
  (practica_id, existencia_id, metodo_control, estado_salida, estado_devolucion)
values (900301, 900203, 'prestamo', 'correcto', 'presenta_fallas');

select is(
  (select count(*)::int from public.movimiento
    where existencia_id = 900203 and tipo <> 'carga_inicial'),
  0,
  'Un prestamo de equipo no genera movimiento: la cantidad no cambia'
);

select is(
  (select funcionamiento::text from public.existencia where id = 900203),
  'presenta_fallas',
  'La devolucion actualiza el funcionamiento del equipo'
);
```

- [ ] **Step 2: Correr para verificar que fallan**

```bash
supabase db reset && supabase test db
```

Esperado: FALLA con `relation "public.programa_educativo" does not exist`.

- [ ] **Step 3: Escribir `20260818120400_practica.sql`**

Los DDL completos de las seis tablas estan en la §4.5 del spec. Ademas de copiarlos:

```sql
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
-- practica_elemento: dos triggers, y el orden importa
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
  uid uuid := (select auth.uid());
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
```

Mas `enable row level security` y `revoke all ... from anon` de las seis tablas.

- [ ] **Step 4: Escribir la seccion de seed**

```sql
-- ---------------------------------------------------------------------------
-- Catalogos de practicas
-- ---------------------------------------------------------------------------
insert into public.programa_educativo (nombre) values
  ('Ingenieria en Alimentos'),
  ('Ingenieria en Biotecnologia'),
  ('Ingenieria Industrial'),
  ('Ingenieria en Electronica y Telecomunicaciones'),
  ('Ingenieria Mecanica'),
  ('Quimica en Alimentos'),
  ('Quimico Farmaceutico Biologo'),
  ('Ingenieria en Tecnologias del Software');

-- Los nueve motivos son las casillas del prototipo. Como catalogo y no como
-- nueve columnas booleanas: agregar el decimo es un insert, no una migracion
-- mas un redespliegue del frontend.
insert into public.motivo_observacion (clave, etiqueta, orden) values
  ('no_tenemos',      'No tenemos',        1),
  ('prestamo_n4',     'Prestamo N4',       2),
  ('prestamo_n3',     'Prestamo N3',       3),
  ('prestamo_lum',    'Prestamo LUM',      4),
  ('contaminado',     'Contaminado',       5),
  ('se_termino',      'Se termino',        6),
  ('material_daniado','Material daniado',  7),
  ('equipo_daniado',  'Equipo daniado',    8),
  ('otro',            'Otro',              9);
```

- [ ] **Step 5: Correr para verificar que pasan**

```bash
supabase db reset && supabase test db
```

Esperado: 40/40.

- [ ] **Step 6: Commit**

```bash
git add supabase/
git commit -m "feat(db): modulo de practicas

movimiento.practica_id llevaba tres semanas siendo un bigint huerfano, sin FK
ni tabla del otro lado. Entran practica, practica_elemento, los catalogos de
programa educativo y asignatura, y los nueve motivos de observacion.

consumo y perdidas son columnas generadas, no cuentas del frontend: el bug que
costo la semana del 11 de agosto fue una resta al reves que no daba error. Un
CHECK discriminado por metodo_control impide que un reactivo traiga
estado_devolucion o que un equipo traiga pesos.

La frontera queda explicita: movimiento responde cuanto hay, practica_elemento
responde quien uso que. De ahi que un prestamo de equipo no genere movimiento
(la cantidad no cambia) y que Reportes lea practica_elemento."
```

---

### Task 6: Perfiles de captura

`perfil_captura.almacen_id` nullable con semantica de default, y `formulario()` resolviendo la precedencia.

**Files:**
- Create: `supabase/migrations/20260818120500_captura.sql`
- Modify: `supabase/tests/database/esquema.test.sql`
- Modify: `supabase/seed.sql`

**Interfaces:**
- Consumes: `public.almacen` (Task 2); `public.clasificacion_articulo` (Task 1).
- Produces: `public.campo_capturable (campo, etiqueta_default, tipo_dato, destino, opciones, ayuda)`; `public.perfil_captura (id, almacen_id, clasificacion, nombre, notas)`; `public.perfil_campo (perfil_id, campo, etiqueta, obligatorio, orden)`; `public.formulario(p_almacen bigint, p_clasificacion public.clasificacion_articulo)` que devuelve `(campo, etiqueta, tipo_dato, destino, opciones, ayuda, obligatorio, orden)`.

- [ ] **Step 1: Escribir las pruebas (fallan)**

Subir a `plan(44)` y agregar:

```sql
-- ---------------------------------------------------------------------------
-- Perfiles de captura
-- ---------------------------------------------------------------------------
select pg_temp.como_postgres();

-- Con el formato unificado todos capturan igual, asi que el seed trae 6
-- perfiles default en vez de 24 por almacen.
select is(
  (select count(*)::int from public.perfil_captura where almacen_id is null),
  6,
  'Hay un perfil default por clasificacion: 6 filas, no 24'
);

-- Un almacen sin perfil propio recibe el default. Dar de alta un quinto
-- almacen no requiere ni una fila nueva.
select isnt_empty(
  $$ select * from public.formulario(
       (select id from public.almacen where clave = 'LE'), 'reactivo') $$,
  'Un almacen sin perfil propio cae al default'
);

-- El especifico gana sobre el default.
insert into public.perfil_captura (almacen_id, clasificacion, nombre)
values ((select id from public.almacen where clave = 'LE'), 'componente',
        'Componentes LE con coordenadas');

insert into public.perfil_campo (perfil_id, campo, obligatorio, orden)
select id, 'coord_h', true, 1 from public.perfil_captura
 where almacen_id = (select id from public.almacen where clave = 'LE')
   and clasificacion = 'componente';

select results_eq(
  $$ select campo from public.formulario(
       (select id from public.almacen where clave = 'LE'), 'componente') $$,
  array['coord_h'],
  'El perfil del almacen gana sobre el default'
);

-- El formato unifico a Mueble: "Anaquel 2" es un valor, no una columna.
select is(
  (select count(*)::int from public.campo_capturable
    where campo in ('anaquel','partida','revisado_por')),
  0,
  'anaquel, partida y revisado_por ya no son campos capturables'
);
```

- [ ] **Step 2: Correr para verificar que fallan**

```bash
supabase db reset && supabase test db
```

Esperado: FALLA con `relation "public.perfil_captura" does not exist`.

- [ ] **Step 3: Escribir `20260818120500_captura.sql`**

Base recuperable con `git show 267c0b7^:supabase/migrations/20260812130100_perfiles_captura.sql`. `campo_capturable` y `perfil_campo` se copian sin cambios. `perfil_captura` es el de la §4.7 del spec (`almacen_id` nullable, `unique nulls not distinct`). `formulario()` se reescribe:

```sql
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
  -- Un perfil por almacen gana sobre el default (almacen_id nulo). Con el
  -- formato unificado el default cubre a los cuatro almacenes, y el mecanismo
  -- especifico se conserva para el dia que uno diverja de verdad.
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
```

Mas `enable row level security` y `revoke all ... from anon` de las tres tablas.

- [ ] **Step 4: Escribir la seccion de seed**

`campo_capturable`: copiar el insert del archivo viejo (`git show 267c0b7^:supabase/seed.sql`), quitando `anaquel`, `partida` y `revisado_por`, y agregando las trece entradas nuevas. Las nuevas, con su `destino`:

| campo | etiqueta_default | tipo_dato | destino |
|---|---|---|---|
| `sub_ubicacion` | Sub-ubicacion | texto | `ubicacion.componentes.sub_ubicacion` |
| `mueble` | Mueble | texto | `ubicacion.componentes.mueble` |
| `fila_cajon` | Fila o cajon | texto | `ubicacion.componentes.fila_cajon` |
| `especificacion` | Especificacion | texto | `articulo.descripcion` |
| `cas` | Numero CAS | texto | `articulo_reactivo.cas` |
| `laboratorio` | Laboratorio | seleccion | `existencia.laboratorio_id` |
| `funcionamiento` | Funcionamiento | seleccion | `existencia.funcionamiento` |
| `origen_especie` | Origen o especie | texto | `articulo_biologico.origen_especie` |
| `metodo_conservacion` | Metodo de conservacion | texto | `existencia.metodo_conservacion` |
| `temperatura` | Temperatura | texto | `existencia.temperatura` |
| `fecha_recoleccion` | Fecha de recoleccion | fecha | `existencia.fecha_recoleccion` |
| `fecha_preparacion` | Fecha de preparacion | fecha | `existencia.fecha_preparacion` |
| `responsable_muestra` | Responsable de la muestra | texto | `existencia.responsable_muestra` |

`funcionamiento` es `seleccion` y por tanto necesita `opciones`: `array['Correcto','Presenta fallas']`. `laboratorio` tambien es `seleccion`; sus opciones las llena el frontend desde `public.laboratorio`, asi que basta `array['(desde laboratorio)']` para satisfacer `campo_seleccion_con_opciones`.

Luego los 6 perfiles default, uno por clasificacion, con las columnas de su hoja del formato en el orden en que aparecen (§5 del spec). Ejemplo del de reactivos:

```sql
insert into public.perfil_captura (almacen_id, clasificacion, nombre, notas) values
  (null, 'reactivo', 'Reactivos · formato unificado',
   'Hoja Reactivos del formato unificado, 28 columnas'),
  (null, 'insumo',   'Insumos · formato unificado',   'Hoja Insumos, 13 columnas'),
  (null, 'material', 'Material · formato unificado',  'Hoja Material, 13 columnas'),
  (null, 'equipo',   'Equipos · formato unificado',   'Hoja Equipos, 13 columnas'),
  (null, 'materia_biologica', 'Materia biologica · formato unificado',
   'Hoja Materia biologica, 15 columnas'),
  (null, 'componente','Electronica · formato unificado',
   'Hoja Electronica, 14 columnas');

insert into public.perfil_campo (perfil_id, campo, obligatorio, orden)
select p.id, c.campo, c.obligatorio, c.orden
  from public.perfil_captura p,
       (values ('sub_ubicacion', false, 1),
               ('mueble',        false, 2),
               ('repisa',        false, 3),
               ('fila',          false, 4),
               ('color_almacenamiento', true, 5),
               ('hoja_seguridad',       true, 6),
               ('nombre_articulo',      true, 7),
               ('cas',                  false, 8),
               ('marca',                false, 9),
               ('presentacion',         false, 10),
               ('peso_frasco_vacio',    false, 11),
               ('peso_total',           false, 12),
               ('cantidad',             true, 13),
               ('unidad',               true, 14),
               ('estado_fisico',        true, 15),
               ('caracteristica_quimica', false, 16),
               ('caracteristica_toxica',  false, 17),
               ('riesgo_salud',           false, 18),
               ('riesgo_reactividad',     false, 19),
               ('riesgo_inflamabilidad',  false, 20),
               ('peligro_especial',       false, 21),
               ('implica_peligro',        false, 22),
               ('observaciones',          false, 23)
       ) as c(campo, obligatorio, orden)
 where p.almacen_id is null and p.clasificacion = 'reactivo';
```

El orden de `peso_frasco_vacio` antes de `peso_total` es la regla 13 y no es negociable: N3 y LUM las tienen invertidas entre si, y si se juntan los archivos sin un orden acordado la mitad de los pesos queda al reves sin que se note.

Los otros cinco perfiles se escriben con el mismo `insert ... select` cambiando la clasificacion y la lista de `(campo, obligatorio, orden)`. Las cinco listas, en el orden en que las columnas aparecen en su hoja:

**`insumo` y `material`** (identicas entre si, 11 campos):

```
('clasificacion',   true,  1), ('nombre_articulo', true,  2),
('especificacion',  false, 3), ('marca',           false, 4),
('cantidad',        true,  5), ('unidad',          true,  6),
('presentacion',    false, 7), ('sub_ubicacion',   false, 8),
('mueble',          false, 9), ('repisa',          false, 10),
('fila_cajon',      false, 11), ('observaciones',  false, 12)
```

**`equipo`** (12 campos). `cantidad` no va: la regla 9 dice un renglon por equipo fisico, asi que siempre es 1 y pedirla invita a capturar 3 y perder la trazabilidad de a cual se le dio mantenimiento:

```
('nombre_articulo',    true,  1), ('marca',              false, 2),
('modelo',             false, 3), ('numero_serie',       false, 4),
('numero_inventario',  false, 5), ('sub_ubicacion',      false, 6),
('laboratorio',        false, 7), ('mueble',             false, 8),
('funcionamiento',     true,  9), ('fecha_chequeo',      false, 10),
('mantenimiento',      false, 11), ('observaciones',     false, 12)
```

**`materia_biologica`** (14 campos):

```
('nombre_articulo',      true,  1), ('origen_especie',    false, 2),
('cantidad',             true,  3), ('unidad',            true,  4),
('presentacion',         false, 5), ('metodo_conservacion', false, 6),
('temperatura',          false, 7), ('fecha_recoleccion', false, 8),
('fecha_preparacion',    false, 9), ('responsable_muestra', false, 10),
('sub_ubicacion',        false, 11), ('mueble',           false, 12),
('repisa',               false, 13), ('observaciones',    false, 14)
```

**`componente`** (13 campos; es el unico con `familia` y con las tres coordenadas):

```
('clasificacion',  true,  1), ('familia',         true,  2),
('nombre_articulo',true,  3), ('especificacion',  false, 4),
('cantidad',       true,  5), ('unidad',          true,  6),
('presentacion',   false, 7), ('sub_ubicacion',   false, 8),
('mueble',         false, 9), ('coord_h',         false, 10),
('coord_v',        false, 11), ('coord_i',        false, 12),
('observaciones',  false, 13)
```

Todas las claves de campo salen de `campo_capturable`; si alguna no existe, el `references` de `perfil_campo` lo rechaza al correr el seed, que es justo lo que debe pasar.

- [ ] **Step 5: Correr para verificar que pasan**

```bash
supabase db reset && supabase test db
```

Esperado: 44/44.

- [ ] **Step 6: Commit**

```bash
git add supabase/
git commit -m "feat(db): perfiles de captura con default por clasificacion

perfil_captura.almacen_id pasa a nullable, donde NULL significa 'default para
todos los almacenes' y una fila con almacen lo sobreescribe. Como el formato ya
esta unificado, esto son 6 perfiles en el seed en vez de 24, y dar de alta un
quinto almacen no requiere ni una fila.

campo_capturable se resiembra desde las columnas reales del formato: fuera
anaquel (el formato unifico a Mueble, y 'Anaquel 2' es un valor), partida y
revisado_por; entran los trece campos de materia biologica, equipos y CAS."
```

---

### Task 7: RLS

Todas las politicas y la suite que las prueba.

**Files:**
- Create: `supabase/migrations/20260818120600_rls.sql`
- Create: `supabase/tests/database/rls.test.sql`

**Interfaces:**
- Consumes: todas las tablas de las tareas 2 a 6; los helpers `private.es_admin()`, `private.almacen_actual()`, `private.puede_escribir()` (Task 2); los usuarios de prueba del seed (Task 2).
- Produces: las politicas. Ninguna interfaz nueva para tareas posteriores.

- [ ] **Step 1: Escribir `rls.test.sql` (falla)**

Se recupera el archivo borrado como base y se adapta:

```bash
git show 267c0b7^:supabase/tests/database/rls.test.sql > supabase/tests/database/rls.test.sql
```

Cambios a aplicar:

1. `plan(23)` sube a `plan(30)`.
2. Quitar cualquier referencia a `almacen_alias` y a `por_confirmar`.
3. En el bloque de datos de trabajo, `insert into public.existencia` ya no manda `codigo` (el trigger lo pone) — dejarlo es valido, el trigger lo respeta.
4. Agregar las siete pruebas nuevas antes de `select * from finish();`:

```sql
-- ---------------------------------------------------------------------------
-- 24-30. Practicas: el almacen_id desnormalizado es la ancla de los permisos
-- ---------------------------------------------------------------------------
select pg_temp.como_postgres();

insert into public.existencia (id, articulo_id, almacen_id)
overriding system value
values (900401, 900001, pg_temp.id_almacen('N4'));

insert into public.movimiento (existencia_id, tipo, cantidad, cantidad_antes,
                               cantidad_despues, almacen_id, usuario_id)
values (900401, 'carga_inicial', 100, 0, 0, pg_temp.id_almacen('N4'),
        (select id from public.perfil where nombre like '%N4%' limit 1));

select pg_temp.como('n3@uaeh.local');

select throws_ok(
  $$ insert into public.practica (programa_educativo_id, laboratorio_id)
     values ((select id from public.programa_educativo limit 1),
             (select id from public.laboratorio
               where almacen_id = pg_temp.id_almacen('N4') limit 1)) $$,
  '42501',
  null,
  'El responsable de N3 no puede registrar una practica en un laboratorio de N4'
);

select lives_ok(
  $$ insert into public.practica (programa_educativo_id, laboratorio_id)
     values ((select id from public.programa_educativo limit 1),
             (select id from public.laboratorio
               where almacen_id = pg_temp.id_almacen('N3') limit 1)) $$,
  'El responsable de N3 si puede registrar una practica en su almacen'
);

-- La prueba que mas importa del modulo: se manda un elemento sobre una
-- existencia de N4 desde una practica de N3. El trigger reescribe el
-- almacen_id desde la existencia y el WITH CHECK lo rechaza.
select throws_ok(
  $$ insert into public.practica_elemento
       (practica_id, existencia_id, metodo_control, cantidad_entregada)
     values ((select id from public.practica
               where almacen_id = pg_temp.id_almacen('N3')
               order by id desc limit 1),
             900401, 'cantidad', 5) $$,
  '42501',
  null,
  'No se puede consumir una existencia de N4 desde una practica de N3'
);

select pg_temp.como('lectura@uaeh.local');

select is(
  (select count(*)::int from public.practica),
  1,
  'El usuario de consulta lee la practica que registro el responsable de N3'
);

select throws_ok(
  $$ insert into public.practica (programa_educativo_id, laboratorio_id)
     values ((select id from public.programa_educativo limit 1),
             (select id from public.laboratorio limit 1)) $$,
  '42501',
  null,
  'El usuario de consulta no puede registrar practicas'
);

select throws_ok(
  $$ insert into public.carga (almacen_id, archivo, hoja)
     values (pg_temp.id_almacen('N3'), 'x.xlsx', 'Reactivos') $$,
  '42501',
  null,
  'El usuario de consulta no puede registrar cargas'
);

select throws_ok(
  $$ insert into public.motivo_observacion (clave, etiqueta, orden)
     values ('inventado', 'Inventado', 99) $$,
  '42501',
  null,
  'Solo el admin cambia los catalogos cerrados'
);
```

- [ ] **Step 2: Correr para verificar que falla**

```bash
supabase db reset && supabase test db
```

Esperado: FALLA. Sin politicas, las tablas con RLS activa niegan todo: la prueba 2 (`el responsable de N3 lee las existencias de todos los almacenes`) devuelve 0 en vez de 2.

- [ ] **Step 3: Escribir `20260818120600_rls.sql`**

Base recuperable con `git show 267c0b7^:supabase/migrations/20260812120400_rls.sql`. Se copian las politicas de `almacen`, `laboratorio`, `perfil`, `ubicacion`, `articulo`, `articulo_alias`, `articulo_reactivo`, `existencia` y `movimiento` sin cambios (quitando los `alter table ... enable row level security` y los `revoke`, que ahora viven en el archivo de cada tabla, y quitando el bloque de `almacen_alias`).

Politicas nuevas, siguiendo el mismo patron:

```sql
-- Catalogos cerrados: todos leen, solo admin escribe. Cambiar uno afecta a
-- todos los almacenes a la vez.
create policy programa_educativo_lectura on public.programa_educativo
  for select to authenticated using (true);
create policy programa_educativo_admin on public.programa_educativo
  for all to authenticated
  using ((select private.es_admin())) with check ((select private.es_admin()));

create policy asignatura_lectura on public.asignatura
  for select to authenticated using (true);
create policy asignatura_admin on public.asignatura
  for all to authenticated
  using ((select private.es_admin())) with check ((select private.es_admin()));

create policy motivo_observacion_lectura on public.motivo_observacion
  for select to authenticated using (true);
create policy motivo_observacion_admin on public.motivo_observacion
  for all to authenticated
  using ((select private.es_admin())) with check ((select private.es_admin()));

create policy articulo_biologico_lectura on public.articulo_biologico
  for select to authenticated using (true);
create policy articulo_biologico_alta on public.articulo_biologico
  for insert to authenticated with check ((select private.puede_escribir()));
create policy articulo_biologico_admin on public.articulo_biologico
  for all to authenticated
  using ((select private.es_admin())) with check ((select private.es_admin()));

-- Carga: todos ven de donde salieron los datos; escribe quien puede escribir
-- en ese almacen.
create policy carga_lectura on public.carga
  for select to authenticated using (true);
create policy carga_escritura on public.carga
  for insert to authenticated
  with check ((select private.puede_escribir())
              and (almacen_id = (select private.almacen_actual())
                   or (select private.es_admin())));

-- Practicas: el almacen_id desnormalizado lo escribe el trigger desde el
-- laboratorio, asi que la politica se evalua sin join y el cliente no lo puede
-- falsear.
create policy practica_lectura on public.practica
  for select to authenticated using (true);
create policy practica_escritura on public.practica
  for insert to authenticated
  with check ((select private.puede_escribir())
              and (almacen_id = (select private.almacen_actual())
                   or (select private.es_admin())));

create policy practica_elemento_lectura on public.practica_elemento
  for select to authenticated using (true);
create policy practica_elemento_escritura on public.practica_elemento
  for insert to authenticated
  with check ((select private.puede_escribir())
              and (almacen_id = (select private.almacen_actual())
                   or (select private.es_admin())));

-- La unica sin almacen_id propio: son dos columnas, y desnormalizar una
-- tercera para la RLS seria peor que el exists. practica_id es la primera
-- columna de la PK, asi que el exists resuelve por indice.
create policy practica_observacion_lectura on public.practica_observacion
  for select to authenticated using (true);
create policy practica_observacion_escritura on public.practica_observacion
  for all to authenticated
  using (exists (select 1 from public.practica p
                  where p.id = practica_id
                    and (p.almacen_id = (select private.almacen_actual())
                         or (select private.es_admin()))))
  with check (exists (select 1 from public.practica p
                       where p.id = practica_id
                         and (p.almacen_id = (select private.almacen_actual())
                              or (select private.es_admin()))));
```

Mas las de `campo_capturable`, `perfil_captura` y `perfil_campo`, que se copian del archivo viejo sin cambios.

- [ ] **Step 4: Correr para verificar que pasan**

```bash
supabase db reset && supabase test db
```

Esperado: `esquema.test.sql .. ok` 44/44 y `rls.test.sql .. ok` 30/30.

- [ ] **Step 5: Commit**

```bash
git add supabase/
git commit -m "feat(db): politicas de RLS para el esquema depurado

Se conserva la forma que ya estaba probada: todos leen, cada quien escribe en su
almacen, helpers envueltos en (select ...) para que Postgres los evalue una vez
por sentencia, e indice en toda columna que aparezca en una politica.

Se extiende a las ocho tablas nuevas. La prueba que mas importa del modulo de
practicas es que un responsable de N3 no pueda consumir una existencia de N4 ni
mandando el almacen_id en el payload: el trigger lo reescribe desde la
existencia antes de que corra el WITH CHECK.

practica_observacion es la unica sin almacen_id propio (son dos columnas) y su
politica va por exists contra la practica padre, que resuelve por el indice de
la PK."
```

---

### Task 8: Regenerar los tipos

**Files:**
- Modify: `src/types/database.ts` (generado, nunca a mano)

**Interfaces:**
- Consumes: el esquema completo de las tareas 1 a 7.
- Produces: `Database` actualizado.

**Se verifico el 18 de agosto de 2026 que ningun archivo escrito a mano depende de lo que se elimina.** El unico consumidor de `padre_id`, `almacen_alias`, `partida`, `revisado_por`, `color_almacenamiento`, `requiere_hoja_seguridad` y `por_confirmar` es `src/types/database.ts`, que es generado. `src/features/inventario/PaginaInicio.tsx` consulta `almacen` con `existencia (id)`, y las dos tablas siguen existiendo con esos nombres; `src/app/almacenes.ts` solo mapea la clave del almacen a color e icono. Por eso esta tarea es una regeneracion y una verificacion, no una refactorizacion.

- [ ] **Step 1: Confirmar que sigue siendo cierto**

```bash
grep -rn "por_confirmar\|almacen_alias\|revisado_por\|color_almacenamiento\|requiere_hoja_seguridad\|padre_id\|partida" src/ --include=*.ts --include=*.tsx | grep -v "^src/types/database.ts"
```

Esperado: sin resultados. Si aparece alguno, arreglar ese uso antes de seguir: `por_confirmar` se resuelve a `agotado` cuando el saldo es cero y a `disponible` cuando no, que es lo que el estado significa ahora.

- [ ] **Step 2: Regenerar**

```bash
pnpm gen:types
```

- [ ] **Step 3: Verificar que el bundle compila contra el esquema nuevo**

```bash
pnpm typecheck && pnpm lint && pnpm build && pnpm test
```

Esperado: los cuatro en cero. `pnpm test` corre los 18 tests de Vitest que ya existian; ninguno toca el esquema, asi que deben seguir pasando sin cambios.

- [ ] **Step 4: Commit**

```bash
git add src/types/database.ts
git commit -m "chore: regenerar los tipos contra el esquema depurado

Los tipos se generan, no se escriben. Ningun archivo escrito a mano dependia de
las columnas que se fueron, asi que el unico cambio es el archivo generado."
```

---

### Task 9: La excepcion fechada en CLAUDE.md

Deja constancia de que el baseline se reescribio una vez y por que, para que no se vuelva costumbre.

**Files:**
- Modify: `CLAUDE.md`

**Interfaces:**
- Consumes: nada. Produces: nada.

- [ ] **Step 1: Actualizar la referencia al spec**

En la cabecera, `docs/specs/2026-08-12-...` pasa a `docs/specs/2026-08-18-depuracion-esquema-formato-unificado-design.md`, con una linea que diga que el de agosto 12 queda como antecedente.

- [ ] **Step 2: Agregar la excepcion bajo la regla de migraciones**

Debajo de **El esquema solo cambia por migración**:

```markdown
> **Excepción de una sola vez, 18 de agosto de 2026.** El baseline se reescribió
> completo (las 7 migraciones de agosto 12 se borraron y se reemplazaron por 7
> nuevas). Se pudo hacer porque no había ni un registro cargado, el proyecto
> remoto estaba vacío y el CLI no estaba vinculado, así que no había historial de
> migraciones fuera de esta máquina. **Esa ventana se cerró con el primer
> `supabase db push`.** La regla vuelve a ser literal: una migración aplicada no
> se edita, se agrega otra. Razonamiento completo en la §3 del spec.
```

- [ ] **Step 3: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: anotar la excepcion de la reescritura del baseline

La regla dice que una migracion aplicada no se edita. Se rompio una vez, con
razon y con fecha, y queda escrito cuando caduco el permiso para volver a
hacerlo: el primer db push al remoto."
```

---

### Task 10: Primer push al remoto · punto de no retorno

**No ejecutar sin confirmacion explicita.** A partir de este push existe un historial de migraciones fuera de esta maquina y la reescritura del baseline deja de ser una opcion.

**Files:** ninguno. Es operacion.

- [ ] **Step 1: Confirmar con el responsable del proyecto**

Verificar que sigue siendo cierto lo que se confirmo el 18 de agosto: el remoto esta vacio, sin usuarios reales ni existencias capturadas. Si algo cambio, **detenerse** y volver al spec.

- [ ] **Step 2: Vincular el CLI**

El `project-ref` son los 20 caracteres del subdominio de la URL del proyecto: en `https://abcdefghijklmnopqrst.supabase.co` es `abcdefghijklmnopqrst`. Sale del Dashboard, en Project Settings › General, o del `VITE_SUPABASE_URL` que ya esta configurado en Vercel.

```bash
supabase login
supabase link --project-ref <los-20-caracteres>
```

`supabase link` pide la contrasenia de la base de datos del proyecto. No se guarda en el repo: `supabase/.temp/` esta en `.gitignore`.

- [ ] **Step 3: Confirmar que el remoto no tiene historial**

```bash
supabase migration list
```

Esperado: la columna `Remote` vacia en las 7 migraciones. Si trae versiones, **detenerse**: la premisa de la §3 era falsa y hay que decidir entre resetear el remoto o pasar a migraciones incrementales.

- [ ] **Step 4: Aplicar**

```bash
supabase db push
```

- [ ] **Step 5: Verificar contra el remoto**

```bash
supabase migration list
```

Esperado: las 7 versiones en `Local` y en `Remote`.

El `seed.sql` **no** se aplica con `db push`: es solo para `db reset` local. Los usuarios reales y los almacenes del remoto se dan de alta aparte; los almacenes con un insert manual equivalente a la seccion correspondiente del seed.

- [ ] **Step 6: Comprobar que la app desplegada responde**

Confirmar en Vercel que `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` apuntan al proyecto vinculado, y que el login funciona contra el remoto.

- [ ] **Step 7: Abrir el PR**

```bash
gh pr create --title "Depuracion del esquema contra el formato unificado" --body "$(cat <<'CUERPO'
Reemplaza las 7 migraciones de agosto 12 por un baseline coherente con el
formato unificado de inventarios, y agrega el modulo de practicas.

Diseno: docs/specs/2026-08-18-depuracion-esquema-formato-unificado-design.md
Plan:   docs/plans/2026-08-18-depuracion-esquema.md

Se quita: almacen_alias, almacen.padre_id, existencia.partida y revisado_por,
articulo_reactivo.uso_principal y clasificacion_ghs, el valor por_confirmar.

Se agrega: la clasificacion materia_biologica y su tabla, el CAS de reactivos,
laboratorio_id y funcionamiento en existencia, la tabla carga, el modulo de
practicas completo, dos FK compuestas que impiden que una existencia de N3
apunte a un anaquel de N4, y unicos parciales en numero_serie y
numero_inventario_uaeh.

La reescritura del baseline en vez de parchear encima esta justificada en la
seccion 3 del spec, y CLAUDE.md ya anota cuando caduco ese permiso.

Verificado: pnpm typecheck && pnpm lint && pnpm build en cero;
supabase db reset y supabase test db con 44 + 30 pruebas en verde.
CUERPO
)"
```

---

## Fuera de este plan

- **El ETL.** Este plan deja el esquema y el contrato (§6 del spec); escribir el cargador de Excel es un plan aparte y no puede empezar antes de que los almacenes devuelvan sus archivos en el formato unificado.
- **El exportador NOM-005-STPS.**
- **Las pantallas de practicas y reportes.** El esquema ya las soporta; construirlas es otro plan.
- **El catalogo institucional de compras** (8,064 articulos con precio y partida).
- **Catalogos cerrados de marcas y muebles.** La regla 4 del formato los pide en desplegable; hoy son texto libre. Necesita que los responsables acuerden la lista primero.
