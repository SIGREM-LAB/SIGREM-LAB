# Diseño · Módulo de administración, entrega 1

**21 de septiembre de 2026**

El sistema sabe administrar dos cosas: el plan de estudios
(`/administracion/educativo`) y los usuarios (`/usuarios`). Todo lo demás que
alguien tendría que poder cambiar sin pedir una migración —los laboratorios de
cada almacén, los motivos de observación, las constantes NOM de un almacén— hoy
solo se cambia editando `supabase/seed.sql` y volviendo a desplegar.

Este documento cubre **la primera entrega**: los laboratorios, los motivos y la
ficha NOM del almacén, más la casa donde van a vivir esos y los que falten. La
§10 dice cuáles son los que faltan y en qué orden.

---

## 1 · Qué se decide aquí

Que un laboratorio se pueda **dar de alta desde la aplicación**, para que
aparezca en el selector de Prácticas sin pasar por una migración; que el
responsable de un almacén pueda hacerlo **en el suyo**; y que el bloque de
Administración deje de ser una lista plana en la barra lateral antes de que
crezca a ocho entradas.

---

## 2 · El punto de partida

`laboratorio` existe desde el baseline
(`20260818120100_organizacion.sql:32`) y **ya está conectado de punta a punta**:

- `existencia` lo referencia con una FK compuesta `(laboratorio_id, almacen_id)`
  contra la llave candidata `laboratorio (id, almacen_id)`. Por construcción,
  una existencia de N3 no puede apuntar a un laboratorio de N4.
- `practica.laboratorio_id` es `not null`, y un trigger deriva de ahí el
  `almacen_id` de la práctica: *«El cliente NO decide el almacén: se deriva del
  laboratorio»* (`20260818120400_practica.sql:91`).
- `useLaboratorios()` (`src/features/practicas/consultas.ts:173`) ya filtra por
  el almacén del perfil y por `activo = true`.
- La RLS ya está escrita: todos leen, solo el admin escribe (`rls.sql:38`).

**Lo único que falta es la pantalla.** No hay un solo `insert` ni `update` a
`laboratorio` en `src/`. Los cinco laboratorios que existen están ahí porque los
puso el seed, y uno de ellos se llama, literal, *«Laboratorio de docencia N3
(por confirmar)»* — un marcador que lleva un mes esperando a que el responsable
de N3 diga el nombre real, y que hoy solo se corrige con una migración.

El mismo síntoma, más caro, en otra tabla: `20260917120000_almacen_icsa.sql` dio
de alta el quinto almacén con `uso_principal`, `zona_riesgo` y
`personas_expuestas` en NULL, y su comentario dice *«hasta que el responsable las
confirme»*. Esos tres campos los reinyecta el exportador en **cada renglón** del
formato unificado. Hoy esa confirmación tampoco cabe en ningún lado.

### 2.1 · Qué más no tiene dónde administrarse

| Qué | Tabla | Quién lo escribe hoy | Qué duele |
|---|---|---|---|
| Laboratorios | `laboratorio` | nadie, solo el seed | §3 en adelante |
| Ficha NOM del almacén | `almacen.uso_principal`, `zona_riesgo`, `personas_expuestas` | nadie | sale en cada renglón del formato exportado; ICSA la tiene vacía |
| Motivos de observación | `motivo_observacion` | nadie, solo el seed | se hizo tabla *para* que agregar un motivo fuera un insert y no una migración; sigue siendo una migración |
| Ubicaciones | `ubicacion` | se crean solas al dar de alta o depurar, desde el texto del renglón | cada typo crea una ubicación nueva y nadie puede renombrar ni fusionar |
| Curación del catálogo | `articulo.verificado`, `articulo_alias` | un responsable crea artículos; nacen `verificado = false` y solo el admin puede verificar o fusionar, pero no hay dónde | el catálogo se fragmenta sin freno |
| Formulario de alta | `perfil_captura`, `perfil_campo`, `campo_capturable` | nadie | la regla del proyecto dice que el formulario se arma desde la base, pero cambiarlo sigue siendo una migración |

**Fuera de la lista a propósito:** `hoja_formato` y `columna_formato`. Ahí la RLS
niega escritura a todo el mundo y el comentario lo dice —*«cambiarlo es una
migración»* (`20260921120100_formato_unificado.sql:176`)—. Es una decisión
tomada, no un hueco.

---

## 3 · Decisiones

### D1 · Un laboratorio pertenece a exactamente un almacén

Se confirmó que no hay laboratorios surtidos por dos almacenes. Si alguno lo
fuera algún día, se registra una vez en cada almacén y en Prácticas aparece bajo
el que corresponde.

Lo contrario —un laboratorio con N almacenes— obligaría a una tabla puente, a
soltar la FK compuesta de `existencia` (que es lo único que hoy impide cruzar
almacenes por construcción) y a que la práctica preguntara su almacén aparte,
porque ya no se podría derivar. El esquema actual se queda intacto.

### D2 · Los laboratorios los administra el responsable de su almacén

El laboratorio es un dato **local**: quien lo surte sabe qué laboratorios
atiende. Que agregar «Laboratorio de enseñanza 7» a N4 tenga que pasar por el
admin convierte una anotación de dos segundos en un ticket.

Es exactamente el reparto que ya tiene `ubicacion` (`rls.sql:80`), y por la misma
razón: es dato de almacén, no de la Unidad.

### D3 · La ficha NOM la confirma el responsable de su propio almacén

Lo pedía ya el comentario de la migración de ICSA. Son tres constantes que
describen el almacén físico —para qué se usa, qué zona de riesgo es, cuánta
gente hay expuesta— y quien las sabe es quien trabaja ahí.

**Y con eso, «la clave no se edita» deja de ser convención de la interfaz.** Se
revoca el `update` completo sobre `almacen` y se otorga por columnas, igual que
ya hace `20260821120000_inventario_consulta.sql:61` con `existencia`. La base
deja de permitir que nadie —admin incluido— cambie `clave` o `activo` desde la
aplicación.

### D4 · Nunca se borra: se retira

Alta, renombrar y `activo = false`. Ningún `delete`. Las existencias y las
prácticas ya registradas apuntan a los laboratorios por `id`, y un borrado o
fallaría con `23503` o se llevaría historial por delante. Es el mismo patrón
que ya usan `programa_educativo`, `asignatura` y `practica_catalogo`.

`useLaboratorios()` ya filtra por `activo = true`, así que retirar un
laboratorio lo saca del selector de Prácticas **sin tocar Prácticas**.

### D5 · No se dan de alta almacenes desde la aplicación

Se editan los cinco que hay. Crear un almacén es un acto estructural —ICSA entró
por migración— y no es algo que la pantalla tenga por qué ofrecer. Se puede
agregar el día que haga falta.

### D6 · `almacen.activo` no aparece en la pantalla

Lo lee exactamente un sitio: `useAlmacenesActivos()`
(`src/features/usuarios/consultas.ts:10`), para decidir qué almacenes se le
pueden asignar a un usuario. Un switch rotulado «Activo» prometería *cerrar un
almacén* y lo único que haría es esconderlo de ese select. Un control con radio
de acción indefinido es peor que no tenerlo.

### D7 · Administración se vuelve un índice, no seis entradas de menú

El bloque Administración de la barra lateral tiene hoy tres entradas. Con las
seis piezas de la §2.1 llegaría a nueve, y el menú dejaría de servir para
navegar.

En su lugar: **una entrada, «Administración», que abre un índice con tarjetas**,
igual que el Menú principal lista los módulos. El índice crece sin volver a
tocar el menú. Programa educativo y Usuarios se mudan ahí; cuestan un clic más y
dejan de competir por espacio con el trabajo diario.

La alternativa de una sola pantalla «Catálogos» con pestañas se descartó: se
rompe en el siguiente ciclo, cuando ubicaciones —que necesita *fusionar*, no solo
editar— y la curación del catálogo pidan pantalla completa. Y «dame el enlace
para dar de alta el laboratorio» deja de ser un enlace.

### D8 · Los laboratorios se administran dentro de su almacén, no aparte

Un laboratorio no existe sin su almacén: es la FK compuesta de la D1. Una
pantalla de laboratorios suelta necesitaría igual un selector de almacén arriba
—o sea, dibujar el almacén dos veces— y la pantalla de la ficha NOM, con cinco
filas de tres campos, quedaría anémica.

Una sola pantalla, **«Almacenes y laboratorios»**, con el almacén como sujeto y
sus laboratorios debajo.

---

## 4 · El esquema

Un archivo: `supabase/migrations/20260921120600_administracion_almacen.sql`.

### 4.1 · Laboratorio: escritura del responsable

```sql
drop policy laboratorio_admin on public.laboratorio;

create policy laboratorio_escritura on public.laboratorio
  for all to authenticated
  using      ((select private.es_admin())
              or almacen_id = (select private.almacen_actual()))
  with check ((select private.es_admin())
              or almacen_id = (select private.almacen_actual()));
```

Es la forma exacta de `ubicacion_escritura`. **No necesita un `puede_escribir()`
encima**, y la razón está en `20260909130000_almacen_solo_responsable.sql`: con
`perfil_almacen_solo_responsable`, tener almacén y ser responsable son lo mismo.
Un usuario de consulta no puede tener `almacen_id`, así que `almacen_actual()` le
devuelve NULL y el segundo disyuntivo nunca es cierto para él.

Esa migración lo dice con todas sus letras: *«Todas las políticas que consultan
`almacen_actual()` son de escritura y van precedidas de `es_admin()` o de
`puede_escribir()`... Solo el responsable depende de ese valor»*. Esta política
cae dentro de esa afirmación y no la debilita.

El `UPDATE` queda cubierto por los dos lados: el `USING` decide si el responsable
**ve** la fila que quiere mover, y el `WITH CHECK` decide si el valor nuevo le
corresponde. Mover un laboratorio de N3 a N4 falla por el primero; crear uno
directamente en N3 falla por el segundo.

### 4.2 · Almacén: ficha del responsable, y por columnas

```sql
create policy almacen_ficha_propia on public.almacen
  for update to authenticated
  using      (id = (select private.almacen_actual()))
  with check (id = (select private.almacen_actual()));

revoke update on public.almacen from authenticated;
grant  update (nombre, uso_principal, zona_riesgo, personas_expuestas)
  on public.almacen to authenticated;
```

`almacen_admin` se queda como está: el admin sigue pudiendo editar la ficha de
cualquiera. Lo que cambia para él, igual que para todos, es que `clave` y
`activo` ya no se pueden escribir desde la aplicación — son ahora un privilegio
que `authenticated` no tiene, no una casilla que la interfaz decidió no dibujar.

Los dos niveles siguen siendo independientes y hacen falta los dos, tal como lo
explica `20260814100000_grants_authenticated.sql`: el privilegio dice *qué
columnas*, la política dice *qué filas*.

### 4.3 · Lo que no cambia

`motivo_observacion` se queda admin-only (`rls.sql:223`): es un catálogo de la
Unidad, no de un almacén. Y no hacen falta grants nuevos para ninguna de las tres
tablas: el `alter default privileges` de
`20260814100000_grants_authenticated.sql` ya alcanzó a todo lo creado después.

---

## 5 · Las pantallas

### 5.1 · `/administracion` — el índice

Tarjetas, una por sección, con el mismo molde que el Menú principal.
`menuDeNavegacion` (`src/app/navegacion.ts`) ya guarda `etiqueta`, `icono`,
`descripcion`, `color` y `disponible` por entrada; el índice se arma de una
lista con esa misma forma, en ese mismo archivo, y no estrena componente.

Las tarjetas se filtran por rol, como ya se filtra el menú:

| Tarjeta | Admin | Responsable | Consulta |
|---|---|---|---|
| Almacenes y laboratorios | sí | sí | no |
| Motivos de observación | sí | no | no |
| Programa educativo | sí | no | no |
| Usuarios | sí | no | no |

Un responsable que entre ve una sola tarjeta. Es correcto: es la única que puede
usar, y la entrada «Administración» aparece en su barra lateral por eso.

### 5.2 · `/administracion/almacenes` — Almacenes y laboratorios

Dos columnas, con `ColumnaAcademica` (`src/features/academico/`), que es el molde
que ya existe para esto.

**Izquierda — los almacenes.** Clave y nombre por renglón, seleccionable. Los que
tengan la ficha NOM incompleta van marcados; hoy eso señala a ICSA, que es el
pendiente real. El responsable ve **solo el suyo**, ya seleccionado.

Ese filtro es decisión de la pantalla, no de la RLS: `almacen_lectura`
(`rls.sql:30`) deja que cualquiera con sesión lea los cinco. Enseñarle al
responsable cuatro almacenes que no puede tocar sería ruido, no seguridad —lo
que de verdad lo detiene si llega ahí es la §4.2—.

**Derecha, arriba — la ficha del almacén.** `nombre`, `uso_principal`,
`zona_riesgo`, `personas_expuestas`, con `react-hook-form` + `zod`. `clave` se
muestra y no se edita (D3). `activo` no aparece (D6).

**Derecha, abajo — los laboratorios de ese almacén.** Alta, renombrar y retirar.
Switch «Ver retirados» a nivel página, igual que en Programa Educativo. La
unicidad la impone `unique (almacen_id, nombre)` y el mensaje la traduce.

**El diálogo de renombrar lleva una advertencia.** Las existencias y prácticas ya
registradas apuntan por `id`, así que renombrar no las mueve. Pero el cargador de
Excel y el alta de existencia resuelven el laboratorio **por nombre
normalizado** (`20260910120000_alta_existencia.sql:411`,
`20260826130000_resolver_pendiente.sql:588`): renombrar cambia qué renglones de
Excel futuros van a hacer match. Es texto de ayuda, no un bloqueo — quien
renombra suele estar corrigiendo justamente un nombre que no hacía match.

### 5.3 · `/administracion/motivos` — Motivos de observación

Una columna, solo admin. `clave`, `etiqueta`, `orden`, `activo`. La `clave` es la
PK de texto: se captura al crear y después no se edita. Retirar es
`activo = false`, porque `practica_observacion` apunta por clave.

---

## 6 · Navegación y rutas

```
/administracion              índice
/administracion/almacenes    Almacenes y laboratorios   ← nueva
/administracion/motivos      Motivos de observación     ← nueva
/administracion/educativo    Programa educativo         (sin cambios)
/administracion/usuarios     Usuarios                   (se muda desde /usuarios)
```

`/usuarios` queda como un `<Navigate replace to="/administracion/usuarios" />`,
para no romper enlaces que ya anden circulando.

`/administracion` y `/administracion/almacenes` **cambian `SoloAdmin` por
`SoloOperacion`**, la guardia que ya usa `/reportes` y que deja pasar a admin y
responsable (`RutaProtegida.tsx:122`). Un usuario de consulta no tiene almacén
—y por la §4.1 no puede tenerlo—, así que no habría una sola fila que pudiera
escribir: se le manda a `/` en vez de enseñarle una pantalla muerta. Las otras
tres rutas siguen con `SoloAdmin`.

Como siempre, la guardia es comodidad y la RLS es la seguridad: quien
edite el bundle llega a la ruta igual, y lo que lo detiene es que la política
niegue la fila.

De paso se consolida un bloque duplicado: hoy `/usuarios` vive en su propio
`RutaProtegida` → `SoloAdmin` → `Layout`, repitiendo los tres envoltorios que el
resto de las rutas ya tiene.

El bloque Administración de la barra lateral queda en dos entradas: **Reportes**
y **Administración**.

---

## 7 · Consultas y caché

`src/features/administracion/consultas.ts`, con el molde de
`academico/consultas.ts`: `useQuery` y `useMutation` de react-query,
`react-hook-form` + `zod` en los diálogos, y un `mensajeDeError` propio que
traduzca `23505` sobre `laboratorio_almacen_id_nombre_key` y sobre
`motivo_observacion_pkey`, más `23503`. Lo desconocido se deja pasar con su
mensaje original, por la misma razón que ya explica el de Académico.

**Invalidación entre módulos.** Al escribir en `laboratorio` hay que invalidar
también las claves de los dos módulos que lo leen:

- `['practicas', 'laboratorios', ...]` (`src/features/practicas/consultas.ts:179`)
- la del alta de inventario (`src/features/inventario/consultas.ts:469`)

Sin eso, el selector de Prácticas sigue mostrando la lista vieja hasta que
caduque el `staleTime` de 30 s, y quien acaba de dar de alta el laboratorio jura
que no se guardó.

---

## 8 · Pruebas

**`supabase test db`** — en `supabase/tests/database/rls.test.sql`, subiendo el
`plan()`. Los dos modos de falla van separados, como advierte el encabezado de
ese archivo: `USING` falso da 0 filas sin error, `WITH CHECK` falso da `42501`.

| Caso | Esperado |
|---|---|
| Responsable de N4 crea laboratorio en N4 | pasa |
| Responsable de N4 crea laboratorio en N3 | `42501` |
| Responsable de N4 mueve un laboratorio de N3 a N4 | 0 filas, sin error |
| Consulta intenta crear un laboratorio | `42501` |
| Admin crea laboratorio en cualquier almacén | pasa |
| Responsable de N4 edita la ficha NOM de N4 | pasa |
| Responsable de N4 edita la ficha NOM de N3 | 0 filas, sin error |
| Cualquiera intenta escribir `almacen.clave` | `42501` — falta el privilegio |
| Responsable intenta crear un motivo | `42501` |

**Vitest** — `mensajeDeError`, los diálogos, y `navegacion.test.ts`, que cambia
porque cambia el menú.

**Y los cuatro de siempre en cero** antes de decir que está:

```bash
pnpm typecheck && pnpm lint && pnpm build
supabase test db
```

---

## 9 · Seed

Los laboratorios del seed se quedan como están: ahora son datos de arranque
corregibles desde la aplicación, no verdades congeladas. El marcador
*«Laboratorio de docencia N3 (por confirmar)»* deja de ser deuda: es el primer
renglón que alguien va a arreglar con esta pantalla.

---

## 10 · Lo que NO entra, y en qué orden

Las tres piezas que quedan de la §2.1, ordenadas por dolor:

1. **Ubicaciones.** La que más duele: se fragmenta sola con cada typo del
   cargador, y el spec del 12 de agosto ya listaba «Respisa» y «procesamineto».
   No es un CRUD — necesita **fusionar** dos ubicaciones reapuntando las
   existencias, o sea una función en la base con su prueba. Spec propio.
2. **Curación del catálogo.** `articulo.verificado` y `articulo_alias`. La RLS ya
   está escrita (`rls.sql:101`, `:107`): un responsable crea artículos sin
   verificar y solo el admin puede verificar o fusionar. Falta la cola y la
   pantalla. El spec del 12 de agosto lo llamaba *«un compromiso organizacional,
   no solo una tabla»*.
3. **El formulario de alta.** `perfil_captura`, `perfil_campo`,
   `campo_capturable`. Es el más delicado: cambiar qué campos pide un almacén
   cambia qué se captura, y una fila mal puesta rompe el alta para todo un
   almacén. Vale la pena que espere a que los otros catálogos estén rodados.

Las tres caen en el mismo índice de la §5.1 sin volver a discutir dónde van.

---

## 11 · Nota al margen

`navegacion.ts:78` dice «Buscar en los cuatro almacenes de la Unidad» y
`CLAUDE.md` habla de los 4 almacenes. Desde
`20260917120000_almacen_icsa.sql` son cinco. No entra en este spec, pero conviene
corregir el texto en algún momento.
