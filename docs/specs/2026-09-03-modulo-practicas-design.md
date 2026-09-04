# Diseño · El módulo de Prácticas

**3 de septiembre de 2026**

Antecedentes: el esquema vigente es
`2026-08-18-depuracion-esquema-formato-unificado-design.md`, que creó las tablas
de práctica pero no la pantalla, y `2026-09-01-panel-academico-design.md`, que
cargó el plan de estudios del que esta pantalla se alimenta. Este documento
**no modifica ninguna de las dos**: todo lo que agrega es aditivo. Donde se
contradiga con ellas, señálalo: es un error de este documento, no una decisión.

El diseño de referencia son las once capturas de `pantalla_practicas/`, que
quedan fuera del repositorio (§10). Lo que sobrevive de ellas es este spec.

---

## 1 · Qué se decide aquí

La pantalla `/practicas`: la captura de lo que una práctica consumió, prestó y
rompió. El spec del 18 de agosto la llama "el módulo principal del sistema, y
el que consume las existencias. Sin él, la base solo guarda; no descuenta".

Cubre el registro completo: la cascada académica, el laboratorio, agregar
productos, la tabla de productos utilizados, el panel de captura por método,
las observaciones por producto, el borrador recuperable y la finalización.

Lo que **no** cubre: el historial de prácticas ya registradas, el escaneo con
cámara, la lectura de balanza, y los préstamos entre almacenes como
transacción. La §10 los deja anotados.

---

## 2 · El punto de partida

El esquema del 18 de agosto dejó las cuatro tablas de práctica completas, con
sus triggers y sus políticas, y nunca se les escribió una fila desde la app. El
panel académico del 1 de septiembre cargó `programa_asignatura` y
`practica_catalogo`, que es exactamente la cascada que el diseño pide. Así que
la mayor parte de este trabajo es frontend.

Lo que sí falta:

| Lo que el diseño pide | En la base al 3 de septiembre |
|---|---|
| Las 9 casillas, **por producto** | `practica_observacion` cuelga de `practica_id`, no del elemento |
| Casillas distintas según el método | `motivo_observacion` no sabe a qué método aplica cada motivo |
| "Guardar borrador" | no existe, y `practica_elemento` no admite filas a medias |
| Que el método de control sea confiable | lo declara el cliente y nada lo verifica |
| Que registrar una práctica sea atómico | son 1 + N + M escrituras sueltas |

---

## 3 · Decisiones

### D1 · Las observaciones son del producto, no de la sesión

En las capturas, las nueve casillas viven dentro del Panel de Control, debajo
de los campos de captura del elemento seleccionado, con su propia descripción
adicional y su botón "Producto completado". El esquema las tiene colgadas de la
práctica.

Gana el diseño, y no solo por fidelidad. "Contaminado" es una propiedad del
frasco; "Equipo dañado", de ese equipo. Colgadas de la práctica, una sesión con
tres productos que marca *Contaminado* no dice cuál se contaminó, y el módulo
de Reportes —que lee `practica_elemento` justamente porque es quien sabe quién
usó qué— se queda sin poder responderlo.

`practica_observacion` **no se borra ni se modifica**. Queda en pie sin uso.
Nada la lee hoy —solo aparece en `src/types/database.ts`, que es generado—, así
que dejarla no cuesta nada, y borrarla sería una migración destructiva sobre
una tabla con dos políticas ya probadas a cambio de un `\dt` más corto. El día
que haga falta una observación de la sesión entera —"la práctica se suspendió a
la mitad"— ya está, con su RLS resuelta.

### D2 · Qué casillas se ven lo decide la base

Las capturas muestran tres listas distintas:

| Motivo | peso | cantidad | préstamo |
|---|:-:|:-:|:-:|
| No tenemos · Contaminado · Se terminó | ✓ | ✓ | |
| Material dañado | | ✓ | |
| Equipo dañado | | | ✓ |
| Préstamo N4 · N3 · LUM · Otro | ✓ | ✓ | ✓ |

Los paneles de peso y de préstamo salen idénticos a las capturas. El de
cantidad se amplió con las tres primeras, y es el único lugar donde este
documento se aparta del diseño: en las capturas, un material solo puede
marcarse *Material dañado*.

La razón es la asimetría del error. Una casilla de más cuesta un renglón en un
panel que ya tiene barra de desplazamiento. Una casilla de menos empuja al
responsable a escribir "se acabó la caja de pipetas" en *Otro* y en la
descripción adicional — texto libre en vez de un motivo con clave, que es
precisamente lo que el catálogo venía a evitar. Y los tres motivos son ciertos
de cualquier consumible: una caja de pipetas se termina, un lote de cajas Petri
se contamina, y `materia_biologica` —muestras, que se contaminan por
definición— cae en `cantidad`.

*Material dañado* y *Equipo dañado* se quedan como en el diseño, cada uno en su
método: ahí el nombre del motivo ya dice a qué se refiere.

Todo esto podría ser un `switch` de nueve líneas en el frontend. Va como columna en
`motivo_observacion` por la misma razón por la que los motivos son un catálogo
y no nueve booleanos: mover "No tenemos" a los materiales tiene que ser un
`update`, no una migración más un redespliegue. Es también lo que este proyecto
ya decidió con `campo_capturable`, y conviene ser consistente.

### D3 · El borrador vive en su propia tabla, en `jsonb`

La opción natural —`practica.estado` en `'borrador'` / `'finalizada'`— no cabe.
`practica_elemento` tiene un check, `practica_elemento_campos_por_metodo`, que
exige los campos completos según el método, y un trigger `AFTER INSERT` que
descuenta el inventario en el acto. Un producto en estado "Pendiente" —que es
justo lo que muestra el contador "(2/3 completados)" de las capturas— no es una
fila válida de esa tabla.

Para que lo fuera habría que aflojar el check, condicionar los dos triggers a
la finalización y agregar una política de `UPDATE`: cuatro piezas ya probadas,
tocadas para dar soporte a algo que ni siquiera es un hecho ocurrido. Y el
check aflojado se queda aflojado para siempre, incluso para las prácticas
finalizadas, que es donde de verdad importa.

`practica_borrador` guarda la captura tal como va —incluidos los productos a
medias— en un `jsonb` opaco para la base. La práctica real nace completa, en
una sola transacción, al finalizar. El esquema de `practica` conserva su
invariante: **una fila en `practica` es un hecho ocurrido**.

El costo: el contenido del `jsonb` no lo valida Postgres, así que un borrador
guardado por una versión vieja del frontend puede no cargar en una nueva. Se
mitiga con un `version` dentro del propio `jsonb` y descartando lo que no
entienda, con aviso. Es el precio correcto: un borrador que se pierde es una
molestia, un `practica_elemento` incompleto que se cuela a Reportes es un dato
malo.

### D4 · El método de control lo deriva la base, no el cliente

Hoy `practica_elemento.metodo_control` es un enum que viaja en el `insert`.
Nada en el esquema lo ata a la clasificación del artículo de esa existencia:
un responsable puede registrar un equipo como consumido por peso, y la base lo
acepta sin chistar.

`public.metodo_de_control(clasificacion)` fija el mapa en un solo lugar, y
`registrar_practica` lo aplica ignorando lo que mande el cliente. El frontend
lee el mismo valor —desde `existencia_listado`, que gana la columna— para
elegir qué panel dibujar, así que las dos puntas concuerdan por construcción y
no por disciplina.

El mapa no es una opinión: sale de lo que cada clasificación **ya declara que
captura** en `perfil_campo`, que es la única fuente que la base tiene sobre el
tema.

| Clasificación | Captura los dos pesos | Captura `cantidad` | Captura `funcionamiento` | Método |
|---|:-:|:-:|:-:|---|
| `reactivo` | ✓ | ✓ | | peso |
| `material` · `insumo` · `componente` | | ✓ | | cantidad |
| `materia_biologica` | | ✓ | | cantidad |
| `equipo` | | | ✓ | préstamo |

`reactivo` es la única que captura `peso_frasco_vacio` y `peso_total` —regla 13
del formato— y por eso es la única que se pesa. `equipo` es la única sin
`cantidad` y con `funcionamiento`: la regla 9 pide un renglón por equipo
físico, así que siempre es 1 y lo único que cambia al devolverlo es en qué
estado volvió. Eso es exactamente un préstamo.

`materia_biologica` queda en `cantidad`, y no por descarte: su perfil pide
`cantidad` y `unidad` y **no** pide los dos pesos. Una muestra se entrega y se
devuelve. Si mañana resulta que alguna se pesa, es una línea en la función.

### D5 · Registrar una práctica es una sola llamada

Una práctica son 1 cabecera + N elementos + M observaciones. Encadenadas desde
el cliente no son atómicas, y el modo de falla es feo: si el elemento 3 revienta
quedan dos elementos ya aplicados —con su `movimiento` escrito, que es de solo
inserción— colgando de una práctica que el responsable no puede corregir,
porque `practica_admin` es la única política de `UPDATE`.

`registrar_practica` lo hace en una transacción. `security invoker`, igual que
`vincular_asignatura` y `resolver_pendiente`: no le presta a nadie privilegios
que no tenga, y un usuario de rol `consulta` que la llame recibe 42501.

### D6 · El laboratorio se elige; no puede ser "Todas"

Las capturas muestran el campo Laboratorio con el texto fijo "Todas".
`practica.laboratorio_id` es `not null`, y el trigger `practica_asigna_folio`
saca de ahí el `almacen_id` de la práctica —o sea, de dónde se descuenta—. Sin
laboratorio no hay almacén, y sin almacén la RLS no tiene ancla.

Va como Select obligatorio, filtrado al almacén del usuario. El admin ve los
cuatro.

### D7 · La búsqueda de productos sale filtrada al almacén

No por gusto: `practica_elemento_escritura` rechaza insertar sobre una
existencia de otro almacén. Dejar buscar en los cuatro significa que un
responsable de N3 agregue un producto de N4, capture sus pesos, marque sus
observaciones, le dé a Finalizar y se coma un 42501 al final de todo el
trabajo. El admin sí ve los cuatro, porque para él la política es cierta.

---

## 4 · Esquema

Migración única: `supabase/migrations/20260903120000_practicas.sql`.

### El método de control, como función

```sql
create or replace function public.metodo_de_control(
  p_clasificacion public.clasificacion_articulo
) returns public.metodo_control
language sql immutable parallel safe
set search_path = ''
as $$
  select case p_clasificacion
    when 'reactivo' then 'peso'::public.metodo_control
    when 'equipo'   then 'prestamo'::public.metodo_control
    else 'cantidad'::public.metodo_control
  end
$$;
```

Se expone en la vista del listado, que es de donde el frontend lee las
existencias. `create or replace view` con la columna nueva **al final**: es lo
único que Postgres admite sin recrear la vista, y recrearla obligaría a repetir
`security_invoker = on`, que es el detalle que falla en silencio y publica el
inventario entero a `anon`.

```sql
create or replace view public.existencia_listado
with (security_invoker = on) as
select …,                                 -- las 18 columnas actuales, intactas
       public.metodo_de_control(a.clasificacion) as metodo_control
from …
```

### Los motivos aprenden a qué método aplican

```sql
alter table public.motivo_observacion
  add column metodos public.metodo_control[] not null
    default array['peso','cantidad','prestamo']::public.metodo_control[];

alter table public.motivo_observacion
  add constraint motivo_observacion_metodos_no_vacio check (cardinality(metodos) > 0);
```

El default con los tres es lo que hace que la migración no rompa lo que ya
esté cargado: un motivo existente sigue saliendo en todos los paneles hasta que
alguien decida otra cosa. Encima va el `update` que fija los cinco específicos y
reordena, y el mismo cambio se refleja en `seed.sql` y `datos-iniciales.sql`
para que un `db reset` produzca lo mismo que un `db push`.

El `orden` se rehace porque el actual saca los tres préstamos antes que
*Contaminado* y *Se terminó*, y el diseño los pone al final:

| clave | orden | metodos |
|---|--:|---|
| `no_tenemos` | 1 | peso, cantidad |
| `contaminado` | 2 | peso, cantidad |
| `se_termino` | 3 | peso, cantidad |
| `material_daniado` | 4 | cantidad |
| `equipo_daniado` | 5 | prestamo |
| `prestamo_n4` | 6 | los tres |
| `prestamo_n3` | 7 | los tres |
| `prestamo_lum` | 8 | los tres |
| `otro` | 9 | los tres |

### Las observaciones del producto

```sql
create table public.practica_elemento_observacion (
  practica_elemento_id bigint not null
    references public.practica_elemento (id) on delete cascade,
  motivo               text not null references public.motivo_observacion (clave),
  primary key (practica_elemento_id, motivo)
);

create index practica_elemento_observacion_motivo_idx
  on public.practica_elemento_observacion (motivo);
```

Sin `almacen_id` desnormalizado, por la misma razón que `practica_observacion`:
son dos columnas, y una tercera solo para la RLS sale más cara que el `exists`.
`practica_elemento_id` es la primera columna de la llave primaria, así que la
subconsulta resuelve por índice sin necesidad de uno nuevo.

**No** se valida en la base que el motivo aplique al método del elemento. El
`metodos` de D2 es para armar la interfaz, no una restricción: cambiar un motivo
de método dejaría inválidas filas históricas que fueron correctas el día que se
capturaron, y una práctica de marzo no debe volverse ilegal en septiembre.

### El borrador

```sql
create table public.practica_borrador (
  usuario_id     uuid primary key references public.perfil (id) on delete cascade,
  contenido      jsonb not null,
  actualizado_en timestamptz not null default now()
);
```

Uno por persona. La pantalla captura una práctica a la vez, y una llave primaria
sobre `usuario_id` hace que "recuperar mi borrador" sea un `select` sin
ambigüedad y que guardar sea un `upsert` sin carreras.

Un trigger `before insert or update` fija `usuario_id` desde `auth.uid()` y
`actualizado_en` desde `now()`, por lo mismo que en `movimiento` y en
`practica`: si el cliente los mandara, podría escribir el borrador de otro —y
el `WITH CHECK` se evalúa después del trigger, sobre la fila final.

### `registrar_practica`

```sql
create or replace function public.registrar_practica(
  p_programa          bigint,
  p_laboratorio       bigint,
  p_asignatura        bigint,
  p_practica_catalogo bigint,
  p_fecha             date,
  p_observaciones     text,
  p_elementos         jsonb
) returns text
language plpgsql security invoker
set search_path = ''
```

`p_observaciones` es el texto libre de la práctica entera, la columna
`practica.observaciones` que ya existe. **La pantalla lo manda en `null`**: el
diseño movió la descripción adicional a cada producto (D1), y no hay campo de
sesión que llenar. Queda en la firma porque cambiarla después obliga a un
`drop` más `create`, y porque el día que se agregue —"la práctica se suspendió
a la mitad"— la columna y el parámetro ya están.

`p_elementos` es un arreglo de objetos:

```json
[{ "existencia_id": 12,
   "peso_inicial": 526, "peso_final": 520,
   "observaciones": "Frasco casi vacío",
   "motivos": ["se_termino"] }]
```

Qué hace, en orden:

1. Rechaza el arreglo vacío. Una práctica sin elementos no consume nada y no
   tiene por qué existir.
2. Inserta la cabecera. `folio`, `almacen_id` y `registrado_por` los pone el
   trigger que ya existe; la función no los toca.
3. Por cada elemento: lee la clasificación del artículo de esa existencia,
   deriva el método con `metodo_de_control`, e inserta **solo los campos que ese
   método admite**, ignorando el resto del objeto. Un `peso_inicial` en un
   equipo se descarta antes de llegar al check, no revienta contra él.
4. Inserta sus motivos.
5. Devuelve el folio.

Los triggers de `practica_elemento` corren dentro de la misma transacción, así
que los `movimiento` y el `update` de `funcionamiento` se van con todo si algo
falla después.

`revoke ... from public, anon` y `grant execute ... to authenticated`, porque el
`alter default privileges` de la migración de grants cubre tablas, no funciones,
y una función nueva es ejecutable por `PUBLIC` salvo que se revoque.

---

## 5 · RLS

```sql
alter table public.practica_elemento_observacion enable row level security;
alter table public.practica_borrador            enable row level security;
revoke all on public.practica_elemento_observacion, public.practica_borrador from anon;
```

**`practica_elemento_observacion`** — calcado de `practica_observacion`, contra
el elemento padre:

```sql
create policy practica_elemento_observacion_lectura
  on public.practica_elemento_observacion
  for select to authenticated using (true);

create policy practica_elemento_observacion_escritura
  on public.practica_elemento_observacion
  for all to authenticated
  using (exists (select 1 from public.practica_elemento e
                  where e.id = practica_elemento_id
                    and ((select private.es_admin())
                         or e.almacen_id = (select private.almacen_actual()))))
  with check (…lo mismo…);
```

**`practica_borrador`** — el borrador es de quien lo escribe, y de nadie más:

```sql
create policy practica_borrador_propio on public.practica_borrador
  for all to authenticated
  using      (usuario_id = (select auth.uid()))
  with check (usuario_id = (select auth.uid()));
```

Sin política de admin, y es deliberado. Un admin no tiene por qué leer la
captura a medio hacer de un responsable: no es un dato del sistema, es su hoja
de trabajo. Lo que el admin sí ve —y corrige— es la práctica ya finalizada.

Toda llamada a función va envuelta en `(select …)`: sin eso Postgres la evalúa
una vez por fila en vez de una por sentencia.

---

## 6 · La pantalla

### Ruta y menú

`/practicas`, dentro de `RutaProtegida` y del `Layout`, sin guardia de rol: los
tres roles la abren. Un usuario de `consulta` puede armar la captura y ver los
saldos; al finalizar, la RLS le niega la escritura y el traductor de errores le
dice por qué. En `navegacion.ts`, la entrada que ya existe pasa de
`disponible: false` a `true`. Es lo único que se toca del menú.

### Estructura

Dos columnas: la captura a la izquierda, el Panel de Control pegado a la
derecha.

```
src/features/practicas/
  consultas.ts          hooks de Query, mutaciones y el traductor de errores
  esquemas.ts           zod: la cabecera y un esquema por método
  campoNumero.ts        leer un input numérico sin volver cero el vacío (puro)
  borrador.ts           serializar / restaurar / validar versión (puro)
  metodos.ts            etiquetas e iconos de cada método (puro)
  PaginaPracticas.tsx   ensamblaje y estado de la selección
  DatosPractica.tsx     la cascada, laboratorio y fecha
  AgregarProductos.tsx  Escanear QR (apagado) y Buscar producto
  DialogoBuscar.tsx     el modal de búsqueda
  TablaProductos.tsx    Productos Utilizados, con el (n/m completados)
  PanelControl.tsx      elige el sub-panel según metodo_control
  CapturaPeso.tsx       peso inicial, peso final, consumo calculado
  CapturaCantidad.tsx   entregada, devuelta, dañada, pérdidas calculadas
  CapturaPrestamo.tsx   estado de salida y de devolución
  Observaciones.tsx     las casillas filtradas y la descripción adicional
```

### La cascada

Programa → semestres de ese programa → asignaturas de ese semestre → prácticas
de esa asignatura. Los cuatro selects se apagan hasta que el anterior tiene
valor, y cambiar uno limpia los de abajo: sin eso queda una asignatura de un
programa que ya no está seleccionado, que es justo lo que la FK compuesta
`practica_pareja_valida` rechazaría al final.

El semestre no es una tabla: sale de los `programa_asignatura` del programa,
distintos y ordenados, con `null` al final como "Optativa" —lo que el spec del
1 de septiembre decidió que significa un semestre nulo—.

"Número de Práctica" es el selector de `practica_catalogo`, no el folio. El
folio `PRA-0001` lo asigna el trigger y se muestra en el aviso de éxito, que es
el único momento en que se conoce.

### Los tres paneles de captura

El sub-panel se elige por `metodo_control`, que viene en la fila de
`existencia_listado`. Consumo y pérdidas se muestran calculados en vivo, pero
**no se envían**: son columnas generadas, y la aritmética vive en la base
porque una resta que calcula el frontend es una resta que se puede equivocar en
silencio.

Estado de salida y de devolución tienen dos opciones, *Correcto* y *Presenta
fallas*, que es lo que el enum `funcionamiento_equipo` admite. El *Bueno /
Regular / Dañado / Mantenimiento* del prototipo viejo no existe en la base.

El botón "Leer balanza" junto a los dos pesos se dibuja apagado, con un título
que explica que la balanza todavía no está conectada. Mismo trato que "Escanear
QR" y que las entradas pendientes del menú: el diseño aprobado se ve completo y
nadie se topa con un botón que no hace nada.

### Un producto está "Completado" cuando su método lo dice

El contador "(n/m completados)" y el chip de cada fila salen de una función
pura en `esquemas.ts`: peso quiere los dos pesos, cantidad quiere la entregada,
préstamo quiere el estado de salida. Es la misma condición que
`practica_elemento_campos_por_metodo` exige en la base, escrita una vez y
probada. Finalizar se apaga mientras haya alguno pendiente.

### El borrador

Se guarda con "Guardar borrador" y se ofrece restaurar al entrar si hay uno.
No hay autoguardado: un guardado en cada tecla convierte cada duda en una
escritura, y el diseño ya puso el botón.

Al finalizar con éxito se borra. Si la práctica falla, se queda: el trabajo no
se pierde por un error de red.

### Los errores, en español

Un `mensajeDeError` propio del módulo, como el de `academico/consultas.ts`.
Los que importan: `42501` → "No puedes registrar prácticas en este almacén";
`23514` sobre `practica_elemento_devolucion_coherente` → "Lo devuelto y lo
dañado no pueden sumar más de lo entregado"; `23514` sobre
`practica_elemento_peso_coherente` → "El peso final no puede ser mayor que el
inicial"; y el mensaje de la excepción de `aplicar_movimiento` cuando el
consumo deja la existencia en negativo. Lo desconocido pasa con su mensaje
original: un "algo salió mal" genérico esconde justo la pista que hace falta.

---

## 7 · Datos de prueba

`seed.sql` ya trae los ocho programas, los nueve motivos, seis asignaturas con
sus semestres y siete prácticas de catálogo. Lo que le falta a este módulo es
que esas asignaturas cuelguen de programas cuyos laboratorios tengan
existencias cargadas, cosa que el seed ya cumple para N3.

Se agrega al seed lo mínimo: la columna `metodos` y el `orden` nuevo de los
motivos. Nada más. Las existencias las pone el ETL o la pantalla de alta.

---

## 8 · Pruebas

### RLS — `rls.test.sql`, de `plan(73)` a `plan(85)`

1. Un responsable inserta una observación en un elemento de su almacén → pasa.
2. Un responsable inserta una observación en un elemento de otro almacén → 42501.
3. Un responsable ve las observaciones de cualquier almacén (lectura abierta).
4. `lectura@` inserta una observación → 42501.
5. El admin inserta en cualquier almacén → pasa.
6. Cada quien lee su propio borrador → 1 fila.
7. Un responsable lee el borrador de otro → 0 filas.
8. Un responsable escribe un borrador con el `usuario_id` de otro → el trigger
   lo reescribe al suyo, y el `WITH CHECK` lo deja pasar sobre la fila final.
9. El admin lee el borrador de un responsable → 0 filas.
10. `anon` toca cualquiera de las dos tablas → denegado.
11. `lectura@` llama a `registrar_practica` → 42501.
12. Un responsable llama a `registrar_practica` con un laboratorio de otro
    almacén → 42501.

### Esquema — `esquema.test.sql`, de `plan(60)` a `plan(69)`

1. `metodo_de_control` cubre las seis clasificaciones, con el valor esperado.
2. `existencia_listado` sigue con `security_invoker = on` después del
   `create or replace`. Es la que atrapa el fallo silencioso.
3. `existencia_listado` expone `metodo_control`.
4. `registrar_practica` ignora un `peso_inicial` mandado sobre un equipo.
5. `registrar_practica` deriva `prestamo` para un equipo aunque el cliente no
   mande nada.
6. `registrar_practica` con un arreglo vacío falla.
7. `registrar_practica` es atómica: un elemento inválido en el arreglo deja
   cero filas en `practica`, `practica_elemento` y `movimiento`.
8. `motivo_observacion.metodos` no admite arreglo vacío.
9. `practica_elemento_observacion` borra en cascada con su elemento.

### Pantalla — vitest

`borrador.ts`: serializar y restaurar es identidad; un contenido de otra versión
se descarta sin reventar. `esquemas.ts`: la condición de "completado" por cada
uno de los tres métodos, y los tres esquemas de zod contra valores límite
(peso final mayor que el inicial, devuelta + dañada mayor que entregada).
`metodos.ts`: el mapa de etiquetas. Componentes: que la cascada limpie los
selects de abajo, que el panel elegido corresponda al método de la fila
seleccionada, y que Finalizar esté apagado con un producto pendiente.

---

## 9 · Riesgos

**El `jsonb` del borrador no lo valida nadie.** Un cambio en la forma del
contenido rompe los borradores guardados. Mitigado con un `version` dentro del
propio objeto y descartando con aviso lo que no se entienda (D3). El modo de
falla es "perdiste el borrador", no "se registró mal una práctica".

**`create or replace view` es frágil de una manera silenciosa.** Si alguien
recrea `existencia_listado` sin `security_invoker = on`, el inventario entero
queda expuesto a `anon` y todo sigue funcionando igual. Por eso la prueba de la
§8 existe desde el 21 de agosto y por eso se repite aquí.

**`registrar_practica` ignora campos en silencio.** Un `peso_inicial` mandado
sobre un equipo se descarta sin avisar. Es deliberado —el check de la base
reventaría con un mensaje que nadie entiende—, pero significa que un bug del
frontend que mande el objeto equivocado se ve como "no se guardó lo que
capturé". Lo cubre la prueba 4 de esquema y el hecho de que el frontend arme el
payload desde el método, no desde un objeto más grande.

**La lista de motivos se lee una vez y se cachea.** Si un admin cambia
`metodos` mientras alguien captura, el que captura sigue viendo la lista vieja
hasta que recargue. Es aceptable: son nueve filas que cambian una vez al año.

---

## 10 · Lo que queda fuera

- **Historial de prácticas.** La pantalla que lista lo ya registrado, con su
  folio y su detalle. `practica_lectura` es abierta a todo `authenticated`, así
  que es solo pantalla.
- **Escaneo con cámara.** Requiere una dependencia nueva, HTTPS y una cámara en
  las máquinas del almacén. El campo de código acepta lo que teclee un lector
  físico, que se comporta como teclado.
- **Lectura de balanza.** Web Serial, solo Chromium, y hace falta saber marca,
  modelo y protocolo de la balanza.
- **Préstamos entre almacenes como transacción.** Ya es límite conocido de v1
  en la §4.6 del spec del 18 de agosto: las casillas *Préstamo N3/N4/LUM* son
  observaciones, no movimientos.
- **Corregir una práctica registrada.** Sigue siendo cosa del admin, y por
  ahora sin pantalla.
- **`pantalla_practicas/`** queda fuera del repositorio. Son PNG de un mockup:
  binarios de los que git no puede hacer diff, y entrada del módulo, no
  producto. Lo que sobrevive de ellas es este documento.
