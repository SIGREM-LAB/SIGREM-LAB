Reemplaza las 7 migraciones del 12 de agosto por un baseline coherente con el
formato unificado de inventarios, y agrega el módulo de prácticas.

- Diseño: `docs/specs/2026-08-18-depuracion-esquema-formato-unificado-design.md`
- Plan: `docs/plans/2026-08-18-depuracion-esquema.md`

## Por qué

El esquema vigente se diseñó contra los 10 Excel históricos, con todas sus mañas.
Desde entonces cambiaron dos cosas que invalidan parte de ese diseño: existe un
**formato unificado** de 6 hojas con 13 reglas de captura, y se decidió arrancar
con los datos de hoy en vez de cargar existencias pasadas. Las defensas contra el
texto sucio ya no protegen nada — protegen contra un formato que no se va a
volver a usar.

## Se quita

- `almacen_alias` y `almacen.padre_id` — la sub-ubicación es ubicación, y el
  almacén lo dice el nombre del archivo
- `existencia.partida` (es del catálogo de compras) y `revisado_por` (quién
  revisó lo dice `movimiento.usuario_id`)
- `articulo_reactivo.uso_principal` (duplicado con `almacen`) y
  `clasificacion_ghs` (no existe en el formato)
- El valor `por_confirmar` del enum de estado: la carga de hoy **es** el conteo
  inicial

## Se agrega

- La clasificación `materia_biologica` y su tabla — el formato tiene una hoja
  completa que el esquema no contemplaba
- El **CAS** de reactivos, hoy enterrado en la cadena larga
  (`"...CAS: 5144-89-8"`). Con índice normal, no único: el CAS identifica el
  compuesto, no el grado, y dos purezas del mismo zinc lo comparten
- `existencia.laboratorio_id` — la tabla `laboratorio` existía y **nada la
  referenciaba** — y `funcionamiento` para equipos
- La tabla `carga`: de qué archivo, periodo y responsable salió cada renglón
- El **módulo de prácticas** completo. `movimiento.practica_id` llevaba tres
  semanas siendo un `bigint` huérfano, sin FK ni tabla del otro lado

## Lo que cierra huecos que hoy están abiertos

**Dos llaves foráneas compuestas.** Nada impide hoy que una existencia de N3
apunte a un anaquel o a un laboratorio de N4. Con `(ubicacion_id, almacen_id)` y
`(laboratorio_id, almacen_id)` es imposible por construcción, sin triggers ni
validación en la app.

**Únicos parciales en `numero_serie` y `numero_inventario_uaeh`** (regla 10 del
formato: hoy en N4 tres series se repiten en 30 equipos). Parciales porque el ETL
normaliza `Sin serie` a `NULL`.

**`articulo` gana `unique nulls not distinct (nombre_canonico, descripcion,
unidad_base)`.** Sin `nulls not distinct`, dos filas con especificación vacía se
cuelan como distintas y el catálogo se duplica solo.

**`consumo` y `perdidas` son columnas generadas**, no cuentas del frontend. El bug
que costó la semana del 11 de agosto fue una resta al revés que *no daba error*.

## La frontera entre `movimiento` y `practica_elemento`

| | `movimiento` | `practica_elemento` |
|---|---|---|
| Responde | **cuánto hay** | **quién usó qué** |
| Se escribe | cuando el saldo cambia | cuando algo se usa en una práctica |

De ahí que un préstamo de equipo no genere `movimiento` (la cantidad no cambia) y
que Reportes lea `practica_elemento`.

## Caducidad

Hay reactivos caducados hace años que **siguen sirviendo** y se usan en prácticas.
`fecha_caducidad` se conserva pero **nunca toca `estado`**: lo caducado se deriva
y se muestra como etiqueta, no bloquea. Modelarlo como estado haría que la gente
aprendiera a ignorar la alerta o a borrar la fecha, y una columna que miente es
peor que una vacía.

## Lo que encontraron las pruebas

- Al mover el `enable row level security` al archivo de cada tabla, las políticas
  de `campo_capturable`, `perfil_captura` y `perfil_campo` se quedaron sin
  migrar. Sin política RLS niega todo: `formulario()` devolvía **vacío para
  cualquier usuario real** y el alta se habría quedado sin campos
- El trigger de prácticas tomaba `usuario_id` de `auth.uid()`, que es `NULL` sin
  sesión: el ETL habría reventado con un error de constraint en vez de algo
  legible
- **N3 no tenía ningún laboratorio**, así que no podía registrar prácticas

## Reescritura del baseline

Se reescribieron las migraciones en vez de parchear encima. La justificación está
en la §3 del spec: cero registros cargados, remoto vacío sin historial de
migraciones, y Postgres no tiene `alter type ... drop value` para quitar
`por_confirmar` por parche. `CLAUDE.md` ya anota la excepción **con fecha** y
cuándo caducó: el primer `db push`, que ya ocurrió.

## Verificación

```
supabase db reset    7 migraciones, limpio
supabase test db     74/74  (44 de esquema + 30 de RLS)
pnpm typecheck       OK
pnpm lint            OK
pnpm build           OK
pnpm test            18/18
```

Aplicado y verificado en el proyecto remoto: 20 tablas, 20 con RLS, 48 políticas,
y los catálogos cargados. `auth.users` en 0 — las cuentas de prueba no se fueron a
producción. `curl` sin llave contra `/rest/v1/almacen` responde 401.

## Pendientes que no son de este PR

- Crear los usuarios reales en Auth y sus filas en `public.perfil`: hoy el login
  en la app desplegada no funciona porque no hay ninguno
- Confirmar los nombres reales de los laboratorios de N3 (queda un marcador
  `(por confirmar)` en el seed)
- El ETL, el exportador NOM-005-STPS y las pantallas de prácticas y reportes son
  planes aparte
