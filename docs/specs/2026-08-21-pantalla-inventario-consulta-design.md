# Diseño · La pantalla de inventario, en modo consulta

**21 de agosto de 2026**

Antecedentes: el esquema está fijado en
`2026-08-18-depuracion-esquema-formato-unificado-design.md`, y este documento no
lo cambia — salvo por dos correcciones de RLS que la §4 justifica. El layout de
referencia es `referencia/prototipo/src/app/components/Inventory.tsx`, que es lo
que carga la ruta `/inventario` del prototipo.

Todo lo que este documento afirma sobre el comportamiento de la base se comprobó
ejecutándolo contra la base local (Postgres 17.6) el 21 de agosto. Las salidas
están citadas donde importan.

---

## 1 · Qué se decide aquí

La primera pantalla real del sistema después del acceso. Cubre **solo consulta**:
listado de existencias, filtros, búsqueda y panel de detalle. El alta de
existencias y el registro de movimientos son pantallas posteriores y este
documento no las diseña.

Lo que se decide: qué tabla se lee y con qué joins, cómo se expone esa lectura
sin abrir un hueco, qué ve cada rol, y dónde vive el filtrado.

---

## 2 · La tabla es `existencia`

Todo lo demás son joins de lectura. El mapeo contra las columnas del prototipo:

| Columna en pantalla | De dónde sale |
|---|---|
| Código | `existencia.codigo` — `N3-00042`, no el `INV-0001` del prototipo (decisión P1 del spec del 18) |
| Nombre | `articulo.nombre_canonico` |
| Segunda línea | `existencia.marca` y `articulo.descripcion` |
| Tipo | `articulo.clasificacion` |
| Existencia | `existencia.cantidad` con `articulo.unidad_base` |
| Estado | `existencia.estado` |
| Almacén | `almacen.clave` |
| Ubicación | `ubicacion.etiqueta`, que ya viene armada: `"N3 · Anaquel 2 · Repisa 3 · Fila 4"` |

El panel de detalle añade `movimiento` (historial), `articulo_reactivo` (CAS,
rombo NFPA, color de almacenaje) y los campos de equipo y materia biológica que
ya viven en `existencia`.

### Dos correcciones sobre el prototipo

**Los tipos son seis, no cinco.** El prototipo no contempla `componente`, que es
la clasificación de 15 de los artículos de LE. Un filtro con cinco opciones deja
esos renglones inalcanzables.

**"Laboratorio" y "Almacén" están intercambiados.** El prototipo llama
*Laboratorio* a lo que el esquema llama `almacen` (N3, N4, LUM, LE) y *Almacén* a
lo que llama `ubicacion` (el anaquel). Pero `laboratorio` existe en el esquema y
es otra cosa: el aula donde se dan las prácticas, que cuelga de un almacén y no
guarda existencias. Copiar los encabezados del prototipo haría que la primera
pantalla del sistema contradiga al esquema en su propio vocabulario. Los
encabezados son **Almacén** y **Ubicación**.

Nota menor de nomenclatura: el prototipo escribe el almacén LE como
"Electrónica". La clave es `LE`.

---

## 3 · Los roles, y lo que la RLS concede hoy

| Tabla | SELECT | INSERT | UPDATE | DELETE |
|---|---|---|---|---|
| `existencia` | todos, los 4 almacenes | admin, o coincidencia de almacén | igual | solo admin |
| `movimiento` | todos | admin, o coincidencia | revocado | revocado |
| `articulo` | todos | admin y responsable | solo admin | solo admin |
| `ubicacion` | todos | admin o coincidencia | igual | igual |
| `almacen`, `laboratorio` | todos | solo admin | solo admin | solo admin |

La regla que pide el proyecto —cada quien edita su almacén y de los demás solo
ve— **ya es el comportamiento de la base** para `responsable`. La lectura abierta
a los cuatro almacenes es deliberada: es lo que permite que N4 consulte el stock
de N3 antes de ir a pedirlo prestado.

### La consecuencia que la pantalla no puede ignorar

Un `UPDATE` sobre una fila de otro almacén **no lanza error**. La fila no pasa el
`USING` de la política, así que la sentencia afecta cero renglones y supabase-js
devuelve `error: null`. Para el cliente es indistinguible de un guardado exitoso.

Esto no muerde en esta pantalla, que es de solo lectura, pero fija una regla para
las que siguen: **la interfaz apaga la edición por su cuenta**, comparando
`existencia.almacen_id` contra `perfil.almacen_id`. No espera a que la base
proteste, porque la base protesta en silencio. La RLS sigue siendo la seguridad
real; la comparación en el cliente es solo honestidad visual.

---

## 4 · Dos huecos de escritura, y su cierre

Ninguno de los dos lo toca una pantalla de consulta. Se cierran ahora porque son
baratos, porque el ETL está por cargar unos 5,500 renglones reales, y porque las
pantallas de escritura se van a construir encima dando por hecho que la regla la
sostiene la base.

### Hueco A · Un `consulta` con almacén asignado puede escribir

`existencia_alta`, `existencia_edicion`, `ubicacion_escritura` y `movimiento_alta`
**no llaman a `puede_escribir()`**: solo comparan almacén. Hoy no se nota porque
`lectura@uaeh.local` tiene `almacen_id` nulo y `NULL = 1` es falso. El día que se
le asigne un almacén —algo natural, para que la pantalla le arranque filtrada en
el suyo— queda con permiso de escritura.

Comprobado asignándole N3 a `lectura@`:

```
 rol      | almacen | puede_escribir
 consulta |       1 | f
 → INSERT 0 1     (existencia N3-00057 creada)
```

La §12 del spec del 18 promete lo contrario: *"un usuario `consulta` no puede
insertar nada en ninguna de las tablas nuevas"*. La prueba 18 de `rls.test.sql`
no lo detectó porque solo ejercita `articulo`, que sí consulta `puede_escribir()`.

**El cierre** es agregar el conjunto a las cuatro políticas:

```sql
alter policy existencia_alta on public.existencia
  with check ((select private.puede_escribir())
              and ((select private.es_admin())
                   or almacen_id = (select private.almacen_actual())));
```

Verificado: el `consulta` con almacén queda bloqueado y el `responsable` sigue
insertando (`N3-00057`). El `admin` no se ve afectado, porque `puede_escribir()`
es cierto para `admin` y `responsable`.

### Hueco B · Un responsable puede reescribir el saldo sin dejar bitácora

`existencia_edicion` autoriza un `UPDATE` sobre la fila entera, y no hay trigger
de `UPDATE`: los dos triggers del esquema son `BEFORE INSERT`. Comprobado como
`n3@`:

```
 id  | codigo | cantidad   | estado
 711 | HACK-1 | 99999.0000 | disponible
 movimientos_generados: 0
```

Se saltó la auditoría y además reescribió el código impreso en la etiqueta QR.
Hoy la regla *"el saldo lo mantiene el trigger desde `movimiento`"* la sostiene
únicamente la disciplina del cliente, y la app va a llevar la `anon key` dentro
del binario.

**El cierre tiene una trampa.** Lo primero que uno escribe es:

```sql
revoke update (cantidad, codigo, almacen_id) on public.existencia from authenticated;
```

y **no hace absolutamente nada**. `authenticated` ya tiene `UPDATE` a nivel tabla
—`information_schema.table_privileges` lo confirma, es el `grant all` por omisión
de Supabase— y un privilegio de tabla implica todas las columnas. Revocar una
columna suelta no le quita nada. Con ese `revoke` puesto, el
`update ... set cantidad = 99999` volvió a pasar.

La secuencia correcta es revocar la tabla y devolver las columnas editables:

```sql
revoke update on public.existencia from authenticated;

grant update (ubicacion_id, laboratorio_id, marca, modelo, presentacion,
              cantidad_minima, peso_frasco_vacio, peso_total, numero_serie,
              numero_inventario_uaeh, funcionamiento, mantenimiento, fecha_chequeo,
              metodo_conservacion, temperatura, fecha_recoleccion, fecha_preparacion,
              responsable_muestra, fecha_adquisicion, fecha_caducidad,
              estado, observaciones)
  on public.existencia to authenticated;
```

Quedan fuera de la lista `cantidad`, `codigo`, `almacen_id`, `articulo_id`,
`carga_id` y `creado_en`. Las tres primeras son el saldo, la identidad de la
etiqueta y el ancla de los permisos. `articulo_id` decide qué *es* la cosa y solo
se mueve por `fusionar_articulo()`, que es de admin. `carga_id` y `creado_en` son
procedencia.

`estado` **sí** queda editable: un responsable tiene que poder marcar un frasco
como `contaminado` o un equipo en `mantenimiento`. Lo que impide que abuse de eso
es el segundo trigger:

```sql
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

`estado_calculado()` ya respeta los tres estados manuales y recalcula el resto,
así que marcar `disponible` una existencia en cero no sirve de nada: vuelve a
`agotado`.

Verificado con la secuencia correcta puesta: `cantidad`, `codigo` y `almacen_id`
truenan con `42501`; los campos editables pasan; y el camino legítimo sigue
funcionando —un `insert` en `movimiento` movió el saldo de 139.8 a 138.8, porque
`aplicar_movimiento()` es `security definer` y corre como su dueño, ajeno a los
privilegios de columna de `authenticated`.

**Efecto secundario, y es bueno:** al subir `cantidad_minima` por encima de la
cantidad, el estado pasó solo a `stock_bajo`. Hoy eso no ocurre —nada recalcula
en un `UPDATE`— así que fijar un mínimo no surtía efecto hasta el siguiente
movimiento. Esto importa: hoy las 164 filas tienen `cantidad_minima` nula, y en
cuanto alguien empiece a capturar mínimos va a esperar que el estado responda.

### Por qué una migración nueva y no un parche a `rls.sql`

El CLI ya está vinculado a un proyecto remoto (`supabase/.temp/project-ref`
existe). La ventana de reescribir el baseline que abrió el spec del 18 se cierra
con el primer `db push`, y desde aquí no hay forma de saber si ese push ya
ocurrió. La regla literal del proyecto —una migración aplicada no se edita— se
respeta: archivo nuevo.

Los dos cierres y la vista de la §5 van juntos en
`supabase/migrations/20260821120000_inventario_consulta.sql`. Van juntos porque
comparten motivo —dejar la lectura de la pantalla expuesta sin abrir escritura—
y porque separarlos obligaría a razonar dos veces sobre el mismo conjunto de
privilegios.

---

## 5 · La vista `existencia_listado`

El listado necesita cuatro tablas unidas, búsqueda sobre tres campos y orden por
cualquier columna. Contra los recursos embebidos de PostgREST eso se vuelve
frágil: un `or` que cruza una columna propia con una de un recurso embebido pelea
con la sintaxis, y ordenar por el nombre exige que el embebido sea `!inner`.

Una vista que aplana el join deja todo como columna de primer nivel y el cliente
vuelve a ser trivial.

```sql
create view public.existencia_listado
with (security_invoker = on) as
select e.id, e.codigo, e.marca, e.cantidad, e.estado, e.almacen_id,
       e.ubicacion_id, e.fecha_caducidad, e.creado_en,
       a.id as articulo_id,
       a.nombre_canonico, a.descripcion, a.clasificacion, a.unidad_base,
       al.clave   as almacen_clave,
       u.etiqueta as ubicacion,
       public.norm_texto(a.nombre_canonico)    as nombre_norm,
       public.norm_texto(coalesce(e.marca, '')) as marca_norm
from public.existencia e
join public.articulo a  on a.id  = e.articulo_id
join public.almacen  al on al.id = e.almacen_id
left join public.ubicacion u on u.id = e.ubicacion_id;
```

### `security_invoker = on` no es opcional

Es la línea de la que depende todo lo demás, y omitirla falla en silencio. Una
vista sin ese ajuste corre con los privilegios de su dueño —`postgres`— y no
aplica la RLS de las tablas de abajo. Comprobado creando las dos variantes y
consultándolas como `anon`:

```
vista con security_invoker = on   → ERROR: permission denied for table existencia
vista sin security_invoker        → count = 164
```

Es decir: la vista sin el ajuste publica el inventario completo a la llave
pública, que es exactamente el escenario contra el que existe la RLS. Con el
ajuste puesto, la vista no concede nada que las tablas no concedan ya, y las
políticas de `existencia` siguen siendo la única puerta.

Aun así, `revoke all on public.existencia_listado from anon`, por el mismo
criterio de dos candados que ya sigue `movimiento`.

### Por qué `nombre_norm` es columna aparte y no una sola columna `busqueda`

La tentación es concatenar nombre, marca y código en un solo campo normalizado y
buscar ahí con un `ilike`. Funciona, pero esa concatenación no la cubre ningún
índice: obliga a recorrer la tabla entera calculando `norm_texto()` por renglón.

Con el nombre normalizado como columna propia, el predicado empuja hasta
`articulo` y aprovecha el índice trigram que el esquema ya tiene. El plan real:

```
Bitmap Index Scan on articulo_nombre_trgm_idx
  Index Cond: (norm_texto(nombre_canonico) ~~ '%acetona%'::text)
```

Que es, literalmente, para lo que se creó `articulo_nombre_trgm_idx`. Y trae
gratis la insensibilidad a acentos que pide el dominio: `"acido"` encuentra
`"Ácido"`.

El precio es normalizar el término tecleado en el cliente. Son tres líneas
—minúsculas y quitar diacríticos con `normalize('NFD')`— en un módulo propio y
con su prueba, porque tiene que coincidir con lo que hace `norm_texto()`.

### Una nota sobre los tipos

La vista lleva joins, así que Postgres no la considera actualizable y
`pnpm gen:types` le va a generar solo el tipo `Row`, sin `Insert` ni `Update`.
Que sea de solo lectura por construcción, y no por disciplina, es justo lo que se
quiere de la tabla que alimenta una pantalla de consulta.

---

## 6 · La pantalla

Ruta `/inventario`, dentro de `RutaProtegida` y `Layout`, junto a `PaginaInicio`.
El item del menú pasa a `disponible: true` en `src/app/navegacion.ts`.

```
src/features/inventario/
  PaginaInventario.tsx     compone las piezas y sostiene el estado de filtros
  FiltrosInventario.tsx    buscador, tipo, almacén, estado
  TablaExistencias.tsx     la tabla y su paginación
  PanelExistencia.tsx      el detalle lateral
  consultas.ts             useExistencias, useDetalleExistencia, useMovimientos
  presentacion.ts          corte del nombre, mapa de estados, normalizar término
  filtros.ts               el tipo Filtros y su valor inicial según el rol
```

`presentacion.ts` y `filtros.ts` son funciones puras: ahí vive lo que se prueba
con Vitest sin montar nada.

### El nombre largo

Los nombres de reactivo son la cadena completa del formato —
`"1,10-Fenantrolina monohidrato, sólido, pureza 99%, presentación 250 g, CAS: 5144-89-8"`,
unos 90 caracteres. Es deliberado: el spec del ETL fija que `nombre_canonico`
guarda la cadena íntegra, porque la pureza distingue artículos.

En pantalla se corta en la primera coma: la cabeza en seminegrita y el resto
debajo, en gris y pequeño, sin el fragmento `CAS:` (que se repite en el panel de
detalle). El nombre completo va en el `title` del elemento. El corte es
**presentación**: no toca el dato.

Los artículos que no son reactivo ya vienen partidos —`"Matraz volumétrico"` con
descripción `"1000 mL, clase A, con tapón"`— y usan el mismo par de líneas sin
cortar nada.

### Los seis estados

`almacenes.ts` ya sentó el precedente: los colores de cada almacén viven en un
módulo de datos y no en el tema, porque no son la paleta de la interfaz sino un
atributo de cada almacén, lo que en una gráfica sería la serie. Los estados son
el mismo caso y siguen el mismo patrón, en `presentacion.ts`.

Hay un detalle que revisar a ojo: `error.main` del tema es `#A21A19`, casi el
guinda institucional. Un chip de `agotado` en `color="error"` se confunde con el
color de la marca, que está por toda la interfaz. El rojo de `agotado` tiene que
separarse del guinda, y hay que confirmarlo en los dos modos.

### Filtros

- **Búsqueda** sobre nombre, marca y código, sin acentos.
- **Tipo**: las seis clasificaciones.
- **Almacén**: los cuatro. Arranca en el propio si el rol es `responsable`; en
  *todos* si es `admin` o `consulta`.
- **Estado**: `agotado` se muestra —el prototipo lo esconde, y eso vuelve
  invisible justo lo que hay que reponer—. `baja` se esconde por omisión, con
  casilla para incluirlo: algo dado de baja ya no es inventario.

### Tuyo contra ajeno

Chip de almacén con el color de `aspectoDeAlmacen()`, y en el panel de detalle un
aviso cuando la existencia es de otro almacén: *"Pertenece a N4. Puedes
consultarla, no modificarla."* Siendo una pantalla de lectura, ese aviso es la
única señal, y es la que prepara el terreno para el alta.

### El panel de detalle

Un `Drawer` de MUI por la derecha, como el panel fijo del prototipo. Lleva: el
código en monoespaciado y grande **sin QR** —el QR sirve para imprimir etiquetas,
y eso es una pantalla propia con su formato de impresión—; información general;
ubicación; los campos del tipo que corresponda (reactivo con CAS, rombo NFPA y
color de almacenaje; equipo con serie, inventario UAEH y funcionamiento; materia
biológica con conservación y fechas); y el historial de `movimiento`, el más
reciente primero.

---

## 7 · La consulta

```ts
useQuery({
  queryKey: ['existencias', filtros, pagina, porPagina],
  placeholderData: keepPreviousData,
  queryFn: async () => {
    const { data, error, count } = await supabase
      .from('existencia_listado')
      .select('*', { count: 'exact' })
      .range(desde, hasta)
    if (error) throw error
    return { filas: data, total: count ?? 0 }
  },
})
```

`queryKey` lleva los filtros completos y la página: sin eso, cambiar de almacén
devuelve la caché del anterior. `keepPreviousData` evita que la tabla parpadee a
esqueleto en cada tecla. La búsqueda se retrasa 300 ms para no disparar una
consulta por pulsación.

**Paginación por `range()`, es decir `OFFSET`, y es a propósito.** La regla
general prefiere paginación por cursor porque el `OFFSET` recorre las filas que
salta. A 5,500 renglones y 25 por página, el peor caso recorre 5,500 filas: unos
milisegundos, y a cambio se conserva el total exacto y el salto a una página
concreta, que es lo que la gente de almacén realmente usa. Si esta tabla creciera
un orden de magnitud, la decisión se revisa.

---

## 8 · Pruebas

**`supabase/tests/database/rls.test.sql`** — cada política con su prueba, como
manda el proyecto:

1. Un `consulta` **con almacén asignado** no puede insertar en `existencia` (es
   el hueco A; la prueba 18 solo cubría `articulo`).
2. Lo mismo para `movimiento` y `ubicacion`.
3. Un responsable no puede escribir `cantidad` — espera `42501`.
4. Tampoco `codigo` ni `almacen_id`.
5. Sí puede escribir `observaciones` y `cantidad_minima`.
6. Un `insert` en `movimiento` sigue moviendo el saldo: el camino legítimo no se
   rompió.
7. Subir `cantidad_minima` por encima de la cantidad deja el estado en
   `stock_bajo` sin que medie un movimiento.
8. `anon` no puede leer `existencia_listado`.

Los ocho puntos son diez pruebas —el segundo cubre `movimiento` y `ubicacion`
por separado—, así que el `select plan(30)` de la cabecera del archivo pasa a
`plan(40)`. pgTAP no falla por una prueba de más ni de menos: falla al final, con
un mensaje sobre el plan, y es fácil perder un rato buscándolo en el lugar
equivocado.

**`supabase/tests/database/esquema.test.sql`** — la vista existe y tiene
`security_invoker` activo. Esta prueba es el seguro contra el fallo silencioso de
la §5: si alguien recrea la vista sin el ajuste, revienta aquí y no en producción.

**Vitest** — sobre las funciones puras y los componentes: corte del nombre largo
(con coma y sin coma); normalización del término contra los mismos casos que
`norm_texto`; filtro inicial según el rol; mapa de estados completo para los seis
valores; y que la tabla pinte el aviso de "solo consulta" cuando la fila es de
otro almacén.

**Guion manual** — la parte que lo automático no alcanza: entrar como `n3@` y
confirmar que ve los cuatro almacenes y arranca en el suyo; como `lectura@` y
como `admin@`; buscar `"acido"` y que encuentre `"Ácido clorhídrico"`; apagar el
stack con `supabase stop` y ver un mensaje entendible en vez de una pantalla en
blanco; recorrer los filtros con Tab; y revisar la tabla a 1024 px, que es la
resolución de las máquinas del almacén, en modo claro y oscuro.

---

## 9 · Qué NO hace esta versión

- **No da de alta ni edita.** Ni el diálogo de nuevo producto ni el formulario
  dinámico de `formulario()`. Pantalla aparte.
- **No registra movimientos.** Consumo, entrada y ajuste de conteo van después.
- **No genera QR ni imprime etiquetas.** Muestra el código; el QR es del módulo
  de etiquetas, con su formato de impresión.
- **No muestra "en uso".** El prototipo marca las existencias tomadas por una
  práctica. Eso sale de `practica_elemento` y llega con el módulo de prácticas.
- **No exporta.** El formato NOM lo regenera el módulo de Reportes.

---

## 10 · Lo que queda anotado y no se resuelve aquí

**Los pesos y la cantidad pueden desincronizarse.** N3 y LUM derivan la cantidad
de `peso_total - peso_frasco_vacio`, pero nada en la base lo impone: hoy lo
calcula el ETL. Con los privilegios de la §4, un responsable podrá editar los dos
pesos y no la cantidad, así que repesar un frasco no moverá el saldo. Es el
comportamiento correcto para esta entrega —el saldo solo se mueve por
`movimiento`— pero deja abierta la pregunta de cómo se captura un repesaje.
Corresponde al diseño de la pantalla de movimientos: probablemente un
`ajuste_conteo` que tome los pesos como entrada.

**Las 164 filas de la base local no traen `cantidad_minima`.** El filtro de
estado va a devolver solo `disponible` y `agotado` hasta que alguien capture
mínimos. No es un defecto de la pantalla, pero conviene saberlo antes de
enseñarla.
