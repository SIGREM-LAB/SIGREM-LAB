# Diseño · Módulo de reportes, entrega 1

**21 de septiembre de 2026**

El módulo de Reportes lleva reservado desde el principio: `navegacion.ts:93` lo
tiene como entrada apagada —«Formato NOM y consumos por periodo»—, el spec del
18 de agosto fijó en su §4.6 que **lee `practica_elemento` y no `movimiento`**, y
el exportador de la NOM-005-STPS se difirió a este módulo tres veces, que es por
lo que `uso_principal`, `zona_riesgo` y `personas_expuestas` viven en la tabla
`almacen` en vez de repetidos por renglón.

Este documento cubre **la primera entrega**. No toca prácticas, ni consumo
académico, ni el formato de la NOM: cada uno lleva su propio spec, y la §11
dice cuáles son.

---

## 1 · Qué se decide aquí

Que Reportes deje de ser una entrada apagada y pase a ser **cuatro exportaciones
a Excel que el responsable de un almacén usa para decidir algo**: qué comprar,
qué se está venciendo, qué contar, y cómo entregar el inventario en el formato
de siempre.

Y de paso, que exista el dato que hoy falta para poder decidir lo primero.

---

## 2 · El punto de partida

Se preguntó qué está resolviendo hoy a mano un encargado de almacén. La
respuesta fueron cuatro cosas: **armar la lista de compras**, **regenerar el
formato de la NOM**, **imprimir una lista para el conteo físico** y
**justificar el consumo por asignatura**. El destinatario de todas es **él
mismo**: no salen de la Unidad, así que no necesitan membrete ni portada
institucional — necesitan ser archivos crudos, filtrables y trabajables.

De esos cuatro dolores, **este documento resuelve dos**: la lista de compras y
la hoja de conteo. El formato de la NOM y el consumo por asignatura se difieren,
por las razones de la §11.

Y una restricción que apareció al preguntar: **casi ninguna existencia tiene
`cantidad_minima` capturada.** El reporte de compras, tal como estaba pensado,
saldría vacío el primer día.

---

## 3 · Decisiones

### D1 · El mínimo de reposición es por artículo × almacén, no por frasco

Una `existencia` es un envase: tiene `codigo` único, `peso_frasco_vacio` y
`peso_total`. Un mínimo por envase responde «¿este frasco está por acabarse?»,
que no es la pregunta de compras. La pregunta de compras es «¿cuánta acetona
queda en N3 en total?».

Con el mínimo por frasco, un envase casi vacío junto a siete llenos dispara una
alerta falsa, y ocho envases a la mitad no disparan ninguna — que es justo
cuando hay que comprar.

**Sumar los envases del mismo artículo es válido por construcción**, y eso ya
estaba resuelto. El comentario de `articulo.unidad_base`
(`20260818120200_catalogo.sql:20`) dice:

> *La unidad vive SOLO aqui. Tenerla tambien en existencia invita a que la misma
> sustancia se registre en g en un almacen y en kg en otro, y a partir de ahi
> ningun total agregado es confiable. Si el mismo articulo se mide en dos
> unidades distintas, son dos articulos.*

Ese comentario se escribió para evitar un problema; resulta que además concede
el permiso que este reporte necesitaba. `minimo_articulo` no lleva columna de
unidad: la hereda del artículo.

### D2 · `existencia.cantidad_minima` se queda donde está, huérfana y documentada

El campo por envase alimenta `private.estado_calculado` y de ahí el estado
`stock_bajo`, que pintan la pantalla de inventario, los filtros y
`almacen_resumen`. No se toca.

En la práctica está dormido —casi nadie lo tiene puesto—, así que conviven sin
estorbarse: `stock_bajo` sigue significando «este envase concreto va bajo» y el
reporte de reposición contesta otra cosa. Se documenta aquí para que en seis
meses nadie los confunda ni intente unificarlos sin leer esto.

### D3 · Stock usable no es stock físico

El faltante se calcula contra lo que **se puede usar**, no contra lo que está
en el estante:

```sql
sum(e.cantidad) filter (
  where e.estado not in ('contaminado', 'mantenimiento', 'baja')
    and (e.fecha_caducidad is null or e.fecha_caducidad >= current_date)
)
```

Un reactivo contaminado ocupa lugar y no se usa; uno vencido, tampoco. Sumarlos
diría que hay 2 L de acetona cuando hay 0.5 L usables y 1.5 L de residuo
peligroso esperando destino, y esa compra no se hace hasta que alguien lo
descubre a media práctica.

Por eso el reporte lleva **tres columnas y no una**: `total físico`, `vencido`,
`vigente`. El faltante sale de la tercera, pero las otras dos quedan a la vista
para que el número sea explicable.

### D4 · El reporte de reposición trae dos hojas de datos, y la segunda es la que lo arranca

Como casi no hay mínimos capturados, la hoja de reposición sale vacía el primer
día. Un reporte que sale vacío se abre una vez y no se vuelve a abrir.

Por eso el libro trae dos:

- **«Reposición»** — los artículos bajo mínimo.
- **«Sin mínimo definido»** — los artículos **presentes en el almacén** que no
  tienen mínimo, ordenados por consumo del periodo y, a falta de consumo, por
  número de envases.

La segunda es la lista de trabajo: *empieza por éstos*. El reporte sirve desde
el primer día precisamente por estar vacío del lado que importa, y se llena
conforme el responsable trabaja la otra hoja.

> **Corrección del 21 de septiembre, tras censar la base real.** Esta hoja se
> diseñó saliendo de `movimiento` y ordenada solo por consumo. El censo lo
> desmiente: hay **2,525 movimientos y solo 3 no son `carga_inicial`**. Una hoja
> que arranca en `gasto` habría traído tres renglones, y el mecanismo inventado
> para resolver el arranque en frío habría necesitado, él mismo, una historia
> que todavía no existe.
>
> Por eso sale de `existencia` —lo que de verdad hay en la bodega— con el
> consumo como `left join`. El orden es `consumo desc, envases desc`: mientras
> no haya historia manda el número de envases, que es la mejor señal disponible
> —ocho frascos de algo es algo que se repone; uno, probablemente no— y en
> cuanto el módulo de prácticas genere consumo real, el primer criterio toma el
> mando sin tocar una línea.

Consecuencia que evita una decisión a ojo: **el reporte no necesita que estén
todos los mínimos.** Con treinta artículos definidos ya hay lista de compras. La
captura deja de ser un requisito previo y pasa a ser trabajo incremental con
retroalimentación inmediata.

### D5 · Los mínimos se capturan en una tabla editable, no en una ida y vuelta por Excel

Se consideró exportar una plantilla, llenarla en Excel y volver a subirla. Se
difiere, no se descarta.

El mínimo por artículo recortó el volumen en un orden de magnitud respecto al
mínimo por envase: son **cientos de renglones por almacén, no miles**. Eso cabe
en una pantalla con filtro por clasificación, buscador y una columna editable,
construida con `@mui/material` y `react-hook-form`, que ya están instalados —
sin abrir la caja de leer archivos, validar, previsualizar y resolver
conflictos.

El rechazo del importador en el panel académico (D5 del spec del 1 de
septiembre) fue **por volumen**: programas y asignaturas se capturan «dos veces
al año». Aquí el argumento apunta al revés, así que no es el mismo caso — pero
tampoco hace falta todavía.

Va en `/reportes/minimos`, enlazada desde la tarjeta del reporte de reposición:
el responsable llega ahí desde «quiero saber qué comprar», no desde el
inventario.

### D6 · La forma del reporte se define en SQL; el cliente solo la escribe

Una función por reporte que devuelve las filas **ya ordenadas y con las columnas
que van en la hoja**. En el cliente, un registro declarativo y **una sola**
función `aExcel()`.

Es el patrón que el proyecto ya usa en todas partes: `formulario(almacen,
clasificacion)` decide qué campos pedir desde la base en vez de con
condicionales en React, `valores_existencia()` devuelve el jsonb armado,
`existencia_listado` y `almacen_resumen` resuelven la forma en la vista. Un
módulo de reportes que definiera sus columnas en TypeScript sería la única pieza
del sistema remando al revés.

Agregar un reporte es **una migración y un objeto en el registro**: ningún
componente nuevo, ninguna pantalla nueva.

### D7 · Un archivo truncado en silencio es peor que un error

`max_rows = 1000` en `supabase/config.toml:18`, y aplica también a las RPC. Un
reporte de reactivos de N3 son ~2,600 renglones: volvería con 1,000 **sin
avisar**, en un Excel perfectamente formado con autofiltro y todo, al que le
faltan dos tercios del inventario.

Es el mismo modo de fallo que persiguen la vista sin `security_invoker` que
«funciona igual de bien hasta el día malo» y la resta invertida que costó la
semana del 11 de agosto.

El cliente pagina con `.range()` hasta que una página vuelva con menos de 1,000,
con un tope absoluto. Si se alcanza el tope, **no se genera archivo**: se
muestra el error. Nunca un `.xlsx` a medias.

### D8 · Exportar el inventario es regenerar el formato unificado, no volcar una tabla

El personal ya conoce un formato y hay que devolvérselo igual. La forma real no
es un archivo por hoja: el docstring de `leer_libro` en
`etl/extract/formato.py` lo dice tras haberse tropezado con ello —

> *Es como entregan los almacenes de verdad: copian el formato unificado y
> llenan las hojas que les tocan. `leer()` no puede con eso —exige una sola hoja
> de datos— y por eso el primer archivo real de N3 no se podía ni abrir.*

Así que el exportador produce **un libro por almacén con una hoja por
clasificación**, en el orden fijo de `HOJAS_DE_DATOS`: Reactivos, Insumos,
Material, Equipos, Materia biológica, Electrónica.

### D9 · La definición del formato va en la base, no en un diccionario de TypeScript

Ya está dictaminado. El comentario de `private.clave_renglon`
(`20260910120000_alta_existencia.sql:48`):

> *La traduccion vive aqui, en SQL, y no en el frontend a proposito. Si viviera
> alla habria un diccionario en TypeScript que hay que recordar actualizar cada
> vez que se agrega un campo, y olvidarlo no rompe la compilacion: manda el
> valor con la llave equivocada y el campo se pierde en silencio.*

El exportador le pregunta a la base cómo se ve la hoja de Reactivos y la
escribe. Cambiar el formato es una migración.

### D10 · Dos copias del formato, vigiladas por una prueba de ida y vuelta

La definición existe hoy en `CAMPOS` de `etl/extract/formato.py`. Con D9 habrá
otra en la base. Se aceptan las dos y **no se refactoriza el ETL**: funciona,
está probado contra archivos reales de seis almacenes, y atarlo a tener conexión
para poder leer un archivo sería un retroceso.

Lo que impide que se separen no es la disciplina sino una prueba:

> **exportar → leer el resultado con `etl/extract/formato.py` → los renglones
> que salen son los que entraron.**

Si cualquiera de las dos copias cambia sin la otra, la prueba falla. Y de paso
convierte «igual al que el personal conoce» en algo comprobable en vez de una
afirmación.

Efecto secundario que no cuesta nada: **`etl/cargar.py` puede volver a leer lo
que el exportador produjo.** Eso da la ida y vuelta de D5 —exportar, corregir en
Excel, volver a subir— sin escribir un importador. Por la línea de comandos, no
desde la app; recargar desde la app es otra entrega.

### D11 · El rol `consulta` no genera reportes

Un archivo sale del sistema, se reenvía y sobrevive a la baja del usuario; una
pantalla no. `consulta` seguirá viendo el inventario de los cuatro almacenes en
pantalla —no tiene almacén asignado, y `almacen_actual()` nulo es esa señal— y
no podrá exportarlo. La incoherencia es aparente y deliberada.

Requiere tres cambios y **solo el tercero protege algo**: quitar la entrada del
menú, cerrar la ruta, y que **las funciones se nieguen a correr**. Los dos
primeros son comodidad. Como dice el spec del 14 de septiembre: *«Esconder la
ruta en el cliente no protege nada: la anon key viaja dentro del binario»*.

### D12 · `puede_reportar()` va aparte de `puede_escribir()`

`private.puede_escribir()` ya devuelve el predicado exacto que hace falta —
`rol in ('admin','responsable')`, en `20260818120100_organizacion.sql:110`—, y
reutilizarla ahorra una función.

No se reutiliza. El día que alguien decida que `consulta` sí puede exportar va a
editar ese cuerpo y **le va a abrir la escritura del inventario de paso**, sin
que nada falle ni nadie se entere. Dos reglas distintas que hoy coinciden en el
resultado no son la misma regla.

### D13 · El vencido se reporta, pero sigue diciendo `disponible`

`estado_existencia` no tiene valor para vencido, así que un reactivo caduco
aparece como bueno en la pantalla de inventario. El reporte de caducidades lo
saca; la pantalla no cambia.

Se consideró marcarlo en la pantalla y agregarlo al enum. Lo segundo no puede
ser una columna: un estado que depende de la fecha de hoy habría que
recalcularlo todos los días. Queda como incoherencia conocida, no como
descuido.

---

## 4 · Esquema

### 4.1 · `minimo_articulo`

```sql
create table public.minimo_articulo (
  articulo_id  bigint not null references public.articulo (id) on delete cascade,
  almacen_id   bigint not null references public.almacen (id),
  minimo       numeric(14,4) not null,
  nota         text,
  definido_por uuid references public.perfil (id),
  definido_en  timestamptz not null default now(),

  primary key (articulo_id, almacen_id),
  constraint minimo_articulo_positivo check (minimo > 0)
);
```

Sin columna de unidad: la hereda de `articulo.unidad_base` (D1).

`minimo > 0` y no `>= 0`: un mínimo de cero es un renglón que no dice nada. Lo
que no se repone no lleva renglón.

`on delete cascade` sobre `articulo` pero no sobre `almacen`: un artículo
fusionado con `fusionar_articulo` se lleva sus mínimos; un almacén no se borra.

### 4.2 · `private.puede_reportar()`

Mismo cuerpo que `puede_escribir()`, otro nombre, otra razón (D12).

### 4.3 · La definición del formato unificado

`public.columna_formato`, sembrada con lo que hoy es `CAMPOS`: hoja, campo,
letra de columna, título y orden. La fila de encabezado por hoja (8, salvo
Reactivos en 9) y las celdas del preámbulo (`F4` responsable, `B5` periodo, `F5`
actualizado) van en una tabla hermana, `public.hoja_formato`, porque son
propiedades de la hoja y no de la columna.

Expuestas por `public.formato_hoja(p_hoja text)`, que devuelve la hoja completa
en orden — el mismo contrato que `formulario(almacen, clasificacion)`: la base
dice cómo se arma, el cliente solo lo dibuja.

---

## 5 · Los reportes de la entrega

### 5.1 · Reposición y compras

Dos hojas de datos (D4). La de reposición:

| Columna | Origen |
|---|---|
| Almacén · Clasificación | `almacen`, `articulo` |
| Artículo · Descripción | `articulo` |
| Unidad | `articulo.unidad_base` |
| Total físico | suma de `existencia.cantidad` |
| Vencido | suma filtrada por `fecha_caducidad` |
| **Vigente** | la suma usable de D3 |
| **Mínimo** | `minimo_articulo.minimo` |
| **Faltante** | `greatest(minimo − vigente, 0)` |
| Envases | cuántas existencias lo componen |
| Consumo del periodo | `movimiento` tipo `consumo` + `merma`, últimos N días |
| Última entrada | fecha del último `movimiento` tipo `entrada` |
| Ubicaciones | dónde está hoy |

El consumo del periodo es lo que convierte «falta» en «pide tanto». Sale de
`movimiento`, y `carga_inicial` se excluye — está al frente del enum
precisamente para que la carga de arranque no se cuente como gasto del semestre.

Parámetros: almacén y días del periodo.

### 5.2 · Caducidades

Una sola hoja con columna «Días restantes» ordenada ascendente: los vencidos
arriba en negativo y en rojo, lo que vence en quince días en ámbar justo debajo.

Se prefirió a dos hojas separadas porque **el gradiente es la información**: un
corte en «vencido / no vencido» esconde que algo vence pasado mañana.

Parámetros: almacén y horizonte en días.

> **Hoy este reporte sale vacío, y seguirá vacío hasta que alguien capture
> fechas.** El censo del 21 de septiembre da **0 de 2,526 existencias con
> `fecha_caducidad`**, y no es un descuido de la carga: **el formato unificado
> no tiene columna de caducidad en ninguna de sus seis hojas**, así que el ETL
> nunca tuvo de dónde llenarla. El campo sí existe en el esquema y en
> `campo_capturable` —«Informativa: un reactivo caducado no se bloquea»—, y el
> alta y la edición lo ofrecen: se puede llenar a mano desde hoy.
>
> Se construye igual, porque queda listo para ese día y porque el costo es una
> función. Lo que **no** se hace es descargar un Excel en blanco: la pantalla
> detecta el caso y dice «ninguna existencia tiene fecha de caducidad
> registrada» en vez de entregar un archivo que parece un inventario sano.
> Añadir la captura de la fecha al formato es otro trabajo (§11).

### 5.3 · Hoja de conteo físico

Ordenada por ubicación —mueble, fila/cajón, etiqueta— y luego por artículo, para
que la lista siga el recorrido físico del almacén y no el orden alfabético. Con
columna en blanco para anotar y otra para observaciones.

**La cantidad del sistema es un parámetro.** Con ella el conteo es más rápido:
se verifica y solo se anota donde no cuadra. Sin ella el conteo es ciego, quien
cuenta no puede copiar el número que ya estaba, y la diferencia que salga es
real — que es lo único que hace que un porcentaje de exactitud signifique algo.
La casilla deja la decisión para el momento del conteo y no para hoy.

### 5.4 · Exportar el inventario en formato unificado

Un libro por almacén, una hoja por clasificación, columnas en su letra exacta,
encabezado en su fila, preámbulo rellenado por el sistema (D8, D9).

Es el botón «Exportar» que lleva pendiente desde el spec del 9 de septiembre en
Inventario e Inventario general.

---

## 6 · El registro y `aExcel()`

Un reporte es datos, no código:

```ts
// src/features/reportes/registro.ts
type Columna = {
  clave: string
  titulo: string
  tipo: 'texto' | 'numero' | 'entero' | 'fecha'
  ancho?: number
  /** Devuelve el token de resalte, o null. Alimenta el formato condicional. */
  resaltar?: (fila: Fila) => 'alerta' | 'aviso' | null
}

type Hoja = { nombre: string; rpc: string; columnas: Columna[] }

type Reporte = {
  id: string
  titulo: string
  descripcion: string
  icono: string
  color: string
  parametros: Parametro[]
  hojas: Hoja[]
}
```

`icono` y `color` salen del mismo vocabulario que `ItemMenu`
(`src/app/navegacion.ts:22`), que ya los lleva por la misma razón: la identidad
de una sección repartida entre componentes acaba distinta en cada pantalla.

`aExcel()` es **la única pieza que sabe de exceljs**. Siempre escribe la hoja
«Parámetros» primero —almacén, periodo, filtros aplicados, quién y cuándo—,
porque un archivo en la carpeta de Descargas dentro de tres meses sin saber con
qué filtros salió no vale nada. Después, por hoja: encabezado en negritas, fila
congelada, autofiltro, anchos calculados, **tipos reales** y formato condicional
desde `resaltar`.

Lo de los tipos no es cosmético: los Excel originales traían `'Un frasco'` en
columna numérica, y el formato nuevo no puede reintroducir por la puerta de
salida lo que el ETL limpió en la de entrada.

**Dependencia nueva: `exceljs`.** Se eligió sobre SheetJS porque la versión
comunitaria de este último casi no da estilos —sin formato condicional ni
paneles congelados sin pelear—, y son justamente los que hacen que el archivo se
sienta un Excel y no un CSV renombrado. Pesa más; irrelevante si el destino es
Tauri.

---

## 7 · Permisos y RLS

`minimo_articulo` sigue la forma del resto, incluido el cierre del 14 de
septiembre:

```sql
-- Lectura: el responsable solo el suyo; admin y consulta, la Unidad entera
using ((select private.almacen_actual()) is null
       or almacen_id = (select private.almacen_actual()))

-- Escritura: quien puede escribir, y solo en su almacén
with check ((select private.puede_escribir())
            and ((select private.es_admin())
                 or almacen_id = (select private.almacen_actual())))
```

Cada función de reporte abre con el chequeo de rol:

```sql
if not (select private.puede_reportar()) then
  raise exception 'Solo un responsable o un administrador puede generar reportes';
end if;
```

**Las funciones de reporte van sin `security definer`.** Es la línea que hace
que todo lo anterior no sea decorativo: una función `definer` correría como su
dueño, se saltaría la política de `existencia` y publicaría el inventario de los
cuatro almacenes a cualquiera con la `anon key`. Falla en silencio, igual que la
trampa que documentan `existencia_listado` y `almacen_resumen`.

El chequeo de rol no obliga a cambiar eso: `puede_reportar()` sí es `definer` y
se llama desde dentro. Las dos cosas conviven.

`menuDeNavegacion` deja de incluir Reportes para `consulta` y enciende la
entrada (`disponible: true`) para los otros dos roles. `RutaProtegida` cierra
`/reportes` y `/reportes/minimos`.

---

## 8 · Pruebas

**`supabase/tests/database/rls.test.sql`** — una por regla:

- `consulta` llama `reporte_reposicion` → excepción.
- `responsable` de N3 sin filtro → solo renglones de N3.
- `responsable` de N3 escribe un `minimo_articulo` de N4 → rechazado.
- `admin` ve los cuatro almacenes.

**`supabase/tests/database/esquema.test.sql`**:

- `minimo_articulo` con `minimo = 0` → rechazado.
- Ninguna función de reporte es `security definer` — contra `pg_proc.prosecdef`.
  Mismo seguro que ya cuida a `existencia_listado` y `almacen_resumen`, por la
  misma razón.
- El vigente excluye vencido, contaminado, mantenimiento y baja.

**Vitest**:

- `aExcel()` escribe fechas como fecha y números como número, no como texto.
- La hoja «Parámetros» siempre está y registra los filtros usados.
- La paginación trae las 2,600 filas completas, y al tope **lanza error sin
  producir archivo**. Es la prueba que más importa: todo lo demás, si se rompe,
  se ve.

**Ida y vuelta (D10)**, en `pytest`:

- Un libro exportado con datos sintéticos se lee con
  `etl.extract.formato.leer_libro` y los renglones coinciden con los que se
  exportaron.
- Los datos son sintéticos a propósito: el repositorio es público y ningún
  `.xlsx` de inventario real entra al commit.

---

## 9 · Riesgos

| Riesgo | Mitigación |
|---|---|
| El reporte de reposición nunca arranca porque nadie captura mínimos | La hoja «Sin mínimo definido» ordena el trabajo por consumo real, y treinta renglones ya dan una lista de compras (D4) |
| Las dos definiciones del formato se separan | La prueba de ida y vuelta falla en cuanto ocurre (D10) |
| Un reporte grande sale truncado | Tope explícito y error en vez de archivo (D7) |
| `exceljs` infla el bundle | Carga diferida de la ruta `/reportes`: quien no entra al módulo no paga la librería |
| Alguien unifica `cantidad_minima` con `minimo_articulo` sin leer esto | D2 |

---

## 10 · Verificación

Lo de siempre:

```bash
pnpm typecheck && pnpm lint && pnpm build
supabase test db
```

Con dos salvedades ya conocidas en esta máquina, que afectan al orden de los
pasos del plan y no al diseño: `supabase test db` no corre sin Docker, y
`pnpm gen:types` lee el esquema local mientras la app apunta al remoto — así que
los tipos no ven una migración hasta empujarla.

---

## 11 · Lo que queda fuera

Cada uno con su propio spec:

- **Consumo y académico.** Consumo por artículo y periodo, por práctica, por
  asignatura y por programa; préstamos de equipo; la receta por práctica del
  catálogo. Lee `movimiento` y `practica_elemento`. Vale esperar: el módulo de
  prácticas es de este mes, y el promedio de consumo de una práctica no
  significa nada hasta que se haya repetido varias veces.
- **Formato NOM-005-STPS.** Encabezado de tres niveles en las filas 21–23,
  campos normativos reinyectados por renglón desde `almacen`, y la pregunta
  abierta de reconstruir contra rellenar plantilla. Es el único candidato real a
  Edge Function.
- **El resto de las alertas.** Equipos con fallas o chequeo vencido; reactivos
  sin hoja de seguridad, sin CAS o sin grados NFPA; existencias sin ubicación o
  sin mínimo; artículos sin verificar. Una vez que existe el registro, cada uno
  es una migración y una entrada.
- **Recargar el archivo corregido desde la app.** La ida y vuelta de D10 pasa
  hoy por `etl/cargar.py` en línea de comandos. Un importador con vista previa y
  validación dentro de la app es otro trabajo.
- **Inventario valorizado.** No hay precio, costo ni proveedor en el esquema.
  Cualquier reporte con cifras de dinero es una migración antes que un reporte.
