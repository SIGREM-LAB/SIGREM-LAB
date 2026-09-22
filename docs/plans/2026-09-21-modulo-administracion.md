# Módulo de administración, entrega 1 · Plan de implementación

> **Para agentes:** SUB-SKILL REQUERIDA: usa `superpowers:subagent-driven-development`
> (recomendado) o `superpowers:executing-plans` para ejecutar este plan tarea por
> tarea. Los pasos llevan casilla (`- [ ]`) para ir marcándolos.

**Meta:** que un laboratorio se dé de alta desde la aplicación —y aparezca en el
selector de Prácticas— sin pasar por una migración, que el responsable de un
almacén pueda hacerlo en el suyo junto con su ficha NOM, y que Administración
deje de ser una lista plana en la barra lateral.

**Arquitectura:** una migración de solo políticas y privilegios reparte la
escritura de `laboratorio` y de la ficha de `almacen` entre admin y responsable,
copiando la forma que ya tiene `ubicacion`. Encima, una sección `/administracion`
nueva: una pantalla índice de tarjetas que sale de la misma lista que ya dibuja
el menú, una pantalla «Almacenes y laboratorios» con el molde de dos columnas de
Programa Educativo, y una pantalla de motivos de observación.

**Stack:** Postgres 17 + Supabase CLI + pgTAP para la base; React 19, MUI 9,
TanStack Query 5, react-hook-form 7 + zod 4, Vitest + Testing Library para la
pantalla. Ninguna dependencia nueva.

**Spec:** `docs/specs/2026-09-21-modulo-administracion-design.md` — este plan
discute desde ahí; léelos juntos.

## Restricciones globales

- **Los commits los hace la persona, no el agente.** Cada tarea termina en un
  punto de commit: deja el árbol limpio y verde, di qué archivos tocaste, y
  **para**. No corras `git commit` ni `git add`.
- **Ninguna dependencia nueva.** Todo lo que hace falta ya está en
  `package.json`. Si crees que falta algo, pregunta antes de instalar.
- **Identificadores del dominio en español**, igual que el esquema: `almacen`,
  `laboratorio`, `motivo`, `ficha`. Comentarios y texto de usuario, también.
- **El esquema sólo cambia por migración.** Un archivo nuevo en
  `supabase/migrations/`. Una migración ya aplicada no se edita: se agrega otra.
- **Cada política de RLS lleva su prueba** en `supabase/tests/database/`.
- **Nunca `delete`, siempre `activo = false`** en laboratorios y motivos.
  Existencias y prácticas los referencian.
- **Componentes de presentación puros.** Las listas y los diálogos reciben datos
  por props y no consultan nada; la consulta vive en la `PaginaX`. Es lo que
  permite probarlos con `render()` a secas, sin proveedores — mira
  `src/features/academico/ListaAsignaturas.test.tsx`.
- **Usa lo instalado.** MUI para todo componente, `@iconify/react` para iconos,
  react-query para datos, react-hook-form + zod para formularios. Nada a mano.

## Nota sobre el entorno: cómo se verifica de verdad

Esto no es opcional y cambia los pasos de la Tarea 1. En esta máquina:

- **`supabase test db` sólo corre si Docker Desktop está arriba.** A menudo no lo
  está. La prueba pgTAP se escribe igual —es la regla del proyecto— pero puede
  que no la puedas ejecutar tú.
- **Si no puedes correrla, no digas que pasa.** Escríbela, deja dicho en el
  reporte de la tarea que quedó sin ejecutar, y entrega además el bloque
  `begin; … rollback;` del Paso 7 para que Daniel lo pegue en el SQL editor del
  remoto. Ese bloque provoca el error esperado sin cambiar un renglón.
- **La migración llega con `npx supabase db push`, nunca pegada en el editor.**
  Pegarla deja el archivo sin registrar en `supabase_migrations.schema_migrations`
  y el siguiente push truena con «already exists». Ese push lo corre Daniel.
- **`pnpm typecheck` no ve el remoto.** `pnpm gen:types` lee `--local`, y `.env`
  apunta al proyecto remoto. Los cuatro comandos pueden salir en cero y la
  pantalla morir en runtime con `42501` si la migración no se empujó. Por eso las
  Tareas 3 a 5 no se pueden dar por buenas hasta que la Tarea 1 esté en el
  remoto.

---

## Mapa de archivos

**Base**

| Archivo | Acción | Responsabilidad |
|---|---|---|
| `supabase/migrations/20260921120600_administracion_almacen.sql` | crear | Políticas de `laboratorio` y `almacen`, y los privilegios por columna |
| `supabase/tests/database/rls.test.sql` | modificar | Diez aserciones nuevas al final, antes del `finish()` |

**Cliente**

| Archivo | Acción | Responsabilidad |
|---|---|---|
| `src/app/navegacion.ts` | modificar | El menú pierde dos entradas y gana «Administración»; exporta las tarjetas del índice |
| `src/app/navegacion.test.ts` | modificar | Dos pruebas existentes cambian; seis nuevas |
| `src/App.tsx` | modificar | Rutas nuevas, guardias, y la redirección de `/usuarios` |
| `src/features/administracion/TarjetaSeccion.tsx` | crear | Una tarjeta enlazada del índice |
| `src/features/administracion/PaginaAdministracion.tsx` | crear | El índice |
| `src/features/administracion/esquemas.ts` | crear | Los tres esquemas zod |
| `src/features/administracion/consultas.ts` | crear | Lecturas, mutaciones y `mensajeDeError` |
| `src/features/administracion/ListaAlmacenes.tsx` | crear | Columna izquierda de Almacenes |
| `src/features/administracion/FichaAlmacen.tsx` | crear | El formulario de la ficha NOM |
| `src/features/administracion/ListaLaboratorios.tsx` | crear | La lista de laboratorios del almacén |
| `src/features/administracion/DialogoLaboratorio.tsx` | crear | Alta y renombrado |
| `src/features/administracion/PaginaAlmacenes.tsx` | crear | Junta lo anterior con las consultas |
| `src/features/administracion/ListaMotivos.tsx` | crear | La lista de motivos |
| `src/features/administracion/DialogoMotivo.tsx` | crear | Alta y edición de motivo |
| `src/features/administracion/PaginaMotivos.tsx` | crear | La pantalla de motivos |

Más el `.test.tsx` o `.test.ts` de cada uno, en la misma carpeta.

---

## Tarea 1: La migración y sus pruebas de RLS

**Archivos:**
- Crear: `supabase/migrations/20260921120600_administracion_almacen.sql`
- Modificar: `supabase/tests/database/rls.test.sql` (el `plan()` de la línea 17, y el final del archivo antes de `select * from finish();`)

**Interfaces:**
- Consume: los helpers que el archivo de pruebas ya define — `pg_temp.como(correo)`, `pg_temp.como_postgres()`, `pg_temp.id_almacen(clave)`.
- Produce: la política `laboratorio_escritura` sobre `public.laboratorio` y la política `almacen_ficha_propia` sobre `public.almacen`. Las Tareas 3 a 5 dependen de las dos.

---

- [ ] **Paso 1: Escribir las pruebas que fallan**

Van **al final** de `supabase/tests/database/rls.test.sql`, justo antes de
`select pg_temp.como_postgres();` y `select * from finish();`.

```sql
-- ---------------------------------------------------------------------------
-- Administracion: el responsable manda en su almacen
-- ---------------------------------------------------------------------------
-- El laboratorio y la ficha NOM son dato LOCAL del almacen: quien lo surte sabe
-- que laboratorios atiende y para que se usa la bodega. Mismo reparto que
-- ubicacion (rls.sql:80), y por la misma razon.
--
-- Ojo con como falla cada clausula: USING falso deja 0 filas SIN error, asi que
-- lo ajeno se mide comprobando el dato, no con throws_ok.
select pg_temp.como_postgres();

-- Un laboratorio de N3 con id fijo, para poder intentar moverlo desde N4.
insert into public.laboratorio (id, almacen_id, nombre)
overriding system value
values (900901, pg_temp.id_almacen('N3'), 'Laboratorio de prueba RLS');


select pg_temp.como('n4@uaeh.local');

select lives_ok(
  $$ insert into public.laboratorio (almacen_id, nombre)
     values ((select id from public.almacen where clave = 'N4'),
             'Laboratorio dado de alta por N4') $$,
  'El responsable de N4 da de alta un laboratorio en su almacen'
);

select throws_ok(
  $$ insert into public.laboratorio (almacen_id, nombre)
     values ((select id from public.almacen where clave = 'N3'), 'Colado en N3') $$,
  '42501', null,
  'El responsable de N4 NO da de alta laboratorios en N3 (WITH CHECK)'
);

-- Mover uno ajeno al propio almacen: la fila de N3 no la ve el USING, asi que
-- el update afecta cero filas y no truena.
update public.laboratorio set almacen_id = pg_temp.id_almacen('N4')
 where id = 900901;
select is(
  (select almacen_id from public.laboratorio where id = 900901),
  pg_temp.id_almacen('N3'),
  'El responsable de N4 no se lleva un laboratorio de N3, y falla en silencio'
);

-- La ficha NOM: la confirma quien trabaja ahi. Es lo que el comentario de
-- 20260917120000_almacen_icsa.sql daba por hecho y no existia.
select lives_ok(
  $$ update public.almacen set zona_riesgo = 'Laboratorio nivel 4'
      where clave = 'N4' $$,
  'El responsable de N4 confirma la ficha NOM de su almacen'
);

select is(
  (select zona_riesgo from public.almacen where clave = 'N4'),
  'Laboratorio nivel 4',
  'Y el valor queda guardado de verdad'
);

update public.almacen set zona_riesgo = 'Cambiada a la mala' where clave = 'N3';
select is(
  (select zona_riesgo from public.almacen where clave = 'N3'),
  'Laboratorio',
  'El responsable de N4 no toca la ficha de N3, y falla en silencio'
);


-- La clave no se edita desde la aplicacion, y eso ya no es convencion de la
-- interfaz: es un privilegio que authenticated no tiene. Ni el admin.
select pg_temp.como('admin@uaeh.local');

select throws_ok(
  $$ update public.almacen set clave = 'XX' where clave = 'N4' $$,
  '42501', null,
  'Ni el admin cambia la clave de un almacen desde la app: falta el privilegio'
);

select lives_ok(
  $$ insert into public.laboratorio (almacen_id, nombre)
     values ((select id from public.almacen where clave = 'N3'),
             'Laboratorio dado de alta por el admin') $$,
  'El admin si da de alta laboratorios en cualquier almacen'
);


-- Un consulta no tiene almacen —lo impide perfil_almacen_solo_responsable— asi
-- que el segundo disyuntivo de la politica nunca es cierto para el.
select pg_temp.como('lectura@uaeh.local');

select throws_ok(
  $$ insert into public.laboratorio (almacen_id, nombre)
     values ((select id from public.almacen where clave = 'N3'), 'Colado por consulta') $$,
  '42501', null,
  'Un usuario de consulta no da de alta laboratorios en ningun almacen'
);

-- Los motivos son catalogo de la Unidad, no de un almacen: siguen siendo del
-- admin y nada mas.
select pg_temp.como('n4@uaeh.local');

select throws_ok(
  $$ insert into public.motivo_observacion (clave, etiqueta, orden)
     values ('colado', 'Colado por el responsable', 99) $$,
  '42501', null,
  'El responsable no agrega motivos de observacion: son de la Unidad'
);
```

Y sube el `plan()` de la línea 17: son **diez** aserciones nuevas
(`lives_ok` ×3, `throws_ok` ×4, `is` ×3), así que `select plan(161);` pasa a
`select plan(171);`.

- [ ] **Paso 2: Correr las pruebas para verlas fallar**

```bash
supabase test db
```

Esperado: fallan las de escritura del responsable — hoy `laboratorio_admin`
niega todo lo que no sea admin, así que los dos `lives_ok` del responsable y el
`is` de la ficha propia revientan. La de `almacen.clave` **también falla**,
porque hoy `authenticated` sí tiene el `update` completo.

Si Docker no está arriba, el comando ni arranca. Salta al Paso 7 y anótalo.

- [ ] **Paso 3: Escribir la migración**

Crear `supabase/migrations/20260921120600_administracion_almacen.sql`:

```sql
-- Administracion de almacenes y laboratorios: que el responsable mande en lo
-- suyo.
--
-- Diseno: docs/specs/2026-09-21-modulo-administracion-design.md, D2 y D3.
--
-- El laboratorio es dato LOCAL del almacen, igual que la ubicacion: quien lo
-- surte sabe que laboratorios atiende. Que agregar uno tenga que pasar por el
-- admin convierte una anotacion de dos segundos en un ticket. Y la ficha NOM la
-- confirma quien trabaja ahi, que es exactamente lo que daba por hecho el
-- comentario de 20260917120000_almacen_icsa.sql cuando dejo las tres columnas
-- de ICSA en nulo «hasta que el responsable las confirme».

-- ---------------------------------------------------------------------------
-- Laboratorio
-- ---------------------------------------------------------------------------
-- Es la forma exacta de ubicacion_escritura (rls.sql:80). NO necesita un
-- puede_escribir() encima: desde 20260909130000_almacen_solo_responsable.sql,
-- tener almacen y ser responsable son lo mismo, asi que almacen_actual() le
-- devuelve NULL a un consulta y el segundo disyuntivo nunca es cierto para el.
drop policy laboratorio_admin on public.laboratorio;

create policy laboratorio_escritura on public.laboratorio
  for all to authenticated
  using       ((select private.es_admin())
               or almacen_id = (select private.almacen_actual()))
  with check  ((select private.es_admin())
               or almacen_id = (select private.almacen_actual()));

comment on policy laboratorio_escritura on public.laboratorio is
  'Admin en todos; responsable en el suyo. El USING frena mover uno ajeno, el WITH CHECK frena crearlo fuera.';


-- ---------------------------------------------------------------------------
-- Almacen: la ficha NOM de quien trabaja ahi
-- ---------------------------------------------------------------------------
-- almacen_admin se queda: el admin sigue editando la ficha de cualquiera. Esta
-- politica es permisiva y se suma con OR, no la sustituye.
create policy almacen_ficha_propia on public.almacen
  for update to authenticated
  using       (id = (select private.almacen_actual()))
  with check  (id = (select private.almacen_actual()));

-- Y aqui es donde «la clave no se edita» deja de ser convencion de la interfaz.
-- La RLS decide QUE FILAS; el privilegio decide QUE COLUMNAS, y son dos niveles
-- independientes (20260814100000_grants_authenticated.sql lo explica). Sin este
-- revoke, esconder el campo en la pantalla no impide nada: basta un PATCH a
-- PostgREST para renombrar un almacen y romper el ETL, el exportador y el seed,
-- que casan por clave.
--
-- activo queda fuera por lo mismo que no aparece en la pantalla: lo lee un solo
-- sitio —a que usuario se le puede asignar el almacen— asi que un control
-- rotulado «Activo» prometeria cerrar el almacen y solo lo escondería de un
-- select.
revoke update on public.almacen from authenticated;
grant  update (nombre, uso_principal, zona_riesgo, personas_expuestas)
  on public.almacen to authenticated;
```

- [ ] **Paso 4: Aplicar la migración en local y correr las pruebas**

```bash
supabase db reset
supabase test db
```

Esperado: las 171 pasan.

Si Docker no está arriba, ninguno de los dos corre. Salta al Paso 7.

- [ ] **Paso 5: Confirmar que los tipos NO cambian**

Esta migración no crea ni altera columnas: solo políticas y privilegios. El
generador de tipos describe la forma del esquema, no quién puede escribirlo, así
que `src/types/database.ts` tiene que quedar **byte por byte igual**.

```bash
pnpm gen:types
git diff --stat src/types/database.ts
```

Esperado: sin salida. Si `git diff` muestra algo, para y avisa: significa que la
migración tocó el esquema sin querer, o que la base local traía cambios que no
están en `supabase/migrations/`.

(Si Docker no está arriba, `gen:types` tampoco corre. Anótalo y sigue: el
razonamiento de por qué no debe cambiar se sostiene solo.)

- [ ] **Paso 6: Los cuatro de siempre**

```bash
pnpm typecheck && pnpm lint && pnpm build
```

Esperado: los tres en cero. Esta tarea no toca TypeScript, así que si alguno
falla es que venía roto de antes; dilo en el reporte.

- [ ] **Paso 7: Dejar el bloque de verificación manual contra el remoto**

Independientemente de si pudiste correr pgTAP, **entrega este bloque en el
reporte de la tarea** para que Daniel lo pegue en el SQL editor del remoto
después de su `npx supabase db push`. Provoca el error esperado y deshace todo:

```sql
begin;

-- Suplantar al responsable de N4 sin necesitar sus credenciales.
set local role authenticated;
set local request.jwt.claims = '{"sub":"<uuid del perfil de N4>","role":"authenticated"}';

-- 1. Debe pasar: un laboratorio en su propio almacen.
insert into public.laboratorio (almacen_id, nombre)
values ((select id from public.almacen where clave = 'N4'), 'Prueba manual');

-- 2. Debe reventar con 42501: uno en el almacen de otro.
insert into public.laboratorio (almacen_id, nombre)
values ((select id from public.almacen where clave = 'N3'), 'Prueba manual colada');

rollback;
```

Y un segundo bloque para el privilegio por columna, que se corre como quien sea:

```sql
begin;
set local role authenticated;
-- Debe reventar con 42501 aunque el jwt sea de un admin.
update public.almacen set clave = 'XX' where clave = 'N4';
rollback;
```

- [ ] **Paso 8: Punto de commit**

Deja el árbol limpio y **para**. Reporta:
- los dos archivos tocados;
- si `supabase test db` corrió o no, y con qué resultado;
- los dos bloques del Paso 7, listos para pegar;
- el recordatorio de que **nada del cliente funciona hasta que Daniel corra
  `npx supabase db push`**.

Mensaje sugerido, para que él lo use:
`feat(db): el responsable administra los laboratorios y la ficha de su almacén`

---

## Tarea 2: El menú y las rutas

**Archivos:**
- Modificar: `src/app/navegacion.ts`
- Modificar: `src/app/navegacion.test.ts`
- Modificar: `src/App.tsx`

**Interfaces:**
- Consume: `ItemMenu` y `GrupoMenu`, que ya viven en `src/app/navegacion.ts`.
- Produce: `tarjetasDeAdministracion(rol: Enums<'rol_usuario'> | undefined): ItemMenu[]`, que la Tarea 3 usa para dibujar el índice. Y las rutas `/administracion`, `/administracion/almacenes`, `/administracion/motivos`, `/administracion/usuarios`.

---

- [ ] **Paso 1: Escribir las pruebas que fallan**

En `src/app/navegacion.test.ts`. **Dos pruebas existentes cambian de
afirmación** — no las dupliques, sustitúyelas:

1. `'la administracion de usuarios sigue siendo solo del admin'` (afirma que
   `/usuarios` está en el menú del admin). Se reemplaza por la prueba de
   tarjetas de abajo.
2. `'sin perfil todavia, las administrativas no se cuelan'` (afirma sobre
   `/usuarios` y `/administracion/educativo`). Cambia a afirmar sobre
   `/administracion`.

```ts
import { menuDeNavegacion, tarjetasDeAdministracion } from './navegacion'

// ... dentro del describe('menuDeNavegacion') existente, sustituyendo la
// prueba de usuarios:

// El menu deja de listar cada pantalla administrativa: con las seis piezas que
// vienen llegaria a nueve entradas y dejaria de servir para navegar.
test('el menu ya no lista las pantallas administrativas una por una', () => {
  const rutas = menuDeNavegacion('admin', false).map((i) => i.ruta)

  expect(rutas).toContain('/administracion')
  expect(rutas).not.toContain('/usuarios')
  expect(rutas).not.toContain('/administracion/educativo')
})

// Sustituye a la prueba homónima: el hueco sigue siendo el mismo —mientras el
// perfil carga no hay rol— y lo que no se puede colar ahora es la entrada nueva.
test('sin perfil todavia, las administrativas no se cuelan', () => {
  const rutas = menuDeNavegacion(undefined, false).map((i) => i.ruta)

  expect(rutas).not.toContain('/administracion')
  expect(rutas).not.toContain('/usuarios')
})

test('administracion la ven admin y responsable, no consulta', () => {
  expect(menuDeNavegacion('admin', false).map((i) => i.ruta)).toContain('/administracion')
  expect(menuDeNavegacion('responsable', true).map((i) => i.ruta)).toContain('/administracion')
  expect(menuDeNavegacion('consulta', false).map((i) => i.ruta)).not.toContain('/administracion')
})
```

Y un `describe` nuevo al final del archivo:

```ts
describe('tarjetasDeAdministracion', () => {
  test('el admin ve las cuatro secciones', () => {
    const rutas = tarjetasDeAdministracion('admin').map((t) => t.ruta)

    expect(rutas).toEqual([
      '/administracion/almacenes',
      '/administracion/motivos',
      '/administracion/educativo',
      '/administracion/usuarios',
    ])
  })

  // Un responsable administra lo suyo: los laboratorios y la ficha de su
  // almacen. Los motivos, el plan de estudios y los usuarios son de la Unidad.
  test('el responsable ve solo almacenes y laboratorios', () => {
    expect(tarjetasDeAdministracion('responsable').map((t) => t.ruta)).toEqual([
      '/administracion/almacenes',
    ])
  })

  test('consulta no ve ninguna, y sin perfil tampoco', () => {
    expect(tarjetasDeAdministracion('consulta')).toEqual([])
    expect(tarjetasDeAdministracion(undefined)).toEqual([])
  })

  // Una tarjeta apagada en el indice seria un enlace roto: aqui no hay nada
  // pendiente, todas las pantallas existen.
  test('todas las tarjetas estan disponibles', () => {
    expect(tarjetasDeAdministracion('admin').every((t) => t.disponible)).toBe(true)
  })
})
```

- [ ] **Paso 2: Correr las pruebas para verlas fallar**

```bash
pnpm vitest run src/app/navegacion.test.ts
```

Esperado: FAIL — `tarjetasDeAdministracion is not a function`, y las de
`/administracion` porque esa entrada todavía no existe.

- [ ] **Paso 3: Cambiar `navegacion.ts`**

En `menuDeNavegacion`, **borra** las dos entradas del bloque final
(`/administracion/educativo` y `/usuarios`) y deja en su lugar una sola:

```ts
  if (rol !== 'admin' && rol !== 'responsable') return conReportes

  return [
    ...conReportes,
    {
      ruta: '/administracion',
      etiqueta: 'Administración',
      icono: 'mdi:cog-outline',
      grupo: 'administracion',
      descripcion: 'Almacenes, laboratorios y catálogos del sistema',
      color: 'grey.600',
      disponible: true,
    },
  ]
```

Ojo con el `if`: hoy dice `if (rol !== 'admin') return conReportes`. Ahora el
responsable también entra, y `rol === undefined` sigue quedando fuera por los dos
lados de la comparación.

Y agrega al final del archivo:

```ts
/**
 * Las secciones del índice de Administración.
 *
 * Viven aquí y no en la pantalla por lo mismo que el menú: son la identidad de
 * cada sección —icono, color, de qué va— y repartidas por los componentes
 * acabarían distintas en cada sitio. El índice las dibuja con el mismo molde de
 * tarjeta que el menú principal.
 *
 * El responsable ve una sola: los laboratorios y la ficha NOM son dato de su
 * almacén. Los motivos, el plan de estudios y los usuarios son de la Unidad.
 */
export function tarjetasDeAdministracion(
  rol: Enums<'rol_usuario'> | undefined,
): ItemMenu[] {
  const almacenes: ItemMenu = {
    ruta: '/administracion/almacenes',
    etiqueta: 'Almacenes y laboratorios',
    icono: 'mdi:warehouse',
    grupo: 'administracion',
    descripcion: 'Los datos del almacén y los laboratorios a los que surte',
    color: 'institucional.main',
    disponible: true,
  }

  if (rol === 'responsable') return [almacenes]
  if (rol !== 'admin') return []

  return [
    almacenes,
    {
      ruta: '/administracion/motivos',
      etiqueta: 'Motivos de observación',
      icono: 'mdi:comment-alert-outline',
      grupo: 'administracion',
      descripcion: 'Por qué se marca una práctica o un producto',
      color: 'secondary.main',
      disponible: true,
    },
    {
      ruta: '/administracion/educativo',
      etiqueta: 'Programa educativo',
      icono: 'mdi:school-outline',
      grupo: 'administracion',
      descripcion: 'Programas, asignaturas y prácticas del plan de estudios',
      color: 'grey.600',
      disponible: true,
    },
    {
      ruta: '/administracion/usuarios',
      etiqueta: 'Usuarios',
      icono: 'mdi:account-cog-outline',
      grupo: 'administracion',
      descripcion: 'Gestionar usuarios, roles y accesos del sistema',
      color: 'grey.600',
      disponible: true,
    },
  ]
}
```

- [ ] **Paso 4: Correr las pruebas para verlas pasar**

```bash
pnpm vitest run src/app/navegacion.test.ts
```

Esperado: PASS, todas.

- [ ] **Paso 5: Cambiar las rutas en `App.tsx`**

Tres cambios. Primero, importa `Navigate` de `react-router-dom` y `SoloOperacion`
si no estuviera ya (sí lo está: lo usa `/reportes`).

**a)** Dentro del `<Route element={<SoloOperacion />}>` que ya envuelve
`/reportes`, agrega las dos rutas que el responsable también abre:

```tsx
                      {/* Bajo SoloOperacion y no SoloAdmin: el responsable
                          administra los laboratorios y la ficha de SU almacén.
                          Un usuario de consulta no tiene almacén —lo impide
                          perfil_almacen_solo_responsable— así que no habría una
                          sola fila que pudiera escribir: mejor mandarlo a / que
                          enseñarle una pantalla muerta. */}
                      <Route path="/administracion" element={<PaginaAdministracion />} />
                      <Route path="/administracion/almacenes" element={<PaginaAlmacenes />} />
```

**b)** El bloque `SoloAdmin` que hoy sólo tiene `/administracion/educativo` se
queda con tres:

```tsx
                    <Route element={<SoloAdmin />}>
                      <Route path="/administracion/educativo" element={<PaginaAcademico />} />
                      <Route path="/administracion/motivos" element={<PaginaMotivos />} />
                      <Route path="/administracion/usuarios" element={<PaginaUsuarios />} />
                    </Route>
```

**c)** El bloque duplicado del final —el `<Route element={<RutaProtegida />}>`
con su propio `SoloAdmin` y su propio `Layout` para `/usuarios`— se borra entero
y se sustituye por la redirección. Va dentro de `RutaProtegida` pero **fuera** de
`Layout`: un `<Navigate>` no pinta nada, y envolverlo en el Layout haría
parpadear la barra lateral antes de irse.

```tsx
                <Route element={<RutaProtegida />}>
                  {/* La pantalla se mudó a /administracion/usuarios el 21 de
                      septiembre de 2026. La redirección se queda: un enlace que
                      alguien guardó no tiene por qué morir con la mudanza. */}
                  <Route path="/usuarios" element={<Navigate to="/administracion/usuarios" replace />} />
                </Route>
```

Los `import` de `PaginaAdministracion`, `PaginaAlmacenes` y `PaginaMotivos`
apuntan a archivos que todavía no existen: el typecheck va a fallar hasta la
Tarea 5. Es esperado y está dicho en el Paso 7.

- [ ] **Paso 6: Escribir los tres archivos mínimos para que compile**

Para no dejar la rama rota entre tareas, crea los tres componentes como cascarón
—cada Tarea siguiente los llena—:

```tsx
// src/features/administracion/PaginaAdministracion.tsx
export function PaginaAdministracion() {
  return null
}
```

Igual para `PaginaAlmacenes.tsx` (`export function PaginaAlmacenes()`) y
`PaginaMotivos.tsx` (`export function PaginaMotivos()`).

- [ ] **Paso 7: Los cuatro de siempre**

```bash
pnpm typecheck && pnpm lint && pnpm build && pnpm vitest run
```

Esperado: los cuatro en cero.

- [ ] **Paso 8: Punto de commit**

Árbol limpio y **para**. Reporta los archivos tocados y que las tres pantallas
son cascarones a propósito.

Mensaje sugerido:
`feat: administración deja de ser una lista plana en el menú`

---

## Tarea 3: El índice de Administración

**Archivos:**
- Crear: `src/features/administracion/TarjetaSeccion.tsx`
- Crear: `src/features/administracion/TarjetaSeccion.test.tsx`
- Modificar: `src/features/administracion/PaginaAdministracion.tsx` (el cascarón de la Tarea 2)
- Crear: `src/features/administracion/PaginaAdministracion.test.tsx`

**Interfaces:**
- Consume: `tarjetasDeAdministracion(rol)` y el tipo `ItemMenu` de `@/app/navegacion`; `usePerfil()` de `@/features/auth/usePerfil`; `EncabezadoPagina` y `CuerpoPagina` de `@/app/EncabezadoPagina`.
- Produce: `TarjetaSeccion({ item }: { item: ItemMenu })`, una tarjeta enlazada.

---

- [ ] **Paso 1: Escribir la prueba de la tarjeta**

`src/features/administracion/TarjetaSeccion.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, test } from 'vitest'

import type { ItemMenu } from '@/app/navegacion'
import { TarjetaSeccion } from './TarjetaSeccion'

const ITEM: ItemMenu = {
  ruta: '/administracion/almacenes',
  etiqueta: 'Almacenes y laboratorios',
  icono: 'mdi:warehouse',
  grupo: 'administracion',
  descripcion: 'Los datos del almacén y los laboratorios a los que surte',
  color: 'institucional.main',
  disponible: true,
}

describe('TarjetaSeccion', () => {
  // Un enlace de verdad y no un onClick: es lo que permite abrirlo en otra
  // pestaña, copiar la dirección y que el lector de pantalla lo anuncie como
  // enlace. La tarjeta entera es el área pulsable.
  test('la tarjeta entera es un enlace a la sección', () => {
    render(
      <MemoryRouter>
        <TarjetaSeccion item={ITEM} />
      </MemoryRouter>,
    )

    const enlace = screen.getByRole('link', { name: /Almacenes y laboratorios/ })

    expect(enlace).toHaveAttribute('href', '/administracion/almacenes')
    expect(enlace).toHaveTextContent('Los datos del almacén y los laboratorios a los que surte')
  })
})
```

- [ ] **Paso 2: Correr para verla fallar**

```bash
pnpm vitest run src/features/administracion/TarjetaSeccion.test.tsx
```

Esperado: FAIL — no existe el módulo.

- [ ] **Paso 3: Escribir `TarjetaSeccion.tsx`**

```tsx
import { Icon } from '@iconify/react'
import { Box, Card, CardActionArea, Stack, Typography } from '@mui/material'
import { Link as EnlaceRuta } from 'react-router-dom'

import type { ItemMenu } from '@/app/navegacion'

/**
 * Una sección del índice de Administración.
 *
 * Misma anatomía que las tarjetas del menú principal —placa de color, etiqueta,
 * una línea de qué se hace ahí— pero éstas sí llevan a algún lado, así que la
 * superficie pulsable es la tarjeta entera y no un botón dentro.
 */
export function TarjetaSeccion({ item }: { item: ItemMenu }) {
  return (
    <Card sx={{ height: '100%' }}>
      <CardActionArea
        component={EnlaceRuta}
        to={item.ruta}
        sx={{ height: '100%', p: 2.25 }}
      >
        <Stack direction="row" spacing={1.75} sx={{ alignItems: 'center' }}>
          <Box
            sx={{
              width: 40,
              height: 40,
              borderRadius: 2,
              bgcolor: item.color,
              color: 'common.white',
              display: 'grid',
              placeItems: 'center',
              flexShrink: 0,
            }}
          >
            <Icon icon={item.icono} width={22} aria-hidden />
          </Box>

          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography sx={{ fontSize: '0.9375rem', fontWeight: 600 }}>
              {item.etiqueta}
            </Typography>
            <Typography variant="caption" component="p" sx={{ color: 'text.secondary' }}>
              {item.descripcion}
            </Typography>
          </Box>
        </Stack>
      </CardActionArea>
    </Card>
  )
}
```

- [ ] **Paso 4: Correr para verla pasar**

```bash
pnpm vitest run src/features/administracion/TarjetaSeccion.test.tsx
```

Esperado: PASS.

- [ ] **Paso 5: Escribir la prueba de la página**

`src/features/administracion/PaginaAdministracion.test.tsx`. El perfil se
sustituye con `vi.mock`, que es lo que ya hacen otras pruebas del repo cuando
necesitan un rol concreto:

```tsx
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, test, vi } from 'vitest'

import { PaginaAdministracion } from './PaginaAdministracion'

const perfil = vi.hoisted(() => ({ actual: { rol: 'admin', nombre: 'X', almacen: null } }))

vi.mock('@/features/auth/usePerfil', () => ({
  usePerfil: () => ({ data: perfil.actual }),
}))

function montar() {
  return render(
    <MemoryRouter>
      <PaginaAdministracion />
    </MemoryRouter>,
  )
}

describe('PaginaAdministracion', () => {
  test('el admin ve las cuatro secciones', () => {
    perfil.actual = { rol: 'admin', nombre: 'X', almacen: null }
    montar()

    expect(screen.getByRole('link', { name: /Almacenes y laboratorios/ })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Motivos de observación/ })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Programa educativo/ })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Usuarios/ })).toBeInTheDocument()
  })

  // No es sólo que no pueda: es que verlas y que la base se las niegue sería
  // peor que no verlas.
  test('el responsable ve una sola, la de su almacén', () => {
    perfil.actual = { rol: 'responsable', nombre: 'X', almacen: { id: 2, clave: 'N4' } }
    montar()

    expect(screen.getByRole('link', { name: /Almacenes y laboratorios/ })).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /Usuarios/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /Programa educativo/ })).not.toBeInTheDocument()
  })
})
```

- [ ] **Paso 6: Correr para verla fallar**

```bash
pnpm vitest run src/features/administracion/PaginaAdministracion.test.tsx
```

Esperado: FAIL — el cascarón devuelve `null`, no hay ningún enlace.

- [ ] **Paso 7: Escribir la página**

Sustituye el cascarón de `PaginaAdministracion.tsx`:

```tsx
import { Grid } from '@mui/material'

import { CuerpoPagina, EncabezadoPagina } from '@/app/EncabezadoPagina'
import { tarjetasDeAdministracion } from '@/app/navegacion'
import { usePerfil } from '@/features/auth/usePerfil'
import { TarjetaSeccion } from './TarjetaSeccion'

/**
 * El índice de Administración.
 *
 * Una pantalla y no seis entradas en la barra lateral: con los catálogos que
 * faltan —ubicaciones, curación del catálogo, el formulario de alta— el menú
 * llegaría a nueve entradas y dejaría de servir para navegar. Aquí crecen sin
 * volver a tocarlo.
 */
export function PaginaAdministracion() {
  const { data: perfil } = usePerfil()
  const tarjetas = tarjetasDeAdministracion(perfil?.rol)

  return (
    <>
      <EncabezadoPagina
        titulo="Administración"
        descripcion="Almacenes, laboratorios y catálogos del sistema"
      />

      <CuerpoPagina>
        <Grid container spacing={2}>
          {tarjetas.map((item) => (
            <Grid key={item.ruta} size={{ xs: 12, sm: 6, md: 4 }}>
              <TarjetaSeccion item={item} />
            </Grid>
          ))}
        </Grid>
      </CuerpoPagina>
    </>
  )
}
```

- [ ] **Paso 8: Correr para verla pasar**

```bash
pnpm vitest run src/features/administracion/
```

Esperado: PASS.

- [ ] **Paso 9: Los cuatro de siempre**

```bash
pnpm typecheck && pnpm lint && pnpm build && pnpm vitest run
```

- [ ] **Paso 10: Punto de commit**

Árbol limpio y **para**.

Mensaje sugerido: `feat: el índice de administración`

---

## Tarea 4: Consultas, esquemas y la ficha del almacén

**Archivos:**
- Crear: `src/features/administracion/esquemas.ts`
- Crear: `src/features/administracion/consultas.ts`
- Crear: `src/features/administracion/consultas.test.ts`
- Crear: `src/features/administracion/ListaAlmacenes.tsx` + `.test.tsx`
- Crear: `src/features/administracion/FichaAlmacen.tsx` + `.test.tsx`
- Modificar: `src/features/administracion/PaginaAlmacenes.tsx` (el cascarón de la Tarea 2)

**Interfaces:**
- Consume: `supabase` de `@/lib/supabase`; `usePerfil()`; `ColumnaAcademica` de `@/features/academico/ColumnaAcademica`.
- Produce, y la Tarea 5 depende de todo esto:
  - `type Almacen = { id: number; clave: string; nombre: string; usoPrincipal: string | null; zonaRiesgo: string | null; personasExpuestas: number | null }`
  - `type Laboratorio = { id: number; nombre: string; activo: boolean }`
  - `mensajeDeError(error: unknown): string`
  - `useAlmacenes()` → `UseQueryResult<Almacen[]>`
  - `useGuardarFichaAlmacen()` → `mutate({ id, nombre, usoPrincipal, zonaRiesgo, personasExpuestas })`
  - `esquemaFichaAlmacen`, `ValoresFichaAlmacen`

---

- [ ] **Paso 1: Escribir la prueba de `mensajeDeError`**

`src/features/administracion/consultas.test.ts`:

```ts
import { describe, expect, test } from 'vitest'

import { mensajeDeError } from './consultas'

describe('mensajeDeError', () => {
  test('traduce el choque de nombre de laboratorio', () => {
    expect(
      mensajeDeError({
        code: '23505',
        message: 'duplicate key value violates unique constraint "laboratorio_almacen_id_nombre_key"',
      }),
    ).toBe('Ya hay un laboratorio con ese nombre en este almacén')
  })

  test('traduce el choque de clave de motivo', () => {
    expect(
      mensajeDeError({
        code: '23505',
        message: 'duplicate key value violates unique constraint "motivo_observacion_pkey"',
      }),
    ).toBe('Ya existe un motivo con esa clave')
  })

  // 42501 es lo que responde la RLS o un privilegio que falta. Decir «no tienes
  // permiso» es lo único accionable: el usuario no puede hacer nada con
  // «new row violates row-level security policy».
  test('traduce el rechazo de la RLS', () => {
    expect(mensajeDeError({ code: '42501', message: 'permission denied' })).toBe(
      'No tienes permiso para cambiar esto. Revisa que sea de tu almacén.',
    )
  })

  // Lo desconocido se deja pasar con su mensaje original, por lo mismo que en
  // académico: un «algo salió mal» genérico esconde justo la pista que hace
  // falta para arreglarlo.
  test('lo desconocido pasa con su mensaje', () => {
    expect(mensajeDeError({ code: 'XX000', message: 'boom' })).toBe('boom')
    expect(mensajeDeError('no es un objeto')).toBe('No se pudo completar la operación')
  })
})
```

- [ ] **Paso 2: Correr para verla fallar**

```bash
pnpm vitest run src/features/administracion/consultas.test.ts
```

Esperado: FAIL — no existe el módulo.

- [ ] **Paso 3: Escribir `esquemas.ts`**

```ts
import { z } from 'zod'

/**
 * Los mensajes van aquí, en el esquema, y no en el JSX: así el mismo campo dice
 * lo mismo en el diálogo de alta y en el de edición.
 */
export const esquemaFichaAlmacen = z.object({
  nombre: z.string().trim().min(1, 'Escribe el nombre del almacén'),
  // Los tres de la NOM son nullable y no optional: un almacén sin confirmar
  // —ICSA hoy— es un estado válido, no un campo que falte por descuido.
  usoPrincipal: z.string().trim().min(1).nullable(),
  zonaRiesgo: z.string().trim().min(1).nullable(),
  personasExpuestas: z
    .number({ message: 'Las personas expuestas son un número entero' })
    .int()
    .min(0, 'No puede ser negativo')
    .nullable(),
})

export const esquemaLaboratorio = z.object({
  nombre: z.string().trim().min(1, 'Escribe el nombre del laboratorio'),
})

export const esquemaMotivo = z.object({
  clave: z
    .string()
    .trim()
    .min(1, 'Escribe la clave')
    .regex(/^[a-z_]+$/, 'La clave va en minúsculas y guiones bajos'),
  etiqueta: z.string().trim().min(1, 'Escribe lo que va a leer el usuario'),
  orden: z.number().int().min(1, 'El orden va del 1 en adelante'),
})

export type ValoresFichaAlmacen = z.infer<typeof esquemaFichaAlmacen>
export type ValoresLaboratorio = z.infer<typeof esquemaLaboratorio>
export type ValoresMotivo = z.infer<typeof esquemaMotivo>
```

- [ ] **Paso 4: Escribir `consultas.ts` (la parte de almacén)**

```ts
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { supabase } from '@/lib/supabase'

export type Almacen = {
  id: number
  clave: string
  nombre: string
  usoPrincipal: string | null
  zonaRiesgo: string | null
  personasExpuestas: number | null
}

/**
 * Traduce los errores de Postgres. Las restricciones y las políticas son la
 * última línea de defensa y funcionan; lo que no puede pasar es que el usuario
 * lea «duplicate key value violates unique constraint».
 *
 * Lo desconocido se deja pasar con su mensaje original a propósito: un «algo
 * salió mal» genérico esconde justo la pista que hace falta para arreglarlo.
 */
export function mensajeDeError(error: unknown): string {
  if (typeof error !== 'object' || error === null) {
    return 'No se pudo completar la operación'
  }

  const { code, message } = error as { code?: string; message?: string }

  if (code === '23505') {
    if (message?.includes('laboratorio_almacen_id_nombre_key')) {
      return 'Ya hay un laboratorio con ese nombre en este almacén'
    }
    if (message?.includes('motivo_observacion_pkey')) {
      return 'Ya existe un motivo con esa clave'
    }
  }

  if (code === '42501') {
    return 'No tienes permiso para cambiar esto. Revisa que sea de tu almacén.'
  }

  if (code === '23503') return 'No se puede borrar: hay registros que lo usan'

  return message ?? 'No se pudo completar la operación'
}

// ---------------------------------------------------------------------------
// Almacenes
// ---------------------------------------------------------------------------
/**
 * Los almacenes con su ficha NOM. Se leen todos: `almacen_lectura` deja que
 * cualquiera con sesión los vea, y quién puede EDITAR cuál lo decide
 * `almacen_ficha_propia`. Que el responsable vea sólo el suyo es decisión de la
 * pantalla, no de la base.
 */
export function useAlmacenes() {
  return useQuery({
    queryKey: ['administracion', 'almacenes'],
    queryFn: async (): Promise<Almacen[]> => {
      const { data, error } = await supabase
        .from('almacen')
        .select('id, clave, nombre, uso_principal, zona_riesgo, personas_expuestas')
        .order('clave')
      if (error) throw error

      return data.map((a) => ({
        id: a.id,
        clave: a.clave,
        nombre: a.nombre,
        usoPrincipal: a.uso_principal,
        zonaRiesgo: a.zona_riesgo,
        personasExpuestas: a.personas_expuestas,
      }))
    },
  })
}

/**
 * `clave` y `activo` no van en el update, y no por olvido: el privilegio de
 * `authenticated` sobre `almacen` está otorgado por columnas
 * (20260921120600_administracion_almacen.sql), así que mandarlas devolvería
 * 42501 aunque la fila sí sea suya.
 */
export function useGuardarFichaAlmacen() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (v: {
      id: number
      nombre: string
      usoPrincipal: string | null
      zonaRiesgo: string | null
      personasExpuestas: number | null
    }) => {
      const { error } = await supabase
        .from('almacen')
        .update({
          nombre: v.nombre,
          uso_principal: v.usoPrincipal,
          zona_riesgo: v.zonaRiesgo,
          personas_expuestas: v.personasExpuestas,
        })
        .eq('id', v.id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['administracion', 'almacenes'] }),
  })
}
```

- [ ] **Paso 5: Correr la prueba de `mensajeDeError`**

```bash
pnpm vitest run src/features/administracion/consultas.test.ts
```

Esperado: PASS.

- [ ] **Paso 6: Escribir la prueba de `ListaAlmacenes`**

`src/features/administracion/ListaAlmacenes.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import { describe, expect, test, vi } from 'vitest'

import type { Almacen } from './consultas'
import { ListaAlmacenes } from './ListaAlmacenes'

const ALMACENES: Almacen[] = [
  {
    id: 1,
    clave: 'N3',
    nombre: 'Almacén Nivel 3',
    usoPrincipal: 'Prácticas de laboratorio en UCL',
    zonaRiesgo: 'Laboratorio',
    personasExpuestas: 80,
  },
  {
    id: 5,
    clave: 'ICSA',
    nombre: 'ICSA',
    usoPrincipal: null,
    zonaRiesgo: null,
    personasExpuestas: null,
  },
]

describe('ListaAlmacenes', () => {
  // ICSA entró el 17 de septiembre con las tres constantes en nulo, «hasta que
  // el responsable las confirme». Marcarlo es lo que convierte esa nota de
  // migración en algo que alguien ve y arregla.
  test('marca el almacén con la ficha NOM incompleta', () => {
    render(<ListaAlmacenes almacenes={ALMACENES} seleccionado={1} onElegir={vi.fn()} />)

    expect(screen.getByText('Falta la ficha NOM')).toBeInTheDocument()
  })

  test('no marca el que la tiene completa', () => {
    render(
      <ListaAlmacenes almacenes={[ALMACENES[0]]} seleccionado={1} onElegir={vi.fn()} />,
    )

    expect(screen.queryByText('Falta la ficha NOM')).not.toBeInTheDocument()
  })
})
```

- [ ] **Paso 7: Correr para verla fallar, y escribir `ListaAlmacenes.tsx`**

```bash
pnpm vitest run src/features/administracion/ListaAlmacenes.test.tsx
```

Esperado: FAIL. Entonces:

```tsx
import { List, ListItemButton, ListItemText } from '@mui/material'

import type { Almacen } from './consultas'

type Props = {
  almacenes: Almacen[]
  seleccionado: number | null
  onElegir: (almacenId: number) => void
}

/** Si le falta cualquiera de las tres constantes de la NOM. */
function fichaIncompleta(almacen: Almacen): boolean {
  return (
    almacen.usoPrincipal === null ||
    almacen.zonaRiesgo === null ||
    almacen.personasExpuestas === null
  )
}

/** La columna izquierda: el sujeto de la pantalla. */
export function ListaAlmacenes({ almacenes, seleccionado, onElegir }: Props) {
  return (
    <List dense disablePadding>
      {almacenes.map((almacen) => (
        <ListItemButton
          key={almacen.id}
          selected={almacen.id === seleccionado}
          onClick={() => onElegir(almacen.id)}
          sx={{ pl: 2, pr: 1 }}
        >
          <ListItemText
            primary={`${almacen.clave} · ${almacen.nombre}`}
            secondary={fichaIncompleta(almacen) ? 'Falta la ficha NOM' : undefined}
            slotProps={{ primary: { sx: { fontSize: '0.85rem' } } }}
          />
        </ListItemButton>
      ))}
    </List>
  )
}
```

- [ ] **Paso 8: Escribir la prueba de `FichaAlmacen`**

`src/features/administracion/FichaAlmacen.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, test, vi } from 'vitest'

import type { Almacen } from './consultas'
import { FichaAlmacen } from './FichaAlmacen'

const ICSA: Almacen = {
  id: 5,
  clave: 'ICSA',
  nombre: 'ICSA',
  usoPrincipal: null,
  zonaRiesgo: null,
  personasExpuestas: null,
}

describe('FichaAlmacen', () => {
  // La clave la casan el ETL, el exportador y el seed. Cambiarla en caliente
  // rompe cargas, y por eso el privilegio de update no la incluye: el campo
  // deshabilitado sólo evita que alguien lo intente y reciba un 42501.
  test('la clave se ve pero no se edita', () => {
    render(<FichaAlmacen almacen={ICSA} puedeEditar guardando={false} onGuardar={vi.fn()} />)

    expect(screen.getByLabelText('Clave')).toBeDisabled()
  })

  test('guarda los tres campos de la NOM', async () => {
    const user = userEvent.setup()
    const onGuardar = vi.fn()

    render(<FichaAlmacen almacen={ICSA} puedeEditar guardando={false} onGuardar={onGuardar} />)

    await user.type(screen.getByLabelText('Uso principal'), 'Prácticas de laboratorio')
    await user.type(screen.getByLabelText('Zona de riesgo'), 'Laboratorio')
    await user.type(screen.getByLabelText('Personas expuestas'), '40')
    await user.click(screen.getByRole('button', { name: 'Guardar ficha' }))

    expect(onGuardar).toHaveBeenCalledWith(
      {
        nombre: 'ICSA',
        usoPrincipal: 'Prácticas de laboratorio',
        zonaRiesgo: 'Laboratorio',
        personasExpuestas: 40,
      },
      expect.anything(),
    )
  })

  // Un responsable mirando el almacén de otro: la base se lo negaría igual, pero
  // un formulario que acepta escritura y luego dice 42501 es una trampa.
  test('sin permiso, los campos están deshabilitados', () => {
    render(
      <FichaAlmacen almacen={ICSA} puedeEditar={false} guardando={false} onGuardar={vi.fn()} />,
    )

    expect(screen.getByLabelText('Uso principal')).toBeDisabled()
    expect(screen.queryByRole('button', { name: 'Guardar ficha' })).not.toBeInTheDocument()
  })
})
```

- [ ] **Paso 9: Correr para verla fallar, y escribir `FichaAlmacen.tsx`**

```bash
pnpm vitest run src/features/administracion/FichaAlmacen.test.tsx
```

Esperado: FAIL. Entonces:

```tsx
import { zodResolver } from '@hookform/resolvers/zod'
import { Box, Button, Card, Stack, TextField, Typography } from '@mui/material'
import { Controller, useForm } from 'react-hook-form'

import type { Almacen } from './consultas'
import { esquemaFichaAlmacen, type ValoresFichaAlmacen } from './esquemas'

type Props = {
  almacen: Almacen
  /** Su propio almacén, o es admin. Falso = sólo mirar. */
  puedeEditar: boolean
  guardando: boolean
  onGuardar: (valores: ValoresFichaAlmacen) => void
}

/**
 * La ficha NOM del almacén.
 *
 * Los tres campos de abajo no son decorativos: el exportador los reinyecta en
 * CADA renglón del formato unificado. ICSA entró el 17 de septiembre con los
 * tres en nulo, «hasta que el responsable las confirme», y hasta hoy esa
 * confirmación no cabía en ningún lado.
 */
export function FichaAlmacen({ almacen, puedeEditar, guardando, onGuardar }: Props) {
  const { control, handleSubmit } = useForm<ValoresFichaAlmacen>({
    resolver: zodResolver(esquemaFichaAlmacen),
    // `values` y no `defaultValues`: al cambiar de almacén en la lista, el
    // formulario tiene que recargarse con el nuevo. Con defaultValues se
    // quedaría enseñando el anterior.
    values: {
      nombre: almacen.nombre,
      usoPrincipal: almacen.usoPrincipal,
      zonaRiesgo: almacen.zonaRiesgo,
      personasExpuestas: almacen.personasExpuestas,
    },
  })

  return (
    <Card sx={{ p: 2.25 }}>
      <Typography variant="h2" sx={{ fontSize: '0.95rem', mb: 2 }}>
        Ficha del almacén
      </Typography>

      <form onSubmit={handleSubmit(onGuardar)}>
        <Stack spacing={2}>
          {/* Fuera del formulario a propósito: el privilegio de update sobre
              `almacen` no incluye `clave`, así que mandarla devolvería 42501.
              Se enseña porque es como la nombra todo el mundo. */}
          <TextField
            label="Clave"
            value={almacen.clave}
            disabled
            fullWidth
            size="small"
            helperText="La casan el cargador de Excel, el exportador y la semilla. No se cambia desde aquí."
          />

          <Controller
            name="nombre"
            control={control}
            render={({ field, fieldState }) => (
              <TextField
                {...field}
                label="Nombre"
                fullWidth
                size="small"
                disabled={!puedeEditar}
                error={!!fieldState.error}
                helperText={fieldState.error?.message}
              />
            )}
          />

          <Controller
            name="usoPrincipal"
            control={control}
            render={({ field, fieldState }) => (
              <TextField
                {...field}
                value={field.value ?? ''}
                onChange={(e) => field.onChange(e.target.value === '' ? null : e.target.value)}
                label="Uso principal"
                fullWidth
                size="small"
                disabled={!puedeEditar}
                error={!!fieldState.error}
                helperText={fieldState.error?.message}
              />
            )}
          />

          <Controller
            name="zonaRiesgo"
            control={control}
            render={({ field, fieldState }) => (
              <TextField
                {...field}
                value={field.value ?? ''}
                onChange={(e) => field.onChange(e.target.value === '' ? null : e.target.value)}
                label="Zona de riesgo"
                fullWidth
                size="small"
                disabled={!puedeEditar}
                error={!!fieldState.error}
                helperText={fieldState.error?.message}
              />
            )}
          />

          <Controller
            name="personasExpuestas"
            control={control}
            render={({ field, fieldState }) => (
              <TextField
                {...field}
                value={field.value ?? ''}
                // Sin esta conversión zod recibe una cadena, el esquema falla y
                // el mensaje que sale no le dice nada a nadie.
                onChange={(e) =>
                  field.onChange(e.target.value === '' ? null : Number(e.target.value))
                }
                type="number"
                label="Personas expuestas"
                fullWidth
                size="small"
                disabled={!puedeEditar}
                error={!!fieldState.error}
                helperText={fieldState.error?.message}
              />
            )}
          />

          {puedeEditar ? (
            <Box>
              <Button type="submit" variant="contained" loading={guardando}>
                Guardar ficha
              </Button>
            </Box>
          ) : null}
        </Stack>
      </form>
    </Card>
  )
}
```

`almacen` es `Almacen` y no `Almacen | null`: mientras no haya ninguno elegido,
la página no monta este componente. Un formulario que sabe dibujarse sin datos
acaba lleno de `?.` y de estados imposibles.

- [ ] **Paso 10: Juntar todo en `PaginaAlmacenes.tsx`**

Sustituye el cascarón. Estructura: `EncabezadoPagina` con título «Almacenes y
laboratorios» y `padre={{ etiqueta: 'Administración', ruta: '/administracion' }}`;
`CuerpoPagina` con un `Grid container spacing={2}`; izquierda
`size={{ xs: 12, md: 4 }}` con `ColumnaAcademica titulo="Almacenes"` envolviendo
`ListaAlmacenes`; derecha `size={{ xs: 12, md: 8 }}` con `FichaAlmacen`.

El filtro del responsable y el permiso salen del perfil:

```tsx
const { data: perfil } = usePerfil()
const almacenes = useAlmacenes()

const propio = perfil?.almacen?.id ?? null
// El responsable ve sólo el suyo. No es seguridad —`almacen_lectura` deja leer
// los cinco— es no enseñarle cuatro fichas que no puede tocar.
const visibles = (almacenes.data ?? []).filter((a) => propio === null || a.id === propio)

const [elegido, setElegido] = useState<number | null>(null)
const almacen = visibles.find((a) => a.id === (elegido ?? visibles[0]?.id)) ?? null
const puedeEditar = perfil?.rol === 'admin' || almacen?.id === propio
```

Los laboratorios entran en la Tarea 5: por ahora la columna derecha lleva sólo la
ficha.

- [ ] **Paso 11: Los cuatro de siempre**

```bash
pnpm typecheck && pnpm lint && pnpm build && pnpm vitest run
```

- [ ] **Paso 12: Punto de commit**

Árbol limpio y **para**. Recuerda en el reporte que esta pantalla **no guarda
nada** hasta que la migración de la Tarea 1 esté empujada al remoto: sin ella,
`almacen_ficha_propia` no existe y el responsable recibe un update de cero filas
sin error, que se ve exactamente como «no se guardó y no dijo por qué».

Mensaje sugerido: `feat: la ficha NOM del almacén se edita desde la app`

---

## Tarea 5: Los laboratorios

**Archivos:**
- Crear: `src/features/administracion/ListaLaboratorios.tsx` + `.test.tsx`
- Crear: `src/features/administracion/DialogoLaboratorio.tsx` + `.test.tsx`
- Modificar: `src/features/administracion/consultas.ts`
- Modificar: `src/features/administracion/PaginaAlmacenes.tsx`

**Interfaces:**
- Consume: `Almacen`, `mensajeDeError` y el molde de mutaciones de la Tarea 4; `esquemaLaboratorio` y `ValoresLaboratorio` de `./esquemas`.
- Produce: `useLaboratoriosDeAlmacen(almacenId, incluirRetirados)`, `useCrearLaboratorio()`, `useRenombrarLaboratorio()`, `useRetirarLaboratorio()`, y el tipo `Laboratorio`.

---

- [ ] **Paso 1: Agregar las consultas de laboratorio**

Va primero y no al final: las pruebas de los dos componentes importan el tipo
`Laboratorio` de aquí, y sin él ni siquiera compilan para poder fallar por la
razón correcta.

Al final de `src/features/administracion/consultas.ts`:

```ts
// ---------------------------------------------------------------------------
// Laboratorios
// ---------------------------------------------------------------------------
export type Laboratorio = { id: number; nombre: string; activo: boolean }

export function useLaboratoriosDeAlmacen(almacenId: number | null, incluirRetirados: boolean) {
  return useQuery({
    queryKey: ['administracion', 'laboratorios', almacenId, incluirRetirados],
    enabled: almacenId !== null,
    queryFn: async (): Promise<Laboratorio[]> => {
      let consulta = supabase
        .from('laboratorio')
        .select('id, nombre, activo')
        .eq('almacen_id', almacenId ?? -1)
        .order('nombre')

      if (!incluirRetirados) consulta = consulta.eq('activo', true)

      const { data, error } = await consulta
      if (error) throw error
      return data
    },
  })
}

/**
 * Las tres mutaciones invalidan lo mismo, y el porqué de las dos últimas claves
 * es lo que se olvida y se siente como un bug: Prácticas e Inventario leen esta
 * tabla por su cuenta, con `staleTime` de 30 s. Sin invalidarlas, quien acaba de
 * dar de alta el laboratorio abre Prácticas, no lo ve, y jura que no se guardó.
 */
function clavesQueDependenDeLaboratorio(qc: ReturnType<typeof useQueryClient>) {
  return Promise.all([
    qc.invalidateQueries({ queryKey: ['administracion', 'laboratorios'] }),
    qc.invalidateQueries({ queryKey: ['practicas', 'laboratorios'] }),
    qc.invalidateQueries({ queryKey: ['inventario', 'laboratorios'] }),
  ])
}

export function useCrearLaboratorio() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (v: { almacenId: number; nombre: string }) => {
      const { error } = await supabase
        .from('laboratorio')
        .insert({ almacen_id: v.almacenId, nombre: v.nombre })
      if (error) throw error
    },
    onSuccess: () => clavesQueDependenDeLaboratorio(qc),
  })
}

export function useRenombrarLaboratorio() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (v: { id: number; nombre: string }) => {
      const { error } = await supabase
        .from('laboratorio')
        .update({ nombre: v.nombre })
        .eq('id', v.id)
      if (error) throw error
    },
    onSuccess: () => clavesQueDependenDeLaboratorio(qc),
  })
}

export function useRetirarLaboratorio() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (v: { id: number; activo: boolean }) => {
      const { error } = await supabase
        .from('laboratorio')
        .update({ activo: v.activo })
        .eq('id', v.id)
      if (error) throw error
    },
    onSuccess: () => clavesQueDependenDeLaboratorio(qc),
  })
}
```

**Antes de escribir esto, verifica las dos claves ajenas.** Abre
`src/features/practicas/consultas.ts:179` y `src/features/inventario/consultas.ts:469`
y copia sus `queryKey` reales. Una clave inventada no invalida nada y falla en
silencio, que es justo el bug que este bloque viene a evitar.

- [ ] **Paso 2: Escribir la prueba del diálogo**

`src/features/administracion/DialogoLaboratorio.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, test, vi } from 'vitest'

import { DialogoLaboratorio } from './DialogoLaboratorio'

describe('DialogoLaboratorio', () => {
  test('da de alta un laboratorio', async () => {
    const user = userEvent.setup()
    const onGuardar = vi.fn()

    render(
      <DialogoLaboratorio
        abierto
        almacen="N4"
        guardando={false}
        onGuardar={onGuardar}
        onCerrar={vi.fn()}
      />,
    )

    await user.type(screen.getByLabelText('Nombre del laboratorio'), 'Laboratorio de enseñanza 7')
    await user.click(screen.getByRole('button', { name: 'Guardar' }))

    expect(onGuardar).toHaveBeenCalledWith(
      { nombre: 'Laboratorio de enseñanza 7' },
      expect.anything(),
    )
  })

  // El cargador de Excel y el alta de existencia resuelven el laboratorio por
  // nombre normalizado, no por id: renombrar cambia qué renglones futuros hacen
  // match. Las existencias ya registradas no se mueven, porque ésas sí apuntan
  // por id. Decirlo es la diferencia entre una corrección y una sorpresa.
  test('al renombrar avisa del efecto sobre las cargas futuras', () => {
    render(
      <DialogoLaboratorio
        abierto
        almacen="N4"
        inicial={{ nombre: 'Análisis Sensorial' }}
        guardando={false}
        onGuardar={vi.fn()}
        onCerrar={vi.fn()}
      />,
    )

    expect(screen.getByText(/cargas de Excel futuras/i)).toBeInTheDocument()
  })
})
```

- [ ] **Paso 3: Correr para verla fallar**

```bash
pnpm vitest run src/features/administracion/DialogoLaboratorio.test.tsx
```

Esperado: FAIL — no existe el módulo.

- [ ] **Paso 4: Escribir `DialogoLaboratorio.tsx`**

```tsx
import { zodResolver } from '@hookform/resolvers/zod'
import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  TextField,
} from '@mui/material'
import { Controller, useForm } from 'react-hook-form'

import { esquemaLaboratorio, type ValoresLaboratorio } from './esquemas'

type Props = {
  abierto: boolean
  /** La clave del almacén, para que el título diga en cuál se está dando de alta. */
  almacen: string
  /** Si viene, el diálogo renombra; si no, da de alta. */
  inicial?: { nombre: string }
  guardando: boolean
  onGuardar: (valores: ValoresLaboratorio) => void
  onCerrar: () => void
}

export function DialogoLaboratorio({
  abierto,
  almacen,
  inicial,
  guardando,
  onGuardar,
  onCerrar,
}: Props) {
  const { control, handleSubmit, reset } = useForm<ValoresLaboratorio>({
    resolver: zodResolver(esquemaLaboratorio),
    values: { nombre: inicial?.nombre ?? '' },
  })

  function cerrar() {
    reset()
    onCerrar()
  }

  return (
    <Dialog open={abierto} onClose={cerrar} fullWidth maxWidth="xs">
      {/* Un <form> de verdad y no un onClick en el botón: así Enter envía, que
          es como se captura una lista larga sin soltar el teclado. */}
      <form onSubmit={handleSubmit(onGuardar)}>
        <DialogTitle>
          {inicial ? 'Renombrar laboratorio' : `Nuevo laboratorio de ${almacen}`}
        </DialogTitle>
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
                label="Nombre del laboratorio"
                error={!!fieldState.error}
                helperText={fieldState.error?.message}
              />
            )}
          />

          {/* Aviso y no bloqueo: quien renombra suele estar corrigiendo
              justamente un nombre que no hacía match. */}
          {inicial ? (
            <Alert severity="info" sx={{ mt: 1.5 }}>
              Las existencias y prácticas ya registradas no se mueven: apuntan a este
              laboratorio por su identificador. Lo que cambia es a qué renglón hacen match
              las cargas de Excel futuras, que lo resuelven por nombre.
            </Alert>
          ) : null}
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

- [ ] **Paso 5: Correr para verla pasar**

```bash
pnpm vitest run src/features/administracion/DialogoLaboratorio.test.tsx
```

Esperado: PASS.

- [ ] **Paso 6: Escribir la prueba de `ListaLaboratorios`**

`src/features/administracion/ListaLaboratorios.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import { describe, expect, test, vi } from 'vitest'

import type { Laboratorio } from './consultas'
import { ListaLaboratorios } from './ListaLaboratorios'

const LABORATORIOS: Laboratorio[] = [
  { id: 1, nombre: 'Análisis Sensorial', activo: true },
  { id: 2, nombre: 'Laboratorio de enseñanza 5', activo: false },
]

describe('ListaLaboratorios', () => {
  test('marca los retirados', () => {
    render(
      <ListaLaboratorios
        laboratorios={LABORATORIOS}
        puedeEditar
        onEditar={vi.fn()}
        onRetirar={vi.fn()}
      />,
    )

    expect(screen.getByText('Retirado')).toBeInTheDocument()
  })

  // Retirar y reactivar es el mismo botón: el rótulo accesible es lo que dice
  // cuál de las dos cosas hace, y es por lo que se puede probar.
  test('el botón dice retirar o reactivar según el estado', () => {
    render(
      <ListaLaboratorios
        laboratorios={LABORATORIOS}
        puedeEditar
        onEditar={vi.fn()}
        onRetirar={vi.fn()}
      />,
    )

    expect(screen.getByRole('button', { name: 'Retirar Análisis Sensorial' })).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Reactivar Laboratorio de enseñanza 5' }),
    ).toBeInTheDocument()
  })

  test('sin permiso no se dibujan los botones', () => {
    render(
      <ListaLaboratorios
        laboratorios={LABORATORIOS}
        puedeEditar={false}
        onEditar={vi.fn()}
        onRetirar={vi.fn()}
      />,
    )

    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })
})
```

- [ ] **Paso 7: Correr para verla fallar, y escribir `ListaLaboratorios.tsx`**

```bash
pnpm vitest run src/features/administracion/ListaLaboratorios.test.tsx
```

Esperado: FAIL. Entonces:

```tsx
import { Icon } from '@iconify/react'
import { IconButton, List, ListItem, ListItemText, Stack } from '@mui/material'

import type { Laboratorio } from './consultas'

type Props = {
  laboratorios: Laboratorio[]
  puedeEditar: boolean
  onEditar: (laboratorio: Laboratorio) => void
  onRetirar: (laboratorio: Laboratorio) => void
}

/**
 * Los laboratorios a los que surte el almacén elegido.
 *
 * `ListItem` y no `ListItemButton` como en ListaProgramas: de un laboratorio no
 * cuelga nada, así que la fila no se elige y no hay que frenar la propagación
 * del clic.
 */
export function ListaLaboratorios({ laboratorios, puedeEditar, onEditar, onRetirar }: Props) {
  return (
    <List dense disablePadding>
      {laboratorios.map((laboratorio) => (
        <ListItem
          key={laboratorio.id}
          sx={{ pl: 2, pr: 1 }}
          secondaryAction={
            puedeEditar ? (
              <Stack direction="row" spacing={0.25} sx={{ flexShrink: 0 }}>
                <IconButton
                  size="small"
                  aria-label={`Renombrar ${laboratorio.nombre}`}
                  onClick={() => onEditar(laboratorio)}
                >
                  <Icon icon="mdi:pencil-outline" width={16} />
                </IconButton>
                {/* Nunca borrar: existencias y prácticas apuntan aquí. Retirar
                    lo saca del selector de Prácticas, que ya filtra por activo. */}
                <IconButton
                  size="small"
                  aria-label={`${laboratorio.activo ? 'Retirar' : 'Reactivar'} ${laboratorio.nombre}`}
                  onClick={() => onRetirar(laboratorio)}
                >
                  <Icon
                    icon={laboratorio.activo ? 'mdi:archive-outline' : 'mdi:archive-off-outline'}
                    width={16}
                  />
                </IconButton>
              </Stack>
            ) : null
          }
        >
          <ListItemText
            primary={laboratorio.nombre}
            secondary={laboratorio.activo ? undefined : 'Retirado'}
            slotProps={{ primary: { sx: { fontSize: '0.85rem' } } }}
          />
        </ListItem>
      ))}
    </List>
  )
}
```

- [ ] **Paso 8: Conectar los laboratorios en `PaginaAlmacenes.tsx`**

Debajo de `FichaAlmacen`, en la misma columna derecha, una segunda
`ColumnaAcademica titulo="Laboratorios"` con:

- `subtitulo={almacen?.clave}`
- `vacio="Este almacén todavía no tiene laboratorios."`
- `acciones` con un `<Button startIcon={<Icon icon="mdi:plus" width={16} />}>` que
  abre el diálogo en modo alta, sólo si `puedeEditar`
- dentro, `<ListaLaboratorios ... />`

Más, a nivel página: el `Switch` «Ver retirados» en las `acciones` del
`EncabezadoPagina` (copia el bloque de `PaginaAcademico.tsx`), el estado
`const [dialogo, setDialogo] = useState<{ laboratorio?: Laboratorio } | null>(null)`,
un `Snackbar` con el aviso, y el `function alFallar(error: unknown) { setAviso(mensajeDeError(error)) }`
que reciben las tres mutaciones en su `onError`.

- [ ] **Paso 9: Los cuatro de siempre**

```bash
pnpm typecheck && pnpm lint && pnpm build && pnpm vitest run
```

- [ ] **Paso 10: Punto de commit**

Árbol limpio y **para**.

Mensaje sugerido: `feat: los laboratorios se dan de alta desde su almacén`

---

## Tarea 6: Motivos de observación

**Archivos:**
- Crear: `src/features/administracion/ListaMotivos.tsx` + `.test.tsx`
- Crear: `src/features/administracion/DialogoMotivo.tsx` + `.test.tsx`
- Modificar: `src/features/administracion/consultas.ts`
- Modificar: `src/features/administracion/PaginaMotivos.tsx` (el cascarón de la Tarea 2)

**Interfaces:**
- Consume: `mensajeDeError` y el molde de mutaciones; `esquemaMotivo` y `ValoresMotivo`.
- Produce: `type Motivo = { clave: string; etiqueta: string; orden: number; activo: boolean }`, `useMotivos(incluirRetirados)`, `useCrearMotivo()`, `useEditarMotivo()`, `useRetirarMotivo()`.

---

- [ ] **Paso 1: Agregar las consultas de motivo**

Primero, por lo mismo que en la Tarea 5: la prueba de `ListaMotivos` importa el
tipo `Motivo` de aquí. Al final de `src/features/administracion/consultas.ts`:

```ts
// ---------------------------------------------------------------------------
// Motivos de observacion
// ---------------------------------------------------------------------------
// Catalogo de la Unidad, no de un almacen: sigue siendo admin-only (rls.sql:223).
// La PK es `clave`, un texto, asi que los .eq() van sobre ella y no sobre un id.
export type Motivo = { clave: string; etiqueta: string; orden: number; activo: boolean }

export function useMotivos(incluirRetirados: boolean) {
  return useQuery({
    queryKey: ['administracion', 'motivos', incluirRetirados],
    queryFn: async (): Promise<Motivo[]> => {
      let consulta = supabase
        .from('motivo_observacion')
        .select('clave, etiqueta, orden, activo')
        .order('orden')

      if (!incluirRetirados) consulta = consulta.eq('activo', true)

      const { data, error } = await consulta
      if (error) throw error
      return data
    },
  })
}

/** Prácticas los lee por su cuenta, igual que los laboratorios. */
function clavesQueDependenDeMotivo(qc: ReturnType<typeof useQueryClient>) {
  return Promise.all([
    qc.invalidateQueries({ queryKey: ['administracion', 'motivos'] }),
    qc.invalidateQueries({ queryKey: ['practicas', 'motivos'] }),
  ])
}

export function useCrearMotivo() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (v: { clave: string; etiqueta: string; orden: number }) => {
      const { error } = await supabase.from('motivo_observacion').insert(v)
      if (error) throw error
    },
    onSuccess: () => clavesQueDependenDeMotivo(qc),
  })
}

/** La clave nunca entra en el update: `practica_observacion` apunta por ella. */
export function useEditarMotivo() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (v: { clave: string; etiqueta: string; orden: number }) => {
      const { error } = await supabase
        .from('motivo_observacion')
        .update({ etiqueta: v.etiqueta, orden: v.orden })
        .eq('clave', v.clave)
      if (error) throw error
    },
    onSuccess: () => clavesQueDependenDeMotivo(qc),
  })
}

export function useRetirarMotivo() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (v: { clave: string; activo: boolean }) => {
      const { error } = await supabase
        .from('motivo_observacion')
        .update({ activo: v.activo })
        .eq('clave', v.clave)
      if (error) throw error
    },
    onSuccess: () => clavesQueDependenDeMotivo(qc),
  })
}
```

**Verifica `['practicas', 'motivos']`** en `src/features/practicas/consultas.ts`
antes de escribirla, por la misma razón que en la Tarea 5.

- [ ] **Paso 2: Escribir la prueba del diálogo**

`src/features/administracion/DialogoMotivo.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, test, vi } from 'vitest'

import { DialogoMotivo } from './DialogoMotivo'

describe('DialogoMotivo', () => {
  test('da de alta un motivo', async () => {
    const user = userEvent.setup()
    const onGuardar = vi.fn()

    render(
      <DialogoMotivo abierto guardando={false} onGuardar={onGuardar} onCerrar={vi.fn()} />,
    )

    await user.type(screen.getByLabelText('Clave'), 'derrame')
    await user.type(screen.getByLabelText('Etiqueta'), 'Derrame durante la práctica')
    await user.clear(screen.getByLabelText('Orden'))
    await user.type(screen.getByLabelText('Orden'), '8')
    await user.click(screen.getByRole('button', { name: 'Guardar' }))

    expect(onGuardar).toHaveBeenCalledWith(
      { clave: 'derrame', etiqueta: 'Derrame durante la práctica', orden: 8 },
      expect.anything(),
    )
  })

  // La clave es la PK y `practica_observacion` apunta por ella: cambiarla no es
  // renombrar, es romper el vínculo de todas las prácticas que ya la usan.
  test('al editar, la clave no se toca', () => {
    render(
      <DialogoMotivo
        abierto
        inicial={{ clave: 'derrame', etiqueta: 'Derrame', orden: 8 }}
        guardando={false}
        onGuardar={vi.fn()}
        onCerrar={vi.fn()}
      />,
    )

    expect(screen.getByLabelText('Clave')).toBeDisabled()
  })

  test('rechaza una clave con mayúsculas o espacios', async () => {
    const user = userEvent.setup()
    const onGuardar = vi.fn()

    render(
      <DialogoMotivo abierto guardando={false} onGuardar={onGuardar} onCerrar={vi.fn()} />,
    )

    await user.type(screen.getByLabelText('Clave'), 'Derrame Grande')
    await user.type(screen.getByLabelText('Etiqueta'), 'Derrame')
    await user.click(screen.getByRole('button', { name: 'Guardar' }))

    expect(onGuardar).not.toHaveBeenCalled()
    expect(screen.getByText('La clave va en minúsculas y guiones bajos')).toBeInTheDocument()
  })
})
```

- [ ] **Paso 3: Correr para verla fallar**

```bash
pnpm vitest run src/features/administracion/DialogoMotivo.test.tsx
```

Esperado: FAIL.

- [ ] **Paso 4: Escribir `DialogoMotivo.tsx`**

```tsx
import { zodResolver } from '@hookform/resolvers/zod'
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  Stack,
  TextField,
  DialogTitle,
} from '@mui/material'
import { Controller, useForm } from 'react-hook-form'

import { esquemaMotivo, type ValoresMotivo } from './esquemas'

type Props = {
  abierto: boolean
  /** Si viene, el diálogo edita; si no, da de alta. */
  inicial?: { clave: string; etiqueta: string; orden: number }
  guardando: boolean
  onGuardar: (valores: ValoresMotivo) => void
  onCerrar: () => void
}

export function DialogoMotivo({ abierto, inicial, guardando, onGuardar, onCerrar }: Props) {
  const { control, handleSubmit, reset } = useForm<ValoresMotivo>({
    resolver: zodResolver(esquemaMotivo),
    values: {
      clave: inicial?.clave ?? '',
      etiqueta: inicial?.etiqueta ?? '',
      orden: inicial?.orden ?? 1,
    },
  })

  function cerrar() {
    reset()
    onCerrar()
  }

  return (
    <Dialog open={abierto} onClose={cerrar} fullWidth maxWidth="xs">
      <form onSubmit={handleSubmit(onGuardar)}>
        <DialogTitle>{inicial ? 'Editar motivo' : 'Nuevo motivo de observación'}</DialogTitle>
        <DialogContent>
          <Stack spacing={1}>
            <Controller
              name="clave"
              control={control}
              render={({ field, fieldState }) => (
                <TextField
                  {...field}
                  autoFocus={!inicial}
                  fullWidth
                  margin="dense"
                  label="Clave"
                  // La clave es la PK y `practica_observacion` apunta por ella:
                  // cambiarla no es renombrar, es romper el vínculo de todas las
                  // prácticas que ya la usan.
                  disabled={!!inicial}
                  error={!!fieldState.error}
                  helperText={
                    fieldState.error?.message ??
                    (inicial ? 'La clave no se cambia: hay prácticas que la usan' : undefined)
                  }
                />
              )}
            />

            <Controller
              name="etiqueta"
              control={control}
              render={({ field, fieldState }) => (
                <TextField
                  {...field}
                  autoFocus={!!inicial}
                  fullWidth
                  margin="dense"
                  label="Etiqueta"
                  error={!!fieldState.error}
                  helperText={fieldState.error?.message ?? 'Lo que lee quien registra la práctica'}
                />
              )}
            />

            <Controller
              name="orden"
              control={control}
              render={({ field, fieldState }) => (
                <TextField
                  {...field}
                  // `orden` es not null en la tabla: aquí no hay caso nulo, a
                  // diferencia de personas_expuestas en la ficha del almacén.
                  onChange={(e) => field.onChange(Number(e.target.value))}
                  type="number"
                  fullWidth
                  margin="dense"
                  label="Orden"
                  error={!!fieldState.error}
                  helperText={fieldState.error?.message ?? 'En qué posición aparece en la lista'}
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

- [ ] **Paso 5: Correr para verla pasar**

```bash
pnpm vitest run src/features/administracion/DialogoMotivo.test.tsx
```

Esperado: PASS, las tres.

- [ ] **Paso 6: Escribir la prueba de `ListaMotivos`**

`src/features/administracion/ListaMotivos.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import { describe, expect, test, vi } from 'vitest'

import type { Motivo } from './consultas'
import { ListaMotivos } from './ListaMotivos'

const MOTIVOS: Motivo[] = [
  { clave: 'derrame', etiqueta: 'Derrame durante la práctica', orden: 1, activo: true },
  { clave: 'faltante', etiqueta: 'Faltante al devolver', orden: 2, activo: false },
]

describe('ListaMotivos', () => {
  test('marca los retirados', () => {
    render(<ListaMotivos motivos={MOTIVOS} onEditar={vi.fn()} onRetirar={vi.fn()} />)

    expect(screen.getByText('Retirado')).toBeInTheDocument()
  })

  // La clave es lo que el responsable ve en la base y en las prácticas viejas:
  // enseñarla junto a la etiqueta es lo que hace posible casarlas.
  test('enseña la clave del que sigue activo', () => {
    render(<ListaMotivos motivos={MOTIVOS} onEditar={vi.fn()} onRetirar={vi.fn()} />)

    expect(screen.getByText('derrame')).toBeInTheDocument()
  })

  test('el botón dice retirar o reactivar según el estado', () => {
    render(<ListaMotivos motivos={MOTIVOS} onEditar={vi.fn()} onRetirar={vi.fn()} />)

    expect(
      screen.getByRole('button', { name: 'Retirar Derrame durante la práctica' }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Reactivar Faltante al devolver' }),
    ).toBeInTheDocument()
  })
})
```

- [ ] **Paso 7: Correr para verla fallar, y escribir `ListaMotivos.tsx`**

```bash
pnpm vitest run src/features/administracion/ListaMotivos.test.tsx
```

Esperado: FAIL. Entonces:

```tsx
import { Icon } from '@iconify/react'
import { IconButton, List, ListItem, ListItemText, Stack } from '@mui/material'

import type { Motivo } from './consultas'

type Props = {
  motivos: Motivo[]
  onEditar: (motivo: Motivo) => void
  onRetirar: (motivo: Motivo) => void
}

/**
 * No lleva `puedeEditar` como la de laboratorios: a esta pantalla sólo entra el
 * admin —la ruta va bajo SoloAdmin y la política es admin-only— así que un
 * estado de sólo lectura sería un caso que no existe.
 */
export function ListaMotivos({ motivos, onEditar, onRetirar }: Props) {
  return (
    <List dense disablePadding>
      {motivos.map((motivo) => (
        <ListItem
          key={motivo.clave}
          sx={{ pl: 2, pr: 1 }}
          secondaryAction={
            <Stack direction="row" spacing={0.25} sx={{ flexShrink: 0 }}>
              <IconButton
                size="small"
                aria-label={`Editar ${motivo.etiqueta}`}
                onClick={() => onEditar(motivo)}
              >
                <Icon icon="mdi:pencil-outline" width={16} />
              </IconButton>
              <IconButton
                size="small"
                aria-label={`${motivo.activo ? 'Retirar' : 'Reactivar'} ${motivo.etiqueta}`}
                onClick={() => onRetirar(motivo)}
              >
                <Icon
                  icon={motivo.activo ? 'mdi:archive-outline' : 'mdi:archive-off-outline'}
                  width={16}
                />
              </IconButton>
            </Stack>
          }
        >
          <ListItemText
            primary={motivo.etiqueta}
            secondary={motivo.activo ? motivo.clave : 'Retirado'}
            slotProps={{ primary: { sx: { fontSize: '0.85rem' } } }}
          />
        </ListItem>
      ))}
    </List>
  )
}
```

- [ ] **Paso 8: Escribir `PaginaMotivos.tsx`**

Sustituye el cascarón. Una sola columna
(`Grid size={{ xs: 12, md: 6 }}`), `ColumnaAcademica titulo="Motivos"`, el
`Switch` «Ver retirados» en el encabezado, el botón de alta en `acciones`, el
`Snackbar` con `mensajeDeError`, y
`padre={{ etiqueta: 'Administración', ruta: '/administracion' }}`.

- [ ] **Paso 9: Los cuatro de siempre**

```bash
pnpm typecheck && pnpm lint && pnpm build && pnpm vitest run
```

- [ ] **Paso 10: Punto de commit**

Árbol limpio y **para**. En el reporte final de esta tarea, recuerda la lista
completa de lo que le queda a Daniel:

1. `npx supabase db push` para que la migración de la Tarea 1 llegue al remoto.
2. Los dos bloques `begin; … rollback;` del Paso 7 de la Tarea 1, en el SQL
   editor, para ver los `42501` con sus propios ojos.
3. Probar a mano con `n4@uaeh.local` que puede dar de alta un laboratorio y que
   aparece en el selector de Prácticas sin recargar.

Mensaje sugerido: `feat: los motivos de observación se administran desde la app`
