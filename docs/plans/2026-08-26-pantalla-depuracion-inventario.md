# Pantalla de depuración de inventario — Plan

> **Estado: entregado.** La tabla existe, el cargador la llena, N3 está cargado
> en local con sus 113 renglones por revisar, la función que los mete al
> inventario está escrita y la pantalla que los recorre también.
>
> **Al 28 de agosto**, a la espera del archivo corregido de N3. La migración al
> Supabase remoto está detenida a propósito: nada se ha empujado todavía.

**Objetivo:** que el responsable de cada almacén recorra los renglones que el
cargador no pudo resolver, uno por uno, con casilla de revisado, y complete o
corrija el dato que falta. Es la contraparte humana del ETL: el cargador decide
lo que se puede decidir sin preguntar, y todo lo demás aterriza aquí.

## Lo que ya está hecho (26 de agosto de 2026)

**`public.carga_pendiente`** — migración `20260826120000_carga_pendiente.sql`.
Una fila por renglón de Excel que no entró, con el renglón crudo en `renglon`,
las reglas que violó en `problemas`, y `estado` / `nota` / `revisado_por` para
la revisión. `revisado_por` lo pone un trigger, no el cliente: es la firma de
quien dio el visto bueno. Ocho pruebas de RLS en `rls.test.sql` (43-50).

**El cargador ya no es todo-o-nada.** `validar()` devuelve un `Resultado` con lo
válido y lo apartado; `escribir_hoja()` escribe las dos cosas en la misma
transacción. Un inventario cargado sin su lista de pendientes es un inventario
que se cree completo y no lo está, así que o entran las dos o ninguna.

**El lector acepta un libro por almacén.** `formato.leer_libro()`. Los archivos
reales llegan como `Almacén-Nivel-3/Inventario final.xlsx`, no como
`N3-Reactivos.xlsx`, y con el lector viejo no se podían ni abrir.

**N3 está cargado en local:**

```
1502 existencias        1157 artículos      302 ubicaciones     3 cargas
 113 pendientes, todos por una regla de captura sin resolver
----
1615 = los 1615 renglones del archivo, ni uno perdido
```

## Lo que la pantalla tiene que resolver

Los 113 de N3, repartidos así:

| Motivo | Renglones | Qué le falta al dato |
|---|---|---|
| Unidad de empaque (`caja`, `paquete`, `kit`…) | 88 | Cuántas piezas trae cada empaque |
| Mismo artículo en dos unidades (g y mL, kg y g) | 17 | Si ese frasco se pesó o se midió |
| Peso lleno ≤ peso vacío | 8 | Volver a pesar; 7 dan cantidad negativa |

Por hoja: Reactivos 236, Material 65, Insumos 36.

Y tres cosas más que no salieron como pendientes pero necesitan la misma
pantalla, porque son el mismo tipo de trabajo:

- **314 reactivos sin CAS.** Búsqueda por sustancia.
- **29 CAS con dígito verificador inválido.** La detección es aritmética; el
  valor correcto se compara con la etiqueta del frasco. Ej.: ácido sulfúrico
  dice `7674-93-9` y el real es `7664-93-9`; acrilamida dice `76-06-1`, que es
  cloropicrina.
- **3 renglones «Equipo» en la hoja Material.** Necesitan serie e inventario
  UAEH. En uno de ellos el propio almacén ya escribió `Por revisar (Equipo?)`
  en la especificación.

## Resuelto: un reactivo repetido es otro frasco

**28 de agosto de 2026.** Se preguntó al almacén y la respuesta cierra el tema:
los reactivos repetidos son intencionales, porque **se manejan por frasco**.
Cada renglón es un frasco físico con su propio peso; los 20 Ergosterol de la
misma gaveta son 20 frascos de verdad.

Así que fuera de Equipos ya no se deduplica: cada renglón es una existencia.
N3 pasó de 1278 existencias a **1502**, y de 337 pendientes a **113**. El motivo
`posible_duplicado` ya no lo produce nadie.

Lo que eso cuesta: el cargador pierde su forma de reconocer un renglón ya
cargado y **deja de ser idempotente**. Se descartó añadir un discriminador a la
llave —migración, y `/inventario` tendría que agrupar— a favor de **limpiar y
recargar**, con un seguro en `escribir_hoja()` que se niega a cargar dos veces
el mismo archivo-hoja en vez de duplicar el inventario en silencio.

Equipos sigue deduplicando por serie: ahí la regla 10 sí exige un renglón por
equipo físico.

**Queda abierto para cristalería.** N3 traía «pipeta graduada de 1 mL» dos veces
en la misma ubicación, con 104 y con 27. Eso no son frascos y no está claro si
se suman. El almacén lo resuelve en su archivo corregido, no el cargador.

## La pantalla: hecha

Ruta propia `/inventario/depuracion`, no pestaña. Las tres razones: es otro
trabajo (revisar y corregir, no consultar), sale de otra tabla, y sobre todo es
**enlazable** — «ve a depurar tus 113» tiene que poder ser un enlace, no una
instruccion de donde hacer clic. Cuelga de `/inventario` para que la migaja diga
de donde viene y la barra lateral siga marcando Inventario. El punto de entrada
es un boton «Depurar N» en la cabecera de `/inventario`, que solo aparece si
queda algo: es el unico aviso de que ese inventario no esta completo.

- **La lista** sale de `carga_pendiente` filtrada por `almacen_id` y `estado`,
  que es exactamente el indice `carga_pendiente_almacen_estado_idx`. Pagina con
  `range()` y `count: 'exact'`, 25 a la vez, igual que `PaginaInventario`.
  Ordena por archivo, hoja y fila —el orden del Excel, que es como se trabaja
  con el archivo abierto al lado— con `id` de desempate para que dos paginas
  consecutivas no repitan ni se salten un renglon.
- **Cada renglon** pinta el `renglon` completo en controles editables, uno por
  columna de su hoja. La lista de campos sale del propio renglon: ni un
  condicional por hoja ni por almacen, la misma propiedad que hace que el
  formulario de alta se arme desde la base.
- **Para `posible_duplicado`** se pintan los dos lado a lado y aparece un boton
  mas, «Es la misma: suma a N3-00015». Ese camino quedo SIN USO el 28 de agosto:
  el cargador ya no produce ese motivo. Se conserva porque el veredicto
  `duplicado` de `resolver_pendiente()` sigue siendo valido y la cristaleria
  puede necesitarlo; si al final no, se quita con su columna y su enum.
- **Escribir** solo toca `renglon`, `estado` y `nota`. `revisado_por` lo pone el
  trigger.
- **Sin dependencias nuevas.** MUI 9, TanStack Query, react-hook-form + zod.

Archivos: `PaginaDepuracion.tsx` (la unica que habla con Query),
`TablaPendientes.tsx`, `PanelPendiente.tsx`, `FiltrosDepuracion.tsx`,
`ResumenDepuracion.tsx` y `pendientes.ts` con su `.test.ts`.

## Resuelto: que pasa al dar el visto bueno

`public.resolver_pendiente(p_pendiente, p_renglon, p_veredicto, p_nota)`, en la
migracion `20260826130000_resolver_pendiente.sql`. Recibe el renglon ya
corregido, crea la existencia y cierra el pendiente, todo en una transaccion.
Tres promesas, cada una con su prueba en `rls.test.sql` (53-62):

1. **La cantidad entra por `movimiento`, tipo `carga_inicial`.** Nunca se
   escribe `existencia.cantidad`: la mantiene el trigger.
2. **SECURITY INVOKER.** La RLS de `existencia`, `movimiento`, `ubicacion` y
   `articulo` se aplica igual que si la pantalla hiciera los INSERT por su
   cuenta. Un responsable de N3 no resuelve un pendiente de N4 aunque sepa su id.
3. **Idempotente.** Un doble clic, un reintento de red o dos pestañas abiertas
   sobre el mismo renglon devuelven la misma existencia y no crean otra.

Dos veredictos y no tres: `nueva` crea su propia existencia, `duplicado` le suma
la cantidad a la que choco. La tercera salida —no debe cargarse— no es un
veredicto, es `estado = 'descartado'`, un UPDATE normal que no toca el
inventario.

**El candado.** `carga_pendiente` gana la columna `existencia_resuelta_id` (en
que se convirtio el renglon; NO es `existencia_id`, que es con cual choco) y el
check `estado <> 'resuelto' or existencia_resuelta_id is not null`. Esa columna
queda fuera del `grant update` por columnas, asi que `resuelto` solo se puede
alcanzar pasando por la funcion. Sin el candado, el cliente seguia pudiendo
`update carga_pendiente set estado = 'resuelto'` a secas y volviamos al punto de
partida: los renglones revisados y el inventario intacto.

**Dos formas del renglon.** `posible_duplicado` guarda el renglon ya
normalizado; `regla` lo guarda CRUDO, tal como venia («Sin marca», «—», «Grado
2: Riesgo moderado», «Si»). La funcion lee los vocabularios que el propio
esquema fija —las formas de decir «no tiene», los seis colores, los tres estados
fisicos, los grados 0-4— y NADA de lo que hace `etl/rules/normalizar.py`: si el
renglon esta ahi es porque el cargador no pudo terminarlo. Lo que no reconoce se
queda en NULL en vez de detener la revision; lo que si la detiene es un numero o
una fecha ilegibles, porque de ahi sale el saldo.

**De paso.** `articulo_reactivo` no tenia politica de alta —su gemela
`articulo_biologico` si—, asi que un responsable podia crear un reactivo pero no
su ficha NOM. No se notaba porque el unico que la llenaba era el cargador, que
corre con la llave de servicio. Se agrego `articulo_reactivo_alta` con sus dos
pruebas (51-52).

**Ojo con el cuadre de `carga.filas`.** Cambia de forma: era existencias +
pendientes, y pasa a ser existencias + pendientes sin resolver.

## Lo que NO va en esta pantalla

Lo determinista se resuelve antes, en `etl/corregir.py`: erratas con destino
único, muebles mal escritos, números guardados como texto, artículos partidos
por un acento. En N3 fueron 140 celdas. Si algo se puede decidir sin
preguntarle a nadie, va allá: esta pantalla cuesta tiempo de una persona que
conoce el almacén, y hay que reservarla para lo que de verdad lo necesita.

## Pendiente de confirmar con N3

- Faltan las hojas **Equipos** y **Materia biológica**. Sin Equipos, N3 no tiene
  ni un equipo registrado.
- El encabezado del formato (responsable, periodo, fecha) viene sin llenar en
  las tres hojas. El cargador ya no se cae por eso —`_fecha()` devuelve `None`
  en vez de una fecha inválida— pero `carga` queda sin saber de quién ni de
  cuándo es el archivo.
