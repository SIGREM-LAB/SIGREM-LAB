# Diseño · El panel académico del administrador

**1 de septiembre de 2026**

Antecedentes: el esquema vigente es
`2026-08-18-depuracion-esquema-formato-unificado-design.md`. Este documento sí
lo modifica —le quita una columna a `asignatura` y le añade dos tablas y dos
restricciones— y donde se contradigan, manda éste. El layout de referencia es
`referencia/prototipo/src/app/components/Practices.tsx`, que es de donde salen
la cascada programa → semestre → asignatura y el catálogo académico de relleno.

---

## 1 · Qué se decide aquí

La pantalla donde el administrador carga el plan académico: programas
educativos, asignaturas, en qué semestre va cada una, y las prácticas que
define el plan de estudios. Sólo la ve el rol `admin`.

Lo que **no** cubre: registrar el consumo de una práctica —esa es la pantalla
`/practicas`, que sigue en `disponible: false` y que este trabajo desbloquea
sin construirla—, ni la administración de usuarios, laboratorios, motivos de
observación o el motor del formulario dinámico. La §10 los deja anotados.

---

## 2 · El punto de partida, y por qué duele

Cuatro de las cosas que hay que cargar, sólo dos existen:

| Se pidió | En la base al 1 de septiembre |
|---|---|
| Programas educativos | `programa_educativo`, 8 filas en `seed.sql` |
| Asignaturas | `asignatura`, **cero filas**, y nadie en `src/` ni `etl/` la lee |
| Semestres | no existe; el prototipo los tiene fijos en el código |
| Planes de estudio | no existe |
| Prácticas del plan | no existe |

Y una colisión de vocabulario que envenena todo lo demás si no se resuelve
primero: **`public.practica` ya existe y significa otra cosa.** Es un evento
ocurrido —folio `PRA-0001`, fecha, `registrado_por`— cuyos triggers descuentan
existencias y escriben en `movimiento`. Es el documento que respalda un
consumo, no algo que un administrador da de alta.

Lo que el administrador carga es la práctica *tal como la define el plan*:
"Práctica 3: Titulación ácido-base, de Química Analítica". Nunca ha tenido
tabla.

---

## 3 · Decisiones

### D1 · La práctica del plan guarda sólo identidad

`practica_catalogo` lleva asignatura, número, nombre y `activo`. **No** lleva
la receta de materiales, ni el PDF del manual, ni objetivo ni duración.

Una receta de materiales es un dato que se pudre: cambia cada semestre, y el
día que el formulario de registro llega precargado con cantidades viejas, el
responsable corrige a mano y deja de confiar en lo precargado. Sin receta, el
catálogo sólo afirma lo que no cambia —qué prácticas existen y cómo se
llaman— y eso ya vale: convierte teclear el nombre de la práctica en elegirlo
de una lista.

Si algún día hace falta la receta, entra como tabla aparte sin tocar ésta.

### D2 · El nombre: `practica_catalogo`, y `practica` no se toca

Renombrar `practica` a algo como `practica_registro` sería más honesto, porque
la práctica del plan es la que un académico llamaría "la práctica". Pero
arrastraría `movimiento.practica_id`, `practica_elemento`,
`practica_observacion`, dos triggers, el generador de folios y cinco políticas
de RLS, todo ya construido y probado. Mucho radio por un beneficio estético.

`practica_catalogo` sigue el patrón de nombres que el esquema ya usa
—`motivo_observacion`, `campo_capturable`, `articulo_alias`—. Se descartó
`practica_plan`, que sugiere el plan de estudios versionado que D4 rechaza.

### D3 · El semestre vive en la relación, no en la asignatura

El catálogo del prototipo lo demuestra solo:

```
"Química General"  → 1° en seis programas distintos
"Mineralogía"      → 2° en Geología Ambiental,  2° en Minero Metalúrgica
"Bioquímica"       → 2° en Lic. Biología,  6° en Lic. Química,  3° en Qca. de Alimentos
```

`Bioquímica` es 2°, 6° y 3° al mismo tiempo. Una columna `semestre` en
`asignatura` no tendría un valor correcto que poner ahí. **El semestre es un
atributo de la pareja (programa, asignatura)**, así que vive en una tabla
puente.

Eso además respeta la decisión que el esquema ya había tomado y documentado en
`20260818120400_practica.sql:19`: la asignatura existe una sola vez, y forzar
el vínculo obligaría a duplicarla una vez por programa.

**Contrapartida aceptada:** las prácticas cuelgan de `asignatura`, no de la
pareja. Las prácticas de "Química General" son las mismas para los seis
programas que la comparten. Eso es coherente con la premisa de la tabla
puente —mismo nombre, mismo curso—, y es justo por lo que se comparte: la
surte el mismo laboratorio. Si resultara falso, la salida es aditiva: una
columna `programa_educativo_id` nullable en `practica_catalogo`, sin migrar
nada de lo existente.

### D4 · Sin planes de estudio versionados

Se consideró un nivel intermedio `plan_estudio` con clave y vigencia, para que
"Química, plan 2018" y "plan 2024" convivan y los reportes históricos citen el
plan correcto. Se descarta: nadie ha pedido conservar planes derogados, y el
nivel extra se paga en cada consulta y en cada pantalla. "Plan de estudios",
en este sistema, es el conjunto de vínculos de un programa.

### D5 · Captura fila por fila, sin importador

La pantalla es alta, edición y retiro unitarios. Se consideró un importador de
pegar-desde-Excel con vista previa y validación, y se descartó dos veces: la
primera por volumen —después de la carga inicial se usaría dos veces al año—,
y la segunda al descubrir la §7, que quita la carga inicial de la mesa.

### D6 · Cascada maestro-detalle, no pestañas

Una ruta, tres columnas encadenadas. Los datos son una jerarquía y la captura
es inherentemente en cascada: eliges programa, luego asignatura, luego añades
sus prácticas. Una pantalla que refleja eso no necesita explicarse.

Y hace visible el modelo de D3 donde importa: "crear una asignatura nueva" y
"vincular una que ya existe" son dos botones distintos, y esa diferencia es
exactamente lo que la tabla puente modela.

**Contrapartida aceptada:** una asignatura compartida se ve una vez bajo cada
programa, y no hay pantalla donde ver "Química General" y sus seis vínculos de
un vistazo. Se consideró una segunda ruta con ese índice y se descartó por
YAGNI: la pregunta "¿dónde se usa?" todavía no la ha hecho nadie.

---

## 4 · Esquema

### Las dos tablas nuevas

```sql
create table public.programa_asignatura (
  programa_educativo_id bigint   not null references public.programa_educativo (id) on delete cascade,
  asignatura_id         bigint   not null references public.asignatura (id)         on delete cascade,

  -- Nullable a proposito: el catalogo del prototipo trae "Optativa" como
  -- semestre de Biologia Marina y Biotecnologia. No es un numero, y forzar uno
  -- obligaria a inventarlo. NULL = optativa.
  semestre              smallint,

  primary key (programa_educativo_id, asignatura_id),
  constraint programa_asignatura_semestre_valido
    check (semestre is null or semestre between 1 and 12)
);

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
```

`practica_catalogo.asignatura_id` va **sin** `on delete cascade`: retirar una
práctica es `activo = false`, que es el patrón que ya usan `almacen`,
`laboratorio`, `asignatura` y `motivo_observacion`. `programa_asignatura` sí
cascadea porque es puro vínculo, sin historia que perder.

### Lo que se le quita a `asignatura`

```sql
alter table public.asignatura
  drop constraint asignatura_programa_educativo_id_nombre_key,
  drop column programa_educativo_id;      -- se lleva asignatura_programa_idx

create unique index asignatura_nombre_norm_idx
  on public.asignatura (public.norm_texto(nombre));
```

El único va sobre `norm_texto(nombre)` y no sobre `nombre`: sin eso
"Bioquímica" y "bioquimica" son dos asignaturas, y a las tres semanas hay
cuatro. `norm_texto` es `immutable` —por eso `base.sql` la declaró con el
diccionario explícito—, así que se puede indexar.

La migración copia los vínculos existentes a `programa_asignatura` con
`semestre` nulo **antes** de tirar la columna. Al 1 de septiembre la tabla está
vacía y ningún código la lee, pero una migración no puede asumirlo.

### Los dos enganches con `practica`

```sql
alter table public.practica
  add column practica_catalogo_id bigint references public.practica_catalogo (id);

-- La pareja (programa, asignatura) tiene que existir en el plan.
alter table public.practica
  add constraint practica_pareja_valida
  foreign key (programa_educativo_id, asignatura_id)
  references public.programa_asignatura (programa_educativo_id, asignatura_id);

-- Y la practica elegida tiene que ser de esa asignatura.
alter table public.practica
  add constraint practica_catalogo_coincide
  foreign key (practica_catalogo_id, asignatura_id)
  references public.practica_catalogo (id, asignatura_id);
```

Las dos son FK compuestas con `MATCH SIMPLE`, que es el comportamiento por
omisión: **si `asignatura_id` es nulo, la restricción se satisface sin
verificar nada.** Eso es exactamente lo que hace falta, porque
`practica.asignatura_id` es nullable y debe seguir siéndolo; pero en cuanto se
llena, la base garantiza que la combinación es real.

Sin `practica_pareja_valida`, nada impide registrar una práctica de "Titulación
ácido-base" bajo Ingeniería Industrial. Es la misma técnica con la que el
esquema ya ata una `existencia` a un laboratorio de su propio almacén, y la
razón por la que `programa_asignatura` tiene esa llave primaria y
`practica_catalogo` esa llave candidata.

### La función que la pantalla necesita

Crear una asignatura nueva son dos inserts —la fila y el vínculo— y desde el
cliente no son atómicos: si el segundo falla queda una asignatura huérfana
flotando en el autocompletar.

```sql
create or replace function public.vincular_asignatura(
  p_programa bigint, p_nombre text, p_semestre smallint default null
) returns bigint
language plpgsql
security invoker
set search_path = ''
```

Busca la asignatura por `norm_texto(nombre)`, la crea si no está, inserta el
vínculo y devuelve el `asignatura_id`. Una ida y vuelta, atómica, y de paso
resuelve el caso que el cliente haría mal: capturar "Bioquimica" cuando ya
existe "Bioquímica" reusa la que hay en vez de chocar contra el índice único.

`security invoker` y no `definer`, por lo mismo que `resolver_pendiente`: la
función no le presta a nadie privilegios que no tenga. Un responsable que la
llame recibe `42501`.

---

## 5 · RLS

Las dos tablas nuevas caen en el patrón que `rls.sql:207` ya llama "catálogos
cerrados: todos leen, sólo admin escribe", con el comentario que lo justifica:
cambiar uno afecta a los cuatro almacenes a la vez.

```sql
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

**Ninguna de las dos lleva `almacen_id`, y es deliberado.** El plan de estudios
no pertenece a un almacén: la misma "Química Analítica, 3°" la surten N3 y N4
según dónde se dé la clase. Desnormalizar un almacén aquí inventaría una
pertenencia que no existe y rompería el caso real de una asignatura que consume
de dos almacenes.

La lectura abierta a todo `authenticated` es lo que hace funcionar la futura
pantalla de registro: si un responsable no pudiera leer el catálogo, sus tres
selects saldrían vacíos. Mismo razonamiento que `rls.sql:294` escribe para
`campo_capturable`.

Los privilegios de tabla no hay que otorgarlos: el `alter default privileges`
de `20260814100000_grants_authenticated.sql` ya cubre lo que cree el rol de
migraciones.

### Dos huecos, por escrito

**Las FK compuestas de la §4 no pasan por RLS.** Postgres evalúa la integridad
referencial como si fuera el dueño de la tabla, saltándose las políticas.
Normalmente eso es un oráculo de existencia; aquí las dos tablas son legibles
por todo `authenticated`, así que no hay nada que filtrar. No es un problema en
este diseño, y sí lo sería si algún día el catálogo se acotara por almacén.

**`for all` incluye `delete`.** Un admin puede borrar un `programa_asignatura`.
Si alguna práctica registrada usa esa pareja, `practica_pareja_valida` bloquea
el borrado, que es lo correcto y sale gratis. Si nadie la ha usado, se borra sin
más. Se acepta: es un catálogo del que el admin es dueño, y el error se deshace
volviéndolo a vincular.

---

## 6 · La pantalla

### Ruta y guardia

`/administracion/academico`, dentro de `RutaProtegida` → `Layout`. Hace falta
una guardia por rol, que hoy no existe:

```tsx
// src/features/auth/RutaProtegida.tsx — tercer export, junto a los dos que ya viven ahí
export function SoloAdmin() {
  const { data: perfil, isPending } = usePerfil()

  // Mismo motivo que en RutaProtegida: mientras el perfil está en vuelo no se
  // decide nada. Redirigir aquí echaría al admin a la portada en cada F5.
  if (isPending) return null
  if (perfil?.rol !== 'admin') return <Navigate to="/" replace />

  return <Outlet />
}
```

**Es comodidad, no seguridad.** Quien edite el bundle llega a la ruta igual; lo
que lo detiene son las políticas de la §5. La guardia existe para que un
responsable no vea una pantalla que le va a fallar en cada botón.

### Estructura

```
src/features/academico/
  PaginaAcademico.tsx     Ruta. Dueña de la selección. Apila en móvil.
  seleccion.ts            Reductor puro de {programaId, asignaturaId}.
  seleccion.test.ts
  ColumnaAcademica.tsx    Cascarón: título, lista con scroll, vacío, pie de acciones.
  ListaProgramas.tsx
  ListaAsignaturas.tsx    Agrupa por semestre.
  ListaPracticas.tsx
  DialogoPrograma.tsx
  DialogoAsignatura.tsx   Dos modos: crear nueva | vincular existente.
  DialogoPractica.tsx
  consultas.ts            useQuery / useMutation
  esquemas.ts             zod
```

Se editan además `App.tsx` (la ruta), `RutaProtegida.tsx` (`SoloAdmin`),
`navegacion.ts` y `navegacion.test.ts`.

`ColumnaAcademica` existe porque las tres columnas comparten el cascarón
—título, subtítulo, lista con scroll, estado vacío, pie con botones— y difieren
sólo en el contenido. Sin ella ese cascarón se copia tres veces y a la segunda
ya divergió.

`seleccion.ts` como módulo puro con su prueba sigue lo que el repo ya hace con
`filtros.ts`, `menu.ts` y `pendientes.ts`. Y protege el bug clásico de las
cascadas, que el propio prototipo tuvo que parchear a mano en
`Practices.tsx:392`: **elegir otro programa tiene que limpiar la asignatura y
la práctica.** Si no, la columna 3 sigue mostrando las prácticas de la
selección anterior, que ya no cuelgan de nada visible.

### Datos

```
useProgramas()                        programa_educativo, orden por nombre
useAsignaturasDePrograma(programaId)  programa_asignatura → semestre + asignatura(id, nombre)
usePracticas(asignaturaId)            practica_catalogo, orden por numero
useAsignaturas()                      todas, para el autocompletar de "vincular"
```

`useAsignaturas()` trae la lista completa y el filtrado de "las que este
programa aún no tiene" ocurre en el cliente. Con decenas de filas es lo
correcto: PostgREST no expresa bien un `NOT IN (subconsulta)`, y montar una
vista sería pagar una migración por un `filter` de JavaScript.

Cada `queryKey` lleva su id (`['asignaturas-de-programa', programaId]`). Sin
eso, cambiar de programa devuelve la caché del anterior. Las mutaciones
invalidan sólo lo que ensucian.

### Los errores, en español

Las restricciones de la §4 son la última línea, pero nadie debería leer un
`23505`. Un traductor pequeño en `consultas.ts`, y `Snackbar` para mostrarlo:

| Código | Restricción | Lo que se ve |
|---|---|---|
| `23505` | `asignatura_nombre_norm_idx` | "Ya existe una asignatura con ese nombre" |
| `23505` | `practica_catalogo_asignatura_id_numero_key` | "Ya hay una práctica número 3 en esta asignatura" |
| `23505` | `programa_asignatura_pkey` | "Esta asignatura ya está en el programa" |
| `23503` | cualquiera | "No se puede borrar: hay prácticas registradas que lo usan" |
| `23514` | `programa_asignatura_semestre_valido` | "El semestre va del 1 al 12" |

### Detalles que no se ven en un boceto

**El semestre nulo.** El `Select` ofrece 1° a 12° más "Optativa"; "Optativa"
guarda `null`. En la columna 2 los grupos se ordenan por semestre y **Optativa
va al final**, no al principio, que es donde lo pondría un `order by semestre`
ingenuo.

**Retirar, no borrar.** Los botones dicen "Retirar" y ponen `activo = false`,
con un interruptor "Ver retiradas" en el pie de cada columna, apagado por
omisión. El `delete` real sólo se ofrece para `programa_asignatura`.

**A 1024 px**, que es la resolución de las máquinas del almacén, tres columnas
de ~340 px caben. Abajo de `md` se apilan (`Grid size={{ xs: 12, md: 4 }}`).

**El menú.** `navegacion.ts` gana una entrada en el grupo `administracion`,
sólo para `admin`, con `disponible: true`. `/practicas` sigue en `false`: este
trabajo la desbloquea, no la construye.

---

## 7 · Datos de prueba, y por qué no hay carga inicial

La intención original era sembrar el plan completo —del orden de 400 filas— de
una vez, y que la pantalla sirviera sólo para correcciones. **No hay de dónde
sacar esas filas.** Los dos catálogos que existen en el repo no se parecen:

```
seed.sql:125  (8 programas)          prototipo Practices.tsx:31  (11 programas)
─────────────────────────────        ────────────────────────────────────────
Ing. en Alimentos                    Bachillerato Biología / Física / Química
Ing. en Biotecnología                Ingeniería Civil
Ing. Industrial            ────────  Ingeniería Industrial      ← el único que coincide
Ing. en Electrónica y Telecom.       Ing. en Geología Ambiental
Ing. Mecánica                        Ingeniería en Materiales
Química en Alimentos                 Ing. Minero Metalúrgica
Químico Farmacéutico Biólogo         Licenciatura en Biología
Ing. en Tecnologías del Software     Licenciatura en Química
                                     Química de Alimentos
```

De once por ocho coincide uno. Los del `seed.sql` parecen los programas reales
de la UAEH; los del prototipo son de relleno, y además no traen ni una sola
práctica. Importarlos llenaría la base de programas que no existen.

**Decisión: el plan real se carga desde la pantalla, desde cero.** Lo que entra
al repo son datos de prueba, y van **sólo en `seed.sql`**. No se crea un
archivo para el remoto y no se toca `datos-iniciales.sql`, que se queda con sus
8 programas y nada más.

La garantía de que esto no llega a producción sale por construcción, no por
disciplina: `seed.sql` lo corre únicamente `supabase db reset` en local —su
primera línea lo dice, y es la misma razón por la que los seis usuarios de
prueba con contraseña conocida viven ahí y no en el remoto—. Producción arranca
sin una sola asignatura porque nunca le llegan.

Los datos se eligen para ejercitar los casos raros, no para verse llenos:

```
Química en Alimentos          Químico Farmacéutico Biólogo    Ing. en Biotecnología
  1°  Química General ─────┬────  1°  Química General ────┬───  1°  Química General
  3°  Bioquímica ──────┐   │      6°  Bioquímica ─────────┘     2°  Microbiología
  5°  Análisis de Alim. │   │      4°  Farmacognosia
  --  Bromatología      │   │
                        └───┴──> la misma fila de asignatura, dos semestres distintos
```

| Lo que prueba | Cómo |
|---|---|
| Que la tabla puente sirve de algo | `Bioquímica` es una fila, 3° en QA y 6° en QFB |
| Que el semestre nulo ordena al final | `Bromatología` entra como Optativa |
| El estado vacío de la columna 3 | `Bromatología` y `Farmacognosia`, sin prácticas |
| Las FK compuestas de la §4 | Hay parejas válidas contra las que registrar prácticas |

Seis asignaturas, nueve vínculos, siete prácticas.

---

## 8 · Pruebas

### RLS — `rls.test.sql`, de `plan(62)` a `plan(71)`

La prueba de cobertura que ya existe (`rls.test.sql:76`, "ninguna tabla de
public se queda sin RLS") atrapa sola el olvido de `enable row level security`.
Lo que no atrapa es olvidar las *políticas*: sin ellas la tabla niega todo, que
falla seguro pero en silencio. Esas van explícitas.

| Prueba | Cómo falla |
|---|---|
| El responsable de N3 lee `programa_asignatura` | 0 filas → el formulario de prácticas sale vacío |
| El responsable de N3 lee `practica_catalogo` | ídem |
| El responsable **no** inserta en `programa_asignatura` | `42501` |
| El responsable **no** inserta en `practica_catalogo` | `42501` |
| El responsable **no** edita una `practica_catalogo` | 0 filas, sin error (`USING` falso) |
| El responsable **no** borra un vínculo | 0 filas, sin error |
| El admin inserta y edita en las dos | debe pasar |
| `anon` no lee ninguna de las dos | `42501` |

Más la de `vincular_asignatura`, calcada de la que ya existe para
`resolver_pendiente`: un responsable que la llame recibe `42501`.

### Esquema — `esquema.test.sql`, de `plan(53)` a `plan(59)`

Éstas son las que más importan, porque prueban las restricciones de la §4, que
es la parte del diseño con más que salir mal:

| Prueba | Por qué |
|---|---|
| Una `practica` con pareja (programa, asignatura) que **no** está en el plan → `23503` | Es la razón de existir de `practica_pareja_valida` |
| Una `practica` con `asignatura_id` **nulo** → **pasa** | Confirma el `MATCH SIMPLE` |
| Una `practica` cuyo `practica_catalogo_id` es de **otra** asignatura → `23503` | La llave candidata `unique (id, asignatura_id)` |
| `semestre = 0` y `semestre = 13` → `23514` | El check |
| Insertar "Bioquímica" y luego "bioquimica" → `23505` | El índice sobre `norm_texto(nombre)` |
| Dos prácticas número 3 en la misma asignatura → `23505` | `unique (asignatura_id, numero)` |

La segunda es la que más vale, porque prueba que algo **sigue funcionando** en
vez de que algo falla. Sin ella, un día alguien "arregla" la FK poniéndole
`match full` y rompe en silencio el registro de prácticas sin asignatura.

### Pantalla — vitest

`seleccion.test.ts` — elegir otro programa limpia la asignatura y la práctica;
elegir otra asignatura limpia la práctica pero conserva el programa.
`ListaAsignaturas.test.tsx` — agrupa por semestre y Optativa queda al final.
`RutaProtegida.test.tsx` — se extiende: `consulta` y `responsable` rebotan de
`/administracion/academico` a `/`.
`navegacion.test.ts` — la entrada aparece para `admin` y no para los otros dos
roles.

---

## 9 · Riesgos

**El archivo de grants sin commitear.**
`supabase/migrations/20260814100000_grants_authenticated.sql` está sin versionar
y su marca de tiempo es `20260814`, anterior al baseline
`20260818120000_base.sql`. Las migraciones corren por orden de nombre, así que
es la primera, y su última línea es
`revoke update, delete on public.movimiento from authenticated;` — cuando
`movimiento` todavía no existe. Un `supabase db reset` limpio debería fallar
ahí. No es parte de este diseño, pero **si el reset está roto, ninguna prueba
de este spec se puede correr**: es lo primero que hay que verificar al empezar.

**`practica_pareja_valida` sobre datos existentes.** Es una restricción que se
añade a una tabla que ya existe. Si producción tiene prácticas con parejas que
no están en el plan, la migración se niega a aplicarse. Eso es lo correcto
—falla ruidosa antes que datos incoherentes— pero hay que saberlo antes de
empujar. `/practicas` está en `disponible: false` y no hay pantalla que las
cree, así que se espera cero; se verifica con un `count(*)` contra el remoto
antes del push, y si sale distinto de cero el plan gana un paso de limpieza.

**Regenerar tipos.** La migración quita una columna que `src/types/database.ts`
declara. `pnpm gen:types` es obligatorio y el `pnpm typecheck` lo delata si se
olvida.

---

## 10 · Lo que queda fuera

Cinco bloques de datos que la RLS reserva a `admin` y que siguen sin pantalla,
cada uno con su propio ciclo spec → plan:

| Bloque | Tablas | Nota |
|---|---|---|
| Motivos de observación | `motivo_observacion` | CRUD de cuatro columnas; el más barato |
| Organización | `almacen`, `laboratorio` | `laboratorio` es de donde el trigger deriva el almacén de una práctica |
| Usuarios y roles | `perfil` | El más delicado: toca auth, y hay que impedir que el último admin se degrade a sí mismo |
| Formulario dinámico | `campo_capturable`, `perfil_captura`, `perfil_campo` | El motor de `formulario()` |
| Artículos | `articulo`, `articulo_alias` | Ya tiene pantalla parcial |

Y la pantalla `/practicas` en sí, que es la que consume todo lo que este
documento construye.
