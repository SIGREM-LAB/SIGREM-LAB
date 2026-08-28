# Migrar el inventario de un almacén

Procedimiento probado con N3 el 26 de agosto de 2026: 1615 renglones, de los
cuales 1278 quedaron cargados y 337 esperando revisión humana. Ni uno perdido.

Los otros tres almacenes se migran igual. Lo que sigue es el orden, qué esperar
en cada paso, y las trampas que ya nos costaron una vez.

## 0. Antes de empezar

Los Excel reales **no van a git** (`.gitignore` ignora `etl/Datos-Reales-JD2026/`).
Son binarios que git no sabe diferenciar y datos institucionales de la UCL.

```
etl/Datos-Reales-JD2026/
  original/Almacén-Nivel-3/Inventario final.xlsx    ← intocable
  corregido/Almacén-Nivel-3/Inventario final.xlsx   ← generado
                            correcciones-aplicadas.csv
```

El original **nunca se edita**. Ni para arreglar una falta de ortografía.

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
   entregaba.
2. **Rechazos por regla.** Son los que necesitan a una persona.
3. **Normalizados.** Los arregla el cargador solo; se leen para confirmar que no
   está «arreglando» algo que en realidad estaba bien.

## 2. Corregir lo determinista

```bash
python -m etl.corregir              # regenera corregido/ desde original/
python -m etl.corregir --verificar  # solo comprueba lo ya generado
```

**Solo entra aquí lo que tiene un destino único y comprobable sin preguntarle a
nadie.** Las correcciones se declaran en `etl/corregir.py`, no se editan en el
Excel: cuando el almacén mande la siguiente versión se vuelve a correr y el diff
de `correcciones-aplicadas.csv` se lee.

Lo que entró en N3 (140 celdas):

| Qué | Cuántas |
|---|---|
| `Gabienete` → `Gabinete` (el propio ETL nombra el destino) | 74 |
| `SIN MARCA` → `Sin marca` | 43 |
| Erratas con destino único (`geado`→`grado`, 8 deletreos de `presentación`…) | 17 |
| Artículos partidos por puntuación o acento | 5 |
| Número guardado como texto | 1 |

**El criterio para meter una errata aquí:** la palabra mal escrita aparece ≤3
veces y la correcta cientos. Si hay duda, no entra.

**Lo que NO entra, aunque el barrido lo marque.** El detector de erratas compara
por parecido y da falsos positivos que parecen buenos: `piseta` (es una piseta,
no una pipeta), `nitrito` (no es nitrato), `subnitrato`, `anhídrido`,
`tricloruro`. Las cinco son palabras reales. Corregirlas es inventar datos.

**Y sobre todo: nada de fusión difusa de artículos.** En N3 había 100 pares de
nombres que difieren en 1-3 caracteres y son artículos **distintos**:
`presentación 10 g` vs `100 g`, `Jeringa de 1 mL` vs `10 mL`, `Anticuerpos A` /
`AB` / `B`. Solo se unifican los que quedan **idénticos** al quitar acentos,
mayúsculas y puntuación. Fuera de ahí, dos nombres parecidos son dos artículos.

`corregir.py` verifica celda por celda que el corregido difiera del original
**solo** en lo que dice su bitácora, y comprueba que sobrevivan las validaciones
de datos y las celdas combinadas. Si algo no cuadra, falla y no genera.

> **Ruido de coma flotante.** openpyxl serializa con `%.16g` y Excel guardaba 17
> cifras: `44.459999999999994` sale `44.45999999999999`. La deriva medida en N3
> fue de 4.1e-16 relativa. Se tolera pero se mide y se reporta; no se esconde.

## 3. Cargar

```bash
python -m etl.cargar --origen etl/Datos-Reales-JD2026/corregido --almacen N3            # simulacro
python -m etl.cargar --origen etl/Datos-Reales-JD2026/corregido --almacen N3 --cargar   # de verdad
```

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
