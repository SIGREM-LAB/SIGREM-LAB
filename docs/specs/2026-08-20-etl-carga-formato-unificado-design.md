# Diseño · El cargador: del formato unificado a la base

**20 de agosto de 2026**

Antecedentes: el contrato de comportamiento está en la §6 de
`2026-08-18-depuracion-esquema-formato-unificado-design.md`. La §4.2 de
`2026-08-12-inventarios-ucl-datos-y-esquema-design.md` dibujó una arquitectura de
ETL en tres etapas; este documento la reemplaza, y la §2 explica por qué.

Los fixtures contra los que se escribe están en `etl/ejemplos/`, con su catálogo
de defectos en `etl/ejemplos/DEFECTOS.md`.

---

## 1 · Qué se decide aquí

El esquema y el formato ya están cerrados. Falta la pieza del medio: el programa
que lee los archivos que entregan los almacenes y los convierte en filas.

Este diseño cubre **cómo se estructura ese programa, cómo reporta lo que no
puede cargar, y cómo se prueba**. No cambia el esquema ni el formato.

Tres hallazgos de la revisión del formato entran aquí como restricciones, no como
opiniones:

**H1 · `movimiento` no se puede insertar sin un perfil explícito.** La columna es
`usuario_id uuid not null references perfil(id)` y el trigger hace
`coalesce(new.usuario_id, (select auth.uid()))`. Conectado por psycopg como
`postgres`, `auth.uid()` es NULL y el insert revienta contra el `not null`. El
cargador **tiene** que traer su propio `perfil.id`. El contrato §6 no lo
menciona; sin esto, el punto 5 de ese contrato es inejecutable.

**H2 · El desplegable de `Funcionamiento` ofrece un valor que el enum no tiene.**
La hoja Equipos valida contra `Correcto, Presenta fallas, No funciona`;
`funcionamiento_equipo` solo tiene `correcto` y `presenta_fallas`. Es una
decisión pendiente, no un defecto de datos. Mientras no se resuelva, el cargador
lo trata como rechazo (§5).

**H3 · Los laboratorios no coinciden por acentos.** `datos-iniciales.sql` inserta
`Caracterizacion y procesamiento`; una persona escribe
`Caracterización y procesamiento`. El lookup pasa por `norm_texto()`, no por
igualdad de texto. Sin esto, ni los archivos limpios cargan.

---

## 2 · El enfoque: validar en memoria, cargar en transacción

La §4.2 del 12 de agosto proponía tres etapas con intermedio en disco:

```text
extract/   Excel → tablas staging, una por archivo, FIEL al original, sin limpiar
rules/     normalización versionada en código
review/    lo que las reglas no resuelven → CSV de excepciones por almacén
```

Ese diseño resolvía un problema real: **leer los diez archivos originales era caro
y frágil** —encabezados de tres niveles en la fila 21, 225 columnas reportadas con
25 reales, listas de validación estacionadas a la derecha, columnas de cantidad
invertidas entre archivos— y no se quería repetir esa lectura en cada corrida.

El formato unificado eliminó ese problema. Son columnas fijas, encabezado en una
fila conocida y 164 renglones. El intermedio en disco ya no compra nada y sí
cuesta: cuatro pasos que mantener en sincronía, y un intermedio que se
desactualiza en cuanto se toca una regla.

**Lo que sí importa ahora es el bucle de prueba.** El cargador se va a re-correr
muchas veces, y un solo comando que en un segundo dice «estos son los problemas»
—sin levantar Docker— es un bucle mucho más rápido que cuatro etapas encadenadas.

Así que: **una pasada, dos fases lógicas.** Se lee y se valida la hoja entera en
memoria. Si tiene rechazos, se escribe el informe y **no se abre conexión**. Si
está limpia, se abre transacción y se escribe.

Lo que se conserva del diseño viejo son las dos ideas que siguen valiendo:
`rules/` como normalización versionada en código, y `review/` como CSV de
excepciones. `extract/` pasa de «tablas staging en disco» a ser el lector del
formato.

### Herramientas

Python con **psycopg[binary]** y **openpyxl**, ya en `etl/requirements.txt`. Se
agrega **pytest**.

Dos descartes deliberados:

- **`supabase-py` / PostgREST, no.** Hace falta una transacción por archivo y
  `on conflict` para la idempotencia; PostgREST no da transacción
  multi-sentencia. Conectando directo, además, la RLS se salta por
  construcción, que es lo correcto para una carga administrativa.
- **pandas, tampoco**, aunque esté en `requirements.txt`. Son 164 renglones y la
  lógica es fila a fila con validación. Pandas convierte celdas vacías en `NaN`,
  y la regla 6 dice que celda vacía significa **cero**: meter `NaN` en medio
  fabrica el bug exacto que el cargador debe atrapar.

---

## 3 · Módulos

```text
etl/
  cargar.py            CLI y orquestación
  db.py                conexión, transacción, el perfil que firma
  catalogo.py          buscar-antes-de-crear, alias, artículos
  destino.py           escribe carga / ubicacion / existencia / movimiento
  extract/formato.py   lee una hoja del formato unificado → renglones crudos
  rules/normalizar.py  texto, vacíos, números, NFPA, colores, estado físico
  rules/validar.py     las 13 reglas y los choques con el esquema
  review/informe.py    acumula problemas → CSV con fecha
```

Cada uno tiene una responsabilidad que se puede enunciar en una línea, y
`extract`, `rules` y `review` no conocen la base: se prueban sin Docker. Esa es
la frontera que hace que el bucle de prueba sea rápido.

`etl/review/*.csv` es salida y va a `.gitignore`.

---

## 4 · Flujo, por archivo

El almacén y la hoja salen **del nombre del archivo** (`N3-Equipos.xlsx`), no de
una columna: decisión D1 del spec del 18, Nivel 1 del Léeme del formato. Un
archivo por almacén-hoja es además la granularidad exacta de la tabla `carga`.

1. `extract.formato.leer(ruta, hoja)` devuelve el encabezado (almacén,
   responsable, periodo, actualizado el) y los renglones crudos. La fila del
   encabezado de columnas depende de la hoja: **9 en Reactivos** —que tiene tres
   filas de encabezado agrupado por los apartados de la NOM— y **8 en las otras
   cinco**. Las hojas `Reglas de captura` y `Léeme` se ignoran.
2. `rules.normalizar` por renglón: trim y colapso de espacios, vacíos a `None`,
   NFPA de texto a `0..4`, colores al enum, estado físico de tres casillas a uno,
   ceros a la izquierda en números de inventario.
3. `rules.validar`: lo que necesita ver el renglón entero o varios renglones
   —una sola casilla de estado físico, pesos con el vacío antes del lleno, series
   e inventarios sin repetir, unidad coherente con la del artículo—.
4. Si hay rechazos, van al informe y **la hoja no se carga**. No se abre conexión.
5. Si no, transacción:
   - `insert into carga` con el encabezado → `carga_id`
   - por renglón: `ubicacion` (upsert por `(almacen_id, etiqueta)`), `articulo`
     vía `buscar_articulo()`, el detalle `articulo_reactivo` o
     `articulo_biologico` si aplica, `existencia` con su `carga_id`, y
     `movimiento` tipo `carga_inicial` **si la cantidad es mayor que cero**.
   - commit

Una transacción por archivo: si un renglón falla, se cae la hoja completa y la
base queda como estaba. Los 15 archivos en una corrida, orden fijo
N3 → N4 → LUM → LE.

**Por qué la corrida son los 15 y no uno.** `articulo` es global, no por almacén.
La acetona de N3, N4 y LUM tiene que resolver a un solo artículo; el zinc al 95%
y al 93% a dos, pese a compartir CAS. Cargar un almacén aislado nunca ejercita la
deduplicación, que es la parte difícil.

### Cantidad cero

Regla 6: celda vacía significa cero. No se inserta movimiento, y el trigger
`existencia_asigna_codigo` ya deja el estado en `agotado` al insertar. Es el
hueco que la función `private.estado_calculado` se extrajo a cerrar.

---

## 5 · Las dos clases de problema

El contrato §6 mezcla en una sola lista «normalizar vacíos» y «error de
revisión». Son cosas distintas y el cargador las separa:

| Clase | Qué es | Qué hace el cargador |
|---|---|---|
| **Rechazo** | El renglón viola una regla y no se puede adivinar la intención | Va al informe. **La hoja no entra.** |
| **Normalizado** | El ETL sabe qué hacer sin preguntar | Corrige, anota en el informe. **La hoja sí entra.** |

Rechazan: texto donde va un número (`Un frasco`), empaque como unidad, `No
funciona` en Funcionamiento (H2), laboratorio de otro almacén, pesos invertidos,
dos estados físicos marcados, serie o inventario repetidos, un renglón para
varios equipos, sub-ubicación desconocida, unidad distinta a la del artículo.

Se normalizan: espacios sobrantes y dobles, `NO TÓXICO` → `verde`,
`S/N` / `Sin serie` / `—` → `NULL`, `Grado 2: Riesgo moderado` → `2`,
ceros a la izquierda en inventarios, acentos en el lookup de laboratorio (H3).

**Por qué no todo rechaza.** Hay 868 celdas con espacios sobrantes entre los diez
archivos reales. Rechazar por eso convierte una corrección mecánica en trabajo
manual de los responsables, y el espacio no se ve en pantalla: nadie lo va a
encontrar.

**El orden importa: primero se normaliza, después se valida.** Las dos clases no
son independientes, y hay un caso donde se cruzan. El defecto 16 de
`DEFECTOS.md` es el mismo número de inventario escrito `5311300206` y
`05311300206`: como texto son distintos y el índice único parcial no los atrapa.
Normalizar el cero a la izquierda es lo que los vuelve iguales, y solo entonces
la regla 10 puede verlos como duplicados y rechazar. Si se validara primero,
los dos entrarían y el duplicado quedaría en la base.

### Qué se puede validar sin base

Casi todo. La sub-ubicación se valida contra la clave del almacén, que sale del
nombre del archivo: `N1-1` no empieza por `N3` y se rechaza sin consultar nada.
Las unidades, los colores, los grados, los pesos, las series duplicadas y las
trece reglas son locales al archivo o a la corrida.

La excepción es **el laboratorio**, que solo existe en la tabla `laboratorio`. Por
eso `validar()` recibe los catálogos como argumento en vez de ir a buscarlos:

- con `--dsn` o `DATABASE_URL`, se leen de la base y se valida todo;
- sin conexión, ese catálogo va vacío, la comprobación se salta y **el informe lo
  dice**;
- en las pruebas se inyecta un catálogo fijo que espeja `datos-iniciales.sql`.

Un simulacro sin Docker atrapa 21 de los 22 defectos. El que falta —el 2,
laboratorio de otro almacén— lo ataja de todos modos la FK compuesta al cargar,
así que nunca llega a la base.

### El informe

Un CSV por corrida en `etl/review/`, con `archivo`, `renglon`, `columna`,
`regla`, `valor`, `accion` (`rechazo` o `normalizado`) y `detalle`. La columna
`accion` es directamente comparable con la columna «Espera» de
`etl/ejemplos/DEFECTOS.md`, que ya declara para cada uno de los 22 defectos si el
ETL debe rechazar, normalizar o marcar.

---

## 6 · Idempotencia

Punto 9 del contrato: re-correr una carga no duplica. Llave natural de una
existencia:

- consumibles: `(articulo_id, almacen_id, ubicacion_id, marca, presentacion)`
- equipos: `numero_serie`, o `numero_inventario_uaeh` si no hay serie

Antes de insertar se busca por su llave natural. Si ya está, se salta y se anota
en el informe. No se ajusta ni se inserta un movimiento correctivo: eso es un
conteo físico, y el conteo lo hace una persona, no el cargador.

**Los folios no se queman en una corrida fallida.** `private.folio_almacen` es una
tabla, no una secuencia, así que el `on conflict do update ... returning` del
trigger es transaccional y un rollback lo devuelve. Lo que sí deja hueco es
borrar a mano algo ya commiteado.

**Las decisiones humanas sobreviven.** Cada texto crudo que resuelve a un artículo
existente se guarda como `articulo_alias` con `origen = 'migracion'`. Es lo que
permite re-correr la carga completa sin perder el trabajo de decidir qué es qué.

### El cargador no empareja por similitud

El punto 7 del contrato §6 dice «`buscar_articulo()` antes de crear». Aquí se
matiza, y el motivo es concreto.

`buscar_articulo()` compara por trigramas. Estas dos cadenas tienen una
similitud altísima:

```text
Zinc en polvo, sólido, pureza 95%, presentación 500 g, CAS: 7440-66-6
Zinc en polvo, sólido, pureza 93%, presentación 500 g, CAS: 7440-66-6
```

y son **dos artículos**: el propio comentario de `catalogo.sql` los usa como
ejemplo de que la pureza cambia la sustancia. Un cargador que auto-acepte la
mejor coincidencia difusa los fusiona en silencio, y el resultado —un artículo
donde había dos, con las cantidades sumadas— no lanza ningún error y no se nota
en ninguna pantalla.

Así que el cargador resuelve **solo por coincidencia exacta**: primero la
identidad `(nombre_canonico, descripcion, unidad_base)`, que es la llave única de
la tabla; después `articulo_alias.texto` exacto. Si ninguna acierta, **crea** el
artículo con `verificado = false`.

`buscar_articulo()` sí se llama, pero para **avisar, no para decidir**: si
devuelve candidatos por encima del umbral, se anotan en el informe como
`normalizado` con la lista de parecidos. El artículo nuevo entra igual y cae en
la cola de curación del admin, que es donde vive `fusionar_articulo()`. Fusionar
dos artículos es una decisión humana con función propia en el esquema; el
cargador no la toma.

Esto es lo que hace que la prueba de los **152 artículos** signifique algo: con
auto-emparejamiento difuso el número bajaría solo, y por la razón equivocada.

---

## 7 · El perfil que firma

`carga@uaeh.local`, rol `admin`. Resuelve H1: cada `movimiento` lleva su
`usuario_id` explícito, y cada `carga` su `cargado_por`.

Perfil propio y no `admin@uaeh.local` porque los movimientos de `carga_inicial`
quedan distinguibles de lo que capturó una persona. La bitácora tiene que poder
contestar «esto lo puso el cargador» sin ambigüedad.

- **Local:** se agrega a `supabase/seed.sql` junto a los otros seis usuarios de
  prueba. Es seed, no migración: no toca la regla de que el esquema solo cambia
  por migración.
- **Remoto:** alta manual desde el dashboard de Auth. `datos-iniciales.sql`
  excluye usuarios a propósito, y meter una cuenta con contraseña conocida en
  producción sería abrir una puerta con llave publicada.

---

## 8 · CLI

```bash
python -m etl.cargar --juego limpios              # valida, NO toca la base
python -m etl.cargar --juego defectos             # el informe con los 22
python -m etl.cargar --juego limpios --cargar     # escribe de verdad
python -m etl.cargar --juego limpios --cargar --almacen N3
python -m etl.cargar --origen etl/datos --cargar  # los archivos reales
```

**Sin `--cargar` es simulacro.** Que lo seguro sea el default: el comando se va a
correr muchas más veces de las que se va a querer escribir.

`--juego` es atajo de `--origen etl/ejemplos/datos-almacenes/<juego>`. El destino
sale de `DATABASE_URL`, o de `--dsn`. Sale con código distinto de cero si hubo
algún rechazo, para que sirva en CI.

---

## 9 · Pruebas

**Unitarias, sin base.** Cada una de las 13 reglas con el renglón que la rompe,
tomado de los fixtures. `extract` y `rules` no conocen la base, así que corren en
milisegundos y sin Docker.

**Aceptación, sin base.** Correr el juego `defectos` y comparar el informe contra
`DEFECTOS.md`: los 22, ni uno más ni uno menos, cada uno con la `accion` que ese
documento declara. `DEFECTOS.md` se genera de la misma lista que produce los
archivos, así que es un oráculo que no puede desfasarse.

**Carga, contra local.** `supabase db reset`, cargar los 15 limpios, y comprobar
en SQL:

| Qué | Cuánto |
|---|---|
| filas en `carga` | 15 |
| existencias | 164 |
| **artículos** | **152** |
| movimientos `carga_inicial` | 162 — los dos renglones en cero no generan uno |
| existencias en estado `agotado` | 2 |
| artículos para la acetona (CAS 67-64-1) | 1, con 3 existencias |
| artículos para el zinc en polvo (CAS 7440-66-6) | 2 — 95% y 93% |
| artículos para el analizador ROTAP | 1, con 2 existencias |

**152 y no 164 es la prueba que importa.** Doce artículos aparecen en más de un
renglón, y por tres motivos distintos que el cargador tiene que resolver bien:
la misma sustancia en almacenes distintos con distinta marca (acetona, hidróxido
de sodio), dos frascos del mismo reactivo en el mismo almacén (ácido succínico),
y dos equipos del mismo tipo de marcas diferentes (balanza analítica en N3 y
LUM, mufla en N3 y LUM, osciloscopio en LE). Si el resultado son 164 artículos,
la deduplicación no está funcionando y no se nota de ninguna otra forma.

Los números salen de los propios fixtures y se pueden recalcular:
`etl/ejemplos/generar.py` es la fuente.

Y después, correr la misma carga otra vez: **cero existencias nuevas**.

---

## 10 · Qué NO hace esta versión

- **No ajusta lo que ya está.** Si una existencia ya existe, se salta. Corregir un
  saldo es un conteo físico y lo hace una persona.
- **No resuelve H2.** El valor `No funciona` se rechaza hasta que se decida si
  entra al enum o se mapea a `presenta_fallas` más `estado = 'baja'`.
- **No cura el catálogo.** Los artículos que crea nacen `verificado = false` y
  caen en la cola del admin, como manda el punto 8 del contrato.
- **No exporta.** Regenerar el formato oficial de la NOM es otro trabajo.
