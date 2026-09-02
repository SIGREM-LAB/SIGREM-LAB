# Migrar el inventario de un almacén

Procedimiento probado con N3 el 26 de agosto de 2026: 1615 renglones, de los
cuales 1278 quedaron cargados y 337 esperando revisión humana. Ni uno perdido.
Esos dos números son los de antes de la regla del frasco; después de ella la
misma corrida dio 1502 y 113 (última trampa de este archivo).

Repetido con la *Versión 2* de N3 el 2 de septiembre de 2026, ya solo con las
tres hojas que el almacén dio por cerradas:

| Hoja | Renglones | Existencias | Pendientes |
|---|---:|---:|---:|
| Reactivos | 1081 | 1062 | 19 |
| Material | 447 | 394 | 53 |
| Insumos | 82 | 46 | 36 |
| **Total** | **1610** | **1502** | **108** |

1164 artículos, y los cuatro controles del paso 4 en cero. Equipos y Electrónica
quedaron fuera a propósito, con `--hoja`.

Esos son los números **después** del paso 2. Cargando el archivo tal como llegó
daba 1428 y 182: las 151 correcciones deterministas mueven 74 renglones de
«pendiente» a «cargado», casi todos los `Gabienete` de Material. Lo que queda
pendiente ya no tiene arreglo automático: 83 de Regla 2, 17 de unidad contra
`articulo.unidad_base` y 8 de Regla 13.

Los otros tres almacenes se migran igual. Lo que sigue es el orden, qué esperar
en cada paso, y las trampas que ya nos costaron una vez.

## 0. Antes de empezar

Los Excel reales **no van a git**: `.gitignore` ignora `etl/Datos-Reales-JD2026/`
y `etl/Inventarios-JD2026/`. Son binarios que git no sabe diferenciar y datos
institucionales de la UCL.

```
etl/Datos-Reales-JD2026/
  original/Almacén-Nivel-3/Inventario final.xlsx    ← intocable
  corregido/Almacén-Nivel-3/Inventario final.xlsx   ← generado
                            correcciones-aplicadas.csv
```

El original **nunca se edita**. Ni para arreglar una falta de ortografía.

> **Si estrenas una carpeta de entregas, agrégala al `.gitignore` en el mismo
> commit.** El bloque de ese archivo ignora rutas literales, no un patrón: la
> entrega de septiembre llegó como `etl/Inventarios-JD2026/` y salía en
> `git status` como archivo nuevo, a un `git add -A` de publicar el inventario
> de la universidad.

**Cierra el Excel antes de cargar.** `openpyxl` lee el último estado
**guardado**; con el libro abierto en LibreOffice o Excel, lo que no hayas
guardado no entra y no hay ni un aviso. El síntoma de que sigue abierto es un
`.~lock.<archivo>#` junto al libro (también ignorado por git).

## 1. Revisar el archivo antes de cargarlo

```bash
python -m etl.cargar --origen etl/Datos-Reales-JD2026/original --almacen N3
```

Sin `--cargar` no escribe nada. Deja el informe en `etl/review/AAAA-MM-DD-original.csv`
con una fila por problema: qué regla, qué celda, qué valor, y si el cargador lo
normaliza solo o no puede.

Lo que hay que mirar en ese CSV, en este orden:

1. **Hojas presentes.** N3 mandó Reactivos, Insumos y Material. Faltaban Equipos
   y Materia biológica, y eso no lo dice ningún error: la hoja que no está,
   sencillamente no aparece. Cuéntalas a mano contra lo que el almacén dijo que
   entregaba. La primera línea del resumen dice cuántas leyó (`3 hojas, …`), y
   ese número es lo primero que hay que comparar. **Una pestaña que existe pero
   se llama distinto cuenta como ausente:** el libro de septiembre traía
   `Material biológico` y el código espera `Materia biológica`
   (`formato.HOJAS_DE_DATOS`), así que se ignoró sin un solo aviso.
2. **Rechazos por regla.** Son los que necesitan a una persona.
3. **Normalizados.** Los arregla el cargador solo; se leen para confirmar que no
   está «arreglando» algo que en realidad estaba bien.

## 2. Corregir lo determinista

```bash
python -m etl.corregir              # regenera corregido/ desde original/
python -m etl.corregir --verificar  # solo comprueba lo ya generado

# otra carpeta de entregas
python -m etl.corregir --origen etl/Inventarios-JD2026 \
                       --destino etl/Inventarios-JD2026-corregido
```

El destino **no puede colgar del origen**, y el comando lo rechaza si lo
intentas: `rglob` volvería a encontrar los corregidos de la corrida anterior y
los trataría como originales, o sea correcciones sobre correcciones sin que
nadie se entere.

**Solo entra aquí lo que tiene un destino único y comprobable sin preguntarle a
nadie.** Las correcciones se declaran en `etl/corregir.py`, no se editan en el
Excel: cuando el almacén mande la siguiente versión se vuelve a correr y el diff
de `correcciones-aplicadas.csv` se lee.

Lo que entró en la Versión 2 de N3 (151 celdas):

| Qué | Cuántas |
|---|---|
| `Gabienete` → `Gabinete` (el propio ETL nombra el destino) | 74 |
| `SIN MARCA` → `Sin marca` | 42 |
| `presentacion` → `presentación`, sin acento | 10 |
| Erratas con destino único (`geado`→`grado`, 8 deletreos de `presentación`…) | 17 |
| Artículos partidos por puntuación o acento | 5 |
| `presentación250` → `presentación 250`, falta el espacio | 2 |
| Número guardado como texto | 1 |

En la Versión 1 fueron 140: `SIN MARCA` bajó de 43 a 42, y los dos últimos
renglones son de la revisión de septiembre. **Cada fila fijada volvió a caer en
el mismo número de fila que en agosto**, así que los pins de `filas=` seguían
siendo válidos; eso se comprueba, no se supone.

**El criterio para meter una errata aquí:** la palabra mal escrita aparece ≤3
veces y la correcta cientos. Si hay duda, no entra.

**Lo que NO entra, aunque el barrido lo marque.** El detector de erratas compara
por parecido y da falsos positivos que parecen buenos: `piseta` (es una piseta,
no una pipeta), `nitrito` (no es nitrato), `subnitrato`, `anhídrido`,
`tricloruro`. Las cinco son palabras reales. Corregirlas es inventar datos.

Tampoco entraron las cinco `. Presentación 500 g` de Reactivos. Ahí la
mayúscula **es correcta**: va después de un punto. Lo anómalo es el punto donde
el resto de la hoja pone coma, y cambiar un separador es decidir cómo se lee el
artículo. Eso lo resuelve la pantalla de depuración, no este archivo.

**Y cuidado con las erratas que son prefijo de la palabra buena.**
`resentación` está dentro de `presentación`, y `presentacio` dentro de
`presentacion`. Sin el `filas=` que las acota, la primera habría reescrito 1031
celdas buenas y la segunda habría dejado `presentaciónn` en diez. Por eso el
acotado por filas no es una optimización: es lo que hace que la corrección sea
correcta. Cuando agregues una errata corta, comprueba a mano contra cuántas
celdas casa en toda la hoja antes de fijarla.

**Y sobre todo: nada de fusión difusa de artículos.** En N3 había 100 pares de
nombres que difieren en 1-3 caracteres y son artículos **distintos**:
`presentación 10 g` vs `100 g`, `Jeringa de 1 mL` vs `10 mL`, `Anticuerpos A` /
`AB` / `B`. Solo se unifican los que quedan **idénticos** al quitar acentos,
mayúsculas y puntuación. Fuera de ahí, dos nombres parecidos son dos artículos.

`corregir.py` verifica celda por celda que el corregido difiera del original
**solo** en lo que dice su bitácora, y comprueba que sobrevivan las validaciones
de datos y las celdas combinadas. Si algo no cuadra, falla y no genera.

> **Dos artefactos de openpyxl al reescribir el libro.** Ninguno es un cambio de
> dato, los dos se toleran, y los dos se cuentan y se imprimen en su renglón de
> la verificación en vez de esconderse en la igualdad.
>
> *Ruido de coma flotante.* openpyxl serializa con `%.16g` y Excel guardaba 17
> cifras: `44.459999999999994` sale `44.45999999999999`. La deriva medida en N3
> fue de 4.1e-16 relativa.
>
> *Cadena vacía contra celda en blanco.* Excel las distingue; openpyxl colapsa
> la primera en la segunda. En la Versión 2 de N3 pasa una sola vez, en
> `Reactivos!I1066`, una marca vacía. La primera corrida de septiembre falló
> justo por esto, que es la señal de que el verificador hace su trabajo.

## 3. Cargar

```bash
python -m etl.cargar --origen etl/Datos-Reales-JD2026/corregido --almacen N3            # simulacro
python -m etl.cargar --origen etl/Datos-Reales-JD2026/corregido --almacen N3 --cargar   # de verdad
```

**`--hoja` carga solo unas clasificaciones.** Es repetible y valida el nombre
contra `ORDEN_HOJAS`, así que una pestaña mal escrita la rechaza `argparse` en
vez de cargar de menos en silencio. Sin la bandera entran todas las que traiga
el libro.

```bash
python -m etl.cargar --origen etl/Inventarios-JD2026 --almacen N3 \
  --hoja Reactivos --hoja Insumos --hoja Material --cargar
```

Hace falta porque el almacén entrega **el libro completo** aunque no dé por
buenas todas las pestañas a la vez: N3 cerró Reactivos, Insumos y Material en
septiembre y dejó Equipos y Electrónica para después. Filtrar aquí y no borrando
pestañas deja intacto el archivo del almacén. El filtro se aplica sobre la lista
**ya ordenada**, así que no toca `ORDEN × ORDEN_HOJAS` ni la reproducibilidad.

**El cargador no es todo-o-nada.** Lo válido entra a `existencia`; lo que
ninguna regla puede resolver aterriza en `public.carga_pendiente` con el renglón
crudo y el motivo, y lo revisa una persona en pantalla. Las dos escrituras van
en la misma transacción por hoja: un inventario cargado sin su lista de
pendientes es un inventario que se cree completo y no lo está.

**NO es idempotente fuera de Equipos, y es a propósito.** Cada renglón de
Reactivos, Insumos y Material es una existencia propia: el almacén maneja los
reactivos **por frasco**, así que 20 renglones del mismo reactivo en la misma
gaveta son 20 frascos físicos, no el mismo dato capturado 20 veces. Como no se
deduplica, el cargador no tiene forma de reconocer lo que ya cargó.

Por eso **se niega a cargar dos veces el mismo archivo-hoja**:

```
«Inventario final.xlsx · Reactivos» ya se cargó en N3. Fuera de Equipos cada
renglón es una existencia propia, así que volver a cargarlo duplicaría el
inventario. Para rehacerlo: psql "$DATABASE_URL" -f supabase/limpiar-inventario.sql
```

Sale con código 2 y no escribe nada. **Para recargar: limpiar primero.** En
local, `supabase db reset` hace lo mismo y de paso reaplica las migraciones.

Equipos sí sigue deduplicando, por la regla 10: cada equipo físico lleva su
número de serie, así que un renglón repetido ahí sí es el mismo objeto.

Un pendiente ya revisado **sobrevive** a un re-upsert: el `on conflict` refresca
el renglón y los problemas, pero no toca `estado`, `nota` ni `revisado_por`.

## 4. Comprobar que cuadra

El invariante, y es el que hay que mirar siempre:

```sql
select c.hoja, c.filas,
       (select count(*) from public.existencia e where e.carga_id = c.id) as existencias,
       (select count(*) from public.carga_pendiente p where p.carga_id = c.id) as pendientes,
       c.filas = (select count(*) from public.existencia e where e.carga_id = c.id)
               + (select count(*) from public.carga_pendiente p where p.carga_id = c.id) as cuadra
  from public.carga c order by c.hoja;
```

`carga.filas` son los renglones que traía la hoja. **Existencias + pendientes
tiene que dar ese número, en las tres columnas.** Si no cuadra, algo se perdió
en silencio y hay que averiguar qué antes de seguir.

Lo demás que conviene mirar, en `supabase/revisar-carga.sql`. Y estas cuatro:

```sql
-- 1. cantidades: la existencia contra sus movimientos
select count(*) from (
  select e.id from public.existencia e
   where e.cantidad <> coalesce((select sum(m.cantidad) from public.movimiento m
                                  where m.existencia_id = e.id), 0)) t;   -- 0

-- 2. ningún artículo con dos unidades
select count(*) from (select nombre_canonico from public.articulo
  group by 1 having count(distinct unidad_base) > 1) t;                   -- 0

-- 3. los posibles duplicados apuntan de verdad a con qué chocaron
select count(*) from public.carga_pendiente
 where motivo = 'posible_duplicado' and existencia_id is null;            -- 0

-- 4. nada suelto
select count(*) from public.existencia
 where articulo_id is null or carga_id is null or codigo is null;         -- 0
```

## 5. Empezar de cero

```bash
supabase db reset    # migraciones + seed, sin un solo renglón de inventario
```

Para el remoto no hay reset: `supabase/limpiar-inventario.sql` borra lo que
escribe el cargador y conserva catálogos y usuarios.

---

## Las trampas que ya nos costaron

**El encabezado sin llenar tumbaba las tres hojas.** El formato trae la fecha
como `___/___/______` y los almacenes la entregan así. Eso tiene barras, así que
`_fecha()` partía feliz y mandaba `'______-___-___'` a `carga.actualizado_el`,
que es `date`. Postgres abortaba la transacción de la hoja entera. Arreglado: si
las partes no son dígitos, devuelve `None`. **La lección es más general: un dato
de encabezado que no valida no debe poder tirar 1081 renglones de inventario.**

**Un archivo por almacén, no por hoja.** Los ejemplos sintéticos eran
`N3-Reactivos.xlsx`; los almacenes mandan un libro con varias hojas y el nombre
que se les ocurra. `formato.leer_libro()` lee eso, y el almacén sale del nombre
del archivo (`N3.xlsx`) o de su carpeta (`Almacén-Nivel-3/`, mapa explícito en
`formato.CARPETAS`). **Si añades un almacén con carpeta nueva, agrégala a ese
mapa** o el cargador no sabrá de quién es el archivo.

Ya pasó: la entrega de septiembre venía en `Almacen-N3/` y el mapa solo conocía
`almacen-nivel-3`, así que `almacen_de()` lanzaba `ArchivoIlegible` y no se leía
nada. Ahora el mapa acepta las dos formas —`almacen-nivel-3` y `almacen-n3`—
para los cuatro almacenes. Falla ruidosamente, que es lo correcto: el castigo de
adivinar mal es cargar el inventario de un almacén en la ficha de otro sin un
solo error.

**El orden de carga no es cosmético.** `articulo` es global, así que qué renglón
crea el artículo y cuál lo reutiliza depende del orden. Va fijo por
`ORDEN × ORDEN_HOJAS`, nunca por el orden del sistema de archivos ni por cómo el
encargado ordenó sus pestañas. Cambiarlo hace la migración irreproducible.

**Un reactivo repetido es otro frasco, no un duplicado.** Esta costó dos vueltas
y es la lección más cara del archivo de N3.

La llave natural de una existencia era *(articulo, almacen, ubicacion, marca,
presentacion)*, y N3 traía 20 renglones de Ergosterol en la misma gaveta, misma
marca, misma presentación, cada uno con su peso. El cargador los colapsaba en
uno: **entraba el primero y los otros 19 desaparecían sin un solo error**, con
sus cantidades. Se apartaron como `posible_duplicado` para preguntarlo, y la
respuesta del almacén fue que **es intencional: los reactivos se manejan por
frasco y cada renglón es un frasco físico**.

Así que fuera de Equipos ya no se deduplica nada. Los 217 renglones de Reactivos
que se apartaban ahora entran: N3 pasó de 1278 existencias a 1502, y los
pendientes de 337 a 113.

**Lo que hay que preguntarle a cada almacén antes de migrar:** si los renglones
repetidos son objetos distintos o captura duplicada. Para reactivos la respuesta
de N3 es «frascos distintos». Para cristalería no está claro —N3 traía «pipeta
graduada de 1 mL» dos veces en la misma ubicación, con 104 y con 27— y eso lo
resuelve el almacén en su archivo, no el cargador adivinando.

**Los CAS con dígito verificador inválido no los detecta el cargador.** El CAS
lleva checksum y en N3 fallaba en 29 de 752. El regex solo comprueba la forma,
no el dígito. Ej.: ácido sulfúrico decía `7674-93-9` y el real es `7664-93-9`;
acrilamida decía `76-06-1`, que es cloropicrina. **Vale la pena correr la
verificación del checksum sobre cada archivo nuevo** — la detección es
aritmética y no falla; el valor correcto se compara con la etiqueta del frasco.

**Y una de método:** el cuadre por hoja se comprueba con
`existencias + pendientes`, no con `carga.filas + pendientes`. Un renglón válido
puede acabar apartado por chocar en la llave natural, y en esa suma sale contado
dos veces. Nos dio 1298 donde el archivo tenía 1081.
