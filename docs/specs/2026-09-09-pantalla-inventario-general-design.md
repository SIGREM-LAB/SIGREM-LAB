# Diseño · Inventario general, y el reparto con Inventario

**9 de septiembre de 2026**

Antecedente directo: `2026-08-21-pantalla-inventario-consulta-design.md`, que
diseñó la pantalla de inventario y creó la vista `existencia_listado`. Este
documento **no lo contradice en esquema ni en RLS**: no toca la base. Lo que
hace es partir en dos aquella pantalla, que hoy sirve dos propósitos con un
filtro.

En particular **conserva su §3**, donde se razona que la lectura de las cuatro
bodegas está abierta a propósito para habilitar el préstamo entre almacenes.
Este diseño descubre que aquella decisión ya pedía una pantalla que no existía:
la que enseña las cuatro a la vez, para todos.

---

## 1 · Qué se decide aquí

Que `/inventario` deje de ser «las cuatro bodegas filtrables» y pase a ser **tu
bodega**, y que `/inventario-general` —hoy un cascarón con un `Alert` que dice
«se implementará en un hito posterior»— sea **la Unidad entera**, con la columna
de almacén y su filtro.

Cubre: el reparto entre las dos pantallas, quién entra a cada una, el componente
que comparten, la navegación desde el menú principal, y la tira de almacenes de
la pantalla general.

Lo que **no** cubre: dar de alta y editar existencias, que hoy siguen siendo
botones `AccionPendiente` en las dos pantallas. La §10 anota la pregunta que
este reparto le deja abierta a ese hito.

---

## 2 · El punto de partida

`PaginaInventario` hace hoy las dos cosas a la vez. Trae un filtro de almacén
con la opción «Todos los almacenes», una columna que dice de cuál es cada
renglón, y unos filtros iniciales que dependen del rol: un responsable arranca
en su bodega, un admin arranca viendo las cuatro.

Funciona. El problema no es que falle, es que la pantalla no puede decir qué es.
Su propia descripción —«Ves los cuatro almacenes; solo puedes editar el tuyo»—
describe un permiso, no un propósito, porque no hay un propósito único que
describir.

Y ese doble papel tiene un costo concreto, en `PaginaInventario.tsx:30-50`:

```ts
const [ajustado, setAjustado] = useState(false)
// ...
if (!ajustado && perfil !== undefined) {
  setAjustado(true)
  const base = filtrosIniciales({ rol: perfil.rol, almacenId: ... })
  setFiltros(almacenPedido === null ? base : { ...base, almacenId: almacenPedido })
}
```

Un `setState` durante el render, con una bandera para que ocurra una sola vez,
porque el perfil aterriza después de la primera pintura y los filtros iniciales
dependen del rol. Está bien resuelto y bien comentado. Existe únicamente porque
la pantalla tiene que decidir en tiempo de render cuál de sus dos papeles está
jugando.

Lo que ya está y se aprovecha entero:

| Pieza | Dónde | Qué aporta |
|---|---|---|
| `existencia_listado` | migración `20260821120000` | Ya expone `almacen_id` y `almacen_clave`. **No hace falta migración.** |
| `almacen_resumen` | migración `20260824120000` | Totales y desglose por bodega, agregados en la base. |
| `useExistencias` | `consultas.ts:18` | Filtra por almacén, busca, ordena y pagina. |
| `TablaExistencias` | `TablaExistencias.tsx` | Ancho fijo, alto de fila clavado, marca de renglón ajeno. |
| `almacenDesdeNavegacion` | `menu.ts:115` | Lee y valida el almacén que manda el menú en el `state`. |
| Las cuatro políticas de lectura | `rls.sql` | `using (true)` para `authenticated`. Nada que agregar. |

---

## 3 · Decisiones

### D1 · Inventario es tu bodega; Inventario general, la Unidad

`/inventario` queda anclado al almacén del perfil. **Se va la columna de almacén
y se va también su filtro**, incluida la opción «Todos los almacenes».

`/inventario-general` muestra las cuatro con la columna que las distingue, el
selector para reducirse a una, y la misma búsqueda, orden y paginación.

El criterio: una pantalla, una pregunta. Inventario responde «qué tengo»;
General responde «dónde está». Quitarle la columna a la primera no es
simplificar la tabla, es que la columna deja de significar nada cuando todos los
renglones dicen lo mismo.

### D2 · Inventario general lo ven los tres roles

Sale de `SoloAdmin` y baja del grupo `administracion` al grupo `operacion`.

Tres razones, en orden de peso:

1. **La RLS ya lo concede.** `existencia_lectura` es `using (true)` y el
   comentario que la acompaña dice por qué con todas sus letras: «la lectura
   abierta es lo que habilita el préstamo entre almacenes: N4 puede consultar el
   stock de N3 antes de ir a pedirlo». Esta es la pantalla de ese caso de uso.
2. **Esconderla no protege nada.** La `anon key` viaja dentro del binario y es
   pública por diseño; lo único que protege los datos son las políticas. Una
   guardia de ruta es comodidad, y aquí no hay ninguna incomodidad que evitar:
   la pantalla no tiene un solo botón que le vaya a fallar a un responsable.
3. **Sin ella, un usuario de `consulta` se queda sin inventario.** No tiene
   almacén propio, así que por D3 tampoco tiene `/inventario`.

### D3 · Quien no tiene almacén propio no tiene Inventario

Admin y consulta no ven `/inventario` en el menú, y si llegan a la ruta se les
redirige a `/inventario-general`.

No es una restricción, es la consecuencia de D1. Inventario es *tu bodega*, y su
ámbito no es una bodega: es la Unidad. Inventario general **es** su inventario.

La alternativa era darles un selector o una pantalla de elección. Las dos
significan construir una tercera cosa para gente que ya tiene la pantalla que
necesita.

### D4 · Un cuerpo compartido, dos encabezados

`ListadoExistencias` se queda con todo lo que es «una tabla de existencias que
se filtra». Las dos páginas quedan reducidas a su encabezado, sus acciones y ese
componente.

Se descartó duplicar el ensamblaje en las dos páginas. No por las líneas, sino
por cuáles: la barra de progreso va *encima* de la tabla y no en su hueco para
que nada brinque al paginar; la página anterior se queda pintada al 0.6 de
opacidad mientras llega la nueva; el conteo lleva `role="status"` para que un
lector de pantalla anuncie cuántos resultados quedaron; el alto de fila está
clavado en 56 px y los anchos en un `colgroup` sobre `table-layout: fixed`. Todo
eso está razonado y comentado en el código actual. Duplicarlo es duplicar la
deuda, y la segunda copia es la que se olvida de recibir el arreglo.

También se descartó que una sola página sirviera las dos rutas decidiendo por
`useLocation` y por rol: es renderizado condicional haciendo de router, que
CLAUDE.md nombra explícitamente como lo que no se hace.

### D5 · El resumen de estados se ciñe al almacén

`useResumenEstados()` cuenta hoy los cuatro almacenes sin filtro alguno
(`consultas.ts:79`). En cuanto Inventario quede anclado a una bodega, esa
cabecera diría «1278 existencias» encima de una tabla de 300.

Pasa a recibir el almacén, y la `queryKey` lo lleva. La forma ya está resuelta
dos funciones más abajo, en `useResumenPendientes` (`consultas.ts:248-257`).

La firma es `useResumenEstados(almacenId: number)`, con el almacén obligatorio y
sin la opción `'todos'` que sí tiene `useResumenPendientes`. Por D6 su único
consumidor es Inventario, que siempre tiene bodega; admitir `'todos'` sería
escribir hoy una rama que nadie recorre. Si General llegara a querer la franja,
ese es el momento de agregarla.

Es un bug que introduciría este hito, no uno que ya exista: hoy la cabecera y la
tabla concuerdan porque las dos pueden ser globales.

### D6 · La tira de almacenes es un control de filtro, no una franja de cifras

Inventario general lleva los cuatro almacenes con sus totales, y al pulsar uno
la tabla se filtra por él.

La tentación era ponerla en la franja bajo el título, que es donde Inventario
pone `ResumenEstados`. **No va ahí.** Esa franja es un `<dl>` de números que no
se tocan y que a propósito no se mueven con los filtros; la tira sí se toca y sí
cambia lo filtrado. Va en el cuerpo, pegada arriba de la tarjeta de filtros, que
es lo que es: otro filtro.

De ahí se sigue que **Inventario general no lleva franja de estados**. No es un
olvido: el desglose por estado de la Unidad entera ya lo pinta el menú principal
en la portada de admin y consulta (`TarjetaAlmacen`, con su barra de tramos), y
repetirlo aquí es un número más que mantener sincronizado y ninguna pregunta
nueva contestada.

---

## 4 · Esquema y RLS

**Ninguno de los dos cambia.** Ni una migración, ni una política, ni una prueba
en `supabase/tests/database/`.

Se deja dicho porque es lo primero que se revisa en este proyecto y la respuesta
no es obvia: una pantalla que enseña las cuatro bodegas suena a que necesita
permisos nuevos. No los necesita. `existencia_lectura`, `almacen_lectura`,
`articulo_lectura` y `ubicacion_lectura` son `using (true)` para `authenticated`
desde el baseline del 18 de agosto, y `existencia_listado` ya hereda esa RLS con
`security_invoker = on`.

Lo que cambia es de quién se esconde una ruta en el cliente, y eso nunca fue
seguridad.

---

## 5 · Las pantallas

### 5.1 · Rutas y guardias

```
/inventario             ConAlmacenPropio   PaginaInventario
/inventario/depuracion  —                  PaginaDepuracion         (sin cambios)
/inventario-general     —                  PaginaInventarioGeneral
/usuarios               SoloAdmin          PaginaUsuarios           (sin cambios)
```

`ConAlmacenPropio` es nueva y va en `RutaProtegida.tsx`, con el molde de
`SoloAdmin` —incluidos los dos estados que casi nunca se piensan y que ahí ya
están resueltos:

```
isPending    → Aviso «Comprobando tu almacén…»
isError      → Aviso «No se pudo comprobar tu perfil…»
sin almacen  → <Navigate to="/inventario-general" replace />
con almacen  → <Outlet />
```

`/inventario/depuracion` es ruta hermana, no anidada, así que la guardia no la
alcanza. Y no debe: la cola de carga es de las cuatro bodegas y la revisa quien
pueda.

Pero su migaja de pan apunta fija a `/inventario` (`PaginaDepuracion.tsx:104`),
que para un admin ahora es un enlace que rebota. Se calcula del perfil: con
almacén, `/inventario`; sin él, `/inventario-general`.

### 5.2 · El contrato de `ListadoExistencias`

```ts
type Props = {
  /** Fija el almacén y esconde lo que sobra cuando hay uno solo. `null` = los cuatro. */
  almacenFijo: number | null
  /** El almacén de quien mira, para marcar lo ajeno. `null` en admin y consulta. */
  almacenPropio: number | null
}
```

Dos props que se parecen y significan cosas distintas, así que queda dicho: en
Inventario valen lo mismo —tu bodega, anclada—; en General `almacenFijo` es
`null` y `almacenPropio` sigue siendo el tuyo, que es lo que hace que la tabla te
marque con el ojito los renglones que puedes ver y no tocar. Esa distinción ya
existe y ya está probada (`TablaExistencias.test.tsx:94-103`); aquí solo se
aprovecha.

**`almacenFijo` es la única rama.** Entra por la frontera del componente, decide
tres cosas, y no vuelve a aparecer más adentro:

1. si `Filtros.almacenId` queda clavado o es del usuario,
2. si se dibujan la columna de almacén y su selector,
3. si se dibuja la tira de almacenes.

#### El corte

| Vive en `ListadoExistencias` | Vive en la página |
|---|---|
| `filtros`, `pagina`, `porPagina`, fila abierta | El encabezado y sus acciones |
| `useExistencias`, `useAlmacenes` | `useResumenEstados` |
| `useMovimientos`, `useDetalleExistencia` | `useResumenPendientes` |
| La tira, los filtros, los chips, el conteo, la tabla | |
| `PanelExistencia` y el aplanado de `datosTipo` | |

El corte no es arbitrario. Las dos consultas que se quedan en la página son las
que **no deben** moverse con los filtros: las cifras de cabecera están razonadas
así en `consultas.ts:66-78`, para que sirvan de referencia estable, y el botón
«Depurar N» cuenta pendientes del almacén, no de lo filtrado. Si vivieran dentro
del listado tendrían que salir a empujones cada vez que alguien tocara un
filtro. Viven donde vive el dato del que dependen.

### 5.3 · Inventario general

```
EncabezadoPagina
  título       Inventario general
  descripción  Las existencias de los cuatro almacenes de la Unidad
  acciones     Exportar (AccionPendiente)
  franja       — ninguna, por D6

CuerpoPagina
  TiraAlmacenes        los cuatro, clicables
  Card
    FiltrosInventario  con el selector de almacén
    FiltrosActivos     con el chip de almacén
    conteo
    TablaExistencias   con la columna de almacén
  PanelExistencia
```

`TiraAlmacenes` sale de `useResumenAlmacenes`, que ya existe y ya devuelve lo que
hace falta. Cada tarjeta lleva la clave con su color de `aspectoDeAlmacen`, el
total, y cuántas piden atención según `necesitanAtencion` —que suma stock bajo,
agotado y mantenimiento, y a propósito no cuenta lo contaminado, porque es un
estado estable y no una tarea (`menu.ts:36-49`)—.

Pulsar una tarjeta pone `filtros.almacenId`; pulsar la que ya está activa la
quita y vuelve a «todas». La activa se marca. Es un grupo de botones de
alternancia, así que va con `aria-pressed`, no como enlaces.

La tarjeta del almacén propio lleva la palabra «Tuyo» bajo la clave, cuando lo
hay: para un responsable que entra a buscar en otra bodega, saber cuál es la suya
es la mitad de la lectura. Se dice con texto y no solo con un borde de color,
por lo mismo que `PuntoEstado` no fía el estado al color.

Que la tira viva dentro de `ListadoExistencias` y no en la página no es una
concesión: es que el estado de filtros vive ahí (§5.2), y un control que filtra
tiene que estar donde está lo que filtra. Ponerla en la cabecera obligaría a
subir `filtros` a las dos páginas para que una sola la usara.

### 5.4 · Inventario

```
EncabezadoPagina
  título       Inventario
  descripción  la clave y el nombre de tu almacén
  acciones     Depurar N · Exportar · Nueva existencia
  franja       ResumenEstados, ya ceñido al almacén (D5)

CuerpoPagina
  Card
    FiltrosInventario  sin el selector de almacén
    FiltrosActivos     sin el chip de almacén
    conteo
    TablaExistencias   sin la columna de almacén
  PanelExistencia
```

La descripción actual, «Ves los cuatro almacenes; solo puedes editar el tuyo»,
pasa a nombrar la bodega. Hoy promete literalmente lo contrario de lo que la
pantalla hará.

### 5.5 · Las piezas que se vuelven condicionales

**`TablaExistencias`.** `COLUMNAS` es hoy constante de módulo y la usan cuatro
sitios: el `colgroup`, la cabecera, el esqueleto de carga y el `colSpan` del
renglón vacío. Pasa a calcularse de la prop. El `colSpan` sale del largo del
arreglo, así que cuadra solo; queda como prueba porque es justo lo que se rompe
en silencio.

`ANCHO_MINIMO` baja de 884 a 780: son los 104 px de la columna que se va. Sin
ajustarlo, la tabla de Inventario reservaría un hueco que nadie ocupa.

**`FiltrosInventario` y `FiltrosActivos`.** El selector y el chip de almacén se
dibujan solo cuando no hay almacén fijo. En Inventario, `filtros.almacenId`
nunca difiere del inicial, así que `hayFiltrosActivos` no lo cuenta y el botón
«Limpiar» no aparece por su culpa. Sale gratis, sin tocar esa función.

**`filtrosIniciales`.** Pierde su parámetro. El anclaje al almacén dejó de ser
cosa de los filtros y pasó a ser cosa de la pantalla, así que la función vuelve a
ser lo que su nombre dice: los valores de arranque.

---

## 6 · Navegación

### El menú

`menuDeNavegacion(rol)` pasa a recibir también si hay almacén propio.

| Entrada | Grupo | Quién la ve |
|---|---|---|
| Menú principal | operación | todos |
| Inventario | operación | solo con almacén propio |
| Inventario general | operación | todos |
| Prácticas | operación | todos |
| Programa educativo | administración | admin |
| Administración de usuarios | administración | admin |
| Reportes | administración | todos, apagada |

Inventario general va inmediatamente después de Inventario: son hermanas y se
leen juntas. Su icono actual es `mdi:shield-check-outline`, un escudo, que era el
vocabulario de las pantallas administrativas; pasa a `mdi:warehouse`. Su color,
de `grey.600` a `institucional.main`.

### A dónde llevan las tarjetas del menú principal

Una regla, no cuatro casos:

> **La lista de almacenes siempre lleva a `/inventario-general` con ese almacén
> en el `state`. Solo la portada de un responsable lleva a `/inventario`.**

Un responsable pulsa N4 en «Otros almacenes» y aterriza en General filtrado por
N4, que es exactamente el préstamo entre almacenes de la §3 del spec del 21 de
agosto. Un admin pulsa cualquiera de los cuatro y aterriza igual.

`almacenDesdeNavegacion` no cambia ni una línea. Solo cambia quién la llama: se
muda de `PaginaInventario` a `PaginaInventarioGeneral`, y ahí sigue siendo lo que
ya era —una semilla que se lee una vez y no se queda pegada en la URL, para que
un `?almacen=2` no siga diciendo 2 después de que la persona filtre otra cosa—.

---

## 7 · Lo que se borra

Vale la pena listarlo, porque es el argumento de que este reparto simplifica en
vez de agregar:

- El `useState(ajustado)` y el `setState` durante el render de
  `PaginaInventario.tsx:30-50`. Con la guardia, la pantalla no se monta hasta que
  hay perfil con almacén, así que sus filtros nacen correctos y nunca hay que
  reajustarlos.
- El parámetro de `filtrosIniciales` y su rama por rol.
- El cálculo de `iniciales` para el botón «Limpiar» (`PaginaInventario.tsx:96-98`),
  que existía para volver a un punto de partida que dependía del rol.
- La opción «Todos los almacenes» del selector de Inventario, y con ella la
  pregunta de qué significa la columna cuando dice cuatro cosas distintas.

---

## 8 · Pruebas

`supabase test db` no cambia: no hay migración. Del lado de React, con vitest y
testing-library, como el resto del módulo:

| Archivo | Qué se prueba |
|---|---|
| `ListadoExistencias.test.tsx` · nuevo | Con `almacenFijo`: no hay columna, ni selector, ni tira, y el almacén llega a la consulta. Con `null`: los tres aparecen. |
| `TiraAlmacenes.test.tsx` · nuevo | Pulsar filtra; volver a pulsar la activa limpia; la activa lleva `aria-pressed`. |
| `TablaExistencias.test.tsx` | La columna es condicional, y el `colSpan` del renglón vacío cuadra con las columnas que quedan. |
| `FiltrosInventario.test.tsx` | «Ofrece los cuatro almacenes más la opción de verlos todos» pasa a ser condicional. |
| `navegacion.test.ts` | Inventario solo con almacén propio; Inventario general para los tres roles y en `operacion`. |
| `menu.test.ts` | A dónde apunta cada renglón de la lista y la portada. |
| `filtros.test.ts` | `filtrosIniciales` sin su parámetro. |
| `RutaProtegida.test.tsx` | Sin almacén, `/inventario` redirige a `/inventario-general`; con almacén, no. |

---

## 9 · Riesgos

**Un responsable pierde de vista las otras bodegas si no encuentra la pantalla
nueva.** Hoy le bastaba cambiar un selector. Lo que lo cubre es que Inventario
general queda en el menú de operación, junto a Inventario, y que las tarjetas
del menú principal siguen llevando a cada bodega con un clic —solo que ahora
aterrizan en la pantalla que las muestra todas—.

**El `state` de navegación se pierde al recargar.** Ya pasaba y sigue pasando:
es `history.state`, y una recarga en `/inventario-general` vuelve a «todas». Se
mantiene la decisión original de no ponerlo en la URL, y por la misma razón.

**Dos pantallas que se parecen mucho pueden divergir.** Es el riesgo que D4
ataca de frente: mientras el cuerpo sea un solo componente, no hay dos sitios
donde divergir. Si alguna vez hay que ramificar por dentro de
`ListadoExistencias` y no en su frontera, ese es el aviso de que el reparto se
eligió mal.

---

## 10 · Lo que queda fuera

**El alta y la edición.** Siguen siendo `AccionPendiente` en las dos pantallas y
este hito no las mueve. Pero el reparto le deja una pregunta al hito que las
implemente, y se anota aquí para que no se cuele sin decidirse: el formulario se
arma con `formulario(almacen_id, clasificacion)`, que necesita un almacén de
entrada. En Inventario ese almacén es implícito. **Un admin ya no tiene
Inventario**, así que su alta tendrá que preguntar en qué bodega, o entrar por
otro camino. No se resuelve aquí porque resolverlo hoy sería diseñar a ciegas un
formulario que todavía no existe.

**Exportar.** Sigue pendiente en las dos.

**Agrupar el listado por almacén.** La columna y el filtro cubren lo que se
pidió. Agrupar con encabezados por bodega pelea con la paginación del servidor
—un grupo puede quedar partido entre dos páginas— y necesitaría su propio
diseño.
