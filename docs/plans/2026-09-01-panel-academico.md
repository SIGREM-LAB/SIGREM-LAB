# Panel académico del administrador · Plan de implementación

> **Para agentes:** SUB-SKILL REQUERIDA: usa `superpowers:subagent-driven-development`
> (recomendado) o `superpowers:executing-plans` para ejecutar este plan tarea por
> tarea. Los pasos llevan casilla (`- [ ]`) para ir marcándolos.

**Meta:** una pantalla que sólo ve el rol `admin`, donde se cargan programas
educativos, asignaturas con su semestre, y las prácticas que define el plan de
estudios.

**Arquitectura:** una migración añade `programa_asignatura` (tabla puente que
guarda el semestre) y `practica_catalogo`, le quita a `asignatura` su columna
`programa_educativo_id`, y ata `practica` al plan con dos FK compuestas. Encima
va una ruta `/administracion/academico` con tres columnas en cascada
—programas → asignaturas → prácticas— detrás de una guardia por rol.

**Stack:** Postgres 17 + Supabase CLI + pgTAP para la base; React 19, MUI 9,
TanStack Query 5, react-hook-form 7 + zod 4, Vitest + Testing Library para la
pantalla.

**Spec:** `docs/specs/2026-09-01-panel-academico-design.md` — este plan discute
desde ahí; léelos juntos.

## Restricciones globales

- **Identificadores del dominio en español**, igual que el esquema:
  `asignatura`, `programa_asignatura`, `practica_catalogo`, `semestre`.
  Comentarios y texto de usuario, también.
- **Los tipos se generan.** `pnpm gen:types` después de cada migración. Nunca
  editar `src/types/database.ts` a mano ni declarar a mano la forma de una fila.
- **El esquema sólo cambia por migración.** Un archivo nuevo en
  `supabase/migrations/`. La ventana de reescribir el baseline se cerró.
- **Cada política de RLS lleva su prueba** en `supabase/tests/database/`.
- **Nada de dependencias nuevas.** Todo lo que este plan necesita ya está en
  `package.json`.
- **MUI 9:** `<Grid size={{ xs: 12, md: 4 }}>`, nunca `<Grid item xs>`. Las props
  de sistema van en `sx`, no sueltas: `<Stack sx={{ alignItems: 'center' }}>`.
- **`supabase-js` no lanza excepciones.** Siempre `if (error) throw error`.
- **Verificación de cierre**, los cuatro en cero:
  `pnpm test && pnpm typecheck && pnpm lint && pnpm build` y `supabase test db`.
- **Rama:** `feat/panel-academico`, que ya existe y ya tiene el commit del spec.

## Dos correcciones al spec

Al contar las llamadas reales de pgTAP, los números de la §8 del spec se quedan
cortos. No cambia nada del diseño; cambia el argumento de `plan()`:

| Suite | Spec | Real | Por qué |
|---|---|---|---|
| `esquema.test.sql` | `plan(59)` | **`plan(60)`** | La fila "semestre 0 y 13" del spec son dos `throws_ok`, no uno |
| `rls.test.sql` | `plan(71)` | **`plan(73)`** | `anon` son dos pruebas (una por tabla), y el admin son dos (insertar y editar) |

Y un archivo más del que el spec listaba en su §6: `semestres.ts`, explicado en
la Tarea 5.

---

## Estructura de archivos

**Base de datos**

| Archivo | Responsabilidad |
|---|---|
| `supabase/migrations/20260901120000_academico.sql` | *Crear.* Tablas, índice, columna que se va, FK compuestas, `vincular_asignatura()`, RLS y políticas. Una sola migración, como hace `20260826120000_carga_pendiente.sql` |
| `supabase/tests/database/esquema.test.sql` | *Modificar.* +7 pruebas de restricciones |
| `supabase/tests/database/rls.test.sql` | *Modificar.* +11 pruebas de políticas |
| `supabase/seed.sql` | *Modificar.* Datos de prueba, sólo local |
| `src/types/database.ts` | *Regenerar.* Nunca a mano |

**Pantalla** — todo bajo `src/features/academico/`

| Archivo | Responsabilidad |
|---|---|
| `seleccion.ts` | Reductor puro de la cascada. Sin React |
| `semestres.ts` | Etiquetas y agrupación por semestre, con Optativa al final. Sin React |
| `esquemas.ts` | Los tres esquemas de zod |
| `consultas.ts` | `useQuery`, `useMutation` y el traductor de errores de Postgres |
| `ColumnaAcademica.tsx` | Cascarón: título, lista con scroll, estado vacío, pie de acciones |
| `ListaProgramas.tsx` | Columna 1 |
| `ListaAsignaturas.tsx` | Columna 2, agrupada por semestre |
| `ListaPracticas.tsx` | Columna 3 |
| `DialogoPrograma.tsx` | Alta y renombrado |
| `DialogoAsignatura.tsx` | Dos modos: crear nueva o vincular existente |
| `DialogoPractica.tsx` | Alta y edición |
| `PaginaAcademico.tsx` | Ruta. Dueña de la selección. Ensambla todo |

**Fuera del feature**

| Archivo | Cambio |
|---|---|
| `src/features/auth/RutaProtegida.tsx` | +`SoloAdmin` |
| `src/features/auth/RutaProtegida.test.tsx` | +pruebas de `SoloAdmin` |
| `src/App.tsx` | +la ruta |
| `src/app/navegacion.ts` | +la entrada de menú |
| `src/app/navegacion.test.ts` | +su prueba |

---

## Tarea 1: La migración académica

Toda la base en un commit. Se hace primero porque `pnpm gen:types` es lo que da
los tipos con los que se escribe todo lo demás.

**Archivos:**
- Crear: `supabase/migrations/20260901120000_academico.sql`
- Modificar: `supabase/tests/database/esquema.test.sql` (`plan(53)` → `plan(60)`)
- Modificar: `supabase/tests/database/rls.test.sql` (`plan(62)` → `plan(73)`)
- Regenerar: `src/types/database.ts`

**Interfaces:**
- Consume: nada.
- Produce: las tablas `public.programa_asignatura` (PK compuesta
  `(programa_educativo_id, asignatura_id)`, columna `semestre smallint` nullable)
  y `public.practica_catalogo` (`id`, `asignatura_id`, `numero smallint`,
  `nombre text`, `activo boolean`, `creado_en`); la columna
  `public.practica.practica_catalogo_id bigint` nullable; y la función
  `public.vincular_asignatura(p_programa bigint, p_nombre text, p_semestre smallint default null) returns bigint`.
  `asignatura` pierde `programa_educativo_id`.

---

- [ ] **Paso 1: Comprobar que el reset local funciona ANTES de tocar nada**

Es el riesgo de la §9 del spec.
`supabase/migrations/20260814100000_grants_authenticated.sql` está sin
versionar, su marca de tiempo es anterior al baseline, y su última línea hace
`revoke ... on public.movimiento` cuando esa tabla todavía no existe.

Con Docker Desktop corriendo:

```bash
supabase start
supabase db reset
```

**Si falla** con `relation "public.movimiento" does not exist`: renombra el
archivo a `20260827120000_grants_authenticated.sql`, que lo coloca después del
baseline y después de todas las migraciones que revoca. Vuelve a correr
`supabase db reset` y confirma que pasa. Ese renombrado es un arreglo aparte:
va en su propio commit, con mensaje
`fix(migraciones): mover los grants despues del baseline`, antes de seguir.

**Si pasa**, sigue sin tocar nada.

En ambos casos, deja constancia de la salida real. Sin un reset verde, ninguna
prueba de este plan significa nada.

- [ ] **Paso 2: Escribir las pruebas de esquema, que deben fallar**

En `supabase/tests/database/esquema.test.sql`, cambia `select plan(53);` por
`select plan(60);` y añade esto **antes** de `select * from finish();`:

```sql
-- ---------------------------------------------------------------------------
-- El plan academico: la tabla puente y el catalogo de practicas
-- ---------------------------------------------------------------------------
select pg_temp.como_postgres();

insert into public.programa_educativo (id, nombre) overriding system value
values (900901, 'Programa de prueba A'),
       (900902, 'Programa de prueba B');

-- Una sola fila de asignatura, en dos programas y en dos semestres distintos.
-- Es el caso que justifica que el semestre viva en la relacion: si estuviera en
-- asignatura, esta fila no tendria un valor correcto que poner.
insert into public.asignatura (id, nombre) overriding system value
values (900911, 'Bioquimica de prueba'),
       (900912, 'Microbiologia de prueba');

insert into public.programa_asignatura (programa_educativo_id, asignatura_id, semestre)
values (900901, 900911, 3),
       (900902, 900911, 6),
       (900901, 900912, 2);

insert into public.practica_catalogo (id, asignatura_id, numero, nombre)
overriding system value
values (900921, 900911, 1, 'Identificacion de carbohidratos'),
       (900922, 900912, 1, 'Siembra en placa');

-- La FK compuesta practica_pareja_valida. Sin ella nada impide registrar una
-- practica de Bioquimica bajo un programa que no la lleva.
-- registrado_por va explicito en las tres: este archivo corre como postgres, y
-- ahi auth.uid() es NULL. El coalesce del trigger no tiene de donde sacarlo y la
-- columna es NOT NULL, asi que sin esto fallaria por 23502 y no por lo que la
-- prueba quiere medir.
select throws_ok(
  $$ insert into public.practica (programa_educativo_id, asignatura_id, laboratorio_id,
                                  registrado_por)
     values (900902, 900912, (select id from public.laboratorio limit 1),
             (select id from public.perfil where nombre = 'Responsable N4')) $$,
  '23503',
  null,
  'No se registra una practica con una pareja programa-asignatura que no esta en el plan'
);

-- La MAS importante de las siete, y la unica que prueba que algo SIGUE
-- funcionando en vez de que algo falla. MATCH SIMPLE es el default: con
-- asignatura_id nulo la restriccion no verifica nada. Si alguien "arregla" la
-- FK poniendole match full, el registro de practicas sin asignatura se rompe en
-- silencio y esta prueba es lo unico que lo grita.
select lives_ok(
  $$ insert into public.practica (programa_educativo_id, laboratorio_id, registrado_por)
     values (900901, (select id from public.laboratorio limit 1),
             (select id from public.perfil where nombre = 'Responsable N4')) $$,
  'Una practica sin asignatura sigue pudiendo registrarse'
);

-- La llave candidata unique (id, asignatura_id) de practica_catalogo.
select throws_ok(
  $$ insert into public.practica (programa_educativo_id, asignatura_id,
                                  practica_catalogo_id, laboratorio_id, registrado_por)
     values (900901, 900911, 900922, (select id from public.laboratorio limit 1),
             (select id from public.perfil where nombre = 'Responsable N4')) $$,
  '23503',
  null,
  'La practica elegida tiene que ser de la asignatura elegida'
);

select throws_ok(
  $$ insert into public.programa_asignatura (programa_educativo_id, asignatura_id, semestre)
     values (900902, 900912, 0) $$,
  '23514', null,
  'El semestre 0 no existe'
);

select throws_ok(
  $$ insert into public.programa_asignatura (programa_educativo_id, asignatura_id, semestre)
     values (900902, 900912, 13) $$,
  '23514', null,
  'El semestre 13 no existe'
);

-- Sin el indice sobre norm_texto, "Bioquimica" y "Bioquímica" son dos
-- asignaturas distintas, y a las tres semanas hay cuatro.
select throws_ok(
  $$ insert into public.asignatura (nombre) values ('BIOQUÍMICA DE PRUEBA') $$,
  '23505', null,
  'Una asignatura no se duplica por acentos ni por mayusculas'
);

select throws_ok(
  $$ insert into public.practica_catalogo (asignatura_id, numero, nombre)
     values (900911, 1, 'Otra practica numero uno') $$,
  '23505', null,
  'No hay dos practicas con el mismo numero en una asignatura'
);
```

- [ ] **Paso 3: Correr las pruebas y confirmar que fallan**

```bash
supabase test db
```

Esperado: falla con `relation "public.programa_asignatura" does not exist`.

- [ ] **Paso 4: Escribir la migración**

Crea `supabase/migrations/20260901120000_academico.sql`:

```sql
-- El plan academico: que asignaturas lleva cada programa, en que semestre, y
-- que practicas define el plan de estudios para cada asignatura.
--
-- Diseno: docs/specs/2026-09-01-panel-academico-design.md
--
-- La frontera con la tabla `practica`, que es lo que mas facil se enreda:
--   practica_catalogo  responde QUE PRACTICAS EXISTEN. Lo carga el admin.
--   practica           responde QUE PASO. La registra el responsable, y sus
--                      triggers descuentan existencias.
-- La primera es del plan de estudios; la segunda es un hecho ocurrido.

-- ---------------------------------------------------------------------------
-- La tabla puente, y por que el semestre vive aqui
-- ---------------------------------------------------------------------------
-- "Bioquimica" es 2do en un programa, 6to en otro y 3ro en un tercero. Una
-- columna `semestre` en `asignatura` no tendria un valor correcto que poner: el
-- semestre no es un atributo de la asignatura, es de la pareja.
--
-- Asi ademas se respeta lo que el esquema ya habia decidido en
-- 20260818120400_practica.sql: la asignatura existe una sola vez, y forzar el
-- vinculo obligaria a duplicarla una vez por programa.
create table public.programa_asignatura (
  programa_educativo_id bigint not null
    references public.programa_educativo (id) on delete cascade,
  asignatura_id         bigint not null
    references public.asignatura (id) on delete cascade,

  -- Nullable a proposito: el catalogo del prototipo trae "Optativa" como
  -- semestre de Biologia Marina y Biotecnologia. No es un numero, y forzar uno
  -- obligaria a inventarlo. NULL = optativa.
  semestre              smallint,

  primary key (programa_educativo_id, asignatura_id),
  constraint programa_asignatura_semestre_valido
    check (semestre is null or semestre between 1 and 12)
);

create index programa_asignatura_asignatura_idx
  on public.programa_asignatura (asignatura_id);

comment on table public.programa_asignatura is
  'Que asignaturas lleva cada programa y en que semestre. El semestre vive aqui y no en asignatura porque depende de la pareja.';


-- ---------------------------------------------------------------------------
-- Se migra lo que hubiera, y despues se tira la columna
-- ---------------------------------------------------------------------------
-- Al 1 de septiembre `asignatura` esta vacia y ningun codigo de src/ ni de etl/
-- la lee, pero una migracion no puede asumirlo. El semestre entra nulo porque
-- ese dato nunca existio: no hay de donde sacarlo.
insert into public.programa_asignatura (programa_educativo_id, asignatura_id, semestre)
select programa_educativo_id, id, null
  from public.asignatura
 where programa_educativo_id is not null;

-- Se lleva por delante el unique (programa_educativo_id, nombre) y el indice
-- asignatura_programa_idx, que dependen de ella.
alter table public.asignatura drop column programa_educativo_id;

-- El unico va sobre norm_texto y no sobre nombre: sin esto "Bioquimica" y
-- "Bioquímica" son dos asignaturas. norm_texto es immutable —por eso base.sql
-- la declaro con el diccionario explicito—, asi que se puede indexar.
create unique index asignatura_nombre_norm_idx
  on public.asignatura (public.norm_texto(nombre));


-- ---------------------------------------------------------------------------
-- El catalogo de practicas
-- ---------------------------------------------------------------------------
-- Solo identidad: numero, nombre y de que asignatura es. Sin receta de
-- materiales a proposito. Una receta cambia cada semestre, y el dia que el
-- formulario de registro llega precargado con cantidades viejas el responsable
-- corrige a mano y deja de confiar en lo precargado.
create table public.practica_catalogo (
  id            bigint generated always as identity primary key,
  asignatura_id bigint   not null references public.asignatura (id),
  numero        smallint not null,
  nombre        text     not null,
  activo        boolean  not null default true,
  creado_en     timestamptz not null default now(),

  unique (asignatura_id, numero),

  -- Llave candidata redundante con la PK a primera vista. Es lo que permite la
  -- FK compuesta de practica: sin ella no hay forma declarativa de exigir que
  -- la practica elegida sea de la asignatura elegida. Mismo truco que
  -- laboratorio.unique (id, almacen_id).
  unique (id, asignatura_id)
);

create index practica_catalogo_asignatura_idx
  on public.practica_catalogo (asignatura_id);

-- Sin `on delete cascade` en asignatura_id: retirar una practica es
-- activo = false, igual que en almacen, laboratorio y motivo_observacion.


-- ---------------------------------------------------------------------------
-- Los dos enganches con practica
-- ---------------------------------------------------------------------------
alter table public.practica
  add column practica_catalogo_id bigint references public.practica_catalogo (id);

create index practica_catalogo_id_idx on public.practica (practica_catalogo_id);

-- Las dos son FK compuestas con MATCH SIMPLE, que es el default: si
-- asignatura_id es NULL la restriccion se satisface sin verificar nada. Eso es
-- exactamente lo que hace falta, porque practica.asignatura_id es nullable y
-- debe seguir siendolo; pero en cuanto se llena, la base garantiza que la
-- combinacion es real.
--
-- NO cambiar a MATCH FULL: romperia el registro de practicas sin asignatura, y
-- lo haria en silencio.
alter table public.practica
  add constraint practica_pareja_valida
  foreign key (programa_educativo_id, asignatura_id)
  references public.programa_asignatura (programa_educativo_id, asignatura_id);

alter table public.practica
  add constraint practica_catalogo_coincide
  foreign key (practica_catalogo_id, asignatura_id)
  references public.practica_catalogo (id, asignatura_id);


-- ---------------------------------------------------------------------------
-- vincular_asignatura: dos inserts que tienen que ser uno
-- ---------------------------------------------------------------------------
-- Crear una asignatura nueva son dos escrituras —la fila y el vinculo— y desde
-- el cliente no son atomicas: si la segunda falla queda una asignatura
-- huerfana flotando en el autocompletar de "vincular".
--
-- security invoker y no definer: la funcion no le presta a nadie privilegios
-- que no tenga. La RLS de asignatura y de programa_asignatura sigue mandando, y
-- un responsable que la llame recibe 42501. Mismo criterio que
-- resolver_pendiente.
create or replace function public.vincular_asignatura(
  p_programa bigint,
  p_nombre   text,
  p_semestre smallint default null
)
returns bigint
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_nombre     text := btrim(p_nombre);
  v_asignatura bigint;
begin
  if v_nombre is null or v_nombre = '' then
    raise exception 'La asignatura necesita nombre';
  end if;

  -- Busca por la forma normalizada, que es la que el indice unico protege.
  -- Capturar "Bioquimica" cuando ya existe "Bioquímica" reusa la que hay en vez
  -- de chocar contra el indice: es la razon principal de que esto sea una
  -- funcion y no dos llamadas desde el cliente.
  select id into v_asignatura
    from public.asignatura
   where public.norm_texto(nombre) = public.norm_texto(v_nombre);

  if v_asignatura is null then
    insert into public.asignatura (nombre) values (v_nombre)
    returning id into v_asignatura;
  end if;

  insert into public.programa_asignatura (programa_educativo_id, asignatura_id, semestre)
  values (p_programa, v_asignatura, p_semestre);

  return v_asignatura;
end;
$$;

-- El `alter default privileges` de la migracion de grants cubre tablas, no
-- funciones, y una funcion nueva es ejecutable por PUBLIC salvo que se revoque.
revoke all on function public.vincular_asignatura(bigint, text, smallint)
  from public, anon;
grant execute on function public.vincular_asignatura(bigint, text, smallint)
  to authenticated;


-- ---------------------------------------------------------------------------
-- RLS: catalogo cerrado, todos leen y solo el admin escribe
-- ---------------------------------------------------------------------------
-- Ninguna de las dos lleva almacen_id, y es deliberado. El plan de estudios no
-- pertenece a un almacen: la misma "Quimica Analitica, 3ro" la surten N3 y N4
-- segun donde se de la clase. Desnormalizar un almacen aqui inventaria una
-- pertenencia que no existe.
--
-- La lectura abierta a todo authenticated es lo que hara funcionar la pantalla
-- de registro de practicas: si un responsable no pudiera leer el catalogo, sus
-- tres selects saldrian vacios.
alter table public.programa_asignatura enable row level security;
alter table public.practica_catalogo   enable row level security;

create policy programa_asignatura_lectura on public.programa_asignatura
  for select to authenticated using (true);
create policy programa_asignatura_admin on public.programa_asignatura
  for all to authenticated
  using ((select private.es_admin())) with check ((select private.es_admin()));

create policy practica_catalogo_lectura on public.practica_catalogo
  for select to authenticated using (true);
create policy practica_catalogo_admin on public.practica_catalogo
  for all to authenticated
  using ((select private.es_admin())) with check ((select private.es_admin()));

revoke all on public.programa_asignatura, public.practica_catalogo from anon;
```

- [ ] **Paso 5: Correr las pruebas de esquema y confirmar que pasan**

```bash
supabase db reset && supabase test db
```

Esperado: `esquema.test.sql .. ok` con 60 pruebas. `rls.test.sql` sigue en 62 y
también pasa: sus inserts a `public.practica` (líneas 315, 325 y 356) no mandan
`asignatura_id`, así que caen en el caso `MATCH SIMPLE` y las FK nuevas no se
disparan.

- [ ] **Paso 6: Escribir las pruebas de RLS, que deben fallar**

En `rls.test.sql`, cambia `select plan(62);` por `select plan(73);` y añade
antes de `select * from finish();`:

```sql
-- ---------------------------------------------------------------------------
-- 63-73. El plan academico: quien lo lee y quien lo escribe
-- ---------------------------------------------------------------------------
select pg_temp.como_postgres();

insert into public.programa_educativo (id, nombre) overriding system value
values (900801, 'Programa academico de prueba');

insert into public.asignatura (id, nombre) overriding system value
values (900811, 'Asignatura de prueba RLS');

insert into public.programa_asignatura (programa_educativo_id, asignatura_id, semestre)
values (900801, 900811, 4);

insert into public.practica_catalogo (id, asignatura_id, numero, nombre)
overriding system value
values (900821, 900811, 1, 'Practica de prueba RLS');

select pg_temp.como('n3@uaeh.local');

-- La lectura abierta no es un descuido: es lo que permitira que el formulario
-- de registro de practicas arme sus tres selects. Si estas dos dan 0, la
-- pantalla de practicas sale vacia y nadie sabe por que.
select is(
  (select count(*)::int from public.programa_asignatura where asignatura_id = 900811),
  1,
  'El responsable de N3 lee el plan academico'
);

select is(
  (select count(*)::int from public.practica_catalogo where id = 900821),
  1,
  'El responsable de N3 lee el catalogo de practicas'
);

select throws_ok(
  $$ insert into public.programa_asignatura (programa_educativo_id, asignatura_id, semestre)
     values (900801, 900811, 5) $$,
  '42501', null,
  'El responsable no vincula asignaturas: el plan es de los cuatro almacenes'
);

select throws_ok(
  $$ insert into public.practica_catalogo (asignatura_id, numero, nombre)
     values (900811, 2, 'Practica colada') $$,
  '42501', null,
  'El responsable no da de alta practicas del plan'
);

-- Ojo con como falla cada clausula: USING falso no explota, deja 0 filas. Por
-- eso estas dos se miden contando y no con throws_ok.
update public.practica_catalogo set nombre = 'Renombrada a la mala' where id = 900821;
select is(
  (select nombre from public.practica_catalogo where id = 900821),
  'Practica de prueba RLS',
  'El responsable no edita el catalogo, y falla en silencio'
);

delete from public.programa_asignatura where asignatura_id = 900811;
select is(
  (select count(*)::int from public.programa_asignatura where asignatura_id = 900811),
  1,
  'El responsable no desvincula asignaturas, y tambien falla en silencio'
);

-- security invoker: la funcion no presta privilegios. Misma prueba que la de
-- resolver_pendiente.
select throws_ok(
  $$ select public.vincular_asignatura(900801, 'Colada por la funcion', 1::smallint) $$,
  '42501', null,
  'vincular_asignatura no le presta al responsable privilegios que no tiene'
);

select pg_temp.como('admin@uaeh.local');

select lives_ok(
  $$ select public.vincular_asignatura(900801, 'Asignatura creada por el admin', 7::smallint) $$,
  'El admin si vincula asignaturas, y la funcion crea la que falta'
);

select lives_ok(
  $$ update public.practica_catalogo set nombre = 'Renombrada por el admin'
      where id = 900821 $$,
  'El admin edita el catalogo de practicas'
);

-- anon lleva la llave dentro del binario y cualquiera puede extraerla. El plan
-- academico no es secreto, pero la regla del proyecto es que anon no llega a
-- ninguna tabla.
select set_config('role', 'anon', true);

select throws_ok(
  $$ select count(*) from public.programa_asignatura $$,
  '42501', null,
  'anon no lee el plan academico'
);

select throws_ok(
  $$ select count(*) from public.practica_catalogo $$,
  '42501', null,
  'anon no lee el catalogo de practicas'
);

select pg_temp.como_postgres();
```

- [ ] **Paso 7: Correr y confirmar que pasan**

```bash
supabase test db
```

Esperado: las dos suites en verde, `esquema.test.sql` con 60 y `rls.test.sql`
con 73. La prueba de cobertura que ya existía ("ninguna tabla de public se queda
sin RLS") cubre sola que no se olvidó el `enable row level security`.

- [ ] **Paso 8: Regenerar los tipos**

```bash
pnpm gen:types && pnpm typecheck
```

`typecheck` tiene que salir en cero. Si se queja de `programa_educativo_id` en
`asignatura`, es que `gen:types` no corrió contra la base ya migrada.

- [ ] **Paso 9: Commit**

```bash
git add supabase/migrations/20260901120000_academico.sql \
        supabase/tests/database/esquema.test.sql \
        supabase/tests/database/rls.test.sql \
        src/types/database.ts
git commit -m "feat(academico): tabla puente, catalogo de practicas y sus politicas"
```

---

## Tarea 2: Datos de prueba

**Archivos:**
- Modificar: `supabase/seed.sql` (al final)

**Interfaces:**
- Consume: las tablas de la Tarea 1.
- Produce: 6 asignaturas, 9 vínculos y 7 prácticas en la base local.

**Van sólo en `seed.sql`, y esa es toda la garantía.** `seed.sql` lo corre
únicamente `supabase db reset` en local —su primera línea lo dice— y por eso
mismo es donde viven los seis usuarios de prueba con contraseña conocida.
Producción arranca sin una sola asignatura porque nunca le llegan, no porque
alguien se acuerde de borrarlas. No se toca `datos-iniciales.sql` ni
`config.toml`.

---

- [ ] **Paso 1: Añadir la sección al final de `supabase/seed.sql`**

```sql
-- ---------------------------------------------------------------------------
-- Plan academico de PRUEBA
-- ---------------------------------------------------------------------------
-- Datos desechables, solo para poder recorrer la pantalla a mano. El plan real
-- se captura desde /administracion/academico, desde cero.
--
-- Esto vive en seed.sql y NO en datos-iniciales.sql a proposito: seed.sql solo
-- lo corre `supabase db reset` en local, asi que estas filas no pueden llegar a
-- produccion. Es la misma razon por la que los usuarios de prueba estan aqui.
--
-- Estan elegidos para ejercitar los tres casos raros, no para verse llenos:
--   Quimica General  -> compartida por los tres programas
--   Bioquimica       -> UNA fila, 3er semestre en uno y 6to en otro
--   Bromatologia     -> semestre NULL (optativa), tiene que ordenar al final
--   Bromatologia y Farmacognosia -> sin practicas, para ver el estado vacio
insert into public.asignatura (nombre) values
  ('Química General'),
  ('Bioquímica'),
  ('Análisis de Alimentos'),
  ('Bromatología'),
  ('Farmacognosia'),
  ('Microbiología');

insert into public.programa_asignatura (programa_educativo_id, asignatura_id, semestre)
select p.id, a.id, v.semestre
  from (values
    ('Química en Alimentos',            'Química General',       1),
    ('Química en Alimentos',            'Bioquímica',            3),
    ('Química en Alimentos',            'Análisis de Alimentos', 5),
    ('Química en Alimentos',            'Bromatología',       null),
    ('Químico Farmacéutico Biólogo',    'Química General',       1),
    ('Químico Farmacéutico Biólogo',    'Bioquímica',            6),
    ('Químico Farmacéutico Biólogo',    'Farmacognosia',         4),
    ('Ingeniería en Biotecnología',     'Química General',       1),
    ('Ingeniería en Biotecnología',     'Microbiología',         2)
  ) as v(programa, asignatura, semestre)
  join public.programa_educativo p on p.nombre = v.programa
  join public.asignatura         a on a.nombre = v.asignatura;

insert into public.practica_catalogo (asignatura_id, numero, nombre)
select a.id, v.numero, v.nombre
  from (values
    ('Química General',       1, 'Material de laboratorio y medición'),
    ('Química General',       2, 'Preparación de disoluciones'),
    ('Química General',       3, 'Titulación ácido-base'),
    ('Bioquímica',            1, 'Identificación de carbohidratos'),
    ('Bioquímica',            2, 'Actividad enzimática'),
    ('Análisis de Alimentos', 1, 'Determinación de humedad'),
    ('Microbiología',         1, 'Siembra en placa')
  ) as v(asignatura, numero, nombre)
  join public.asignatura a on a.nombre = v.asignatura;
```

- [ ] **Paso 2: Reconstruir y comprobar los tres casos raros**

```bash
supabase db reset
psql "$(supabase status -o json | grep -o '"DB_URL":"[^"]*"' | cut -d'"' -f4)" -c "
select a.nombre, count(distinct pa.programa_educativo_id) as programas,
       array_agg(distinct pa.semestre) as semestres,
       count(distinct pc.id) as practicas
  from public.asignatura a
  join public.programa_asignatura pa on pa.asignatura_id = a.id
  left join public.practica_catalogo pc on pc.asignatura_id = a.id
 group by a.nombre order by a.nombre;"
```

Esperado, y son las tres cosas que estos datos existen para probar:

| nombre | programas | semestres | practicas |
|---|---|---|---|
| Análisis de Alimentos | 1 | {5} | 1 |
| Bioquímica | **2** | **{3,6}** | 2 |
| Bromatología | 1 | **{NULL}** | **0** |
| Farmacognosia | 1 | {4} | **0** |
| Microbiología | 1 | {2} | 1 |
| Química General | **3** | {1} | 3 |

Si `Bioquímica` sale con un solo semestre, la tabla puente no está haciendo su
trabajo y hay que volver a la Tarea 1.

- [ ] **Paso 3: Confirmar que las suites siguen verdes**

```bash
supabase test db
```

Esperado: 60 y 73. El seed corre antes que las pruebas, así que filas nuevas
que rompan un `count(*)` de una prueba vieja saldrían aquí.

- [ ] **Paso 4: Commit**

```bash
git add supabase/seed.sql
git commit -m "test(academico): plan academico de prueba, solo local"
```

---

## Tarea 3: `seleccion.ts`, el reductor de la cascada

**Archivos:**
- Crear: `src/features/academico/seleccion.ts`
- Crear: `src/features/academico/seleccion.test.ts`

**Interfaces:**
- Consume: nada.
- Produce:
  ```ts
  type Seleccion = { programaId: number | null; asignaturaId: number | null; practicaId: number | null }
  const SELECCION_VACIA: Seleccion
  function elegirPrograma(actual: Seleccion, programaId: number): Seleccion
  function elegirAsignatura(actual: Seleccion, asignaturaId: number): Seleccion
  function elegirPractica(actual: Seleccion, practicaId: number): Seleccion
  ```

Módulo puro, sin React, con su prueba — igual que `filtros.ts`, `menu.ts` y
`pendientes.ts`. Existe para blindar el bug clásico de las cascadas, que el
propio prototipo tuvo que parchear a mano en `Practices.tsx:392`.

---

- [ ] **Paso 1: Escribir la prueba, que debe fallar**

Crea `src/features/academico/seleccion.test.ts`:

```ts
import { describe, expect, test } from 'vitest'

import { elegirAsignatura, elegirPractica, elegirPrograma, SELECCION_VACIA } from './seleccion'

describe('la cascada del panel académico', () => {
  // La importante. Sin esto la columna 3 sigue mostrando las prácticas de la
  // selección anterior, que ya no cuelgan de nada visible en pantalla.
  test('cambiar de programa limpia la asignatura y la práctica', () => {
    const antes = elegirPractica(elegirAsignatura(elegirPrograma(SELECCION_VACIA, 1), 10), 100)

    const despues = elegirPrograma(antes, 2)

    expect(despues).toEqual({ programaId: 2, asignaturaId: null, practicaId: null })
  })

  test('cambiar de asignatura limpia la práctica pero conserva el programa', () => {
    const antes = elegirPractica(elegirAsignatura(elegirPrograma(SELECCION_VACIA, 1), 10), 100)

    const despues = elegirAsignatura(antes, 11)

    expect(despues).toEqual({ programaId: 1, asignaturaId: 11, practicaId: null })
  })

  // Volver a hacer clic en lo que ya estaba elegido no puede tirar el resto:
  // si lo hiciera, un clic accidental en la columna 1 vaciaría las otras dos.
  test('reelegir el mismo programa no toca nada', () => {
    const antes = elegirPractica(elegirAsignatura(elegirPrograma(SELECCION_VACIA, 1), 10), 100)

    expect(elegirPrograma(antes, 1)).toEqual(antes)
  })

  test('reelegir la misma asignatura no toca nada', () => {
    const antes = elegirPractica(elegirAsignatura(elegirPrograma(SELECCION_VACIA, 1), 10), 100)

    expect(elegirAsignatura(antes, 10)).toEqual(antes)
  })

  test('la selección vacía no trae nada elegido', () => {
    expect(SELECCION_VACIA).toEqual({ programaId: null, asignaturaId: null, practicaId: null })
  })
})
```

- [ ] **Paso 2: Correr y confirmar que falla**

```bash
pnpm test src/features/academico/seleccion.test.ts
```

Esperado: FAIL, no resuelve `./seleccion`.

- [ ] **Paso 3: Escribir el módulo**

Crea `src/features/academico/seleccion.ts`:

```ts
/**
 * Qué está elegido en cada una de las tres columnas.
 *
 * Vive aparte de la pantalla y sin React porque es la regla que más fácil se
 * rompe al tocar el componente: elegir otro programa TIENE que limpiar lo de
 * abajo. Si no, la columna de prácticas sigue mostrando las de la selección
 * anterior, que ya no cuelgan de nada visible. El prototipo tuvo que parchearlo
 * a mano en cada `onValueChange`, y por eso aquí es una función con prueba.
 */
export type Seleccion = {
  programaId: number | null
  asignaturaId: number | null
  practicaId: number | null
}

export const SELECCION_VACIA: Seleccion = {
  programaId: null,
  asignaturaId: null,
  practicaId: null,
}

/**
 * Reelegir lo mismo devuelve el objeto tal cual, no uno nuevo equivalente: así
 * un clic en lo que ya estaba elegido no vacía las columnas de la derecha, y de
 * paso no dispara un renderizado de más.
 */
export function elegirPrograma(actual: Seleccion, programaId: number): Seleccion {
  if (actual.programaId === programaId) return actual
  return { programaId, asignaturaId: null, practicaId: null }
}

export function elegirAsignatura(actual: Seleccion, asignaturaId: number): Seleccion {
  if (actual.asignaturaId === asignaturaId) return actual
  return { ...actual, asignaturaId, practicaId: null }
}

export function elegirPractica(actual: Seleccion, practicaId: number): Seleccion {
  if (actual.practicaId === practicaId) return actual
  return { ...actual, practicaId }
}
```

- [ ] **Paso 4: Correr y confirmar que pasa**

```bash
pnpm test src/features/academico/seleccion.test.ts
```

Esperado: 5 pruebas en verde.

- [ ] **Paso 5: Commit**

```bash
git add src/features/academico/seleccion.ts src/features/academico/seleccion.test.ts
git commit -m "feat(academico): reductor de la cascada programa-asignatura-practica"
```

---

## Tarea 4: `semestres.ts`, etiquetas y agrupación

**Archivos:**
- Crear: `src/features/academico/semestres.ts`
- Crear: `src/features/academico/semestres.test.ts`

**Interfaces:**
- Consume: nada.
- Produce:
  ```ts
  const SEMESTRES: { valor: number | null; etiqueta: string }[]   // 1°..12° y "Optativa"
  function etiquetaSemestre(semestre: number | null): string
  function agruparPorSemestre<T extends { semestre: number | null }>(
    filas: T[],
  ): { semestre: number | null; etiqueta: string; filas: T[] }[]
  ```

Este archivo no estaba en la §6 del spec. Se añade porque la regla de que
**Optativa va al final** es lógica pura que si no vive aquí acaba probándose a
través del DOM, que es más frágil y más lento. Mismo criterio que `seleccion.ts`.

---

- [ ] **Paso 1: Escribir la prueba, que debe fallar**

Crea `src/features/academico/semestres.test.ts`:

```ts
import { describe, expect, test } from 'vitest'

import { agruparPorSemestre, etiquetaSemestre, SEMESTRES } from './semestres'

describe('etiquetaSemestre', () => {
  test('un número se muestra con el símbolo de grado', () => {
    expect(etiquetaSemestre(3)).toBe('3°')
  })

  // NULL no es "sin semestre" ni un hueco: es una optativa, que es una cosa que
  // el plan de estudios sí tiene.
  test('sin semestre es una optativa', () => {
    expect(etiquetaSemestre(null)).toBe('Optativa')
  })
})

describe('SEMESTRES', () => {
  test('ofrece del 1 al 12 más la optativa', () => {
    expect(SEMESTRES).toHaveLength(13)
    expect(SEMESTRES[0]).toEqual({ valor: 1, etiqueta: '1°' })
    expect(SEMESTRES[12]).toEqual({ valor: null, etiqueta: 'Optativa' })
  })
})

describe('agruparPorSemestre', () => {
  test('agrupa y ordena de menor a mayor', () => {
    const grupos = agruparPorSemestre([
      { semestre: 3, nombre: 'Química Analítica' },
      { semestre: 1, nombre: 'Química General' },
      { semestre: 3, nombre: 'Fisicoquímica I' },
    ])

    expect(grupos.map((g) => g.etiqueta)).toEqual(['1°', '3°'])
    expect(grupos[1].filas.map((f) => f.nombre)).toEqual([
      'Química Analítica',
      'Fisicoquímica I',
    ])
  })

  // La que de verdad importa. Un `order by semestre` ingenuo pone los nulos
  // primero, y entonces lo primero que se ve del plan de estudios son las
  // optativas en vez del primer semestre.
  test('la optativa va al final, no al principio', () => {
    const grupos = agruparPorSemestre([
      { semestre: null, nombre: 'Bromatología' },
      { semestre: 5, nombre: 'Análisis de Alimentos' },
      { semestre: 1, nombre: 'Química General' },
    ])

    expect(grupos.map((g) => g.etiqueta)).toEqual(['1°', '5°', 'Optativa'])
  })

  test('sin filas no hay grupos', () => {
    expect(agruparPorSemestre([])).toEqual([])
  })
})
```

- [ ] **Paso 2: Correr y confirmar que falla**

```bash
pnpm test src/features/academico/semestres.test.ts
```

Esperado: FAIL, no resuelve `./semestres`.

- [ ] **Paso 3: Escribir el módulo**

Crea `src/features/academico/semestres.ts`:

```ts
/**
 * El semestre de una asignatura dentro de un programa. Vive en
 * `programa_asignatura` y no en `asignatura` porque depende de la pareja:
 * "Bioquímica" es 3° en un programa y 6° en otro.
 *
 * `null` no es un hueco ni un dato que falte: es una **optativa**, que es algo
 * que el plan de estudios sí contempla. El catálogo del prototipo trae dos.
 */
export function etiquetaSemestre(semestre: number | null): string {
  return semestre === null ? 'Optativa' : `${semestre}°`
}

/** Las opciones del selector, en el orden en que se ofrecen. */
export const SEMESTRES: { valor: number | null; etiqueta: string }[] = [
  ...Array.from({ length: 12 }, (_, i) => ({ valor: i + 1, etiqueta: `${i + 1}°` })),
  { valor: null, etiqueta: 'Optativa' },
]

/**
 * Agrupa las asignaturas de un programa por semestre, **con la optativa al
 * final**. Un `order by semestre` ingenuo pone los nulos primero, y entonces lo
 * primero que se ve del plan de estudios son las optativas en lugar del primer
 * semestre. Por eso el orden se decide aquí y no en la consulta.
 *
 * Dentro de cada grupo se conserva el orden en que vinieron las filas, que es
 * el que impuso la consulta.
 */
export function agruparPorSemestre<T extends { semestre: number | null }>(
  filas: T[],
): { semestre: number | null; etiqueta: string; filas: T[] }[] {
  const grupos = new Map<number | null, T[]>()

  for (const fila of filas) {
    const grupo = grupos.get(fila.semestre)
    if (grupo === undefined) grupos.set(fila.semestre, [fila])
    else grupo.push(fila)
  }

  return [...grupos.entries()]
    .sort(([a], [b]) => {
      // Number.MAX_SAFE_INTEGER y no un `a === null ? 1 : ...` encadenado:
      // así el criterio es uno solo y no hay que razonar tres ramas.
      const izq = a ?? Number.MAX_SAFE_INTEGER
      const der = b ?? Number.MAX_SAFE_INTEGER
      return izq - der
    })
    .map(([semestre, filasDelGrupo]) => ({
      semestre,
      etiqueta: etiquetaSemestre(semestre),
      filas: filasDelGrupo,
    }))
}
```

- [ ] **Paso 4: Correr y confirmar que pasa**

```bash
pnpm test src/features/academico/semestres.test.ts
```

Esperado: 6 pruebas en verde.

- [ ] **Paso 5: Commit**

```bash
git add src/features/academico/semestres.ts src/features/academico/semestres.test.ts
git commit -m "feat(academico): etiquetas y agrupacion por semestre, con optativa al final"
```

---

## Tarea 5: `SoloAdmin`, la ruta y el menú

**Archivos:**
- Modificar: `src/features/auth/RutaProtegida.tsx`
- Modificar: `src/features/auth/RutaProtegida.test.tsx`
- Modificar: `src/app/navegacion.ts`
- Modificar: `src/app/navegacion.test.ts`
- Modificar: `src/App.tsx`

**Interfaces:**
- Consume: `usePerfil()` de `@/features/auth/usePerfil`.
- Produce: `SoloAdmin` (componente de ruta, sin props) exportado desde
  `src/features/auth/RutaProtegida.tsx`; la ruta
  `/administracion/academico`; la entrada de menú del mismo `ruta`.

Se hace antes que la pantalla para que ésta se pueda abrir en el navegador en
cuanto exista, en vez de al final.

---

- [ ] **Paso 1: Escribir las pruebas, que deben fallar**

En `src/features/auth/RutaProtegida.test.tsx`, añade estos dos imports **arriba,
junto a los que ya están** (no al final: aunque los `import` se elevan, dejarlos
sueltos a media hoja es lo que ESLint marca y lo que confunde al leer):

```tsx
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
```

y cambia el import existente a `import { RutaProtegida, SoloAdmin, SoloInvitados } from './RutaProtegida'`.
Después, al final del archivo:

```tsx
function montarAdmin(rol: 'admin' | 'responsable' | 'consulta' | 'cargando') {
  // Se siembra la caché de Query en vez de simular la red: `usePerfil` lee de
  // ['perfil', usuarioId], así que poner el dato ahí es la forma honesta de
  // decir "el perfil ya llegó". Sin sembrar, la consulta queda en isPending y
  // eso es justo el cuarto caso.
  const cliente = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  if (rol !== 'cargando') cliente.setQueryData(['perfil', 'u-1'], { id: 'u-1', nombre: 'X', rol })

  return render(
    <QueryClientProvider client={cliente}>
      <ContextoSesion.Provider value={{ estado: 'con-sesion', usuarioId: 'u-1' }}>
        <MemoryRouter initialEntries={['/administracion/academico']}>
          <Routes>
            <Route path="/" element={<p>Menu principal</p>} />
            <Route element={<SoloAdmin />}>
              <Route path="/administracion/academico" element={<p>Panel academico</p>} />
            </Route>
          </Routes>
        </MemoryRouter>
      </ContextoSesion.Provider>
    </QueryClientProvider>,
  )
}

describe('SoloAdmin', () => {
  test('el admin entra al panel académico', () => {
    montarAdmin('admin')

    expect(screen.getByText('Panel academico')).toBeInTheDocument()
  })

  // No es seguridad —quien edite el bundle llega igual, y lo que de verdad lo
  // detiene son las políticas de RLS—. Es para que un responsable no vea una
  // pantalla que le va a fallar en cada botón.
  test('un responsable rebota al menú principal', () => {
    montarAdmin('responsable')

    expect(screen.getByText('Menu principal')).toBeInTheDocument()
    expect(screen.queryByText('Panel academico')).not.toBeInTheDocument()
  })

  test('un usuario de consulta rebota al menú principal', () => {
    montarAdmin('consulta')

    expect(screen.getByText('Menu principal')).toBeInTheDocument()
  })

  // Mismo hueco que en RutaProtegida: el perfil es una consulta y tarda. Si el
  // guard decide mientras está en vuelo, el admin acaba en la portada cada vez
  // que recarga la página con F5.
  test('mientras el perfil carga no decide nada', () => {
    montarAdmin('cargando')

    expect(screen.queryByText('Panel academico')).not.toBeInTheDocument()
    expect(screen.queryByText('Menu principal')).not.toBeInTheDocument()
  })
})
```

Y añade a `src/app/navegacion.test.ts`:

```ts
describe('el panel académico', () => {
  test('solo lo ve el admin, y ya está disponible', () => {
    const items = menuDeNavegacion('admin')
    const panel = items.find((i) => i.ruta === '/administracion/academico')

    expect(panel?.disponible).toBe(true)
  })

  test('un responsable no lo ve', () => {
    const rutas = menuDeNavegacion('responsable').map((i) => i.ruta)

    expect(rutas).not.toContain('/administracion/academico')
  })

  test('sin perfil todavía, tampoco', () => {
    const rutas = menuDeNavegacion(undefined).map((i) => i.ruta)

    expect(rutas).not.toContain('/administracion/academico')
  })
})
```

- [ ] **Paso 2: Correr y confirmar que fallan**

```bash
pnpm test src/features/auth/RutaProtegida.test.tsx src/app/navegacion.test.ts
```

Esperado: FAIL, `SoloAdmin` no se exporta y la ruta del menú no existe.

- [ ] **Paso 3: Añadir `SoloAdmin`**

En `src/features/auth/RutaProtegida.tsx`, importa `usePerfil` y añade el tercer
export:

```tsx
import { usePerfil } from './usePerfil'

/**
 * Las pantallas de administración: el plan académico, y las que vengan.
 *
 * Esto es comodidad, no seguridad. Quien edite el bundle llega a la ruta igual;
 * lo que de verdad protege los datos son las políticas de RLS, que niegan la
 * escritura a cualquiera que no sea admin. La guardia existe para que un
 * responsable no se meta a una pantalla que le va a fallar en cada botón.
 */
export function SoloAdmin() {
  const { data: perfil, isPending } = usePerfil()

  // Mismo motivo que en RutaProtegida: mientras el perfil está en vuelo no se
  // decide nada. Redirigir aquí echaría al admin a la portada en cada F5.
  if (isPending) return null
  if (perfil?.rol !== 'admin') return <Navigate to="/" replace />

  return <Outlet />
}
```

- [ ] **Paso 4: Añadir la entrada de menú**

En `src/app/navegacion.ts`, dentro del bloque que sólo devuelve el admin, junto
a `/inventario-general`:

```ts
    {
      ruta: '/administracion/academico',
      etiqueta: 'Plan académico',
      icono: 'mdi:school-outline',
      grupo: 'administracion',
      descripcion: 'Programas, asignaturas y prácticas del plan de estudios',
      color: 'grey.600',
      disponible: true,
    },
```

- [ ] **Paso 5: Registrar la ruta**

En `src/App.tsx`, dentro del `<Route element={<Layout />}>`, después de la ruta
de depuración:

```tsx
                  {/* Bajo /administracion y no en la raíz: es el primero de
                      cinco bloques de catálogo que sólo toca el admin, y el
                      prefijo es lo que evita que cada uno se invente su sitio.
                      SoloAdmin va aquí y no dentro de la pantalla para que la
                      redirección ocurra antes de montar nada. */}
                  <Route element={<SoloAdmin />}>
                    <Route path="/administracion/academico" element={<PaginaAcademico />} />
                  </Route>
```

Con sus dos imports:

```tsx
import { RutaProtegida, SoloAdmin, SoloInvitados } from '@/features/auth/RutaProtegida'
import { PaginaAcademico } from '@/features/academico/PaginaAcademico'
```

- [ ] **Paso 6: Crear el esqueleto de `PaginaAcademico`**

La ruta necesita algo que montar; la Tarea 8 lo llena.
Crea `src/features/academico/PaginaAcademico.tsx`:

```tsx
import { CuerpoPagina, EncabezadoPagina } from '@/app/EncabezadoPagina'

export function PaginaAcademico() {
  return (
    <>
      <EncabezadoPagina
        titulo="Plan académico"
        descripcion="Programas, asignaturas y prácticas del plan de estudios"
      />
      <CuerpoPagina>{null}</CuerpoPagina>
    </>
  )
}
```

- [ ] **Paso 7: Correr y confirmar que pasan**

```bash
pnpm test && pnpm typecheck && pnpm lint
```

Esperado: todo verde, incluidas las 5 pruebas que `navegacion.test.ts` ya tenía
—la de "ninguna ruta se repite" cubre sola que la entrada nueva no choca—.

- [ ] **Paso 8: Commit**

```bash
git add src/features/auth/RutaProtegida.tsx src/features/auth/RutaProtegida.test.tsx \
        src/app/navegacion.ts src/app/navegacion.test.ts src/App.tsx \
        src/features/academico/PaginaAcademico.tsx
git commit -m "feat(academico): guardia de admin, ruta y entrada de menu"
```

---

## Tarea 6: `esquemas.ts` y `consultas.ts`

**Archivos:**
- Crear: `src/features/academico/esquemas.ts`
- Crear: `src/features/academico/consultas.ts`
- Crear: `src/features/academico/consultas.test.ts`

**Interfaces:**
- Consume: `supabase` de `@/lib/supabase`; `SEMESTRES` de `./semestres`.
- Produce:
  ```ts
  // esquemas.ts
  const esquemaPrograma: ZodObject   // { nombre: string }
  const esquemaAsignatura: ZodObject // { nombre: string; semestre: number | null }
  const esquemaPractica: ZodObject   // { numero: number; nombre: string }
  type ValoresPrograma, ValoresAsignatura, ValoresPractica

  // consultas.ts
  type Programa            = { id: number; nombre: string; activo: boolean }
  type AsignaturaVinculada = { asignaturaId: number; nombre: string; semestre: number | null }
  type PracticaCatalogo    = { id: number; numero: number; nombre: string; activo: boolean }
  type Asignatura          = { id: number; nombre: string }

  function useProgramas(incluirRetiradas: boolean)
  function useAsignaturasDePrograma(programaId: number | null)
  function usePracticas(asignaturaId: number | null, incluirRetiradas: boolean)
  function useAsignaturas()

  function useCrearPrograma()        // { nombre }
  function useRenombrarPrograma()    // { id, nombre }
  function useRetirarPrograma()      // { id, activo }
  function useVincularAsignatura()   // { programaId, nombre, semestre }
  function useCambiarSemestre()      // { programaId, asignaturaId, semestre }
  function useDesvincularAsignatura()// { programaId, asignaturaId }
  function useCrearPractica()        // { asignaturaId, numero, nombre }
  function useEditarPractica()       // { id, numero, nombre }
  function useRetirarPractica()      // { id, activo }

  function mensajeDeError(error: unknown): string
  ```

---

- [ ] **Paso 1: Escribir la prueba del traductor de errores, que debe fallar**

Es la única parte de estos dos archivos que se puede probar sin red, y es la
que más se rompe en silencio: un código sin traducir sale como texto crudo de
Postgres delante del usuario.

Crea `src/features/academico/consultas.test.ts`:

```ts
import { describe, expect, test } from 'vitest'

import { mensajeDeError } from './consultas'

describe('mensajeDeError', () => {
  test('un nombre de asignatura repetido se explica', () => {
    const mensaje = mensajeDeError({
      code: '23505',
      message: 'duplicate key value violates unique constraint "asignatura_nombre_norm_idx"',
    })

    expect(mensaje).toBe('Ya existe una asignatura con ese nombre')
  })

  test('un número de práctica repetido se explica', () => {
    const mensaje = mensajeDeError({
      code: '23505',
      message:
        'duplicate key value violates unique constraint "practica_catalogo_asignatura_id_numero_key"',
    })

    expect(mensaje).toBe('Ya hay una práctica con ese número en esta asignatura')
  })

  test('una asignatura ya vinculada se explica', () => {
    const mensaje = mensajeDeError({
      code: '23505',
      message: 'duplicate key value violates unique constraint "programa_asignatura_pkey"',
    })

    expect(mensaje).toBe('Esta asignatura ya está en el programa')
  })

  test('un borrado que rompe una referencia se explica', () => {
    expect(mensajeDeError({ code: '23503', message: 'violates foreign key constraint' })).toBe(
      'No se puede borrar: hay prácticas registradas que lo usan',
    )
  })

  test('un semestre fuera de rango se explica', () => {
    expect(
      mensajeDeError({ code: '23514', message: 'violates check constraint' }),
    ).toBe('El semestre va del 1 al 12')
  })

  // El caso que importa que NO se rompa: un error que no conocemos tiene que
  // llegar al usuario con su texto, no con un "algo salió mal" que esconde la
  // pista. Y algo que no es un error de Postgres tampoco puede reventar aquí.
  test('un error desconocido conserva su mensaje', () => {
    expect(mensajeDeError({ code: '42501', message: 'permission denied' })).toBe(
      'permission denied',
    )
  })

  test('algo que no es un error de Postgres no revienta', () => {
    expect(mensajeDeError(null)).toBe('No se pudo completar la operación')
    expect(mensajeDeError('vaya')).toBe('No se pudo completar la operación')
  })
})
```

- [ ] **Paso 2: Correr y confirmar que falla**

```bash
pnpm test src/features/academico/consultas.test.ts
```

Esperado: FAIL, no resuelve `./consultas`.

- [ ] **Paso 3: Escribir `esquemas.ts`**

```ts
import { z } from 'zod'

/**
 * Los mensajes de error se escriben aquí, en el esquema, y no en el JSX: así el
 * mismo campo dice lo mismo en el diálogo de alta y en el de edición.
 */
export const esquemaPrograma = z.object({
  nombre: z.string().trim().min(1, 'Escribe el nombre del programa'),
})

export const esquemaAsignatura = z.object({
  nombre: z.string().trim().min(1, 'Escribe el nombre de la asignatura'),
  // `null` es una optativa, no un campo vacío: es un valor válido del plan de
  // estudios y por eso es nullable y no optional.
  semestre: z.number().int().min(1).max(12).nullable(),
})

export const esquemaPractica = z.object({
  numero: z.number().int().min(1, 'El número va del 1 en adelante'),
  nombre: z.string().trim().min(1, 'Escribe el nombre de la práctica'),
})

export type ValoresPrograma = z.infer<typeof esquemaPrograma>
export type ValoresAsignatura = z.infer<typeof esquemaAsignatura>
export type ValoresPractica = z.infer<typeof esquemaPractica>
```

- [ ] **Paso 4: Escribir `consultas.ts`**

```ts
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { supabase } from '@/lib/supabase'

export type Programa = { id: number; nombre: string; activo: boolean }
export type AsignaturaVinculada = {
  asignaturaId: number
  nombre: string
  semestre: number | null
}
export type PracticaCatalogo = {
  id: number
  numero: number
  nombre: string
  activo: boolean
}
export type Asignatura = { id: number; nombre: string }

/**
 * Traduce los errores de Postgres. Las restricciones de la migración son la
 * última línea de defensa y funcionan; lo que no puede pasar es que el usuario
 * lea "duplicate key value violates unique constraint".
 *
 * Lo desconocido se deja pasar con su mensaje original a propósito: un
 * "algo salió mal" genérico esconde justo la pista que hace falta para
 * arreglarlo.
 */
export function mensajeDeError(error: unknown): string {
  if (typeof error !== 'object' || error === null) {
    return 'No se pudo completar la operación'
  }

  const { code, message } = error as { code?: string; message?: string }

  if (code === '23505') {
    if (message?.includes('asignatura_nombre_norm_idx')) {
      return 'Ya existe una asignatura con ese nombre'
    }
    if (message?.includes('practica_catalogo_asignatura_id_numero_key')) {
      return 'Ya hay una práctica con ese número en esta asignatura'
    }
    if (message?.includes('programa_asignatura_pkey')) {
      return 'Esta asignatura ya está en el programa'
    }
  }

  if (code === '23503') return 'No se puede borrar: hay prácticas registradas que lo usan'
  if (code === '23514') return 'El semestre va del 1 al 12'

  return message ?? 'No se pudo completar la operación'
}

// ---------------------------------------------------------------------------
// Lecturas
// ---------------------------------------------------------------------------
export function useProgramas(incluirRetiradas: boolean) {
  return useQuery({
    queryKey: ['academico', 'programas', incluirRetiradas],
    queryFn: async (): Promise<Programa[]> => {
      let consulta = supabase.from('programa_educativo').select('id, nombre, activo').order('nombre')
      if (!incluirRetiradas) consulta = consulta.eq('activo', true)

      const { data, error } = await consulta
      if (error) throw error
      return data
    },
  })
}

/**
 * El semestre sale de la tabla puente y el nombre del join. El orden se decide
 * en `agruparPorSemestre`, no aquí: un `order by semestre` pondría las
 * optativas primero.
 */
export function useAsignaturasDePrograma(programaId: number | null) {
  return useQuery({
    queryKey: ['academico', 'asignaturas-de-programa', programaId],
    enabled: programaId !== null,
    queryFn: async (): Promise<AsignaturaVinculada[]> => {
      const { data, error } = await supabase
        .from('programa_asignatura')
        .select('semestre, asignatura:asignatura_id (id, nombre)')
        .eq('programa_educativo_id', programaId as number)
      if (error) throw error

      return data
        .map((fila) => ({
          asignaturaId: fila.asignatura.id,
          nombre: fila.asignatura.nombre,
          semestre: fila.semestre,
        }))
        .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))
    },
  })
}

export function usePracticas(asignaturaId: number | null, incluirRetiradas: boolean) {
  return useQuery({
    queryKey: ['academico', 'practicas', asignaturaId, incluirRetiradas],
    enabled: asignaturaId !== null,
    queryFn: async (): Promise<PracticaCatalogo[]> => {
      let consulta = supabase
        .from('practica_catalogo')
        .select('id, numero, nombre, activo')
        .eq('asignatura_id', asignaturaId as number)
        .order('numero')
      if (!incluirRetiradas) consulta = consulta.eq('activo', true)

      const { data, error } = await consulta
      if (error) throw error
      return data
    },
  })
}

/**
 * Todas las asignaturas, para el autocompletar de "vincular una que ya existe".
 * El filtrado de "las que este programa aún no tiene" ocurre en el componente:
 * son decenas de filas, PostgREST no expresa bien un NOT IN (subconsulta), y
 * montar una vista sería pagar una migración por un `filter` de JavaScript.
 */
export function useAsignaturas() {
  return useQuery({
    queryKey: ['academico', 'asignaturas'],
    queryFn: async (): Promise<Asignatura[]> => {
      const { data, error } = await supabase.from('asignatura').select('id, nombre').order('nombre')
      if (error) throw error
      return data
    },
  })
}

// ---------------------------------------------------------------------------
// Escrituras
// ---------------------------------------------------------------------------
// Cada una invalida sólo lo que ensucia. Invalidar ['academico'] entero
// refrescaría las tres columnas en cada tecleo.

export function useCrearPrograma() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (v: { nombre: string }) => {
      const { error } = await supabase.from('programa_educativo').insert({ nombre: v.nombre })
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['academico', 'programas'] }),
  })
}

export function useRenombrarPrograma() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (v: { id: number; nombre: string }) => {
      const { error } = await supabase
        .from('programa_educativo')
        .update({ nombre: v.nombre })
        .eq('id', v.id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['academico', 'programas'] }),
  })
}

export function useRetirarPrograma() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (v: { id: number; activo: boolean }) => {
      const { error } = await supabase
        .from('programa_educativo')
        .update({ activo: v.activo })
        .eq('id', v.id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['academico', 'programas'] }),
  })
}

/**
 * Por RPC y no por dos inserts: crear la asignatura y vincularla tienen que ser
 * atómicos, y la función además reusa la asignatura que ya exista con ese
 * nombre normalizado en vez de chocar contra el índice único.
 */
export function useVincularAsignatura() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (v: { programaId: number; nombre: string; semestre: number | null }) => {
      const { error } = await supabase.rpc('vincular_asignatura', {
        p_programa: v.programaId,
        p_nombre: v.nombre,
        // `undefined` y no `null`: el argumento tiene `default null` en la
        // firma, y omitirlo es lo mismo que mandarlo nulo.
        p_semestre: v.semestre ?? undefined,
      })
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['academico', 'asignaturas-de-programa'] })
      qc.invalidateQueries({ queryKey: ['academico', 'asignaturas'] })
    },
  })
}

export function useCambiarSemestre() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (v: {
      programaId: number
      asignaturaId: number
      semestre: number | null
    }) => {
      const { error } = await supabase
        .from('programa_asignatura')
        .update({ semestre: v.semestre })
        .eq('programa_educativo_id', v.programaId)
        .eq('asignatura_id', v.asignaturaId)
      if (error) throw error
    },
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ['academico', 'asignaturas-de-programa'] }),
  })
}

export function useDesvincularAsignatura() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (v: { programaId: number; asignaturaId: number }) => {
      const { error } = await supabase
        .from('programa_asignatura')
        .delete()
        .eq('programa_educativo_id', v.programaId)
        .eq('asignatura_id', v.asignaturaId)
      if (error) throw error
    },
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ['academico', 'asignaturas-de-programa'] }),
  })
}

export function useCrearPractica() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (v: { asignaturaId: number; numero: number; nombre: string }) => {
      const { error } = await supabase
        .from('practica_catalogo')
        .insert({ asignatura_id: v.asignaturaId, numero: v.numero, nombre: v.nombre })
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['academico', 'practicas'] }),
  })
}

export function useEditarPractica() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (v: { id: number; numero: number; nombre: string }) => {
      const { error } = await supabase
        .from('practica_catalogo')
        .update({ numero: v.numero, nombre: v.nombre })
        .eq('id', v.id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['academico', 'practicas'] }),
  })
}

export function useRetirarPractica() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (v: { id: number; activo: boolean }) => {
      const { error } = await supabase
        .from('practica_catalogo')
        .update({ activo: v.activo })
        .eq('id', v.id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['academico', 'practicas'] }),
  })
}
```

- [ ] **Paso 5: Correr y confirmar que pasa**

```bash
pnpm test src/features/academico/consultas.test.ts && pnpm typecheck
```

Esperado: 7 pruebas en verde y `typecheck` en cero. Si `typecheck` se queja del
`fila.asignatura.id` de `useAsignaturasDePrograma`, es que PostgREST tipó el
join como arreglo: ajusta el acceso a lo que digan los tipos generados, **sin
tocar `src/types/database.ts`**.

- [ ] **Paso 6: Commit**

```bash
git add src/features/academico/esquemas.ts src/features/academico/consultas.ts \
        src/features/academico/consultas.test.ts
git commit -m "feat(academico): consultas, mutaciones y traductor de errores"
```

---

## Tarea 7: Las tres columnas

**Archivos:**
- Crear: `src/features/academico/ColumnaAcademica.tsx`
- Crear: `src/features/academico/ListaProgramas.tsx`
- Crear: `src/features/academico/ListaAsignaturas.tsx`
- Crear: `src/features/academico/ListaAsignaturas.test.tsx`
- Crear: `src/features/academico/ListaPracticas.tsx`

**Interfaces:**
- Consume: `agruparPorSemestre`, `etiquetaSemestre` de `./semestres`; los tipos
  `Programa`, `AsignaturaVinculada`, `PracticaCatalogo` de `./consultas`.
- Produce:
  ```tsx
  <ColumnaAcademica
    titulo={string} subtitulo={string | undefined}
    cargando={boolean} vacio={string} acciones={ReactNode}
  >{children}</ColumnaAcademica>

  <ListaProgramas programas seleccionado onElegir onEditar onRetirar />
  <ListaAsignaturas asignaturas seleccionada onElegir onCambiarSemestre onDesvincular />
  <ListaPracticas practicas seleccionada onEditar onRetirar />
  ```

Sin datos propios: reciben todo por props. Así `ListaAsignaturas` se prueba sin
red y sin `QueryClientProvider`.

---

- [ ] **Paso 1: Escribir la prueba de `ListaAsignaturas`, que debe fallar**

Crea `src/features/academico/ListaAsignaturas.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import { describe, expect, test, vi } from 'vitest'

import { ListaAsignaturas } from './ListaAsignaturas'

const ASIGNATURAS = [
  { asignaturaId: 4, nombre: 'Bromatología', semestre: null },
  { asignaturaId: 3, nombre: 'Análisis de Alimentos', semestre: 5 },
  { asignaturaId: 1, nombre: 'Química General', semestre: 1 },
]

function montar() {
  return render(
    <ListaAsignaturas
      asignaturas={ASIGNATURAS}
      seleccionada={null}
      onElegir={vi.fn()}
      onCambiarSemestre={vi.fn()}
      onDesvincular={vi.fn()}
    />,
  )
}

describe('ListaAsignaturas', () => {
  test('muestra un encabezado por semestre', () => {
    montar()

    expect(screen.getByText('1°')).toBeInTheDocument()
    expect(screen.getByText('5°')).toBeInTheDocument()
    expect(screen.getByText('Optativa')).toBeInTheDocument()
  })

  // Lo que de verdad se prueba aquí: que el orden llegue hasta el DOM. La
  // agrupación ya está probada en semestres.test.ts; esto ancla que el
  // componente no la deshaga al pintarla.
  test('la optativa se pinta al final, después del último semestre', () => {
    montar()

    const encabezados = screen.getAllByRole('heading', { level: 3 }).map((h) => h.textContent)

    expect(encabezados).toEqual(['1°', '5°', 'Optativa'])
  })

  test('cada asignatura aparece bajo su semestre', () => {
    montar()

    expect(screen.getByText('Química General')).toBeInTheDocument()
    expect(screen.getByText('Bromatología')).toBeInTheDocument()
  })
})
```

- [ ] **Paso 2: Correr y confirmar que falla**

```bash
pnpm test src/features/academico/ListaAsignaturas.test.tsx
```

Esperado: FAIL, no resuelve `./ListaAsignaturas`.

- [ ] **Paso 3: Escribir `ColumnaAcademica.tsx`**

```tsx
import type { ReactNode } from 'react'
import { Box, Card, LinearProgress, Stack, Typography } from '@mui/material'

type Props = {
  titulo: string
  /** De qué cuelga esta columna: el programa elegido, la asignatura elegida. */
  subtitulo?: string
  cargando: boolean
  /** Qué decir cuando no hay nada que listar. */
  vacio: string
  /** Los botones del pie. */
  acciones?: ReactNode
  children?: ReactNode
}

/**
 * El cascarón de las tres columnas de la cascada.
 *
 * Existe porque las tres comparten exactamente esto —título, subtítulo, lista
 * con scroll propio, estado vacío y pie de acciones— y difieren sólo en el
 * contenido. Copiado tres veces, a la segunda ya habría divergido.
 *
 * El scroll es de la columna y no de la página: con tres listas de largos
 * distintos, un scroll único obligaría a bajar la página entera para ver el pie
 * de la tercera.
 */
export function ColumnaAcademica({ titulo, subtitulo, cargando, vacio, acciones, children }: Props) {
  const sinContenido = children === null || children === undefined

  return (
    <Card sx={{ display: 'flex', flexDirection: 'column', height: { md: '68vh' } }}>
      <Box sx={{ px: 2, pt: 1.75, pb: 1.25, borderBottom: '1px solid', borderColor: 'divider' }}>
        <Typography variant="h2" sx={{ fontSize: '0.95rem' }}>
          {titulo}
        </Typography>
        {subtitulo === undefined ? null : (
          <Typography sx={{ color: 'text.secondary', fontSize: '0.8rem', mt: 0.25 }}>
            {subtitulo}
          </Typography>
        )}
      </Box>

      {/* Barra y no spinner centrado: la columna ya tiene contenido debajo y un
          spinner en medio lo taparía en cada refresco. */}
      {cargando ? <LinearProgress /> : null}

      <Box sx={{ flex: 1, overflowY: 'auto', minHeight: 160 }}>
        {sinContenido && !cargando ? (
          <Stack sx={{ alignItems: 'center', justifyContent: 'center', height: '100%', p: 3 }}>
            <Typography sx={{ color: 'text.secondary', textAlign: 'center', fontSize: '0.85rem' }}>
              {vacio}
            </Typography>
          </Stack>
        ) : (
          children
        )}
      </Box>

      {acciones === undefined ? null : (
        <Stack
          direction="row"
          spacing={1}
          sx={{ p: 1.25, borderTop: '1px solid', borderColor: 'divider', flexWrap: 'wrap' }}
        >
          {acciones}
        </Stack>
      )}
    </Card>
  )
}
```

- [ ] **Paso 4: Escribir `ListaAsignaturas.tsx`**

```tsx
import { Icon } from '@iconify/react'
import { IconButton, List, ListItemButton, ListItemText, Stack, Typography } from '@mui/material'

import type { AsignaturaVinculada } from './consultas'
import { agruparPorSemestre } from './semestres'

type Props = {
  asignaturas: AsignaturaVinculada[]
  seleccionada: number | null
  onElegir: (asignaturaId: number) => void
  onCambiarSemestre: (asignatura: AsignaturaVinculada) => void
  onDesvincular: (asignatura: AsignaturaVinculada) => void
}

/**
 * La columna 2. Agrupada por semestre, con la optativa al final —ese orden lo
 * decide `agruparPorSemestre` y no la consulta, porque un `order by semestre`
 * pone los nulos primero y entonces lo primero que se ve del plan son las
 * optativas—.
 */
export function ListaAsignaturas({
  asignaturas,
  seleccionada,
  onElegir,
  onCambiarSemestre,
  onDesvincular,
}: Props) {
  return (
    <List dense disablePadding>
      {agruparPorSemestre(asignaturas).map((grupo) => (
        <li key={grupo.etiqueta}>
          <Typography
            variant="h3"
            component="h3"
            sx={{
              px: 2,
              pt: 1.5,
              pb: 0.5,
              fontSize: '0.7rem',
              fontWeight: 700,
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              color: 'text.secondary',
            }}
          >
            {grupo.etiqueta}
          </Typography>

          <List dense disablePadding>
            {grupo.filas.map((asignatura) => (
              <ListItemButton
                key={asignatura.asignaturaId}
                selected={asignatura.asignaturaId === seleccionada}
                onClick={() => onElegir(asignatura.asignaturaId)}
                sx={{ pl: 2, pr: 1 }}
              >
                <ListItemText
                  primary={asignatura.nombre}
                  slotProps={{ primary: { sx: { fontSize: '0.85rem' } } }}
                />
                <Stack direction="row" spacing={0.25} sx={{ flexShrink: 0 }}>
                  <IconButton
                    size="small"
                    aria-label={`Cambiar el semestre de ${asignatura.nombre}`}
                    onClick={(e) => {
                      // Sin esto el clic también elige la asignatura y la
                      // columna 3 se recarga detrás del diálogo.
                      e.stopPropagation()
                      onCambiarSemestre(asignatura)
                    }}
                  >
                    <Icon icon="mdi:calendar-edit-outline" width={16} />
                  </IconButton>
                  <IconButton
                    size="small"
                    aria-label={`Quitar ${asignatura.nombre} del programa`}
                    onClick={(e) => {
                      e.stopPropagation()
                      onDesvincular(asignatura)
                    }}
                  >
                    <Icon icon="mdi:link-variant-off" width={16} />
                  </IconButton>
                </Stack>
              </ListItemButton>
            ))}
          </List>
        </li>
      ))}
    </List>
  )
}
```

- [ ] **Paso 5: Correr la prueba y confirmar que pasa**

```bash
pnpm test src/features/academico/ListaAsignaturas.test.tsx
```

Esperado: 3 pruebas en verde.

- [ ] **Paso 6: Escribir `ListaProgramas.tsx` y `ListaPracticas.tsx`**

`src/features/academico/ListaProgramas.tsx`:

```tsx
import { Icon } from '@iconify/react'
import { IconButton, List, ListItemButton, ListItemText, Stack } from '@mui/material'

import type { Programa } from './consultas'

type Props = {
  programas: Programa[]
  seleccionado: number | null
  onElegir: (programaId: number) => void
  onEditar: (programa: Programa) => void
  onRetirar: (programa: Programa) => void
}

/** La columna 1: la raíz de la cascada. */
export function ListaProgramas({ programas, seleccionado, onElegir, onEditar, onRetirar }: Props) {
  return (
    <List dense disablePadding>
      {programas.map((programa) => (
        <ListItemButton
          key={programa.id}
          selected={programa.id === seleccionado}
          onClick={() => onElegir(programa.id)}
          sx={{ pl: 2, pr: 1 }}
        >
          <ListItemText
            primary={programa.nombre}
            secondary={programa.activo ? undefined : 'Retirado'}
            slotProps={{ primary: { sx: { fontSize: '0.85rem' } } }}
          />
          <Stack direction="row" spacing={0.25} sx={{ flexShrink: 0 }}>
            <IconButton
              size="small"
              aria-label={`Renombrar ${programa.nombre}`}
              onClick={(e) => {
                e.stopPropagation()
                onEditar(programa)
              }}
            >
              <Icon icon="mdi:pencil-outline" width={16} />
            </IconButton>
            <IconButton
              size="small"
              aria-label={`${programa.activo ? 'Retirar' : 'Reactivar'} ${programa.nombre}`}
              onClick={(e) => {
                e.stopPropagation()
                onRetirar(programa)
              }}
            >
              <Icon
                icon={programa.activo ? 'mdi:archive-outline' : 'mdi:archive-off-outline'}
                width={16}
              />
            </IconButton>
          </Stack>
        </ListItemButton>
      ))}
    </List>
  )
}
```

`src/features/academico/ListaPracticas.tsx`:

```tsx
import { Icon } from '@iconify/react'
import { IconButton, List, ListItem, ListItemText, Stack, Typography } from '@mui/material'

import type { PracticaCatalogo } from './consultas'

type Props = {
  practicas: PracticaCatalogo[]
  /** La que se está editando ahora mismo. Se resalta mientras el diálogo está abierto. */
  seleccionada: number | null
  onEditar: (practica: PracticaCatalogo) => void
  onRetirar: (practica: PracticaCatalogo) => void
}

/**
 * La columna 3. `ListItem` y no `ListItemButton`: aquí no hay cuarto nivel al
 * que bajar, así que una fila que se ilumina al pasar el ratón prometería una
 * navegación que no existe.
 */
export function ListaPracticas({ practicas, seleccionada, onEditar, onRetirar }: Props) {
  return (
    <List dense disablePadding>
      {practicas.map((practica) => (
        <ListItem
          key={practica.id}
          sx={{
            pl: 2,
            pr: 1,
            opacity: practica.activo ? 1 : 0.55,
            bgcolor: practica.id === seleccionada ? 'action.selected' : undefined,
          }}
          secondaryAction={
            <Stack direction="row" spacing={0.25}>
              <IconButton
                size="small"
                aria-label={`Editar la práctica ${practica.numero}`}
                onClick={() => onEditar(practica)}
              >
                <Icon icon="mdi:pencil-outline" width={16} />
              </IconButton>
              <IconButton
                size="small"
                aria-label={`${practica.activo ? 'Retirar' : 'Reactivar'} la práctica ${practica.numero}`}
                onClick={() => onRetirar(practica)}
              >
                <Icon
                  icon={practica.activo ? 'mdi:archive-outline' : 'mdi:archive-off-outline'}
                  width={16}
                />
              </IconButton>
            </Stack>
          }
        >
          <Typography
            sx={{
              width: 26,
              flexShrink: 0,
              fontVariantNumeric: 'tabular-nums',
              color: 'text.secondary',
              fontSize: '0.8rem',
            }}
          >
            {practica.numero}
          </Typography>
          <ListItemText
            primary={practica.nombre}
            slotProps={{ primary: { sx: { fontSize: '0.85rem' } } }}
          />
        </ListItem>
      ))}
    </List>
  )
}
```

- [ ] **Paso 7: Verificar**

```bash
pnpm test && pnpm typecheck && pnpm lint
```

Esperado: todo verde.

- [ ] **Paso 8: Commit**

```bash
git add src/features/academico/ColumnaAcademica.tsx \
        src/features/academico/ListaProgramas.tsx \
        src/features/academico/ListaAsignaturas.tsx \
        src/features/academico/ListaAsignaturas.test.tsx \
        src/features/academico/ListaPracticas.tsx
git commit -m "feat(academico): las tres columnas de la cascada"
```

---

## Tarea 8: Los diálogos y el ensamblaje

**Archivos:**
- Crear: `src/features/academico/DialogoPrograma.tsx`
- Crear: `src/features/academico/DialogoAsignatura.tsx`
- Crear: `src/features/academico/DialogoPractica.tsx`
- Modificar: `src/features/academico/PaginaAcademico.tsx` (reemplaza el esqueleto)

**Interfaces:**
- Consume: todo lo de las tareas 3, 4, 6 y 7.
- Produce: la pantalla completa en `/administracion/academico`.

---

- [ ] **Paso 1: Escribir `DialogoPrograma.tsx`**

```tsx
import { zodResolver } from '@hookform/resolvers/zod'
import { Button, Dialog, DialogActions, DialogContent, DialogTitle, TextField } from '@mui/material'
import { Controller, useForm } from 'react-hook-form'

import { esquemaPrograma, type ValoresPrograma } from './esquemas'

type Props = {
  abierto: boolean
  /** Si viene, el diálogo renombra; si no, da de alta. */
  inicial?: { nombre: string }
  guardando: boolean
  onGuardar: (valores: ValoresPrograma) => void
  onCerrar: () => void
}

export function DialogoPrograma({ abierto, inicial, guardando, onGuardar, onCerrar }: Props) {
  const { control, handleSubmit, reset } = useForm<ValoresPrograma>({
    resolver: zodResolver(esquemaPrograma),
    values: { nombre: inicial?.nombre ?? '' },
  })

  function cerrar() {
    reset()
    onCerrar()
  }

  return (
    <Dialog open={abierto} onClose={cerrar} fullWidth maxWidth="xs">
      {/* component="form" y no un onClick en el botón: así Enter envía el
          formulario, que es como se captura una lista larga sin soltar el
          teclado. */}
      <form onSubmit={handleSubmit(onGuardar)}>
        <DialogTitle>{inicial ? 'Renombrar programa' : 'Nuevo programa educativo'}</DialogTitle>
        <DialogContent>
          <Controller
            name="nombre"
            control={control}
            render={({ field, fieldState }) => (
              <TextField
                {...field}
                autoFocus
                fullWidth
                margin="dense"
                label="Nombre del programa"
                error={!!fieldState.error}
                helperText={fieldState.error?.message}
              />
            )}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={cerrar}>Cancelar</Button>
          <Button type="submit" variant="contained" loading={guardando}>
            Guardar
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  )
}
```

- [ ] **Paso 2: Escribir `DialogoAsignatura.tsx`**

```tsx
import { useState } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import {
  Autocomplete,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  MenuItem,
  Tab,
  Tabs,
  TextField,
} from '@mui/material'
import { Controller, useForm } from 'react-hook-form'

import type { Asignatura } from './consultas'
import { esquemaAsignatura, type ValoresAsignatura } from './esquemas'
import { SEMESTRES } from './semestres'

type Props = {
  abierto: boolean
  /** Las que este programa AÚN NO tiene: el filtrado lo hace quien llama. */
  disponibles: Asignatura[]
  /** Si viene, el diálogo sólo cambia el semestre de una ya vinculada. */
  inicial?: { nombre: string; semestre: number | null }
  guardando: boolean
  onGuardar: (valores: ValoresAsignatura) => void
  onCerrar: () => void
}

/**
 * Dos modos, y la diferencia entre ellos es exactamente lo que modela la tabla
 * puente: **crear** mete una fila nueva en `asignatura`; **vincular** reusa una
 * que ya existe y sólo añade el renglón de `programa_asignatura`. Que sean dos
 * pestañas y no un solo campo es lo que enseña ese modelo a quien captura.
 *
 * En los dos casos se llama a `vincular_asignatura`, que busca por nombre
 * normalizado: si alguien escribe en "Nueva" un nombre que ya existe, la
 * función reusa el que hay en vez de fallar.
 */
export function DialogoAsignatura({
  abierto,
  disponibles,
  inicial,
  guardando,
  onGuardar,
  onCerrar,
}: Props) {
  const editando = inicial !== undefined
  const [modo, setModo] = useState<'nueva' | 'vincular'>('nueva')

  const { control, handleSubmit, reset, setValue } = useForm<ValoresAsignatura>({
    resolver: zodResolver(esquemaAsignatura),
    values: { nombre: inicial?.nombre ?? '', semestre: inicial?.semestre ?? null },
  })

  function cerrar() {
    reset()
    setModo('nueva')
    onCerrar()
  }

  return (
    <Dialog open={abierto} onClose={cerrar} fullWidth maxWidth="xs">
      <form onSubmit={handleSubmit(onGuardar)}>
        <DialogTitle>
          {editando ? `Semestre de ${inicial.nombre}` : 'Agregar asignatura al programa'}
        </DialogTitle>

        {editando ? null : (
          <Tabs
            value={modo}
            onChange={(_, v: 'nueva' | 'vincular') => {
              setModo(v)
              setValue('nombre', '')
            }}
            sx={{ px: 3 }}
          >
            <Tab value="nueva" label="Nueva" />
            <Tab value="vincular" label="Ya existe" />
          </Tabs>
        )}

        <DialogContent>
          {editando ? null : (
            <Controller
              name="nombre"
              control={control}
              render={({ field, fieldState }) =>
                modo === 'nueva' ? (
                  <TextField
                    {...field}
                    autoFocus
                    fullWidth
                    margin="dense"
                    label="Nombre de la asignatura"
                    error={!!fieldState.error}
                    helperText={fieldState.error?.message}
                  />
                ) : (
                  <Autocomplete
                    options={disponibles.map((a) => a.nombre)}
                    value={field.value === '' ? null : field.value}
                    onChange={(_, v) => field.onChange(v ?? '')}
                    noOptionsText="No quedan asignaturas por vincular"
                    renderInput={(params) => (
                      <TextField
                        {...params}
                        autoFocus
                        margin="dense"
                        label="Asignatura existente"
                        error={!!fieldState.error}
                        helperText={fieldState.error?.message}
                      />
                    )}
                  />
                )
              }
            />
          )}

          <Controller
            name="semestre"
            control={control}
            render={({ field, fieldState }) => (
              <TextField
                select
                fullWidth
                margin="dense"
                label="Semestre"
                // El valor del Select es texto; null viaja como '' y se
                // reconvierte al salir. Sin esto, "Optativa" no se puede elegir.
                value={field.value === null ? '' : String(field.value)}
                onChange={(e) => field.onChange(e.target.value === '' ? null : Number(e.target.value))}
                error={!!fieldState.error}
                helperText={fieldState.error?.message}
              >
                {SEMESTRES.map((s) => (
                  <MenuItem key={s.etiqueta} value={s.valor === null ? '' : String(s.valor)}>
                    {s.etiqueta}
                  </MenuItem>
                ))}
              </TextField>
            )}
          />
        </DialogContent>

        <DialogActions>
          <Button onClick={cerrar}>Cancelar</Button>
          <Button type="submit" variant="contained" loading={guardando}>
            Guardar
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  )
}
```

- [ ] **Paso 3: Escribir `DialogoPractica.tsx`**

```tsx
import { zodResolver } from '@hookform/resolvers/zod'
import { Button, Dialog, DialogActions, DialogContent, DialogTitle, Stack, TextField } from '@mui/material'
import { Controller, useForm } from 'react-hook-form'

import { esquemaPractica, type ValoresPractica } from './esquemas'

type Props = {
  abierto: boolean
  /** Bajo qué asignatura se está capturando, para que se vea en el título. */
  asignatura: string
  inicial?: { numero: number; nombre: string }
  /** El siguiente número libre, para no obligar a contar. */
  siguienteNumero: number
  guardando: boolean
  onGuardar: (valores: ValoresPractica) => void
  onCerrar: () => void
}

export function DialogoPractica({
  abierto,
  asignatura,
  inicial,
  siguienteNumero,
  guardando,
  onGuardar,
  onCerrar,
}: Props) {
  const { control, handleSubmit, reset } = useForm<ValoresPractica>({
    resolver: zodResolver(esquemaPractica),
    values: {
      numero: inicial?.numero ?? siguienteNumero,
      nombre: inicial?.nombre ?? '',
    },
  })

  function cerrar() {
    reset()
    onCerrar()
  }

  return (
    <Dialog open={abierto} onClose={cerrar} fullWidth maxWidth="xs">
      <form onSubmit={handleSubmit(onGuardar)}>
        <DialogTitle>
          {inicial ? 'Editar práctica' : 'Nueva práctica'} · {asignatura}
        </DialogTitle>
        <DialogContent>
          <Stack direction="row" spacing={1.5} sx={{ mt: 0.5 }}>
            <Controller
              name="numero"
              control={control}
              render={({ field, fieldState }) => (
                <TextField
                  {...field}
                  type="number"
                  label="N°"
                  sx={{ width: 92 }}
                  // valueAsNumber no existe en Controller: sin este onChange el
                  // campo entrega texto y zod lo rechaza por no ser number.
                  onChange={(e) => field.onChange(e.target.value === '' ? 0 : Number(e.target.value))}
                  error={!!fieldState.error}
                  helperText={fieldState.error?.message}
                />
              )}
            />
            <Controller
              name="nombre"
              control={control}
              render={({ field, fieldState }) => (
                <TextField
                  {...field}
                  autoFocus
                  fullWidth
                  label="Nombre de la práctica"
                  error={!!fieldState.error}
                  helperText={fieldState.error?.message}
                />
              )}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={cerrar}>Cancelar</Button>
          <Button type="submit" variant="contained" loading={guardando}>
            Guardar
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  )
}
```

- [ ] **Paso 4: Reemplazar `PaginaAcademico.tsx` por el ensamblaje completo**

```tsx
import { useState } from 'react'
import { Icon } from '@iconify/react'
import { Alert, Button, FormControlLabel, Grid, Snackbar, Switch } from '@mui/material'

import { CuerpoPagina, EncabezadoPagina } from '@/app/EncabezadoPagina'
import { ColumnaAcademica } from './ColumnaAcademica'
import { DialogoAsignatura } from './DialogoAsignatura'
import { DialogoPractica } from './DialogoPractica'
import { DialogoPrograma } from './DialogoPrograma'
import { ListaAsignaturas } from './ListaAsignaturas'
import { ListaPracticas } from './ListaPracticas'
import { ListaProgramas } from './ListaProgramas'
import {
  mensajeDeError,
  useAsignaturas,
  useAsignaturasDePrograma,
  useCambiarSemestre,
  useCrearPractica,
  useCrearPrograma,
  useDesvincularAsignatura,
  useEditarPractica,
  usePracticas,
  useProgramas,
  useRenombrarPrograma,
  useRetirarPractica,
  useRetirarPrograma,
  useVincularAsignatura,
  type AsignaturaVinculada,
  type PracticaCatalogo,
  type Programa,
} from './consultas'
import { elegirAsignatura, elegirPractica, elegirPrograma, SELECCION_VACIA } from './seleccion'

/** Qué diálogo está abierto y sobre qué fila. */
type Dialogo =
  | { tipo: 'programa'; programa?: Programa }
  | { tipo: 'asignatura'; asignatura?: AsignaturaVinculada }
  | { tipo: 'practica'; practica?: PracticaCatalogo }
  | null

export function PaginaAcademico() {
  const [seleccion, setSeleccion] = useState(SELECCION_VACIA)
  const [verRetiradas, setVerRetiradas] = useState(false)
  const [dialogo, setDialogo] = useState<Dialogo>(null)
  const [aviso, setAviso] = useState<string | null>(null)

  const programas = useProgramas(verRetiradas)
  const asignaturas = useAsignaturasDePrograma(seleccion.programaId)
  const practicas = usePracticas(seleccion.asignaturaId, verRetiradas)
  const todasLasAsignaturas = useAsignaturas()

  const crearPrograma = useCrearPrograma()
  const renombrarPrograma = useRenombrarPrograma()
  const retirarPrograma = useRetirarPrograma()
  const vincular = useVincularAsignatura()
  const cambiarSemestre = useCambiarSemestre()
  const desvincular = useDesvincularAsignatura()
  const crearPractica = useCrearPractica()
  const editarPractica = useEditarPractica()
  const retirarPractica = useRetirarPractica()

  const programa = programas.data?.find((p) => p.id === seleccion.programaId) ?? null
  const asignatura = asignaturas.data?.find((a) => a.asignaturaId === seleccion.asignaturaId) ?? null

  // Las que este programa aún no tiene. Se filtra aquí y no en la consulta:
  // son decenas de filas y PostgREST no expresa bien un NOT IN (subconsulta).
  const yaVinculadas = new Set(asignaturas.data?.map((a) => a.asignaturaId) ?? [])
  const disponibles = (todasLasAsignaturas.data ?? []).filter((a) => !yaVinculadas.has(a.id))

  // Un número libre de salida, para no obligar a contar la lista a mano.
  const siguienteNumero = Math.max(0, ...(practicas.data?.map((p) => p.numero) ?? [])) + 1

  /** Todas las mutaciones fallan igual: aviso en español y el diálogo se queda. */
  function alFallar(error: unknown) {
    setAviso(mensajeDeError(error))
  }

  function cerrarDialogo() {
    setDialogo(null)
  }

  return (
    <>
      <EncabezadoPagina
        titulo="Plan académico"
        descripcion="Programas, asignaturas y prácticas del plan de estudios"
        acciones={
          <FormControlLabel
            control={
              <Switch
                size="small"
                checked={verRetiradas}
                onChange={(e) => setVerRetiradas(e.target.checked)}
              />
            }
            label="Ver retiradas"
            slotProps={{ typography: { sx: { fontSize: '0.85rem' } } }}
          />
        }
      />

      <CuerpoPagina>
        <Grid container spacing={2}>
          <Grid size={{ xs: 12, md: 4 }}>
            <ColumnaAcademica
              titulo="Programas"
              cargando={programas.isPending}
              vacio="Todavía no hay programas educativos."
              acciones={
                <Button
                  size="small"
                  startIcon={<Icon icon="mdi:plus" width={16} />}
                  onClick={() => setDialogo({ tipo: 'programa' })}
                >
                  Programa
                </Button>
              }
            >
              {programas.data === undefined || programas.data.length === 0 ? null : (
                <ListaProgramas
                  programas={programas.data}
                  seleccionado={seleccion.programaId}
                  onElegir={(id) => setSeleccion((s) => elegirPrograma(s, id))}
                  onEditar={(p) => setDialogo({ tipo: 'programa', programa: p })}
                  onRetirar={(p) =>
                    retirarPrograma.mutate({ id: p.id, activo: !p.activo }, { onError: alFallar })
                  }
                />
              )}
            </ColumnaAcademica>
          </Grid>

          <Grid size={{ xs: 12, md: 4 }}>
            <ColumnaAcademica
              titulo="Asignaturas"
              subtitulo={programa?.nombre}
              cargando={asignaturas.isPending && seleccion.programaId !== null}
              vacio={
                seleccion.programaId === null
                  ? 'Elige un programa para ver sus asignaturas.'
                  : 'Este programa todavía no tiene asignaturas.'
              }
              acciones={
                seleccion.programaId === null ? undefined : (
                  <Button
                    size="small"
                    startIcon={<Icon icon="mdi:plus" width={16} />}
                    onClick={() => setDialogo({ tipo: 'asignatura' })}
                  >
                    Asignatura
                  </Button>
                )
              }
            >
              {asignaturas.data === undefined || asignaturas.data.length === 0 ? null : (
                <ListaAsignaturas
                  asignaturas={asignaturas.data}
                  seleccionada={seleccion.asignaturaId}
                  onElegir={(id) => setSeleccion((s) => elegirAsignatura(s, id))}
                  onCambiarSemestre={(a) => setDialogo({ tipo: 'asignatura', asignatura: a })}
                  onDesvincular={(a) =>
                    desvincular.mutate(
                      { programaId: seleccion.programaId as number, asignaturaId: a.asignaturaId },
                      { onError: alFallar },
                    )
                  }
                />
              )}
            </ColumnaAcademica>
          </Grid>

          <Grid size={{ xs: 12, md: 4 }}>
            <ColumnaAcademica
              titulo="Prácticas"
              subtitulo={asignatura?.nombre}
              cargando={practicas.isPending && seleccion.asignaturaId !== null}
              vacio={
                seleccion.asignaturaId === null
                  ? 'Elige una asignatura para ver sus prácticas.'
                  : 'Esta asignatura todavía no tiene prácticas.'
              }
              acciones={
                seleccion.asignaturaId === null ? undefined : (
                  <Button
                    size="small"
                    startIcon={<Icon icon="mdi:plus" width={16} />}
                    onClick={() => setDialogo({ tipo: 'practica' })}
                  >
                    Práctica
                  </Button>
                )
              }
            >
              {practicas.data === undefined || practicas.data.length === 0 ? null : (
                <ListaPracticas
                  practicas={practicas.data}
                  seleccionada={seleccion.practicaId}
                  onEditar={(p) => {
                    setSeleccion((s) => elegirPractica(s, p.id))
                    setDialogo({ tipo: 'practica', practica: p })
                  }}
                  onRetirar={(p) =>
                    retirarPractica.mutate({ id: p.id, activo: !p.activo }, { onError: alFallar })
                  }
                />
              )}
            </ColumnaAcademica>
          </Grid>
        </Grid>
      </CuerpoPagina>

      <DialogoPrograma
        abierto={dialogo?.tipo === 'programa'}
        inicial={dialogo?.tipo === 'programa' ? dialogo.programa : undefined}
        guardando={crearPrograma.isPending || renombrarPrograma.isPending}
        onCerrar={cerrarDialogo}
        onGuardar={(v) => {
          const existente = dialogo?.tipo === 'programa' ? dialogo.programa : undefined
          const opciones = { onSuccess: cerrarDialogo, onError: alFallar }
          if (existente) renombrarPrograma.mutate({ id: existente.id, nombre: v.nombre }, opciones)
          else crearPrograma.mutate({ nombre: v.nombre }, opciones)
        }}
      />

      <DialogoAsignatura
        abierto={dialogo?.tipo === 'asignatura'}
        disponibles={disponibles}
        inicial={dialogo?.tipo === 'asignatura' ? dialogo.asignatura : undefined}
        guardando={vincular.isPending || cambiarSemestre.isPending}
        onCerrar={cerrarDialogo}
        onGuardar={(v) => {
          const existente = dialogo?.tipo === 'asignatura' ? dialogo.asignatura : undefined
          const opciones = { onSuccess: cerrarDialogo, onError: alFallar }
          if (existente) {
            cambiarSemestre.mutate(
              {
                programaId: seleccion.programaId as number,
                asignaturaId: existente.asignaturaId,
                semestre: v.semestre,
              },
              opciones,
            )
          } else {
            vincular.mutate(
              { programaId: seleccion.programaId as number, nombre: v.nombre, semestre: v.semestre },
              opciones,
            )
          }
        }}
      />

      <DialogoPractica
        abierto={dialogo?.tipo === 'practica'}
        asignatura={asignatura?.nombre ?? ''}
        inicial={dialogo?.tipo === 'practica' ? dialogo.practica : undefined}
        siguienteNumero={siguienteNumero}
        guardando={crearPractica.isPending || editarPractica.isPending}
        onCerrar={cerrarDialogo}
        onGuardar={(v) => {
          const existente = dialogo?.tipo === 'practica' ? dialogo.practica : undefined
          const opciones = { onSuccess: cerrarDialogo, onError: alFallar }
          if (existente) {
            editarPractica.mutate({ id: existente.id, numero: v.numero, nombre: v.nombre }, opciones)
          } else {
            crearPractica.mutate(
              { asignaturaId: seleccion.asignaturaId as number, numero: v.numero, nombre: v.nombre },
              opciones,
            )
          }
        }}
      />

      <Snackbar
        open={aviso !== null}
        autoHideDuration={6000}
        onClose={() => setAviso(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert severity="error" onClose={() => setAviso(null)}>
          {aviso}
        </Alert>
      </Snackbar>
    </>
  )
}
```

- [ ] **Paso 5: Verificar**

```bash
pnpm test && pnpm typecheck && pnpm lint && pnpm build
```

Esperado: los cuatro en cero.

- [ ] **Paso 6: Commit**

```bash
git add src/features/academico/
git commit -m "feat(academico): dialogos y ensamblaje de la pantalla"
```

---

## Tarea 9: Verificación de cierre

**Archivos:** ninguno, salvo lo que salga roto.

---

- [ ] **Paso 1: Las cuatro comprobaciones automáticas, desde cero**

```bash
supabase db reset
supabase test db
pnpm test && pnpm typecheck && pnpm lint && pnpm build
```

Esperado: `esquema.test.sql` con 60, `rls.test.sql` con 73, y los cuatro
comandos de `pnpm` en cero. **Pega la salida real.** No digas que funciona sin
haberla visto.

- [ ] **Paso 2: El guion de prueba manual**

`pnpm dev`, y recorrer esto en orden. Cubre lo que las pruebas automáticas no
alcanzan:

```
 1. Entra como lectura@uaeh.local / sigrem2026
    -> En el menú NO aparece "Plan académico"
 2. Escribe /administracion/academico en la barra de direcciones
    -> Rebota al menú principal. No parpadea la pantalla antes de rebotar
 3. Entra como n3@uaeh.local / sigrem2026, repite el paso 2
    -> Mismo rebote
 4. Entra como admin@uaeh.local / sigrem2026
    -> "Plan académico" aparece en el grupo Administración y abre
 5. Elige "Química en Alimentos"
    -> La columna 2 lista 1°, 3°, 5° y Optativa, EN ESE ORDEN.
       Bromatología está bajo Optativa, al final
 6. Elige "Bioquímica" y mira la columna 3
    -> Dos prácticas: 1 Identificación de carbohidratos, 2 Actividad enzimática
 7. Cambia a "Químico Farmacéutico Biólogo" y elige su "Bioquímica"
    -> Aparece bajo 6°, y sus prácticas son LAS MISMAS dos del paso 6.
       Es una sola asignatura vista desde dos programas: si aquí salieran
       prácticas distintas, la tabla puente no está funcionando
 8. Con "Química en Alimentos" y "Bioquímica" elegidos, cambia el programa
    a "Ingeniería en Biotecnología"
    -> Las columnas 2 y 3 se vacían. La 3 NO se queda con las prácticas
       de Bioquímica
 9. Elige "Bromatología" (Optativa)
    -> La columna 3 dice "Esta asignatura todavía no tiene prácticas"
10. Añade una práctica ahí
    -> El campo N° llega con 1 puesto. Envía con Enter, sin tocar el ratón
11. Añade otra práctica con el N° 1 otra vez
    -> Sale un aviso rojo: "Ya hay una práctica con ese número en esta
       asignatura". NO sale texto de Postgres
12. En "Ingeniería en Biotecnología", agrega asignatura, pestaña "Ya existe"
    -> El autocompletar NO ofrece Química General ni Microbiología, que ya
       están en ese programa
13. En la pestaña "Nueva", escribe "BIOQUIMICA" (sin acento, en mayúsculas)
    con semestre 4
    -> NO da error de duplicado: reusa la fila de "Bioquímica" que ya existe,
       y aparece bajo 4° con sus dos prácticas
14. Retira una práctica y apaga "Ver retiradas"
    -> Desaparece de la lista. Enciéndelo y vuelve, atenuada
15. Recorre el diálogo de práctica sólo con Tab y envíalo con Enter
    -> Se puede capturar sin soltar el teclado
16. Reduce la ventana a ~1024 px
    -> Las tres columnas siguen cabiendo, cada una con su propio scroll
17. Reduce a ~700 px
    -> Se apilan en vertical, sin scroll horizontal en la página
18. `supabase stop` y recarga
    -> Sale un mensaje entendible, no una pantalla en blanco
```

- [ ] **Paso 3: Comprobar el riesgo de `practica_pareja_valida` contra el remoto**

Lo pide la §9 del spec. `practica_pareja_valida` se añade a una tabla que ya
existe: si producción tiene prácticas con parejas que no están en el plan, la
migración se niega a aplicarse. Se espera cero, porque `/practicas` está en
`disponible: false` y no hay pantalla que las cree — pero eso se comprueba, no
se supone. **Antes de cualquier `supabase db push`:**

```bash
psql "$DATABASE_URL" -c "
select count(*) as practicas_totales,
       count(*) filter (where asignatura_id is not null) as con_asignatura
  from public.practica;"
```

Esperado: `0 | 0`. Si `con_asignatura` sale distinto de cero, **no empujes**:
esas filas hay que revisarlas una por una y decidir si se les da su vínculo en
`programa_asignatura` o si se les pone `asignatura_id` en nulo. Eso es un paso
de limpieza aparte y no entra en este plan.

- [ ] **Paso 4: Commit de cualquier arreglo y abrir el PR**

```bash
git push -u origin feat/panel-academico
gh pr create --title "feat(academico): panel del plan academico para el admin" \
  --body "Implementa docs/specs/2026-09-01-panel-academico-design.md"
```

---

## Anexo · Lo que este plan NO hace

Del spec, §10. Cada uno con su propio ciclo spec → plan:

- La pantalla `/practicas`, que es la que consume todo esto. Sigue en
  `disponible: false`.
- Administración de `motivo_observacion`, `almacen`/`laboratorio`, `perfil`, y
  el motor de `formulario()`.
- El índice global de asignaturas ("¿dónde se usa Química General?").
- La receta de materiales por práctica.
