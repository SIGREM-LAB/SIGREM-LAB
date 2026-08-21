# Pantalla de inventario (consulta) — Plan de implementacion

> **Para quien lo ejecute con agentes:** SUB-SKILL REQUERIDA: usa
> `superpowers:subagent-driven-development` (recomendada) o
> `superpowers:executing-plans` para ir tarea por tarea. Los pasos llevan
> casilla (`- [ ]`) para marcarlos.

**Objetivo:** que `/inventario` liste las existencias de los cuatro almacenes con
busqueda, filtros y panel de detalle, en modo solo lectura, sobre una vista que
hereda la RLS; y cerrar de paso los dos huecos de escritura que la revision de
roles destapo.

**Arquitectura:** una vista `existencia_listado` con `security_invoker = on`
aplana el join de existencia, articulo, almacen y ubicacion, y expone el nombre y
la marca ya normalizados para que la busqueda sin acentos use el indice trigram
que el esquema ya tiene. La pantalla pide 25 filas a la vez con `range()` y
`count: 'exact'`. Los componentes reciben los datos por props; solo
`PaginaInventario` habla con TanStack Query.

**Stack:** Postgres 17.6 via Supabase CLI, pgTAP, MUI 9.3.1, TanStack Query 5,
`@iconify/react`, Vite 8, Vitest 4, Testing Library. **Sin dependencias nuevas.**

**Spec:** `docs/specs/2026-08-21-pantalla-inventario-consulta-design.md` — se lee
junto con este plan; el plan argumenta desde ahi.

## Restricciones globales

- **En español.** Identificadores del dominio, comentarios y todo el texto que ve
  el usuario. Los comentarios explican *por que*, no *que*.
- **Colores solo en el tema**, salvo los dos modulos de datos:
  `src/app/almacenes.ts` (ya existe) y el nuevo `presentacion.ts` para los
  estados. Fuera de ahi no se escribe un hex.
- **MUI 9:** `<Grid size={{ xs: 12 }}>`, nunca `<Grid item xs={12}>`. Las props
  de sistema van dentro de `sx`, no sueltas: `<Stack sx={{ alignItems: 'center' }}>`,
  no `<Stack alignItems="center">`. `spacing` y `direction` si son props propias.
- **`if (error) throw error`** despues de cada llamada a supabase-js. Sin esa
  linea Query cree que todo salio bien y deja la pantalla en blanco.
- **Nunca se escribe `existencia.cantidad` desde el cliente.** Esta pantalla no
  escribe nada, pero la Task 1 lo vuelve imposible por privilegios.
- **Los tipos se generan.** Nadie edita `src/types/database.ts` a mano.
- **Nada de `Co-Authored-By` ni firmas de herramientas en los commits.** Misma
  regla que el plan del tema del 19 de agosto.
- **Antes de dar por terminada cualquier tarea:**
  `pnpm typecheck && pnpm lint && pnpm test && pnpm build` y `supabase test db`.
  Los cinco en cero.
- **Las migraciones no se editan una vez aplicadas al remoto.** La de este plan
  es nueva y todavia no se ha empujado, asi que las Tasks 1 y 2 escriben en el
  mismo archivo mientras siga siendo local.
- **NO se corre `supabase db reset`.** La base local tiene 164 existencias
  cargadas por el ETL el 21 de agosto, y **no las reproduce ningun archivo del
  repo**: `seed.sql` no inserta existencias y `datos-iniciales.sql` es para el
  proyecto remoto. Un reset las borra sin vuelta atras. Se aplica con
  `supabase migration up`, que solo corre lo pendiente.
  Los dos archivos de pruebas van envueltos en `begin; ... rollback;`, asi que
  `supabase test db` no deja rastro y se puede correr las veces que haga falta
  contra la base viva.
  Respaldo tomado antes de empezar, por si acaso:
  `scratchpad/respaldo-inventario-20260821.sql` (164 existencias, 162
  movimientos, 152 articulos).
  Si en algun momento hace falta un reset de verdad, primero se restaura ese
  volcado despues.
- **Usuarios de prueba** (todos con `sigrem2026`): `admin@uaeh.local`,
  `n3@uaeh.local`, `n4@uaeh.local`, `lum@uaeh.local`, `le@uaeh.local`,
  `lectura@uaeh.local`.
- **Claves de almacen:** `N3`, `N4`, `LUM`, `LE`. El prototipo escribe
  "Electronica"; no se copia.

---

## Lo que la verificacion previa cambio respecto al spec

Todo esto se comprobo ejecutandolo antes de escribir el plan. Son cuatro cosas
que el spec no podia saber y que cambian el codigo.

**1. `revoke update (columna)` no hace nada si el rol tiene UPDATE de tabla.**
`authenticated` lo tiene por el `grant all` por omision de Supabase. Hay que
`revoke update on <tabla>` y despues `grant update (col, col, ...)`. El spec ya
lo documenta; el plan lo ejecuta en ese orden y la Task 1 lo prueba.

**2. Cortar el nombre en la primera coma parte los nombres quimicos.**
`"1,10-Fenantrolina monohidrato, solido, ..."` se corta en `"1"`, porque la coma
de `1,10` viene antes. Verificado con la primera fila real de la base. El corte
tiene que ignorar las comas que separan digitos: `nombre.search(/,(?!\d)/)`.
Con eso da `"1,10-Fenantrolina monohidrato"`.

**3. `norm_texto()` y el equivalente en JS coinciden.** Comprobado contra la
base:

| Entrada | `norm_texto()` |
|---|---|
| `Ácido clorhídrico` | `acido clorhidrico` |
| `Ñandú` | `nandu` |
| `ÜBER` | `uber` |

`toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')` da lo mismo en
los tres. La Task 3 lo fija con esos casos exactos.

**4. Son diez pruebas nuevas de RLS, no ocho.** El punto 2 de la §8 del spec
cubre `movimiento` y `ubicacion` por separado. `plan(30)` pasa a `plan(40)`.

---

## Estructura de archivos

| Archivo | Responsabilidad |
|---|---|
| `supabase/migrations/20260821120000_inventario_consulta.sql` | **Crear.** Cierra los dos huecos y crea la vista |
| `supabase/tests/database/rls.test.sql` | **Modificar.** Diez pruebas nuevas al final; `plan(30)` → `plan(40)` |
| `supabase/tests/database/esquema.test.sql` | **Modificar.** La vista existe y tiene `security_invoker` |
| `src/types/database.ts` | **Regenerar.** Nunca a mano |
| `src/features/inventario/presentacion.ts` | **Crear.** Puro: corte del nombre, normalizacion, mapa de estados |
| `src/features/inventario/filtros.ts` | **Crear.** Puro: el tipo `Filtros` y su valor inicial segun el rol |
| `src/features/inventario/TablaExistencias.tsx` | **Crear.** La tabla y su paginacion. Recibe filas por props |
| `src/features/inventario/FiltrosInventario.tsx` | **Crear.** Buscador y selects. Controlado desde arriba |
| `src/features/inventario/PanelExistencia.tsx` | **Crear.** El `Drawer` de detalle |
| `src/features/inventario/consultas.ts` | **Crear.** `useExistencias`, `useDetalleExistencia`, `useMovimientos` |
| `src/features/inventario/PaginaInventario.tsx` | **Crear.** Compone todo y sostiene el estado de filtros |
| `src/App.tsx` | **Modificar.** La ruta `/inventario` |
| `src/app/navegacion.ts` | **Modificar.** El item pasa a `disponible: true` |

Los componentes reciben datos por props y no llaman a supabase. Eso es lo que
permite probarlos con arreglos planos, sin dobles del cliente, siguiendo lo que
ya hace `ProveedorSesion.test.tsx`: *no se afirma sobre el doble, se afirma sobre
lo que el componente renderiza*.

---

### Task 1: Cerrar los dos huecos de escritura

**Files:**
- Create: `supabase/migrations/20260821120000_inventario_consulta.sql`
- Modify: `supabase/tests/database/rls.test.sql` (cabecera `plan()` y bloque final)

**Interfaces:**
- Consumes: nada.
- Produces: `private.recalcular_estado()` (trigger `existencia_recalcula_estado`
  sobre `public.existencia`), y las cuatro politicas con `puede_escribir()`.

- [ ] **Step 1: Escribe las pruebas que fallan**

En `supabase/tests/database/rls.test.sql`, cambia la cabecera:

```sql
select plan(40);
```

y agrega al final del archivo:

```sql
-- ---------------------------------------------------------------------------
-- 31-40. Escritura: quien puede, y sobre que columnas
-- ---------------------------------------------------------------------------
-- Estas diez cierran los dos huecos que encontro la revision de roles del 21 de
-- agosto. La prueba 18 no los detecto porque solo ejercita `articulo`.

-- El escenario del hueco A: un usuario de rol `consulta` AL QUE SE LE ASIGNO un
-- almacen. Es un estado alcanzable -nada lo prohibe- y hasta ahora le daba
-- permiso de escritura, porque las politicas solo comparaban el almacen.
select pg_temp.como_postgres();
update public.perfil set almacen_id = pg_temp.id_almacen('N3')
 where id = (select id from auth.users where email = 'lectura@uaeh.local');

select pg_temp.como('lectura@uaeh.local');

select throws_ok(
  $$ insert into public.existencia (articulo_id, almacen_id, cantidad)
     values (900001, (select id from public.almacen where clave = 'N3'), 5) $$,
  '42501', null,
  'Un consulta con almacen asignado no puede crear existencias'
);

select throws_ok(
  $$ insert into public.movimiento (existencia_id, tipo, cantidad,
                                    almacen_id, cantidad_antes, cantidad_despues)
     values (900001, 'entrada', 5, 0, 0, 0) $$,
  '42501', null,
  'Un consulta con almacen asignado no puede registrar movimientos'
);

select throws_ok(
  $$ insert into public.ubicacion (almacen_id, etiqueta)
     values ((select id from public.almacen where clave = 'N3'), 'N3 . Colada') $$,
  '42501', null,
  'Un consulta con almacen asignado no puede crear ubicaciones'
);

-- Devolver el perfil a como estaba: las pruebas no se heredan estado entre si.
select pg_temp.como_postgres();
update public.perfil set almacen_id = null
 where id = (select id from auth.users where email = 'lectura@uaeh.local');

-- El hueco B: el saldo, el codigo del QR y el ancla de permisos no se escriben
-- desde el cliente. La bitacora es el unico camino.
select pg_temp.como('n3@uaeh.local');

select throws_ok(
  $$ update public.existencia set cantidad = 99999 where id = 900001 $$,
  '42501', null,
  'Un responsable no puede escribir el saldo directo'
);

select throws_ok(
  $$ update public.existencia set codigo = 'N3-FALSO' where id = 900001 $$,
  '42501', null,
  'Un responsable no puede reescribir el codigo de la etiqueta'
);

select throws_ok(
  $$ update public.existencia set almacen_id = 2 where id = 900001 $$,
  '42501', null,
  'Un responsable no puede mudar una existencia a otro almacen'
);

-- Lo que si le toca sigue funcionando: si esto se rompe, el arreglo se paso de
-- estricto y la pantalla de alta nace muerta.
select lives_ok(
  $$ update public.existencia
        set observaciones = 'Frasco rayado', marca = 'MEYER'
      where id = 900001 $$,
  'Un responsable si edita las columnas descriptivas de lo suyo'
);

-- El trigger nuevo: fijar un minimo por encima del saldo cambia el estado sin
-- que medie un movimiento. Antes solo se recalculaba al insertar.
select pg_temp.como_postgres();
insert into public.movimiento (existencia_id, tipo, cantidad,
                               almacen_id, cantidad_antes, cantidad_despues, usuario_id)
values (900001, 'carga_inicial', 100, 0, 0, 0,
        (select id from auth.users where email = 'admin@uaeh.local'));

select pg_temp.como('n3@uaeh.local');
update public.existencia set cantidad_minima = 500 where id = 900001;

select is(
  (select estado from public.existencia where id = 900001),
  'stock_bajo'::public.estado_existencia,
  'Subir el minimo por encima del saldo deja la existencia en stock_bajo'
);

-- Y el camino legitimo no se rompio: el trigger de movimiento es security
-- definer, asi que los privilegios de columna de authenticated no lo alcanzan.
select lives_ok(
  $$ insert into public.movimiento (existencia_id, tipo, cantidad,
                                    almacen_id, cantidad_antes, cantidad_despues)
     values (900001, 'consumo', -10, 0, 0, 0) $$,
  'Un responsable sigue moviendo el saldo por la bitacora'
);

select is(
  (select cantidad from public.existencia where id = 900001),
  90::numeric(14,4),
  'El movimiento aplico el saldo aunque cantidad no sea escribible'
);
```

- [ ] **Step 2: Corre las pruebas y comprueba que fallan**

```bash
supabase migration up && supabase test db
```

Esperado: FALLA. Los tres `throws_ok` del hueco A y los tres del hueco B pasan
sin lanzar nada, asi que pgTAP los reporta como `not ok`. La prueba de
`stock_bajo` tambien falla: hoy nada recalcula en un `UPDATE`, asi que el estado
se queda en `disponible`.

- [ ] **Step 3: Escribe la migracion**

Crea `supabase/migrations/20260821120000_inventario_consulta.sql`:

```sql
-- Pantalla de inventario en modo consulta: cierra dos huecos de escritura y
-- publica la vista que alimenta el listado.
--
-- Diseno: docs/specs/2026-08-21-pantalla-inventario-consulta-design.md

-- ---------------------------------------------------------------------------
-- Hueco A: las politicas de escritura no consultaban el rol
-- ---------------------------------------------------------------------------
-- Comparaban el almacen y nada mas. Un usuario de rol `consulta` al que se le
-- asigne un almacen -algo natural, para que la pantalla le arranque filtrada en
-- el suyo- quedaba con permiso de escritura, contra lo que promete la §12 del
-- spec del 18 de agosto. `puede_escribir()` es cierto para admin y responsable,
-- asi que agregar el conjunto no le quita nada a quien ya podia.

alter policy existencia_alta on public.existencia
  with check ((select private.puede_escribir())
              and ((select private.es_admin())
                   or almacen_id = (select private.almacen_actual())));

alter policy existencia_edicion on public.existencia
  using      ((select private.puede_escribir())
              and ((select private.es_admin())
                   or almacen_id = (select private.almacen_actual())))
  with check ((select private.puede_escribir())
              and ((select private.es_admin())
                   or almacen_id = (select private.almacen_actual())));

alter policy ubicacion_escritura on public.ubicacion
  using      ((select private.puede_escribir())
              and ((select private.es_admin())
                   or almacen_id = (select private.almacen_actual())))
  with check ((select private.puede_escribir())
              and ((select private.es_admin())
                   or almacen_id = (select private.almacen_actual())));

alter policy movimiento_alta on public.movimiento
  with check ((select private.puede_escribir())
              and ((select private.es_admin())
                   or almacen_id = (select private.almacen_actual())));


-- ---------------------------------------------------------------------------
-- Hueco B: el saldo se podia escribir directo, sin bitacora
-- ---------------------------------------------------------------------------
-- `existencia_edicion` autoriza un UPDATE sobre la fila entera y los dos
-- triggers del esquema son BEFORE INSERT, asi que nada impedia
-- `update existencia set cantidad = 99999`. Eso se salta la auditoria y ademas
-- permite reescribir el codigo impreso en la etiqueta.
--
-- OJO CON EL ORDEN. `revoke update (cantidad) ...` por si solo NO HACE NADA:
-- `authenticated` tiene UPDATE a nivel tabla por el `grant all` por omision de
-- Supabase, y un privilegio de tabla implica todas las columnas. Hay que
-- revocar la tabla y devolver las columnas editables.

revoke update on public.existencia from authenticated;

grant update (ubicacion_id, laboratorio_id, marca, modelo, presentacion,
              cantidad_minima, peso_frasco_vacio, peso_total, numero_serie,
              numero_inventario_uaeh, funcionamiento, mantenimiento, fecha_chequeo,
              metodo_conservacion, temperatura, fecha_recoleccion, fecha_preparacion,
              responsable_muestra, fecha_adquisicion, fecha_caducidad,
              estado, observaciones)
  on public.existencia to authenticated;

-- Quedan fuera: `cantidad` (la mantiene el trigger desde movimiento), `codigo`
-- (la identidad de la etiqueta), `almacen_id` (el ancla de los permisos),
-- `articulo_id` (que ES la cosa; solo se mueve por fusionar_articulo, de admin),
-- `carga_id` y `creado_en` (procedencia).

-- `estado` SI es editable: un responsable tiene que poder marcar un frasco como
-- contaminado o un equipo en mantenimiento. Lo que impide que abuse es este
-- trigger, porque `estado_calculado` respeta los tres estados manuales y
-- recalcula el resto: marcar `disponible` algo en cero no sirve de nada.
--
-- De paso arregla un hueco silencioso: hasta ahora fijar `cantidad_minima` no
-- surtia efecto hasta el siguiente movimiento.
create or replace function private.recalcular_estado()
returns trigger
language plpgsql
security definer
set search_path = ''
as $funcion$
begin
  new.estado := private.estado_calculado(new.cantidad, new.cantidad_minima, new.estado);
  return new;
end;
$funcion$;

create trigger existencia_recalcula_estado
  before update on public.existencia
  for each row execute function private.recalcular_estado();
```

- [ ] **Step 4: Corre las pruebas y comprueba que pasan**

```bash
supabase migration up && supabase test db
```

Esperado: PASA, 40 de 40.

Si falla `'El movimiento aplico el saldo aunque cantidad no sea escribible'`,
el trigger `aplicar_movimiento` perdio su `security definer`: sin eso corre como
`authenticated` y choca con el `revoke` de la columna.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260821120000_inventario_consulta.sql supabase/tests/database/rls.test.sql
git commit -m "fix(rls): la escritura exige rol, y el saldo solo se mueve por la bitacora"
```

---

### Task 2: La vista `existencia_listado`

**Files:**
- Modify: `supabase/migrations/20260821120000_inventario_consulta.sql` (agrega al final)
- Modify: `supabase/tests/database/esquema.test.sql`
- Modify: `supabase/tests/database/rls.test.sql` (una prueba mas; `plan(40)` → `plan(41)`)
- Regenerate: `src/types/database.ts`

**Interfaces:**
- Consumes: la migracion de la Task 1.
- Produces: `public.existencia_listado` con las columnas `id`, `codigo`, `marca`,
  `cantidad`, `estado`, `almacen_id`, `ubicacion_id`, `fecha_caducidad`,
  `creado_en`, `articulo_id`, `nombre_canonico`, `descripcion`, `clasificacion`,
  `unidad_base`, `almacen_clave`, `ubicacion`, `nombre_norm`, `marca_norm`.
  En TypeScript: `Tables<'existencia_listado'>`.

- [ ] **Step 1: Escribe las pruebas que fallan**

En `supabase/tests/database/esquema.test.sql`, busca el `select plan(N)` de la
cabecera, sumale 2, y agrega al final:

```sql
-- ---------------------------------------------------------------------------
-- La vista del listado hereda la RLS
-- ---------------------------------------------------------------------------
-- Esta es la prueba mas importante del archivo. Una vista sin
-- `security_invoker` corre con los privilegios de su dueno (postgres) y NO
-- aplica la RLS de las tablas de abajo: publica el inventario completo a la
-- anon key, que va dentro del binario. Comprobado el 21 de agosto: sin el
-- ajuste, `anon` leia las 164 existencias.
--
-- Falla en silencio, asi que el seguro va aqui y no en la revision de nadie.
select has_view('public', 'existencia_listado', 'La vista del listado existe');

select is(
  (select reloptions::text[] @> array['security_invoker=on']
     from pg_class
    where oid = 'public.existencia_listado'::regclass),
  true,
  'La vista del listado corre con los privilegios de quien la consulta'
);
```

En `supabase/tests/database/rls.test.sql` sube la cabecera a `select plan(41);`
y agrega al final:

```sql
-- El otro candado: aunque la vista herede la RLS, anon no tiene por que verla
-- ni en el catalogo. Dos candados en la puerta, como ya hace `movimiento`.
select pg_temp.como_postgres();
select set_config('role', 'anon', true);

select throws_ok(
  $$ select count(*) from public.existencia_listado $$,
  '42501', null,
  'anon no puede leer la vista del listado'
);

select pg_temp.como_postgres();
```

- [ ] **Step 2: Corre las pruebas y comprueba que fallan**

```bash
supabase migration up && supabase test db
```

Esperado: FALLA con `relation "public.existencia_listado" does not exist`.

- [ ] **Step 3: Agrega la vista a la migracion**

Al final de `supabase/migrations/20260821120000_inventario_consulta.sql`:

```sql
-- ---------------------------------------------------------------------------
-- La vista que alimenta el listado
-- ---------------------------------------------------------------------------
-- El listado une cuatro tablas, busca sobre tres campos y ordena por cualquier
-- columna. Contra los recursos embebidos de PostgREST eso se vuelve fragil: un
-- `or` que cruza una columna propia con una embebida pelea con la sintaxis.
-- Aplanado, el cliente vuelve a ser trivial.
--
-- `security_invoker = on` NO ES OPCIONAL y falla en silencio si se omite: sin
-- el, la vista corre como su dueno y publica el inventario entero a anon.
-- La prueba en esquema.test.sql existe por eso.
--
-- `nombre_norm` va como columna propia y no concatenada con marca y codigo: asi
-- el predicado empuja hasta `articulo` y usa articulo_nombre_trgm_idx. Una
-- concatenacion no la cubre ningun indice y obliga a recorrer todo calculando
-- norm_texto por renglon.
create view public.existencia_listado
with (security_invoker = on) as
select e.id, e.codigo, e.marca, e.cantidad, e.estado, e.almacen_id,
       e.ubicacion_id, e.fecha_caducidad, e.creado_en,
       a.id as articulo_id,
       a.nombre_canonico, a.descripcion, a.clasificacion, a.unidad_base,
       al.clave   as almacen_clave,
       u.etiqueta as ubicacion,
       public.norm_texto(a.nombre_canonico)     as nombre_norm,
       public.norm_texto(coalesce(e.marca, '')) as marca_norm
from public.existencia e
join public.articulo a  on a.id  = e.articulo_id
join public.almacen  al on al.id = e.almacen_id
left join public.ubicacion u on u.id = e.ubicacion_id;

comment on view public.existencia_listado is
  'Listado plano para la pantalla de inventario. Hereda la RLS de existencia.';

grant select on public.existencia_listado to authenticated;
revoke all  on public.existencia_listado from anon;
```

- [ ] **Step 4: Corre las pruebas y comprueba que pasan**

```bash
supabase migration up && supabase test db
```

Esperado: PASA. 41 en `rls.test.sql` y dos mas en `esquema.test.sql`.

- [ ] **Step 5: Comprueba a mano que el indice se usa**

```bash
docker exec -i supabase_db_SIGREM-LAB psql -U postgres -d postgres -c \
  "explain (costs off) select * from public.existencia_listado where nombre_norm like '%acetona%';"
```

Esperado: el plan menciona `Bitmap Index Scan on articulo_nombre_trgm_idx`. Si
sale `Seq Scan on articulo`, el predicado dejo de empujarse y la busqueda se
degrada en cuanto entren los ~5,500 renglones del ETL.

- [ ] **Step 6: Regenera los tipos**

```bash
pnpm gen:types
```

Esperado: `src/types/database.ts` gana `existencia_listado` bajo `Views`, con
`Row` y **sin** `Insert` ni `Update` — la vista lleva joins, asi que Postgres no
la considera actualizable. Que sea de solo lectura por construccion es
exactamente lo que se quiere.

- [ ] **Step 7: Commit**

```bash
git add supabase/ src/types/database.ts
git commit -m "feat(db): vista existencia_listado para el listado de inventario"
```

---

### Task 3: `presentacion.ts` — corte del nombre, normalizacion y estados

**Files:**
- Create: `src/features/inventario/presentacion.ts`
- Test: `src/features/inventario/presentacion.test.ts`

**Interfaces:**
- Consumes: `Enums<'estado_existencia'>` de `@/types/database`.
- Produces:
  - `cortarNombre(nombre: string): { cabeza: string; resto: string }`
  - `normalizarTermino(texto: string): string`
  - `ESTADO: Record<Enums<'estado_existencia'>, { etiqueta: string; color: string }>`

- [ ] **Step 1: Escribe la prueba que falla**

Crea `src/features/inventario/presentacion.test.ts`:

```ts
import { describe, expect, test } from 'vitest'

import { cortarNombre, normalizarTermino, ESTADO } from './presentacion'

describe('cortarNombre', () => {
  test('separa la sustancia de sus caracteristicas', () => {
    expect(
      cortarNombre('Acetona, líquido, grado A.C.S., pureza 99.5%, presentación 4 L, CAS: 67-64-1'),
    ).toEqual({
      cabeza: 'Acetona',
      resto: 'líquido · grado A.C.S. · pureza 99.5% · presentación 4 L',
    })
  })

  // El caso que rompe la version ingenua: la coma de "1,10" viene antes que la
  // que de verdad separa. Cortar en la primera coma daria la cabeza "1".
  test('no parte el nombre quimico por sus propias comas', () => {
    expect(
      cortarNombre('1,10-Fenantrolina monohidrato, sólido, pureza 99%, CAS: 5144-89-8'),
    ).toEqual({
      cabeza: '1,10-Fenantrolina monohidrato',
      resto: 'sólido · pureza 99%',
    })
  })

  test('deja intacto un nombre sin comas', () => {
    expect(cortarNombre('Matraz volumétrico')).toEqual({
      cabeza: 'Matraz volumétrico',
      resto: '',
    })
  })

  test('tira el CAS, que ya sale en el panel de detalle', () => {
    expect(cortarNombre('Etanol, líquido, CAS: 64-17-5').resto).toBe('líquido')
  })
})

describe('normalizarTermino', () => {
  // Los tres casos estan verificados contra public.norm_texto() en la base: si
  // dejan de coincidir, buscar "acido" deja de encontrar "Ácido".
  test.each([
    ['Ácido clorhídrico', 'acido clorhidrico'],
    ['Ñandú', 'nandu'],
    ['ÜBER', 'uber'],
  ])('normaliza %s igual que norm_texto', (entrada, esperado) => {
    expect(normalizarTermino(entrada)).toBe(esperado)
  })

  test('quita los caracteres que romperian el filtro or() de PostgREST', () => {
    expect(normalizarTermino('acido, (99%)*')).toBe('acido 99%')
  })

  test('recorta los espacios de los extremos', () => {
    expect(normalizarTermino('  acetona  ')).toBe('acetona')
  })
})

describe('ESTADO', () => {
  test('cubre los seis estados del enum', () => {
    expect(Object.keys(ESTADO).sort()).toEqual([
      'agotado', 'baja', 'contaminado', 'disponible', 'mantenimiento', 'stock_bajo',
    ])
  })
})
```

- [ ] **Step 2: Corre la prueba y comprueba que falla**

```bash
pnpm test presentacion
```

Esperado: FALLA con `Failed to resolve import "./presentacion"`.

- [ ] **Step 3: Escribe el modulo**

Crea `src/features/inventario/presentacion.ts`:

```ts
import type { Enums } from '@/types/database'

/**
 * Los nombres de reactivo llegan como la cadena completa del formato:
 * "Acetona, líquido, grado A.C.S., pureza 99.5%, presentación 4 L, CAS: 67-64-1".
 * Son unos 90 caracteres y no caben en una celda.
 *
 * El corte es de PRESENTACION: `nombre_canonico` se guarda íntegro, porque la
 * pureza es lo que distingue dos artículos. Aquí sólo se decide qué se lee
 * primero.
 *
 * La coma que separa no es la primera: los nombres químicos traen las suyas
 * ("1,10-Fenantrolina", "2,4-D"). Se busca la primera coma que NO venga seguida
 * de un dígito.
 */
export function cortarNombre(nombre: string): { cabeza: string; resto: string } {
  const corte = nombre.search(/,(?!\d)/)
  if (corte === -1) return { cabeza: nombre.trim(), resto: '' }

  const resto = nombre
    .slice(corte + 1)
    .split(',')
    .map((parte) => parte.trim())
    // El CAS se repite en el panel de detalle, y aquí gasta el ancho que
    // necesita la pureza, que es lo que de verdad distingue dos renglones.
    .filter((parte) => parte !== '' && !/^CAS\b/i.test(parte))
    .join(' · ')

  return { cabeza: nombre.slice(0, corte).trim(), resto }
}

/**
 * La misma normalización que `public.norm_texto()` en la base: minúsculas y sin
 * acentos. Tiene que coincidir, porque el término se compara contra las columnas
 * `nombre_norm` y `marca_norm` de la vista, que ya vienen normalizadas.
 *
 * Además quita los caracteres que romperían el filtro `or()` de PostgREST, que
 * separa sus argumentos por comas y agrupa con paréntesis. Un usuario que teclea
 * "acido, 99%" no está pidiendo nada raro; sin esta limpieza, la consulta sale
 * malformada.
 */
export function normalizarTermino(texto: string): string {
  return texto
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[,()*\\]/g, '')
    .trim()
}

/**
 * Los seis estados con su color. Viven aquí y no en el tema por la misma razón
 * que los colores de almacén en `almacenes.ts`: no son la paleta de la interfaz,
 * son un atributo del dato -lo que en una gráfica sería la serie-.
 *
 * El color se pinta como un punto junto a la etiqueta, no como fondo del chip.
 * Así el texto conserva el contraste del tema en modo claro y en oscuro, sin
 * tener que calcular un par de colores por estado y por modo.
 *
 * `agotado` no usa `error.main` del tema (`#A21A19`): ese es casi el guinda
 * institucional, que está por toda la interfaz, y un agotado en guinda se
 * confunde con la marca.
 */
export const ESTADO: Record<Enums<'estado_existencia'>, { etiqueta: string; color: string }> = {
  disponible:    { etiqueta: 'Disponible',    color: '#2E7D32' },
  stock_bajo:    { etiqueta: 'Stock bajo',    color: '#B26A00' },
  agotado:       { etiqueta: 'Agotado',       color: '#D32F2F' },
  contaminado:   { etiqueta: 'Contaminado',   color: '#7C3AED' },
  mantenimiento: { etiqueta: 'Mantenimiento', color: '#ED5E17' },
  baja:          { etiqueta: 'Baja',          color: '#6F6F6E' },
}
```

- [ ] **Step 4: Corre la prueba y comprueba que pasa**

```bash
pnpm test presentacion
```

Esperado: PASA, 9 pruebas.

- [ ] **Step 5: Commit**

```bash
git add src/features/inventario/presentacion.ts src/features/inventario/presentacion.test.ts
git commit -m "feat(inventario): corte del nombre, normalizacion y mapa de estados"
```

---

### Task 4: `filtros.ts` — el estado de los filtros y su valor inicial

**Files:**
- Create: `src/features/inventario/filtros.ts`
- Test: `src/features/inventario/filtros.test.ts`

**Interfaces:**
- Consumes: `Enums<'clasificacion_articulo'>`, `Enums<'estado_existencia'>`,
  `Enums<'rol_usuario'>` de `@/types/database`.
- Produces:
  - `type Filtros = { termino: string; clasificacion: Enums<'clasificacion_articulo'> | 'todas'; almacenId: number | 'todos'; estado: Enums<'estado_existencia'> | 'todos'; incluirBaja: boolean }`
  - `filtrosIniciales(perfil: { rol: Enums<'rol_usuario'>; almacenId: number | null } | undefined): Filtros`
  - `CLASIFICACIONES: { valor: Enums<'clasificacion_articulo'>; etiqueta: string }[]`

- [ ] **Step 1: Escribe la prueba que falla**

Crea `src/features/inventario/filtros.test.ts`:

```ts
import { describe, expect, test } from 'vitest'

import { CLASIFICACIONES, filtrosIniciales } from './filtros'

describe('filtrosIniciales', () => {
  test('un responsable arranca en su propio almacen', () => {
    expect(filtrosIniciales({ rol: 'responsable', almacenId: 3 }).almacenId).toBe(3)
  })

  test('un admin arranca viendo los cuatro', () => {
    expect(filtrosIniciales({ rol: 'admin', almacenId: null }).almacenId).toBe('todos')
  })

  // Un admin con almacen asignado sigue viendo todo: su trabajo es el conjunto.
  test('un admin con almacen asignado tambien arranca en todos', () => {
    expect(filtrosIniciales({ rol: 'admin', almacenId: 1 }).almacenId).toBe('todos')
  })

  test('un consulta arranca viendo los cuatro', () => {
    expect(filtrosIniciales({ rol: 'consulta', almacenId: null }).almacenId).toBe('todos')
  })

  // Mientras el perfil carga no hay rol, y la pantalla ya se esta pintando.
  test('sin perfil todavia, arranca en todos y no revienta', () => {
    expect(filtrosIniciales(undefined).almacenId).toBe('todos')
  })

  test('las bajas se esconden por omision', () => {
    expect(filtrosIniciales(undefined).incluirBaja).toBe(false)
  })

  test('los agotados NO se esconden: son justo lo que hay que reponer', () => {
    expect(filtrosIniciales(undefined).estado).toBe('todos')
  })
})

describe('CLASIFICACIONES', () => {
  // El prototipo tiene cinco y se le olvida `componente`, que es la
  // clasificacion de 15 articulos de LE. Con cinco opciones quedan inalcanzables.
  test('son las seis del enum, con componente incluido', () => {
    expect(CLASIFICACIONES.map((c) => c.valor).sort()).toEqual([
      'componente', 'equipo', 'insumo', 'material', 'materia_biologica', 'reactivo',
    ])
  })
})
```

- [ ] **Step 2: Corre la prueba y comprueba que falla**

```bash
pnpm test filtros
```

Esperado: FALLA con `Failed to resolve import "./filtros"`.

- [ ] **Step 3: Escribe el modulo**

Crea `src/features/inventario/filtros.ts`:

```ts
import type { Enums } from '@/types/database'

export type Filtros = {
  termino: string
  clasificacion: Enums<'clasificacion_articulo'> | 'todas'
  almacenId: number | 'todos'
  estado: Enums<'estado_existencia'> | 'todos'
  incluirBaja: boolean
}

/**
 * Las seis clasificaciones del enum. El prototipo lista cinco: se le olvida
 * `componente`, que es lo que son 15 de los artículos de Electrónica. Con cinco
 * opciones esos renglones no se pueden filtrar.
 */
export const CLASIFICACIONES: { valor: Enums<'clasificacion_articulo'>; etiqueta: string }[] = [
  { valor: 'reactivo',          etiqueta: 'Reactivos' },
  { valor: 'material',          etiqueta: 'Materiales' },
  { valor: 'equipo',            etiqueta: 'Equipos' },
  { valor: 'insumo',            etiqueta: 'Insumos' },
  { valor: 'componente',        etiqueta: 'Componentes' },
  { valor: 'materia_biologica', etiqueta: 'Materia biológica' },
]

/**
 * Un responsable arranca en su propio almacén, que es donde trabaja; admin y
 * consulta arrancan viendo los cuatro, porque su trabajo es el conjunto.
 *
 * `baja` se esconde: algo dado de baja ya no es inventario. `agotado` NO se
 * esconde -el prototipo lo hace-, porque es justo lo que hay que reponer.
 *
 * `perfil` llega en `undefined` mientras la consulta del perfil está en vuelo, y
 * la pantalla ya se está pintando para entonces.
 */
export function filtrosIniciales(
  perfil: { rol: Enums<'rol_usuario'>; almacenId: number | null } | undefined,
): Filtros {
  const propio = perfil?.rol === 'responsable' && perfil.almacenId !== null

  return {
    termino: '',
    clasificacion: 'todas',
    almacenId: propio ? (perfil.almacenId as number) : 'todos',
    estado: 'todos',
    incluirBaja: false,
  }
}
```

- [ ] **Step 4: Corre la prueba y comprueba que pasa**

```bash
pnpm test filtros
```

Esperado: PASA, 8 pruebas.

- [ ] **Step 5: Commit**

```bash
git add src/features/inventario/filtros.ts src/features/inventario/filtros.test.ts
git commit -m "feat(inventario): estado de filtros y su valor inicial por rol"
```

---

### Task 5: `TablaExistencias.tsx`

**Files:**
- Create: `src/features/inventario/TablaExistencias.tsx`
- Test: `src/features/inventario/TablaExistencias.test.tsx`

**Interfaces:**
- Consumes: `cortarNombre`, `ESTADO` de `./presentacion`; `aspectoDeAlmacen` de
  `@/app/almacenes`; `Tables<'existencia_listado'>` de `@/types/database`.
- Produces: `TablaExistencias(props: { filas: Fila[]; total: number; pagina: number; porPagina: number; almacenPropio: number | null; onPagina: (p: number) => void; onPorPagina: (n: number) => void; onAbrir: (fila: Fila) => void })`
  y `type Fila = Tables<'existencia_listado'>`.

- [ ] **Step 1: Escribe la prueba que falla**

Crea `src/features/inventario/TablaExistencias.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, test, vi } from 'vitest'

import { TablaExistencias, type Fila } from './TablaExistencias'

function fila(cambios: Partial<Fila> = {}): Fila {
  return {
    id: 1,
    codigo: 'N3-00001',
    marca: 'SIGMA',
    cantidad: 139.8,
    estado: 'disponible',
    almacen_id: 1,
    ubicacion_id: 7,
    fecha_caducidad: null,
    creado_en: '2026-08-01T10:00:00Z',
    articulo_id: 5,
    nombre_canonico: '1,10-Fenantrolina monohidrato, sólido, pureza 99%, CAS: 5144-89-8',
    descripcion: null,
    clasificacion: 'reactivo',
    unidad_base: 'g',
    almacen_clave: 'N3',
    ubicacion: 'N3 · Anaquel 2 · Repisa 3',
    nombre_norm: '1,10-fenantrolina monohidrato, solido, pureza 99%, cas: 5144-89-8',
    marca_norm: 'sigma',
    ...cambios,
  }
}

function pintar(props: Partial<Parameters<typeof TablaExistencias>[0]> = {}) {
  const onAbrir = vi.fn()
  render(
    <TablaExistencias
      filas={[fila()]}
      total={1}
      pagina={0}
      porPagina={25}
      almacenPropio={1}
      onPagina={vi.fn()}
      onPorPagina={vi.fn()}
      onAbrir={onAbrir}
      {...props}
    />,
  )
  return { onAbrir }
}

describe('TablaExistencias', () => {
  test('muestra la sustancia sin partirla por sus propias comas', () => {
    pintar()
    expect(screen.getByText('1,10-Fenantrolina monohidrato')).toBeInTheDocument()
  })

  test('muestra la cantidad con su unidad', () => {
    pintar()
    expect(screen.getByText('139.8 g')).toBeInTheDocument()
  })

  test('etiqueta el estado en palabras, no con el valor del enum', () => {
    pintar()
    expect(screen.getByText('Disponible')).toBeInTheDocument()
    expect(screen.queryByText('disponible')).not.toBeInTheDocument()
  })

  // El detalle tiene que abrirse con teclado. El prototipo pone el onClick en el
  // <tr>, y a un <tr> no se llega con Tab: la pantalla queda inservible sin raton.
  test('el detalle se abre con el teclado', async () => {
    const { onAbrir } = pintar()

    await userEvent.tab()
    await userEvent.keyboard('{Enter}')

    expect(onAbrir).toHaveBeenCalledTimes(1)
    expect(onAbrir.mock.calls[0][0].codigo).toBe('N3-00001')
  })

  test('el control del detalle dice de que existencia es', () => {
    pintar()
    expect(screen.getByRole('button', { name: /N3-00001/ })).toBeInTheDocument()
  })

  test('la tabla tiene nombre accesible', () => {
    pintar()
    expect(screen.getByRole('table', { name: /existencias/i })).toBeInTheDocument()
  })

  test('avisa cuando no hay resultados', () => {
    pintar({ filas: [], total: 0 })
    expect(screen.getByText(/no se encontraron existencias/i)).toBeInTheDocument()
  })

  test('marca las filas que no son del almacen propio', () => {
    pintar({ filas: [fila({ almacen_id: 2, almacen_clave: 'N4' })], almacenPropio: 1 })
    expect(screen.getByTitle(/solo consulta/i)).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Corre la prueba y comprueba que falla**

```bash
pnpm test TablaExistencias
```

Esperado: FALLA con `Failed to resolve import "./TablaExistencias"`.

- [ ] **Step 3: Escribe el componente**

Crea `src/features/inventario/TablaExistencias.tsx`:

```tsx
import { Icon } from '@iconify/react'
import {
  Box,
  ButtonBase,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TablePagination,
  TableRow,
  Typography,
} from '@mui/material'

import { aspectoDeAlmacen } from '@/app/almacenes'
import type { Tables } from '@/types/database'
import { cortarNombre, ESTADO } from './presentacion'

export type Fila = Tables<'existencia_listado'>

type Props = {
  filas: Fila[]
  total: number
  pagina: number
  porPagina: number
  /** `null` para admin y consulta: no hay almacén propio que marcar. */
  almacenPropio: number | null
  onPagina: (pagina: number) => void
  onPorPagina: (porPagina: number) => void
  onAbrir: (fila: Fila) => void
}

function PuntoEstado({ estado }: { estado: Fila['estado'] }) {
  const aspecto = ESTADO[estado]
  return (
    <Stack direction="row" spacing={0.75} sx={{ alignItems: 'center' }}>
      <Box
        sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: aspecto.color, flexShrink: 0 }}
      />
      <Typography variant="body2">{aspecto.etiqueta}</Typography>
    </Stack>
  )
}

export function TablaExistencias({
  filas, total, pagina, porPagina, almacenPropio, onPagina, onPorPagina, onAbrir,
}: Props) {
  return (
    <>
      <TableContainer>
        <Table aria-label="Existencias de los almacenes" size="small">
          <TableHead>
            <TableRow>
              <TableCell>Código</TableCell>
              <TableCell>Nombre</TableCell>
              <TableCell>Existencia</TableCell>
              <TableCell>Estado</TableCell>
              <TableCell>Almacén</TableCell>
              <TableCell>Ubicación</TableCell>
            </TableRow>
          </TableHead>

          <TableBody>
            {filas.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} sx={{ py: 6, textAlign: 'center' }}>
                  <Typography sx={{ color: 'text.secondary' }}>
                    No se encontraron existencias con esos filtros
                  </Typography>
                </TableCell>
              </TableRow>
            )}

            {filas.map((f) => {
              const { cabeza, resto } = cortarNombre(f.nombre_canonico ?? '')
              const aspecto = aspectoDeAlmacen(f.almacen_clave)
              const ajeno = almacenPropio !== null && f.almacen_id !== almacenPropio

              return (
                <TableRow key={f.id} hover>
                  <TableCell>
                    {/* El control enfocable vive AQUI y no en el <tr>: a un <tr>
                        no se llega con Tab, y el prototipo pone ahi el onClick.
                        Sin esto la pantalla no se puede usar sin raton. */}
                    <ButtonBase
                      onClick={() => onAbrir(f)}
                      aria-label={`Ver detalle de ${f.codigo}`}
                      sx={{
                        fontFamily: 'monospace',
                        fontWeight: 600,
                        color: 'primary.main',
                        borderRadius: 1,
                        px: 0.5,
                      }}
                    >
                      {f.codigo}
                    </ButtonBase>
                  </TableCell>

                  <TableCell>
                    <Typography variant="body2" sx={{ fontWeight: 500 }} title={f.nombre_canonico ?? ''}>
                      {cabeza}
                    </Typography>
                    <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                      {[f.marca, resto || f.descripcion].filter(Boolean).join(' · ')}
                    </Typography>
                  </TableCell>

                  <TableCell sx={{ whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>
                    {f.cantidad} {f.unidad_base}
                  </TableCell>

                  <TableCell><PuntoEstado estado={f.estado} /></TableCell>

                  <TableCell>
                    <Stack direction="row" spacing={0.75} sx={{ alignItems: 'center' }}>
                      <Box
                        sx={{
                          px: 1, py: 0.25, borderRadius: 1,
                          bgcolor: aspecto.color, color: 'common.white',
                          fontSize: '0.75rem', fontWeight: 600,
                        }}
                      >
                        {f.almacen_clave}
                      </Box>
                      {ajeno && (
                        // El `title` va en el span y no en el <Icon>: Iconify
                        // lo pintaria como <title> dentro del SVG, y ahi queda
                        // a merced de como cada lector de pantalla trate los
                        // SVG. En un span es un atributo title de toda la vida.
                        <Box
                          component="span"
                          title="De otro almacén: solo consulta"
                          sx={{ display: 'inline-flex', color: 'text.secondary' }}
                        >
                          <Icon icon="mdi:eye-outline" width={16} aria-hidden />
                        </Box>
                      )}
                    </Stack>
                  </TableCell>

                  <TableCell>
                    <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                      {f.ubicacion ?? '—'}
                    </Typography>
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </TableContainer>

      <TablePagination
        component="div"
        count={total}
        page={pagina}
        rowsPerPage={porPagina}
        rowsPerPageOptions={[25, 50, 100]}
        onPageChange={(_, p) => onPagina(p)}
        onRowsPerPageChange={(e) => onPorPagina(Number(e.target.value))}
        labelRowsPerPage="Por página:"
        labelDisplayedRows={({ from, to, count }) => `${from}–${to} de ${count}`}
      />
    </>
  )
}
```

- [ ] **Step 4: Corre la prueba y comprueba que pasa**

```bash
pnpm test TablaExistencias
```

Esperado: PASA, 8 pruebas.

Si `el detalle se abre con el teclado` falla porque el primer Tab cae en otra
cosa, comprueba que no haya ningun elemento enfocable antes del `ButtonBase` en
el arbol renderizado.

- [ ] **Step 5: Commit**

```bash
git add src/features/inventario/TablaExistencias.tsx src/features/inventario/TablaExistencias.test.tsx
git commit -m "feat(inventario): tabla de existencias con detalle alcanzable por teclado"
```

---

### Task 6: `FiltrosInventario.tsx`

**Files:**
- Create: `src/features/inventario/FiltrosInventario.tsx`
- Test: `src/features/inventario/FiltrosInventario.test.tsx`

**Interfaces:**
- Consumes: `Filtros`, `CLASIFICACIONES` de `./filtros`; `ESTADO` de `./presentacion`.
- Produces: `FiltrosInventario(props: { filtros: Filtros; almacenes: { id: number; clave: string }[]; onCambio: (filtros: Filtros) => void })`

- [ ] **Step 1: Escribe la prueba que falla**

Crea `src/features/inventario/FiltrosInventario.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, test, vi } from 'vitest'

import { FiltrosInventario } from './FiltrosInventario'
import { filtrosIniciales } from './filtros'

const ALMACENES = [
  { id: 1, clave: 'N3' },
  { id: 2, clave: 'N4' },
  { id: 3, clave: 'LUM' },
  { id: 4, clave: 'LE' },
]

function pintar() {
  const onCambio = vi.fn()
  render(
    <FiltrosInventario
      filtros={filtrosIniciales(undefined)}
      almacenes={ALMACENES}
      onCambio={onCambio}
    />,
  )
  return { onCambio }
}

describe('FiltrosInventario', () => {
  // Sin etiqueta asociada, un lector de pantalla anuncia "cuadro de edicion" y
  // nada mas. Los cuatro controles llevan la suya.
  test('cada control tiene etiqueta accesible', () => {
    pintar()
    expect(screen.getByLabelText(/buscar/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/tipo/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/almacén/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/estado/i)).toBeInTheDocument()
  })

  test('escribir en el buscador propaga el termino', async () => {
    const { onCambio } = pintar()

    await userEvent.type(screen.getByLabelText(/buscar/i), 'a')

    expect(onCambio).toHaveBeenCalledWith(expect.objectContaining({ termino: 'a' }))
  })

  test('ofrece los cuatro almacenes mas la opcion de verlos todos', async () => {
    pintar()

    await userEvent.click(screen.getByLabelText(/almacén/i))

    expect(screen.getByRole('option', { name: 'Todos los almacenes' })).toBeInTheDocument()
    for (const clave of ['N3', 'N4', 'LUM', 'LE']) {
      expect(screen.getByRole('option', { name: clave })).toBeInTheDocument()
    }
  })

  test('la casilla de bajas arranca apagada y propaga el cambio', async () => {
    const { onCambio } = pintar()
    const casilla = screen.getByRole('checkbox', { name: /bajas/i })

    expect(casilla).not.toBeChecked()
    await userEvent.click(casilla)

    expect(onCambio).toHaveBeenCalledWith(expect.objectContaining({ incluirBaja: true }))
  })
})
```

- [ ] **Step 2: Corre la prueba y comprueba que falla**

```bash
pnpm test FiltrosInventario
```

Esperado: FALLA con `Failed to resolve import "./FiltrosInventario"`.

- [ ] **Step 3: Escribe el componente**

Crea `src/features/inventario/FiltrosInventario.tsx`:

```tsx
import { Icon } from '@iconify/react'
import {
  Checkbox,
  FormControl,
  FormControlLabel,
  InputAdornment,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  TextField,
} from '@mui/material'

import { ESTADO } from './presentacion'
import { CLASIFICACIONES, type Filtros } from './filtros'

type Props = {
  filtros: Filtros
  almacenes: { id: number; clave: string }[]
  onCambio: (filtros: Filtros) => void
}

export function FiltrosInventario({ filtros, almacenes, onCambio }: Props) {
  // Un solo camino para publicar cambios: así ningún control se olvida de
  // conservar el resto del estado.
  const cambiar = (parche: Partial<Filtros>) => onCambio({ ...filtros, ...parche })

  return (
    <Stack
      direction={{ xs: 'column', md: 'row' }}
      spacing={2}
      sx={{ alignItems: { md: 'center' } }}
    >
      <TextField
        label="Buscar"
        type="search"
        value={filtros.termino}
        onChange={(e) => cambiar({ termino: e.target.value })}
        placeholder="Nombre, marca o código"
        size="small"
        sx={{ flex: 1, minWidth: 220 }}
        slotProps={{
          input: {
            startAdornment: (
              <InputAdornment position="start">
                {/* Decorativo: la etiqueta ya dice qué hace el campo. */}
                <Icon icon="mdi:magnify" width={20} aria-hidden />
              </InputAdornment>
            ),
          },
        }}
      />

      <FormControl size="small" sx={{ minWidth: 170 }}>
        <InputLabel id="filtro-tipo">Tipo</InputLabel>
        <Select
          labelId="filtro-tipo"
          label="Tipo"
          value={filtros.clasificacion}
          onChange={(e) => cambiar({ clasificacion: e.target.value as Filtros['clasificacion'] })}
        >
          <MenuItem value="todas">Todos los tipos</MenuItem>
          {CLASIFICACIONES.map((c) => (
            <MenuItem key={c.valor} value={c.valor}>{c.etiqueta}</MenuItem>
          ))}
        </Select>
      </FormControl>

      <FormControl size="small" sx={{ minWidth: 170 }}>
        <InputLabel id="filtro-almacen">Almacén</InputLabel>
        <Select
          labelId="filtro-almacen"
          label="Almacén"
          value={filtros.almacenId}
          onChange={(e) =>
            cambiar({
              almacenId: e.target.value === 'todos' ? 'todos' : Number(e.target.value),
            })
          }
        >
          <MenuItem value="todos">Todos los almacenes</MenuItem>
          {almacenes.map((a) => (
            <MenuItem key={a.id} value={a.id}>{a.clave}</MenuItem>
          ))}
        </Select>
      </FormControl>

      <FormControl size="small" sx={{ minWidth: 160 }}>
        <InputLabel id="filtro-estado">Estado</InputLabel>
        <Select
          labelId="filtro-estado"
          label="Estado"
          value={filtros.estado}
          onChange={(e) => cambiar({ estado: e.target.value as Filtros['estado'] })}
        >
          <MenuItem value="todos">Todos los estados</MenuItem>
          {Object.entries(ESTADO).map(([valor, aspecto]) => (
            <MenuItem key={valor} value={valor}>{aspecto.etiqueta}</MenuItem>
          ))}
        </Select>
      </FormControl>

      <FormControlLabel
        control={
          <Checkbox
            checked={filtros.incluirBaja}
            onChange={(e) => cambiar({ incluirBaja: e.target.checked })}
          />
        }
        label="Incluir bajas"
      />
    </Stack>
  )
}
```

- [ ] **Step 4: Corre la prueba y comprueba que pasa**

```bash
pnpm test FiltrosInventario
```

Esperado: PASA, 4 pruebas.

- [ ] **Step 5: Commit**

```bash
git add src/features/inventario/FiltrosInventario.tsx src/features/inventario/FiltrosInventario.test.tsx
git commit -m "feat(inventario): barra de filtros con etiquetas accesibles"
```

---

### Task 7: `PanelExistencia.tsx`

**Files:**
- Create: `src/features/inventario/PanelExistencia.tsx`
- Test: `src/features/inventario/PanelExistencia.test.tsx`

**Interfaces:**
- Consumes: `Fila` de `./TablaExistencias`; `cortarNombre`, `ESTADO` de `./presentacion`.
- Produces: `PanelExistencia(props: { fila: Fila | null; almacenPropio: number | null; movimientos: Movimiento[]; cargandoMovimientos: boolean; onCerrar: () => void })`
  y `type Movimiento = { id: number; tipo: string; cantidad: number; cantidad_despues: number; ocurrido_en: string; motivo: string | null }`.

- [ ] **Step 1: Escribe la prueba que falla**

Crea `src/features/inventario/PanelExistencia.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import { describe, expect, test, vi } from 'vitest'

import { PanelExistencia, type Movimiento } from './PanelExistencia'
import type { Fila } from './TablaExistencias'

const FILA: Fila = {
  id: 1,
  codigo: 'N3-00001',
  marca: 'SIGMA',
  cantidad: 139.8,
  estado: 'disponible',
  almacen_id: 1,
  ubicacion_id: 7,
  fecha_caducidad: null,
  creado_en: '2026-08-01T10:00:00Z',
  articulo_id: 5,
  nombre_canonico: 'Acetona, líquido, pureza 99.5%, CAS: 67-64-1',
  descripcion: null,
  clasificacion: 'reactivo',
  unidad_base: 'mL',
  almacen_clave: 'N3',
  ubicacion: 'N3 · Anaquel 2 · Repisa 3',
  nombre_norm: 'acetona, liquido, pureza 99.5%, cas: 67-64-1',
  marca_norm: 'sigma',
}

const MOVIMIENTOS: Movimiento[] = [
  {
    id: 10, tipo: 'consumo', cantidad: -45, cantidad_despues: 139.8,
    ocurrido_en: '2026-08-20T15:00:00Z', motivo: 'Práctica de titulación',
  },
]

function pintar(props: Partial<Parameters<typeof PanelExistencia>[0]> = {}) {
  const onCerrar = vi.fn()
  render(
    <PanelExistencia
      fila={FILA}
      almacenPropio={1}
      movimientos={MOVIMIENTOS}
      cargandoMovimientos={false}
      onCerrar={onCerrar}
      {...props}
    />,
  )
  return { onCerrar }
}

describe('PanelExistencia', () => {
  test('el panel se anuncia con el codigo de la existencia', () => {
    pintar()
    expect(screen.getByRole('dialog', { name: /N3-00001/ })).toBeInTheDocument()
  })

  test('muestra el codigo, que es lo que va impreso en la etiqueta', () => {
    pintar()
    expect(screen.getByText('N3-00001')).toBeInTheDocument()
  })

  test('el boton de cerrar tiene nombre accesible', () => {
    pintar()
    expect(screen.getByRole('button', { name: /cerrar/i })).toBeInTheDocument()
  })

  test('lista los movimientos con su signo', () => {
    pintar()
    expect(screen.getByText('-45 mL')).toBeInTheDocument()
    expect(screen.getByText(/práctica de titulación/i)).toBeInTheDocument()
  })

  // La senal de "esto no es tuyo". En una pantalla de solo lectura es lo unico
  // que distingue el almacen propio del ajeno.
  test('avisa cuando la existencia es de otro almacen', () => {
    pintar({ almacenPropio: 2 })
    expect(screen.getByText(/pertenece a N3/i)).toBeInTheDocument()
    expect(screen.getByText(/no modificarla/i)).toBeInTheDocument()
  })

  test('no avisa cuando la existencia es del almacen propio', () => {
    pintar({ almacenPropio: 1 })
    expect(screen.queryByText(/no modificarla/i)).not.toBeInTheDocument()
  })

  test('sin fila seleccionada no hay panel', () => {
    pintar({ fila: null })
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Corre la prueba y comprueba que falla**

```bash
pnpm test PanelExistencia
```

Esperado: FALLA con `Failed to resolve import "./PanelExistencia"`.

- [ ] **Step 3: Escribe el componente**

Crea `src/features/inventario/PanelExistencia.tsx`:

```tsx
import { Icon } from '@iconify/react'
import {
  Alert,
  Box,
  Divider,
  Drawer,
  IconButton,
  Skeleton,
  Stack,
  Typography,
} from '@mui/material'

import { aspectoDeAlmacen } from '@/app/almacenes'
import { cortarNombre, ESTADO } from './presentacion'
import type { Fila } from './TablaExistencias'

export type Movimiento = {
  id: number
  tipo: string
  cantidad: number
  cantidad_despues: number
  ocurrido_en: string
  motivo: string | null
}

type Props = {
  fila: Fila | null
  almacenPropio: number | null
  movimientos: Movimiento[]
  cargandoMovimientos: boolean
  onCerrar: () => void
}

const FECHA = new Intl.DateTimeFormat('es-MX', { dateStyle: 'medium', timeStyle: 'short' })

function Dato({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  return (
    <Stack direction="row" spacing={1} sx={{ alignItems: 'baseline' }}>
      <Typography variant="caption" sx={{ color: 'text.secondary', width: 104, flexShrink: 0 }}>
        {etiqueta}
      </Typography>
      <Typography variant="body2" sx={{ flex: 1 }}>{valor}</Typography>
    </Stack>
  )
}

export function PanelExistencia({
  fila, almacenPropio, movimientos, cargandoMovimientos, onCerrar,
}: Props) {
  if (fila === null) return null

  const { cabeza, resto } = cortarNombre(fila.nombre_canonico ?? '')
  const aspecto = aspectoDeAlmacen(fila.almacen_clave)
  const ajeno = almacenPropio !== null && fila.almacen_id !== almacenPropio

  return (
    <Drawer
      anchor="right"
      open
      onClose={onCerrar}
      // Drawer ya atrapa el foco y lo devuelve al control que lo abrio; lo que
      // falta es que se anuncie con un nombre, y el codigo es el identificador
      // que la gente de almacen lee en la etiqueta.
      aria-labelledby="detalle-titulo"
      slotProps={{ paper: { sx: { width: { xs: '100%', sm: 380 }, p: 2.5 } } }}
    >
      <Stack direction="row" spacing={1} sx={{ alignItems: 'flex-start', mb: 2 }}>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography
            id="detalle-titulo"
            sx={{ fontFamily: 'monospace', fontSize: '1.25rem', fontWeight: 700, color: 'primary.main' }}
          >
            {fila.codigo}
          </Typography>
          <Typography variant="body2" sx={{ fontWeight: 600 }}>{cabeza}</Typography>
          {resto !== '' && (
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>{resto}</Typography>
          )}
        </Box>
        <IconButton onClick={onCerrar} aria-label="Cerrar el detalle" size="small">
          <Icon icon="mdi:close" width={20} />
        </IconButton>
      </Stack>

      {ajeno && (
        <Alert severity="info" sx={{ mb: 2 }}>
          Pertenece a {fila.almacen_clave}. Puedes consultarla, no modificarla.
        </Alert>
      )}

      <Stack spacing={1} sx={{ mb: 2 }}>
        <Dato etiqueta="Existencia" valor={`${fila.cantidad} ${fila.unidad_base}`} />
        <Dato etiqueta="Estado" valor={ESTADO[fila.estado].etiqueta} />
        <Dato etiqueta="Marca" valor={fila.marca ?? '—'} />
        {fila.descripcion !== null && <Dato etiqueta="Descripción" valor={fila.descripcion} />}
        <Dato etiqueta="Ubicación" valor={fila.ubicacion ?? '—'} />
        <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
          <Typography variant="caption" sx={{ color: 'text.secondary', width: 104, flexShrink: 0 }}>
            Almacén
          </Typography>
          <Box
            sx={{
              px: 1, py: 0.25, borderRadius: 1,
              bgcolor: aspecto.color, color: 'common.white',
              fontSize: '0.75rem', fontWeight: 600,
            }}
          >
            {fila.almacen_clave}
          </Box>
        </Stack>
      </Stack>

      <Divider sx={{ my: 2 }} />

      <Typography variant="overline" sx={{ color: 'text.secondary' }}>
        Movimientos
      </Typography>

      {cargandoMovimientos && <Skeleton variant="rounded" height={72} sx={{ mt: 1 }} />}

      {!cargandoMovimientos && movimientos.length === 0 && (
        <Typography variant="body2" sx={{ color: 'text.secondary', mt: 1 }}>
          Todavía no hay movimientos registrados.
        </Typography>
      )}

      <Stack spacing={1.5} sx={{ mt: 1 }}>
        {movimientos.map((m) => (
          <Box key={m.id}>
            <Stack direction="row" spacing={1} sx={{ justifyContent: 'space-between' }}>
              <Typography variant="body2" sx={{ textTransform: 'capitalize' }}>
                {m.tipo.replace('_', ' ')}
              </Typography>
              <Typography
                variant="body2"
                sx={{
                  fontFamily: 'monospace',
                  fontWeight: 600,
                  color: m.cantidad >= 0 ? 'success.main' : 'text.primary',
                }}
              >
                {m.cantidad > 0 ? '+' : ''}{m.cantidad} {fila.unidad_base}
              </Typography>
            </Stack>
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
              {FECHA.format(new Date(m.ocurrido_en))}
              {m.motivo !== null && ` · ${m.motivo}`}
            </Typography>
          </Box>
        ))}
      </Stack>
    </Drawer>
  )
}
```

- [ ] **Step 4: Corre la prueba y comprueba que pasa**

```bash
pnpm test PanelExistencia
```

Esperado: PASA, 7 pruebas.

- [ ] **Step 5: Commit**

```bash
git add src/features/inventario/PanelExistencia.tsx src/features/inventario/PanelExistencia.test.tsx
git commit -m "feat(inventario): panel de detalle con historial de movimientos"
```

---

### Task 8: `consultas.ts`

**Files:**
- Create: `src/features/inventario/consultas.ts`

**Interfaces:**
- Consumes: `supabase` de `@/lib/supabase`; `Filtros` de `./filtros`;
  `normalizarTermino` de `./presentacion`; `Movimiento` de `./PanelExistencia`.
- Produces:
  - `useExistencias(filtros: Filtros, pagina: number, porPagina: number)` →
    `{ filas: Fila[]; total: number }`
  - `useMovimientos(existenciaId: number | null)` → `Movimiento[]`
  - `useAlmacenes()` → `{ id: number; clave: string }[]`
  - `useDetalleExistencia(existenciaId: number | null)` → los campos propios del
    tipo (los consume la Task 10)

- [ ] **Step 1: Escribe el modulo**

No lleva prueba unitaria propia: son envoltorios de supabase-js, y probarlos con
un doble solo afirmaria sobre el doble. Lo que se prueba de verdad son las
funciones puras que consumen (Tasks 3 y 4) y el guion manual de la Task 9, que
corre contra la base real con usuarios reales — que es donde la RLS existe.

Crea `src/features/inventario/consultas.ts`:

```ts
import { keepPreviousData, useQuery } from '@tanstack/react-query'

import { supabase } from '@/lib/supabase'
import type { Filtros } from './filtros'
import type { Movimiento } from './PanelExistencia'
import { normalizarTermino } from './presentacion'

/**
 * El listado. La `queryKey` lleva los filtros completos y la página: sin eso,
 * cambiar de almacén devuelve la caché del anterior.
 *
 * `keepPreviousData` evita que la tabla parpadee a esqueleto en cada tecla: se
 * queda con la página anterior mientras llega la nueva.
 */
export function useExistencias(filtros: Filtros, pagina: number, porPagina: number) {
  return useQuery({
    queryKey: ['existencias', filtros, pagina, porPagina],
    placeholderData: keepPreviousData,
    queryFn: async () => {
      let consulta = supabase
        .from('existencia_listado')
        .select('*', { count: 'exact' })
        .order('codigo')

      if (filtros.almacenId !== 'todos') consulta = consulta.eq('almacen_id', filtros.almacenId)
      if (filtros.clasificacion !== 'todas') consulta = consulta.eq('clasificacion', filtros.clasificacion)

      if (filtros.estado !== 'todos') consulta = consulta.eq('estado', filtros.estado)
      else if (!filtros.incluirBaja) consulta = consulta.neq('estado', 'baja')

      const termino = normalizarTermino(filtros.termino)
      if (termino !== '') {
        // `nombre_norm` y `marca_norm` ya vienen en minúsculas y sin acentos, así
        // que aquí va `like` y no `ilike`: es lo que permite que el predicado
        // use el índice trigram. `codigo` no está normalizado, y ahí sí `ilike`.
        consulta = consulta.or(
          `nombre_norm.like.*${termino}*,marca_norm.like.*${termino}*,codigo.ilike.*${termino}*`,
        )
      }

      const desde = pagina * porPagina
      const { data, error, count } = await consulta.range(desde, desde + porPagina - 1)
      if (error) throw error

      return { filas: data, total: count ?? 0 }
    },
  })
}

/** El historial del panel de detalle. No se pide hasta que hay panel abierto. */
export function useMovimientos(existenciaId: number | null) {
  return useQuery({
    queryKey: ['movimientos', existenciaId],
    enabled: existenciaId !== null,
    queryFn: async (): Promise<Movimiento[]> => {
      const { data, error } = await supabase
        .from('movimiento')
        .select('id, tipo, cantidad, cantidad_despues, ocurrido_en, motivo')
        .eq('existencia_id', existenciaId as number)
        .order('ocurrido_en', { ascending: false })
        .limit(20)
      if (error) throw error
      return data
    },
  })
}

/**
 * Los campos que no caben en el listado y sólo importan cuando abres una: los
 * de reactivo (CAS y rombo NFPA), los de equipo y los de materia biológica.
 * Van en su propia consulta porque traerlos en el listado sería pedir cuatro
 * tablas más por cada uno de los 25 renglones de la página.
 */
export function useDetalleExistencia(existenciaId: number | null) {
  return useQuery({
    queryKey: ['detalle-existencia', existenciaId],
    enabled: existenciaId !== null,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('existencia')
        .select(`
          modelo, presentacion, numero_serie, numero_inventario_uaeh, funcionamiento,
          mantenimiento, fecha_chequeo, metodo_conservacion, temperatura,
          fecha_recoleccion, fecha_preparacion, responsable_muestra,
          peso_frasco_vacio, peso_total, fecha_adquisicion, fecha_caducidad, observaciones,
          articulo:articulo_id (
            familia,
            articulo_reactivo ( cas, estado_fisico, color_almacenaje, tiene_hoja_seguridad,
                                riesgo_salud, riesgo_inflamabilidad, riesgo_reactividad,
                                peligro_especial ),
            articulo_biologico ( origen_especie )
          )
        `)
        .eq('id', existenciaId as number)
        .single()
      if (error) throw error
      return data
    },
  })
}

/** Los cuatro almacenes, para el select del filtro. Cambian casi nunca. */
export function useAlmacenes() {
  return useQuery({
    queryKey: ['almacenes'],
    staleTime: 60 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('almacen')
        .select('id, clave')
        .eq('activo', true)
        .order('clave')
      if (error) throw error
      return data
    },
  })
}
```

- [ ] **Step 2: Comprueba que compila**

```bash
pnpm typecheck && pnpm lint
```

Esperado: cero errores. Si `existencia_listado` no existe en los tipos, la Task 2
no corrió `pnpm gen:types`.

- [ ] **Step 3: Commit**

```bash
git add src/features/inventario/consultas.ts
git commit -m "feat(inventario): consultas del listado, movimientos y almacenes"
```

---

### Task 9: `PaginaInventario.tsx`, la ruta y el menu

**Files:**
- Create: `src/features/inventario/PaginaInventario.tsx`
- Modify: `src/App.tsx`
- Modify: `src/app/navegacion.ts:26`
- Test: `src/app/navegacion.test.ts` (ajustar la expectativa de `disponible`)

**Interfaces:**
- Consumes: todo lo anterior, mas `usePerfil` de `@/features/auth/usePerfil`.
- Produces: la ruta `/inventario`.

- [ ] **Step 1: Escribe la pagina**

Crea `src/features/inventario/PaginaInventario.tsx`:

```tsx
import { useState } from 'react'
import { Alert, Card, CardContent, Skeleton, Stack, Typography } from '@mui/material'

import { usePerfil } from '@/features/auth/usePerfil'
import { FiltrosInventario } from './FiltrosInventario'
import { PanelExistencia } from './PanelExistencia'
import { TablaExistencias, type Fila } from './TablaExistencias'
import { useAlmacenes, useExistencias, useMovimientos } from './consultas'
import { filtrosIniciales, type Filtros } from './filtros'

export function PaginaInventario() {
  const { data: perfil } = usePerfil()
  const almacenPropio = perfil?.almacen?.id ?? null

  const [filtros, setFiltros] = useState<Filtros>(() => filtrosIniciales(undefined))
  const [tocado, setTocado] = useState(false)
  const [pagina, setPagina] = useState(0)
  const [porPagina, setPorPagina] = useState(25)
  const [abierta, setAbierta] = useState<Fila | null>(null)

  // El perfil llega después de la primera pintura, y el filtro inicial depende
  // del rol. Se aplica una sola vez: en cuanto la persona toca un filtro, manda
  // lo que eligió, no lo que el rol sugería.
  if (!tocado && perfil !== undefined && filtros.almacenId === 'todos') {
    setTocado(true)
    setFiltros(filtrosIniciales({ rol: perfil.rol, almacenId: perfil.almacen?.id ?? null }))
  }

  const almacenes = useAlmacenes()
  const listado = useExistencias(filtros, pagina, porPagina)
  const movimientos = useMovimientos(abierta?.id ?? null)

  const cambiarFiltros = (nuevos: Filtros) => {
    setTocado(true)
    setFiltros(nuevos)
    setPagina(0) // Cambiar un filtro y quedarse en la página 7 deja la tabla vacía.
  }

  return (
    <Stack spacing={3}>
      <Stack spacing={0.5}>
        <Typography variant="h1">Inventario</Typography>
        <Typography sx={{ color: 'text.secondary' }}>
          Ves los cuatro almacenes; solo puedes editar el tuyo
        </Typography>
      </Stack>

      <Card>
        <CardContent>
          <FiltrosInventario
            filtros={filtros}
            almacenes={almacenes.data ?? []}
            onCambio={cambiarFiltros}
          />
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          {/* role="status" hace que un lector de pantalla anuncie cuántos
              resultados quedaron después de filtrar. Sin esto, quien no ve la
              tabla no se entera de que la búsqueda hizo algo. */}
          <Typography role="status" variant="body2" sx={{ color: 'text.secondary', mb: 1.5 }}>
            {listado.isPending ? 'Buscando…' : `${listado.data?.total ?? 0} existencias`}
          </Typography>

          {listado.error !== null && (
            <Alert severity="error">
              No se pudo leer el inventario: {listado.error.message}
            </Alert>
          )}

          {listado.isPending && <Skeleton variant="rounded" height={320} />}

          {listado.data !== undefined && (
            <TablaExistencias
              filas={listado.data.filas}
              total={listado.data.total}
              pagina={pagina}
              porPagina={porPagina}
              almacenPropio={almacenPropio}
              onPagina={setPagina}
              onPorPagina={(n) => { setPorPagina(n); setPagina(0) }}
              onAbrir={setAbierta}
            />
          )}
        </CardContent>
      </Card>

      <PanelExistencia
        fila={abierta}
        almacenPropio={almacenPropio}
        movimientos={movimientos.data ?? []}
        cargandoMovimientos={movimientos.isPending && abierta !== null}
        onCerrar={() => setAbierta(null)}
      />
    </Stack>
  )
}
```

- [ ] **Step 2: Enciende la ruta y el menu**

En `src/App.tsx`, agrega el import y la ruta dentro del `Layout`:

```tsx
import { PaginaInventario } from '@/features/inventario/PaginaInventario'
```

```tsx
<Route element={<Layout />}>
  <Route path="/" element={<PaginaInicio />} />
  <Route path="/inventario" element={<PaginaInventario />} />
</Route>
```

En `src/app/navegacion.ts`, el item de inventario pasa a disponible:

```ts
{ ruta: '/inventario', etiqueta: 'Inventario', icono: 'mdi:package-variant-closed', disponible: true },
```

- [ ] **Step 3: Fija en una prueba que el menu ya lleva a algun lado**

`src/app/navegacion.test.ts` no afirma nada sobre `disponible` hoy, así que no
hay nada que corregir: hay algo que **agregar**. Un item marcado `disponible`
sin ruta registrada es un enlace roto, y al revés es una pantalla inalcanzable.

Agrega dentro del `describe('menuDeNavegacion', ...)`:

```ts
  // Un item disponible sin ruta en App.tsx es un enlace roto, y una ruta sin
  // item es una pantalla a la que nadie llega. Esta prueba ancla el unico de
  // los cuatro que ya esta construido.
  test('inventario ya esta disponible y el resto sigue apagado', () => {
    const items = menuDeNavegacion('responsable')

    expect(items.find((i) => i.ruta === '/inventario')?.disponible).toBe(true)
    expect(items.find((i) => i.ruta === '/practicas')?.disponible).toBe(false)
    expect(items.find((i) => i.ruta === '/reportes')?.disponible).toBe(false)
  })
```

Córrela antes de tocar `navegacion.ts` y comprueba que falla con
`expected false to be true`. Luego haz el cambio del Step 2 y vuelve a correrla.

- [ ] **Step 4: Corre todo**

```bash
pnpm test && pnpm typecheck && pnpm lint && pnpm build
supabase test db
```

Esperado: los cinco en cero.

- [ ] **Step 5: Guion de prueba manual**

`pnpm dev` y recorre esto. Cada paso dice qué hacer y qué debería pasar:

```
1. Entra como n3@uaeh.local / sigrem2026 y ve a Inventario
   -> El filtro de almacén arranca en N3 y la tabla muestra sus 56 existencias

2. Cambia el filtro de almacén a "Todos los almacenes"
   -> Salen las 164. Las filas que no son de N3 llevan el icono de ojo, y el
      title dice "De otro almacén: solo consulta"

3. Teclea "acido" en el buscador
   -> Encuentra "Ácido clorhídrico" y "Ácido succínico" pese a que escribiste
      sin acento. El contador de arriba baja al número de resultados

4. Teclea "acido, (99%)" con coma y paréntesis
   -> Sigue buscando y no truena: el término se limpia antes de armar el filtro

5. Filtra por tipo "Componentes"
   -> Salen los 15 de LE. Con las cinco opciones del prototipo esto no existía

6. Haz clic en un código
   -> Abre el panel derecho con el código en monoespaciado y su historial

7. Con el panel abierto, pulsa Escape
   -> Se cierra, y el foco vuelve al código desde el que lo abriste

8. Recorre la pantalla SOLO con Tab, sin tocar el ratón, y abre un detalle
      con Enter
   -> Llegas a los cuatro filtros y a los códigos de la tabla. Este es el paso
      que el prototipo no pasa: ahí el onClick vive en el <tr> y no se alcanza

9. Entra como lectura@uaeh.local
   -> Arranca en "Todos los almacenes" y ve las 164

10. Entra como admin@uaeh.local
   -> Arranca en "Todos los almacenes"; ningún icono de ojo, porque no tiene
      almacén propio que contrastar

11. Con la sesión abierta, corre `supabase stop` y recarga
   -> Sale la alerta "No se pudo leer el inventario: ..." y no una pantalla en
      blanco. Vuelve a levantarlo con `supabase start`

12. Reduce la ventana a 1024 px, que es la resolución de las máquinas del
       almacén, y cambia entre modo claro y oscuro con el control de la barra
   -> La tabla no desborda en horizontal, y los seis colores de estado se
      distinguen en los dos modos. Fíjate en particular en que "Agotado" no se
      confunda con el guinda de la marca
```

- [ ] **Step 6: Commit**

```bash
git add src/features/inventario/PaginaInventario.tsx src/App.tsx src/app/navegacion.ts src/app/navegacion.test.ts
git commit -m "feat(inventario): pantalla de consulta en /inventario"
```

---

### Task 10: El bloque propio de cada tipo en el panel

Cierra la §6 del spec: el panel muestra los campos que dependen de qué es la
cosa. En un almacén de reactivos esto no es adorno — el rombo NFPA y la hoja de
seguridad son la información que alguien busca antes de abrir un frasco.

Va después de la pantalla y no antes a propósito: la Task 9 ya deja algo que se
puede usar, y esto lo enriquece sin bloquearlo.

**Files:**
- Create: `src/features/inventario/DetalleTipo.tsx`
- Test: `src/features/inventario/DetalleTipo.test.tsx`
- Modify: `src/features/inventario/PanelExistencia.tsx`
- Modify: `src/features/inventario/PaginaInventario.tsx`

**Interfaces:**
- Consumes: `useDetalleExistencia` de `./consultas`.
- Produces: `DetalleTipo(props: { clasificacion: Enums<'clasificacion_articulo'>; datos: DatosTipo | null })`
  y `type DatosTipo` — un objeto **plano**, no la forma que devuelve PostgREST.

- [ ] **Step 1: Comprueba que forma devuelve el anidado**

PostgREST devuelve las relaciones 1:1 como objeto o como arreglo según logre
detectar que la llave foránea es también la primaria. `articulo_reactivo` lo es,
pero conviene verlo en lugar de suponerlo:

```bash
grep -n "articulo_reactivo" src/types/database.ts | head
```

Y en el navegador, con el panel abierto, mira la respuesta en la pestaña de red.
Lo que salga de ahí es lo que aplana el Step 4. Anótalo antes de seguir: es la
única parte de esta tarea que no se puede saber leyendo el plan.

- [ ] **Step 2: Escribe la prueba que falla**

Crea `src/features/inventario/DetalleTipo.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import { describe, expect, test } from 'vitest'

import { DetalleTipo, type DatosTipo } from './DetalleTipo'

const VACIO: DatosTipo = {
  cas: null, estadoFisico: null, colorAlmacenaje: null, tieneHojaSeguridad: null,
  riesgoSalud: null, riesgoInflamabilidad: null, riesgoReactividad: null,
  numeroSerie: null, numeroInventario: null, funcionamiento: null, fechaChequeo: null,
  metodoConservacion: null, temperatura: null, origenEspecie: null,
}

describe('DetalleTipo', () => {
  test('un reactivo muestra el CAS y el rombo NFPA', () => {
    render(
      <DetalleTipo
        clasificacion="reactivo"
        datos={{ ...VACIO, cas: '67-64-1', riesgoSalud: 2, riesgoInflamabilidad: 3, riesgoReactividad: 0 }}
      />,
    )

    expect(screen.getByText('67-64-1')).toBeInTheDocument()
    expect(screen.getByText(/salud/i)).toBeInTheDocument()
    expect(screen.getByText(/inflamabilidad/i)).toBeInTheDocument()
  })

  // El formato pregunta "existencia de hoja de seguridad": si la tienes, no si
  // hace falta. Un false tiene que leerse como "no la tenemos", sin ambiguedad.
  test('dice cuando NO hay hoja de seguridad, en vez de callarse', () => {
    render(<DetalleTipo clasificacion="reactivo" datos={{ ...VACIO, tieneHojaSeguridad: false }} />)
    expect(screen.getByText(/sin hoja de seguridad/i)).toBeInTheDocument()
  })

  test('un equipo muestra la serie y el inventario UAEH', () => {
    render(
      <DetalleTipo
        clasificacion="equipo"
        datos={{ ...VACIO, numeroSerie: 'B417000341', numeroInventario: 'UAEH-9912' }}
      />,
    )

    expect(screen.getByText('B417000341')).toBeInTheDocument()
    expect(screen.getByText('UAEH-9912')).toBeInTheDocument()
  })

  test('la materia biologica muestra especie y conservacion', () => {
    render(
      <DetalleTipo
        clasificacion="materia_biologica"
        datos={{ ...VACIO, origenEspecie: 'Zea mays', metodoConservacion: 'Refrigeración' }}
      />,
    )

    expect(screen.getByText('Zea mays')).toBeInTheDocument()
    expect(screen.getByText('Refrigeración')).toBeInTheDocument()
  })

  // Un material no tiene bloque propio: mejor nada que un encabezado vacio.
  test('un material no pinta nada', () => {
    const { container } = render(<DetalleTipo clasificacion="material" datos={VACIO} />)
    expect(container).toBeEmptyDOMElement()
  })

  test('sin datos todavia no pinta nada', () => {
    const { container } = render(<DetalleTipo clasificacion="reactivo" datos={null} />)
    expect(container).toBeEmptyDOMElement()
  })
})
```

- [ ] **Step 3: Corre la prueba y comprueba que falla**

```bash
pnpm test DetalleTipo
```

Esperado: FALLA con `Failed to resolve import "./DetalleTipo"`.

- [ ] **Step 4: Escribe el componente**

Crea `src/features/inventario/DetalleTipo.tsx`:

```tsx
import { Divider, Stack, Typography } from '@mui/material'

import type { Enums } from '@/types/database'

/**
 * Plano a propósito. La consulta anidada de PostgREST devuelve `articulo` con
 * `articulo_reactivo` colgando, y esa forma no tiene por qué llegar hasta aquí:
 * si el componente la conociera, cambiar el `select` lo rompería. La página
 * aplana una vez y este componente sólo sabe de campos.
 */
export type DatosTipo = {
  cas: string | null
  estadoFisico: Enums<'estado_fisico'> | null
  colorAlmacenaje: Enums<'color_almacenaje'> | null
  tieneHojaSeguridad: boolean | null
  riesgoSalud: number | null
  riesgoInflamabilidad: number | null
  riesgoReactividad: number | null
  numeroSerie: string | null
  numeroInventario: string | null
  funcionamiento: Enums<'funcionamiento_equipo'> | null
  fechaChequeo: string | null
  metodoConservacion: string | null
  temperatura: string | null
  origenEspecie: string | null
}

function Dato({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  return (
    <Stack direction="row" spacing={1} sx={{ alignItems: 'baseline' }}>
      <Typography variant="caption" sx={{ color: 'text.secondary', width: 104, flexShrink: 0 }}>
        {etiqueta}
      </Typography>
      <Typography variant="body2" sx={{ flex: 1 }}>{valor}</Typography>
    </Stack>
  )
}

function Bloque({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <>
      <Divider sx={{ my: 2 }} />
      <Typography variant="overline" sx={{ color: 'text.secondary' }}>{titulo}</Typography>
      <Stack spacing={1} sx={{ mt: 1 }}>{children}</Stack>
    </>
  )
}

export function DetalleTipo({
  clasificacion, datos,
}: {
  clasificacion: Enums<'clasificacion_articulo'>
  datos: DatosTipo | null
}) {
  if (datos === null) return null

  if (clasificacion === 'reactivo') {
    return (
      <Bloque titulo="Datos del reactivo">
        {datos.cas !== null && <Dato etiqueta="CAS" valor={datos.cas} />}
        {datos.estadoFisico !== null && <Dato etiqueta="Estado físico" valor={datos.estadoFisico} />}
        {datos.colorAlmacenaje !== null && (
          <Dato etiqueta="Almacenaje" valor={datos.colorAlmacenaje} />
        )}
        {/* Un false se escribe con todas sus letras: el formato pregunta si la
            TIENES, y callarse dejaria "no la tenemos" indistinguible de "no se". */}
        {datos.tieneHojaSeguridad !== null && (
          <Dato
            etiqueta="Hoja de seguridad"
            valor={datos.tieneHojaSeguridad ? 'Disponible' : 'Sin hoja de seguridad'}
          />
        )}
        {datos.riesgoSalud !== null && (
          <Dato etiqueta="NFPA salud" valor={`${datos.riesgoSalud} de 4`} />
        )}
        {datos.riesgoInflamabilidad !== null && (
          <Dato etiqueta="NFPA inflamabilidad" valor={`${datos.riesgoInflamabilidad} de 4`} />
        )}
        {datos.riesgoReactividad !== null && (
          <Dato etiqueta="NFPA reactividad" valor={`${datos.riesgoReactividad} de 4`} />
        )}
      </Bloque>
    )
  }

  if (clasificacion === 'equipo') {
    return (
      <Bloque titulo="Datos del equipo">
        {datos.numeroSerie !== null && <Dato etiqueta="N.º de serie" valor={datos.numeroSerie} />}
        {datos.numeroInventario !== null && (
          <Dato etiqueta="Inventario UAEH" valor={datos.numeroInventario} />
        )}
        {datos.funcionamiento !== null && (
          <Dato
            etiqueta="Funcionamiento"
            valor={datos.funcionamiento === 'correcto' ? 'Correcto' : 'Presenta fallas'}
          />
        )}
        {datos.fechaChequeo !== null && <Dato etiqueta="Último chequeo" valor={datos.fechaChequeo} />}
      </Bloque>
    )
  }

  if (clasificacion === 'materia_biologica') {
    return (
      <Bloque titulo="Datos de la muestra">
        {datos.origenEspecie !== null && <Dato etiqueta="Especie" valor={datos.origenEspecie} />}
        {datos.metodoConservacion !== null && (
          <Dato etiqueta="Conservación" valor={datos.metodoConservacion} />
        )}
        {datos.temperatura !== null && <Dato etiqueta="Temperatura" valor={datos.temperatura} />}
      </Bloque>
    )
  }

  // material, insumo y componente no tienen campos propios: mejor nada que un
  // encabezado vacio.
  return null
}
```

- [ ] **Step 5: Corre la prueba y comprueba que pasa**

```bash
pnpm test DetalleTipo
```

Esperado: PASA, 6 pruebas.

- [ ] **Step 6: Conectalo al panel**

En `PanelExistencia.tsx`, agrega a las props `datosTipo: DatosTipo | null` y
píntalo justo antes del `Divider` de Movimientos:

```tsx
<DetalleTipo clasificacion={fila.clasificacion} datos={datosTipo} />
```

con los imports:

```tsx
import { DetalleTipo, type DatosTipo } from './DetalleTipo'
```

En `PaginaInventario.tsx`, llama a la consulta y aplana su resultado. **Ajusta
este aplanado a la forma que anotaste en el Step 1** — si `articulo_reactivo`
llegó como arreglo, aquí va `[0]` en vez del acceso directo:

```tsx
const detalle = useDetalleExistencia(abierta?.id ?? null)

const datosTipo: DatosTipo | null = detalle.data
  ? {
      cas:                 detalle.data.articulo?.articulo_reactivo?.cas ?? null,
      estadoFisico:        detalle.data.articulo?.articulo_reactivo?.estado_fisico ?? null,
      colorAlmacenaje:     detalle.data.articulo?.articulo_reactivo?.color_almacenaje ?? null,
      tieneHojaSeguridad:  detalle.data.articulo?.articulo_reactivo?.tiene_hoja_seguridad ?? null,
      riesgoSalud:         detalle.data.articulo?.articulo_reactivo?.riesgo_salud ?? null,
      riesgoInflamabilidad: detalle.data.articulo?.articulo_reactivo?.riesgo_inflamabilidad ?? null,
      riesgoReactividad:   detalle.data.articulo?.articulo_reactivo?.riesgo_reactividad ?? null,
      numeroSerie:         detalle.data.numero_serie,
      numeroInventario:    detalle.data.numero_inventario_uaeh,
      funcionamiento:      detalle.data.funcionamiento,
      fechaChequeo:        detalle.data.fecha_chequeo,
      metodoConservacion:  detalle.data.metodo_conservacion,
      temperatura:         detalle.data.temperatura,
      origenEspecie:       detalle.data.articulo?.articulo_biologico?.origen_especie ?? null,
    }
  : null
```

y pásalo: `<PanelExistencia ... datosTipo={datosTipo} />`.

- [ ] **Step 7: Corre todo y compruebalo a mano**

```bash
pnpm test && pnpm typecheck && pnpm lint && pnpm build
```

Y en el navegador: abre `N3-00003` (Acetona).
Esperado: el panel muestra `CAS 67-64-1` y su rombo NFPA. Abre después un
material como un matraz: no aparece ningún bloque extra ni encabezado vacío.

- [ ] **Step 8: Commit**

```bash
git add src/features/inventario/DetalleTipo.tsx src/features/inventario/DetalleTipo.test.tsx src/features/inventario/PanelExistencia.tsx src/features/inventario/PaginaInventario.tsx
git commit -m "feat(inventario): campos propios de reactivo, equipo y materia biologica"
```

---

## Verificacion final

```bash
pnpm typecheck && pnpm lint && pnpm test && pnpm build
supabase test db
```

Los cinco en cero, y el guion manual de la Task 9 recorrido de principio a fin.
No se dice que funciona sin haberlo hecho.
