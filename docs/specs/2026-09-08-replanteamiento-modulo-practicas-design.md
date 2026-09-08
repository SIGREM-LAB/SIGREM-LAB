# Diseño · Replanteamiento del módulo de Prácticas

**8 de septiembre de 2026**

Antecedente directo: `2026-09-03-modulo-practicas-design.md`, que diseñó la
captura. Este documento **no lo contradice en nada de esquema**: lo extiende con
la pantalla que aquella §10 dejó anotada como "Historial de prácticas", y
reordena la navegación del módulo alrededor de ella.

En particular **conserva la D3 de aquel spec** —el borrador vive en su propia
tabla, en `jsonb`, y una fila en `practica` es un hecho ocurrido—. Lo que hace
este diseño es descubrir que esa decisión ya contenía los estados que hacían
falta; solo que no eran visibles desde ninguna pantalla.

---

## 1 · Qué se decide aquí

Que `/practicas` deje de abrir directo en un formulario y abra en una tabla de
lo registrado, con un botón para capturar una nueva.

Y qué significan los estados de una práctica: **En curso** y **Finalizada**.

Cubre: las dos rutas, la tabla, el renglón del borrador, el detalle de solo
lectura, y la desaparición del diálogo "¿restauras tu borrador?".

Lo que **no** cubre: corregir o cancelar una práctica ya registrada, y buscar
por texto en el historial. La §9 los deja anotados.

---

## 2 · El punto de partida

El módulo de Prácticas funciona, pero su pantalla tiene una sola cara: entras y
estás capturando. No hay dónde ver lo que ya registraste, y el hecho de tener
una captura a medias solo se descubre porque al entrar aparece un diálogo
preguntando si la restauras.

| Lo que falta | Hoy |
|---|---|
| Ver lo ya registrado | no existe pantalla; `practica_lectura` ya lo permite |
| Saber que tengo algo a medias | un diálogo al entrar, y solo entonces |
| Empezar una práctica nueva teniendo un borrador | pisa el borrador en silencio al guardar |
| Ver el detalle de una práctica con su folio | no existe |

Lo que **no** falta, y es el hallazgo que ordena todo este diseño: **una columna
de estado en `practica`**. Ver la §3, D1.

---

## 3 · Decisiones

### D1 · El estado sale de la tabla donde vive el renglón, no de una columna

La opción natural —`practica.estado` en `'en_curso'` / `'finalizada'`— es la
misma que la D3 del 3 de septiembre ya rechazó, y por las mismas razones:
`practica_elemento_campos_por_metodo` exige los campos completos según el
método, y el trigger `AFTER INSERT` descuenta el inventario en el acto. Una
práctica "en curso" con productos a medias no es una fila válida de esa tabla.

No hace falta. Los dos estados **ya existen** en el esquema, repartidos en dos
tablas:

| Estado | De dónde sale | Cuántos |
|---|---|---|
| **En curso** | `practica_borrador` | 0 o 1, y solo el propio |
| **Finalizada** | `practica` | todas las del almacén |

La pantalla los une en una tabla. La base no se entera, y la invariante
—**una fila en `practica` es un hecho ocurrido**— sigue en pie.

Vale la pena decirlo al revés, porque es lo que hace barato a este diseño: el
módulo no carecía de estados. Carecía de una pantalla donde el estado que ya
tenía fuera visible.

**Lo que esto cierra la puerta a, a propósito:** una práctica que existe en la
base desde que arranca la sesión de laboratorio, con el material ya entregado y
pendiente de que regrese. Eso es un modelo de dos fases, sí rompe la invariante,
y es un spec distinto. Ver §9.

### D2 · El listado es la puerta del módulo; el formulario, una ruta aparte

```
/practicas         el listado
/practicas/nueva   el formulario
```

Y no un diálogo a pantalla completa ni un intercambio de contenido en la misma
URL. El formulario es largo —la cascada, la tabla de productos y el panel de
captura— y tiene una propiedad que ninguna otra pantalla del módulo tiene: se
puede abandonar a medias y volver. Una ruta propia es lo que hace que recargar
no te saque, que el botón Atrás del navegador signifique algo, y que "continuar
mi borrador" sea un lugar al que se navega.

La app ya usa una ruta de segundo nivel así en `/inventario/depuracion`, así que
no es un patrón nuevo.

### D3 · El botón nombra lo que hay, y el diálogo de restaurar desaparece

Hoy el formulario pregunta al entrar si restauras el borrador. Ese diálogo
existe **porque no había dónde ver que tenías uno**. Con el listado sobra, y
además tapaba un hueco: decir "no restaurar", capturar otra cosa y pisar en
silencio lo anterior al guardar, porque el borrador es uno por persona.

| Hay borrador | El botón dice | Va a |
|---|---|---|
| no | Registrar práctica | `/practicas/nueva`, limpia |
| sí | Continuar práctica | `/practicas/nueva`, restaurada sin preguntar |

Para empezar una distinta hay que descartar la que está en curso,
explícitamente, desde su propio renglón y con confirmación. Un solo borrador por
persona deja de ser una restricción escondida en la llave primaria y pasa a ser
algo que la pantalla dice.

### D4 · El historial no necesita vista nueva

Lo que obligó a crear `existencia_listado` fue buscar sobre tres campos y
ordenar por cualquier columna, incluidas las embebidas: contra los recursos
embebidos de PostgREST eso se vuelve frágil.

Aquí no aplica. El historial filtra por `almacen_id` y ordena por `fecha`, las
dos columnas propias de `practica`. Los nombres de asignatura y laboratorio solo
se muestran. Así que los recursos embebidos bastan:

```ts
supabase
  .from('practica')
  .select(
    'id, folio, fecha, creado_en,' +
      'asignatura:asignatura_id (nombre),' +
      'laboratorio:laboratorio_id (nombre),' +
      'practica_elemento (count)',
    { count: 'exact' },
  )
  .order('fecha', { ascending: false })
  .range(desde, hasta)
```

Más `.eq('almacen_id', …)` cuando quien mira no es admin, por lo mismo que en
`useLaboratorios` y en la búsqueda de productos: el almacén del perfil es el
único sobre el que la persona opera.

Una vista se justificará el día que se quiera buscar por nombre de asignatura.
Hoy no, y crearla "por si acaso" es una migración que mantener a cambio de nada.

### D5 · El borrador guarda los nombres · `VERSION_BORRADOR` → 2

`ContenidoBorrador.cabecera` es un `Partial<Cabecera>`, y `Cabecera` guarda
**ids**: `programaId`, `asignaturaId`, `practicaCatalogoId`, `laboratorioId`.
El renglón "En curso" tendría entonces tres de sus columnas en "—", o pagaría
tres consultas de resolución para pintar un solo renglón.

Se agregan los nombres al borrador, que es exactamente lo que `ElementoCaptura`
ya hace con el producto —guarda junto lo que se muestra y lo que se captura,
"así restaurarlo no necesita volver a consultar el inventario"—. La misma razón
vale para la cabecera.

Subir la versión descarta los borradores guardados con la anterior. **Hoy eso
cuesta cero:** la migración `20260903120000_practicas.sql` no está aplicada en
el proyecto remoto, así que `practica_borrador` ni siquiera existe ahí y no hay
un solo borrador que perder. Es la ventana para hacerlo gratis, y se cierra en
cuanto alguien guarde el primero.

---

## 4 · Esquema

**Ninguno.** Ni tabla, ni columna, ni vista, ni función.

Eso es el resultado de la D1, no un descuido. Si al implementar aparece la
tentación de una columna `estado`, es señal de que se coló el modelo de dos
fases que la §9 deja fuera — hay que parar y volver aquí, no agregarla.

---

## 5 · RLS

**Ninguna política nueva.**

`practica_lectura` ya es abierta a todo `authenticated`, tal como la §10 del
spec del 3 de septiembre anotó: *"es solo pantalla"*. `practica_borrador_propio`
ya limita cada borrador a su dueño, así que el renglón "En curso" solo puede ser
el propio aunque la consulta no filtre.

El filtro por almacén de la tabla es **decisión de pantalla, no de permisos**.
Conviene tenerlo claro: quien quiera ver las prácticas de otro almacén puede
hacerlo contra la API, y está bien que pueda. Lo que la pantalla decide es qué
es útil por omisión, no qué es secreto.

---

## 6 · La pantalla

### Rutas

```
/practicas         PaginaPracticas.tsx       el listado
/practicas/nueva   PaginaNuevaPractica.tsx   el formulario
```

Las dos dentro de `RutaProtegida` y del `Layout`, sin guardia de rol, igual que
hoy. `navegacion.ts` no se toca: la entrada del menú sigue apuntando a
`/practicas`, que ahora es el listado.

### Estructura

```
src/features/practicas/
  PaginaPracticas.tsx      NUEVO   el listado y su estado
  TablaPracticas.tsx       NUEVO   la tabla, incluido el renglón en curso
  PanelPractica.tsx        NUEVO   el Drawer de detalle, de solo lectura
  PaginaNuevaPractica.tsx  RENOMBRADO desde PaginaPracticas.tsx
  consultas.ts             + useHistorialPracticas, + useDetallePractica
  borrador.ts              + los nombres en la cabecera, VERSION_BORRADOR = 2
  …el resto sin cambios
```

Ojo con el cruce de nombres, porque en git se ve raro: el contenido de hoy de
`PaginaPracticas.tsx` pasa a llamarse `PaginaNuevaPractica.tsx`, y el nombre
`PaginaPracticas.tsx` queda para el listado, que es contenido nuevo. Es a
propósito: el nombre del archivo sigue a la ruta, y `/practicas` ahora es el
listado.

El formulario no cambia por dentro. Se mueve, pierde el diálogo de restaurar
(D3) y gana el retorno al listado al finalizar.

### La tabla

`Folio · Fecha · Asignatura · Laboratorio · Productos · Estado`

El renglón "En curso" va **siempre primero**, no intercalado por fecha: es lo
único accionable de la pantalla y lo único que puede perderse. Lleva chip
distinto y su folio es "—", porque todavía no tiene: `PRA-0001` lo asigna el
trigger al finalizar, y fingir uno antes sería inventar un dato.

Las finalizadas van por fecha descendente, paginadas con el mismo `range()` que
usa Inventario y con su mismo tamaño de página, 25. El renglón en curso no entra
en la cuenta: va fuera de la paginación, porque no es una de las filas que la
consulta trajo.

### El detalle

Un `Drawer` a la derecha, el patrón que `PanelExistencia` ya estableció. Solo
lectura: folio, la cabecera académica, el laboratorio, quién registró, y los
productos con lo que cada uno consumió, prestó o rompió según su método.

Corregir desde ahí **no** se ofrece. Sigue siendo cosa del admin y sin pantalla,
como la §10 del 3 de septiembre dejó dicho.

### El renglón en curso

Se arma con `restaurarBorrador()`, la misma función que ya valida la versión. Un
borrador que no se entiende no pinta un renglón roto: no pinta renglón, y el
aviso de "es de una versión anterior" sale al continuar, que es donde hoy sale.

Dos acciones: **Continuar** —navega a `/practicas/nueva`— y **Descartar**, con
confirmación, que es `useBorrarBorrador` tal cual existe.

---

## 7 · Pruebas

vitest, sin SQL nuevo — no hay esquema que probar:

1. El renglón en curso aparece primero, antes que la finalizada más reciente.
2. Sin borrador, el botón dice "Registrar práctica"; con borrador, "Continuar".
3. Descartar pide confirmación y solo entonces llama a la mutación.
4. Un borrador de versión 1 no pinta renglón.
5. El renglón en curso muestra la asignatura por nombre, desde el propio jsonb.
6. La tabla filtra al almacén del perfil; el admin no lleva filtro.
7. El Drawer arma el detalle con el folio y los productos.
8. `serializar` → `restaurar` sigue siendo identidad con la cabecera v2.

Las pruebas de RLS y de esquema no cambian de `plan(n)`: no se agregó nada que
proteger.

---

## 8 · Riesgos

**El `count` embebido de PostgREST no está verificado.** La columna *Productos*
usa `practica_elemento (count)`. No se pudo probar: anon no tiene lectura sobre
esas tablas y el CLI no está enlazado al proyecto. Si no responde como se
espera, el respaldo es traer los elementos y contarlos en el cliente — más
tráfico, misma pantalla. Es la primera cosa a comprobar al implementar.

**La pantalla no tendrá datos hasta el `db push`.** `20260903120000_practicas.sql`
sigue sin aplicarse en el remoto. Mientras eso no pase no hay `practica_borrador`
ni `metodo_control`, así que ni el renglón en curso ni el formulario funcionan.
No es un riesgo de este diseño, pero sí lo que hará que parezca roto si se
prueba antes de empujar.

**Subir `VERSION_BORRADOR` deja de ser gratis en cuanto alguien guarde.** Hoy no
hay borradores porque la tabla no existe en el remoto. Si el push ocurre y
alguien captura antes de que esto se implemente, ese borrador se pierde con
aviso. El orden barato es: implementar esto, luego empujar.

---

## 9 · Lo que queda fuera

- **La práctica de dos fases.** Registrar al inicio lo que sale y cerrar después
  con lo que regresó. Es el otro significado posible de "en curso", sí exige
  columna de estado, check condicionado, triggers por fase y política de UPDATE,
  y rompe la invariante que la D1 conserva. Si se quiere, es un spec propio.
- **Corregir o cancelar una práctica registrada.** Sigue donde la dejó el 3 de
  septiembre: cosa del admin, sin pantalla. "Cancelada" sería columna nueva.
- **Buscar por texto en el historial.** Filtrar por asignatura o por folio
  pediría la vista que la D4 decidió no crear todavía.
- **Exportar el historial.** Es del módulo de Reportes, que lee
  `practica_elemento` y todavía no existe.
