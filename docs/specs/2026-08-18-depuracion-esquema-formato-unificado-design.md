# Depuracion del esquema contra el formato unificado de inventarios

**Fecha:** 18 de agosto de 2026
**Estado:** disenio aprobado, pendiente de plan de implementacion
**Sustituye a:** `2026-08-12-inventarios-ucl-datos-y-esquema-design.md` en todo lo que se contradiga
**Postgres:** 17 (`supabase/config.toml`)

---

## 1 · Por que esta depuracion

El esquema actual (7 migraciones, 1,248 lineas) se disenio en agosto contra los
**10 Excel historicos**, columna por columna, con todas sus mananas: pesos
invertidos entre N3 y LUM, la columna `Almacen` con `'4'` y `'N1-1'`, seis
columnas de existencias de semestres pasados, colores pintados en la celda pero
sin texto.

Desde entonces cambiaron dos cosas que invalidan parte de ese disenio:

1. **Existe un formato unificado** (`Notas-almacenes/3-Ejemplos/Formato-unificado-inventarios.xlsx`):
   6 hojas — Reactivos, Insumos, Material, Equipos, Materia biologica,
   Electronica — mas 13 reglas de captura. Los almacenes van a entregar en ese
   formato, no en sus archivos viejos. Las defensas contra el texto sucio ya no
   protegen nada: protegen contra un formato que no se va a volver a usar.

2. **No se cargan existencias historicas.** Se arranca con los datos de hoy. El
   estado `por_confirmar` — "migrada del Excel, sin conteo fisico todavia" —
   deja de tener sentido: la carga *es* el conteo inicial.

Y hay un tercer hueco, que no es nuevo pero sigue abierto: el prototipo
(`prototipo/`) llama a **Practicas** "el modulo principal del sistema", y en la
base no existe. `movimiento.practica_id` es un `bigint` huerfano, sin llave
foranea ni tabla del otro lado.

---

## 2 · Decisiones tomadas

Resueltas con Daniel Gonzalez el 18 de agosto de 2026:

| # | Decision | Resuelto |
|---|---|---|
| D1 | La columna **Sub-ubicacion** es parte de la ubicacion, no un sub-almacen | Se quitan `almacen.padre_id` y la tabla `almacen_alias`. El almacen lo define el nombre del archivo (Nivel 1 del Leeme) |
| D2 | `fecha_caducidad`, `fecha_adquisicion` y `cantidad_minima` **se quedan**, aunque no vengan en el formato | Se capturan en la app. La caducidad es informativa y **nunca** toca `estado` |
| D3 | El modulo de **Practicas entra ahora** | Tablas nuevas + `movimiento.practica_id` por fin con FK |
| D4 | `uso_principal`, `zona_riesgo` y `personas_expuestas` **se quedan en `almacen`** | Constantes por almacen; el exportador NOM las reinyecta por renglon |
| D5 | Hay reactivos caducados hace anios que **siguen sirviendo** y se usan en practicas. No se agrega ninguna columna para registrar la aprobacion | El historial de `movimiento` es la evidencia de que se siguio usando |

### D2 y D5 en detalle, porque es el punto mas facil de arruinar

Si la caducidad se modela como un estado (`estado = 'caducado'`), el sistema
empieza a bloquear u ocultar frascos que la gente si usa. A los dos meses los
responsables aprenden a ignorar la alerta o a borrar la fecha, y la columna
queda peor que vacia: queda mintiendo.

**La regla es:** un reactivo caducado sigue `disponible`. Lo caducado se
**deriva** (`fecha_caducidad < current_date`), se pinta como etiqueta en la
pantalla y no esconde nada. Si el responsable decide que ya no sirve, eso ya se
registra con lo que hay: un `movimiento` de tipo `baja` con su `motivo`.

`fecha_adquisicion` gana valor con este dato, no lo pierde: en frascos viejos la
etiqueta de caducidad suele estar ilegible o no existir, y la fecha de
adquisicion es lo unico que dice si algo tiene 3 anios o 20.

---

## 3 · Estrategia de aplicacion: se reescribe el baseline

Las 7 migraciones actuales se **reemplazan** por un juego nuevo y coherente, en
vez de agregar dos migraciones de parche encima.

Esto contradice la regla de `CLAUDE.md` ("una migracion ya aplicada no se edita:
se agrega otra"), y quiero dejar por escrito por que aqui es legitimo y cuando
deja de serlo.

**Por que ahora si:**

- **Cero registros cargados.** No hay dato que perder.
- **El proyecto remoto existe pero esta vacio.** Hay proyecto en Supabase cloud y
  la app esta desplegada en Vercel contra el, pero **nunca se corrio
  `supabase db push`**: el esquema no esta aplicado alla y no hay usuarios ni
  datos capturados (confirmado el 18 de agosto de 2026). El CLI local tampoco
  esta vinculado — no existe `supabase/.temp/project-ref` —, asi que no hay
  historial de migraciones remoto que cuadrar. La unica forma en que el esquema
  se ha aplicado hasta hoy es `supabase db reset` en local.
- La regla existe para **proteger datos en produccion**. Hay despliegue, pero
  todavia no hay produccion: nadie ha capturado nada contra esa base.
- La historia no se pierde: vive en git (`1295949`, `83e47f3`).
- El costo de no hacerlo es concreto: el esquema real quedaria repartido en 9
  archivos que se contradicen — la migracion 6 agrega `partida` y la 8 la quita,
  la 5 crea `almacen_alias` y la 8 la borra. Quien abra el repo en noviembre
  tendria que reconstruir el estado leyendo nueve archivos en orden.
- Y hay un obstaculo tecnico real: **Postgres no tiene `alter type ... drop
  value`**. Quitar `por_confirmar` del enum por parche obliga a recrear el tipo y
  reescribir las columnas que lo usan. Hecho de un jalon en el baseline es una
  linea; hecho por parche son cuarenta y frágiles.

**Cuando deja de ser legitimo:** el primer `supabase db push` al proyecto remoto.
Desde ese momento existe un historial de migraciones fuera de esta maquina, y
reescribir el baseline obligaria a resetear una base que ya no es solo nuestra. A
partir de ahi la regla vuelve a ser intocable. Esto se anota en `CLAUDE.md` como
excepcion de una sola vez, con fecha, para que no se vuelva costumbre.

**Consecuencia para el plan:** el baseline nuevo se aplica primero en local
(`supabase db reset`), se verifica completo, y solo entonces se vincula el CLI y
se hace el primer `db push` al remoto. Ese push es el punto de no retorno.

### Archivos resultantes

```
supabase/migrations/
  20260818120000_base.sql          extensiones, private, norm_texto, enums
  20260818120100_organizacion.sql  almacen, laboratorio, perfil, helpers RLS
  20260818120200_catalogo.sql      articulo, alias, reactivo, biologico, buscar_articulo
  20260818120300_inventario.sql    ubicacion, existencia, carga, movimiento, triggers
  20260818120400_practica.sql      programa, asignatura, practica, elemento, observacion
  20260818120500_captura.sql       campo_capturable, perfil_captura, perfil_campo, formulario()
  20260818120600_rls.sql           todas las politicas
supabase/seed.sql                  reescrito
```

Se borran las 7 migraciones `202608121*`.

---

## 4 · El esquema

### 4.1 Enums (`base.sql`)

```sql
create type public.rol_usuario as enum ('admin','responsable','consulta');

-- +materia_biologica: una clasificacion por hoja del formato
create type public.clasificacion_articulo as enum (
  'reactivo','material','insumo','equipo','componente','materia_biologica');

create type public.estado_fisico as enum ('solido','liquido','gas');

-- -por_confirmar: la carga de hoy ES el conteo inicial
create type public.estado_existencia as enum (
  'disponible','stock_bajo','agotado','contaminado','mantenimiento','baja');

-- +carga_inicial al frente: sin el, el primer reporte de consumo cuenta la
-- carga de arranque como compra del mes
create type public.tipo_movimiento as enum (
  'carga_inicial','entrada','consumo','merma','ajuste_conteo',
  'prestamo','devolucion','baja');

create type public.origen_alias as enum ('migracion','busqueda','fusion');

-- NUEVO. Regla 12 del formato: los colores de almacenaje son seis.
-- "NO TOXICO" no es un color; los 143 renglones de N3 que lo dicen pasan a verde.
create type public.color_almacenaje as enum (
  'verde','rojo','azul','blanco','amarillo','naranja');

-- NUEVO. Solo los dos valores que trae la columna Funcionamiento del formato.
-- Agregar valores a un enum es una linea; quitarlos no se puede.
create type public.funcionamiento_equipo as enum ('correcto','presenta_fallas');

-- NUEVO. Los tres metodos de control del prototipo.
create type public.metodo_control as enum ('peso','cantidad','prestamo');
```

`funcionamiento` va **aparte** de `estado`, no dentro. Son dos ejes distintos: un
equipo puede estar `presenta_fallas` y seguir `disponible` para practicas —
exactamente el mismo razonamiento de D5 con los reactivos caducados. Meterlos en
un solo enum obliga a elegir entre "esta roto" y "se puede usar", y en este
dominio las dos cosas son ciertas a la vez.

### 4.2 Organizacion (`organizacion.sql`)

`almacen` conserva `clave`, `nombre`, `activo`, `uso_principal`, `zona_riesgo`,
`personas_expuestas`, `creado_en`.

**Se va `padre_id`** (D1) y **se va la tabla `almacen_alias` completa**: existia
para mapear el texto sucio de la columna `Almacen` (`'4'`, `'n4'`, `'N1-1'`,
`'LE-LUM-UCL'`) al almacen canonico. En el formato unificado el almacen lo dice
el nombre del archivo, y la sub-ubicacion es un valor de ubicacion. No queda
texto sucio que mapear.

`laboratorio` gana una llave candidata que habilita la seccion 4.4:

```sql
create table public.laboratorio (
  id         bigint generated always as identity primary key,
  almacen_id bigint  not null references public.almacen (id),
  nombre     text    not null,
  activo     boolean not null default true,
  unique (almacen_id, nombre),
  -- Redundante con la PK a primera vista, pero es lo que permite la FK
  -- compuesta de existencia. Sin esto no hay forma declarativa de exigir que
  -- el laboratorio de una existencia pertenezca a su mismo almacen.
  unique (id, almacen_id)
);
```

`perfil` no cambia. Los helpers de RLS (`private.almacen_actual()`,
`rol_actual()`, `es_admin()`, `puede_escribir()`) no cambian: `stable`,
`security definer`, `set search_path = ''`, en el esquema `private`, con
`revoke` para `anon`.

### 4.3 Catalogo (`catalogo.sql`)

```sql
create table public.articulo (
  id              bigint generated always as identity primary key,
  nombre_canonico text not null,          -- columna "Articulo" / "Sustancia quimica"
  descripcion     text,                   -- columna "Especificacion"
  clasificacion   public.clasificacion_articulo not null,
  unidad_base     text not null,
  familia         text,                   -- solo Electronica: 26 valores
  verificado      boolean not null default false,
  creado_por      uuid references public.perfil (id),
  creado_en       timestamptz not null default now(),

  -- El formato separa Articulo + Especificacion. Ese par, mas la unidad, ES el
  -- articulo: "Matraz volumetrico"+"1000 mL clase A" es otra cosa que
  -- "Matraz volumetrico"+"250 mL forma baja".
  --
  -- `nulls not distinct` (PG15+) es la parte que importa: sin el, dos filas con
  -- especificacion vacia se cuelan como distintas y el catalogo se duplica solo.
  constraint articulo_identidad
    unique nulls not distinct (nombre_canonico, descripcion, unidad_base)
);
```

`articulo_alias` no cambia. Sigue siendo la maquinaria de
`buscar_articulo()` y lo que permite re-correr la carga sin perder el trabajo
humano de decidir que es que.

```sql
create table public.articulo_reactivo (
  articulo_id             bigint primary key
                          references public.articulo (id) on delete cascade,

  -- NUEVO. Viene enterrado en la cadena larga:
  -- "1,10-Fenantrolina monohidrato, solido, pureza 99%, ..., CAS: 5144-89-8"
  cas                     text,

  estado_fisico           public.estado_fisico,
  color_almacenaje        public.color_almacenaje,   -- era text
  tiene_hoja_seguridad    boolean,                   -- era requiere_hoja_seguridad
  caracteristica_quimica  text,
  caracteristica_toxica   text,
  riesgo_salud            smallint check (riesgo_salud          between 0 and 4),
  riesgo_inflamabilidad   smallint check (riesgo_inflamabilidad between 0 and 4),
  riesgo_reactividad      smallint check (riesgo_reactividad    between 0 and 4),
  peligro_especial        text,
  implica_actividad_peligro boolean
);

-- Indice normal, NO unique. El CAS identifica el compuesto, no el grado: el
-- propio esquema define que "Zinc en polvo 95%" y "Zinc en polvo 93%" son dos
-- articulos, y los dos son CAS 7440-66-6.
create index articulo_reactivo_cas_idx on public.articulo_reactivo (cas)
  where cas is not null;
```

**`tiene_hoja_seguridad`, no `requiere_hoja_seguridad`.** El formato pregunta
*"Existencia de hoja de seguridad"*: si la tienes, no si la necesitas. Con el
nombre viejo, un `false` es ambiguo entre "no la tenemos" y "no hace falta".

**Se van** `uso_principal` (duplicado con `almacen.uso_principal`, D4) y
`clasificacion_ghs` (no existe en el formato: nadie lo va a llenar).

```sql
-- NUEVO, 1:1 igual que articulo_reactivo.
create table public.articulo_biologico (
  articulo_id    bigint primary key
                 references public.articulo (id) on delete cascade,
  origen_especie text        -- "Zea mays", "Rattus norvegicus", "Aloe vera"
);
```

Una tabla de una columna es delgada, y es a proposito: `origen_especie` es el CAS
de las muestras y solo aplica a una de las seis clasificaciones. Colgarla de
`articulo` la dejaria nula en cinco de seis. El precedente es
`articulo_reactivo`, que empezo igual.

`buscar_articulo(termino, umbral, maximo)` no cambia.

### 4.4 Inventario (`inventario.sql`)

**Orden de creacion dentro del archivo:** `ubicacion` → `carga` → `existencia` →
`private.estado_calculado` → triggers → `movimiento`. Abajo se presenta
`existencia` antes de `carga` para que se lea de corrido, pero `carga` tiene que
existir antes por la FK.

```sql
create table public.ubicacion (
  id          bigint generated always as identity primary key,
  almacen_id  bigint not null references public.almacen (id),
  etiqueta    text   not null,
  componentes jsonb  not null default '{}'::jsonb,
  unique (almacen_id, etiqueta),
  unique (id, almacen_id)      -- para la FK compuesta de existencia
);
```

Las llaves de `componentes` pasan a ser las columnas del formato:

```json
{"sub_ubicacion":"LUM-2","mueble":"Anaquel 4","repisa":"2","fila_cajon":"3",
 "h":"2","v":"4","i":"1"}
```

**`anaquel` desaparece como llave.** El formato unifico a **Mueble**: "Anaquel 2"
es un *valor* de mueble, igual que "Gabinete 301", "Refrigerador", "Husky" o
"Separador 3". Tenerlo como columna aparte obligaba a decidir, por cada
almacen, si su mueble era "anaquel" o no.

`h`/`v`/`i` son la posicion dentro del mueble en Electronica.

```sql
create table public.existencia (
  id                     bigint generated always as identity primary key,
  articulo_id            bigint not null references public.articulo (id),
  almacen_id             bigint not null references public.almacen (id),
  ubicacion_id           bigint,
  laboratorio_id         bigint,                       -- NUEVO
  carga_id               bigint references public.carga (id),  -- NUEVO

  codigo                 text unique,                  -- lo que se imprime en el QR
  marca                  text,
  modelo                 text,
  presentacion           text,

  cantidad               numeric(14,4) not null default 0,   -- solo por trigger
  cantidad_minima        numeric(14,4),

  -- Reactivos que se pesan (LUM, N3). Regla 13: el vacio va ANTES que el lleno.
  -- N4 captura la cantidad directa y deja estos dos nulos.
  peso_frasco_vacio      numeric(14,4),
  peso_total             numeric(14,4),

  -- Equipos
  numero_serie           text,
  numero_inventario_uaeh text,
  funcionamiento         public.funcionamiento_equipo,  -- NUEVO
  mantenimiento          text,
  fecha_chequeo          date,

  -- Materia biologica (NUEVOS)
  metodo_conservacion    text,
  temperatura            text,      -- "4 °C", "Ambiente": condicion, no medicion
  fecha_recoleccion      date,
  fecha_preparacion      date,
  responsable_muestra    text,

  fecha_adquisicion      date,
  fecha_caducidad        date,
  estado                 public.estado_existencia not null default 'disponible',
  observaciones          text,
  creado_en              timestamptz not null default now(),

  constraint existencia_cantidad_no_negativa check (cantidad >= 0),
  constraint existencia_minimo_no_negativo
    check (cantidad_minima is null or cantidad_minima >= 0),
  constraint existencia_caducidad_posterior
    check (fecha_caducidad is null or fecha_adquisicion is null
           or fecha_caducidad >= fecha_adquisicion),
  constraint existencia_codigo_presente check (codigo is not null),

  -- Lo que hoy esta abierto: nada impide que una existencia de N3 apunte a un
  -- anaquel de N4. Con la FK compuesta es imposible por construccion, sin
  -- triggers ni validacion en la app.
  foreign key (ubicacion_id,   almacen_id) references public.ubicacion   (id, almacen_id),
  foreign key (laboratorio_id, almacen_id) references public.laboratorio (id, almacen_id)
);

-- Regla 10: la serie y el numero de inventario no se repiten entre renglones.
-- Hoy en N4 tres numeros de serie se repiten en 30 equipos y nada lo impide.
-- El ETL normaliza "Sin serie" / "Sin inventario" / "—" a NULL, que es lo que
-- hace que el indice parcial funcione.
create unique index existencia_numero_serie_uniq
  on public.existencia (numero_serie) where numero_serie is not null;
create unique index existencia_numero_inventario_uniq
  on public.existencia (numero_inventario_uaeh) where numero_inventario_uaeh is not null;

create index existencia_articulo_id_idx   on public.existencia (articulo_id);
create index existencia_almacen_id_idx    on public.existencia (almacen_id);
create index existencia_ubicacion_id_idx  on public.existencia (ubicacion_id);
create index existencia_laboratorio_idx   on public.existencia (laboratorio_id)
  where laboratorio_id is not null;
create index existencia_carga_id_idx      on public.existencia (carga_id);

create index existencia_por_atender_idx on public.existencia (almacen_id, estado)
  where estado in ('stock_bajo','agotado');

create index existencia_caducidad_idx on public.existencia (fecha_caducidad)
  where fecha_caducidad is not null;
```

**Se van** `partida` (es del catalogo institucional de compras, no del
inventario; ver seccion 9) y `revisado_por` (quien reviso ya lo dice
`movimiento.usuario_id`; un texto libre paralelo solo se contradice con la
bitacora).

`cantidad` **no** es columna generada a partir de los pesos, aunque para LUM y N3
salga de `peso_total - peso_frasco_vacio`: N4 la captura directa y deja los pesos
nulos. La resta la hace el ETL cuando los pesos estan presentes, y el resultado
se escribe via `movimiento` como cualquier otro saldo.

#### Estado calculado en un solo lugar

Hoy la logica de "que estado le toca a esta cantidad" vive dentro del trigger de
`movimiento`. Eso deja un hueco: una existencia insertada con cantidad 0 (regla
6: celda vacia significa cero) se queda en `disponible` porque ningun movimiento
corrio. Se extrae a una funcion y se usa en los dos triggers:

```sql
create or replace function private.estado_calculado(
  p_cantidad numeric,
  p_minimo   numeric,
  p_estado   public.estado_existencia
) returns public.estado_existencia
language sql immutable parallel safe set search_path = '' as $$
  select case
    -- Un estado puesto a mano manda sobre el calculado.
    when p_estado in ('contaminado','mantenimiento','baja') then p_estado
    when p_cantidad = 0 then 'agotado'::public.estado_existencia
    when p_minimo is not null and p_cantidad <= p_minimo
      then 'stock_bajo'::public.estado_existencia
    else 'disponible'::public.estado_existencia
  end
$$;
```

Nota que `fecha_caducidad` **no aparece** aqui. Es deliberado (D2/D5).

`private.asignar_codigo()` (trigger `before insert on existencia`) se extiende
para fijar tambien `estado` con esa funcion. El folio sigue siendo
`{clave}-{5 digitos}` con el contador en `private.folio_almacen`.

#### `carga`: de que archivo salio cada renglon

```sql
create table public.carga (
  id              bigint generated always as identity primary key,
  almacen_id      bigint not null references public.almacen (id),
  archivo         text   not null,
  hoja            text   not null,
  periodo         text,          -- encabezado "Periodo:"
  actualizado_el  date,          -- encabezado "Actualizado el:"
  responsable     text,          -- encabezado "Responsable:"
  filas           integer,
  cargado_por     uuid references public.perfil (id),
  cargado_en      timestamptz not null default now()
);
```

Cada hoja del formato trae Almacen / Responsable / Periodo / Actualizado el en el
encabezado, y hoy eso se tira. Una fila por archivo cargado: cuesta nada y es lo
que contesta "este numero salio de tal archivo, entregado tal dia, por tal
persona" cuando alguien lo reclame.

#### `movimiento`

Sin cambios estructurales salvo dos:

```sql
practica_id bigint,   -- antes: bigint suelto, y sigue sin FK EN ESTE ARCHIVO
```

La llave foranea a `practica` **no se puede declarar aqui**: `practica` se crea en
`practica.sql`, que va despues porque `practica_elemento` referencia
`existencia`. La dependencia es circular entre archivos, asi que la FK se agrega
al final de `practica.sql`:

```sql
alter table public.movimiento
  add constraint movimiento_practica_id_fkey
  foreign key (practica_id) references public.practica (id);
```

y el trigger `private.aplicar_movimiento()` usa `private.estado_calculado()` en
vez de su propio `case`. Todo lo demas se conserva: solo insercion, `for update`
para no perder movimientos concurrentes, `almacen_id`/`cantidad_antes`/
`cantidad_despues`/`usuario_id` escritos por el trigger y no por el cliente,
`before insert` para que el `with check` de la RLS vea el `almacen_id` correcto.

### 4.5 Practicas (`practica.sql`)

```sql
create table public.programa_educativo (
  id     bigint generated always as identity primary key,
  nombre text not null unique,
  activo boolean not null default true
);

create table public.asignatura (
  id                    bigint generated always as identity primary key,
  programa_educativo_id bigint references public.programa_educativo (id),
  nombre                text not null,
  activo                boolean not null default true,
  unique nulls not distinct (programa_educativo_id, nombre)
);

create table public.practica (
  id                    bigint generated always as identity primary key,
  folio                 text unique,       -- PRA-0001, lo pone el trigger
  programa_educativo_id bigint not null references public.programa_educativo (id),
  laboratorio_id        bigint not null references public.laboratorio (id),
  asignatura_id         bigint references public.asignatura (id),

  -- Desnormalizado a proposito, igual que en movimiento: la politica de RLS se
  -- evalua sin join. Lo escribe el trigger desde laboratorio_id, NO el cliente.
  almacen_id            bigint not null references public.almacen (id),

  fecha                 date not null default current_date,
  observaciones         text,              -- "descripcion adicional" del prototipo
  registrado_por        uuid not null references public.perfil (id),
  creado_en             timestamptz not null default now()
);

create index practica_almacen_fecha_idx on public.practica (almacen_id, fecha desc);
create index practica_laboratorio_idx   on public.practica (laboratorio_id);
create index practica_asignatura_idx    on public.practica (asignatura_id);
```

El folio (`PRA-0001`) es global, no por almacen, igual que en el prototipo. Un
contador propio en `private.folio_practica` (misma mecanica de
`private.folio_almacen`: `insert ... on conflict do update ... returning`, que es
lo que evita que dos capturas simultaneas saquen el mismo folio) y un
`before insert` que fija `folio`, `almacen_id` — leido de `laboratorio` — y
`registrado_por` desde `auth.uid()`.

#### Los checkboxes, como datos

El prototipo tiene nueve casillas: *No tenemos · Prestamo N4 · Prestamo N3 ·
Prestamo LUM · Contaminado · Se termino · Material daniado · Equipo daniado ·
Otro*.

```sql
create table public.motivo_observacion (
  clave    text primary key,      -- 'no_tenemos', 'prestamo_n3', ...
  etiqueta text not null,
  orden    integer not null,
  activo   boolean not null default true
);

create table public.practica_observacion (
  practica_id bigint not null references public.practica (id) on delete cascade,
  motivo      text   not null references public.motivo_observacion (clave),
  primary key (practica_id, motivo)
);
```

Nueve columnas booleanas serian mas cortas de escribir hoy y mas caras cada vez
que alguien quiera una decima casilla: migracion mas redespliegue del frontend.
Como catalogo, agregar un motivo es un `insert`. Es la misma decision que este
proyecto ya tomo con `campo_capturable`, y conviene que sea consistente.

#### `practica_elemento`

```sql
create table public.practica_elemento (
  id             bigint generated always as identity primary key,
  practica_id    bigint not null references public.practica (id) on delete cascade,
  existencia_id  bigint not null references public.existencia (id),

  -- Desnormalizado para RLS, escrito por el trigger desde existencia.
  almacen_id     bigint not null references public.almacen (id),

  metodo_control public.metodo_control not null,

  -- Reactivos: se pesa antes y despues
  peso_inicial   numeric(14,4),
  peso_final     numeric(14,4),
  consumo        numeric(14,4)
                 generated always as (peso_inicial - peso_final) stored,

  -- Materiales: se entrega y se devuelve
  cantidad_entregada numeric(14,4),
  cantidad_devuelta  numeric(14,4),
  cantidad_danada    numeric(14,4),
  perdidas       numeric(14,4) generated always as (
                   cantidad_entregada
                   - coalesce(cantidad_devuelta, 0)
                   - coalesce(cantidad_danada, 0)
                 ) stored,

  -- Equipos: se presta y se regresa
  estado_salida     public.funcionamiento_equipo,
  estado_devolucion public.funcionamiento_equipo,

  observaciones  text,

  constraint practica_elemento_peso_coherente
    check (peso_final is null or peso_inicial is null or peso_final <= peso_inicial),
  constraint practica_elemento_devolucion_coherente
    check (cantidad_entregada is null
           or coalesce(cantidad_devuelta,0) + coalesce(cantidad_danada,0)
              <= cantidad_entregada),

  -- Union discriminada: impide que un reactivo traiga estado_devolucion lleno,
  -- o que un equipo traiga pesos.
  constraint practica_elemento_campos_por_metodo check (
    case metodo_control
      when 'peso' then
        peso_inicial is not null and peso_final is not null
        and cantidad_entregada is null and cantidad_devuelta is null
        and cantidad_danada is null
        and estado_salida is null and estado_devolucion is null
      when 'cantidad' then
        cantidad_entregada is not null
        and peso_inicial is null and peso_final is null
        and estado_salida is null and estado_devolucion is null
      when 'prestamo' then
        estado_salida is not null
        and peso_inicial is null and peso_final is null
        and cantidad_entregada is null and cantidad_devuelta is null
        and cantidad_danada is null
    end
  )
);

create index practica_elemento_practica_idx   on public.practica_elemento (practica_id);
create index practica_elemento_existencia_idx on public.practica_elemento (existencia_id);
create index practica_elemento_almacen_idx    on public.practica_elemento (almacen_id);
```

**`consumo` y `perdidas` son columnas generadas, no cuentas del frontend.** El
bug que costo la semana del 11 de agosto fue una resta al reves que *no daba
error*: los pesos invertidos entre N3 y LUM. Una aritmetica que el frontend
calcula es una aritmetica que se puede equivocar en silencio; una columna
generada no.

### 4.6 La frontera entre `movimiento` y `practica_elemento`

Esto es lo que mas facil se enreda, asi que queda explicito:

| | `movimiento` | `practica_elemento` |
|---|---|---|
| Responde | **cuanto hay** | **quien uso que** |
| Se escribe | siempre que el saldo cambia | siempre que algo se usa en una practica |
| Lo lee | pantalla de existencias, alertas de reposicion | modulo de Reportes |

`practica_elemento` lleva **dos** triggers, y el orden importa:

1. `before insert` — fija `almacen_id` leyendolo de `existencia`. Tiene que ser
   `before` por lo mismo que en `movimiento`: el cliente no debe poder mandar el
   `almacen_id`, porque podria falsearlo para escribir en el almacen de otro, y
   el `with check` de la RLS tiene que ver ya el valor correcto.
2. `after insert` — inserta el `movimiento` que corresponda. Tiene que ser
   `after` porque necesita leer `consumo` y `perdidas`, que son columnas
   generadas y no existen todavia en `before`.

El movimiento que genera:

- **`peso`** → un `consumo` con `cantidad = -consumo`.
- **`cantidad`** → hasta dos filas: una `merma` con `-cantidad_danada` y un
  `consumo` con `-perdidas`, cada una solo si es distinta de cero. Se separan a
  proposito: tener dos columnas y luego sumarlas en una sola fila desperdicia la
  distincion que el formulario si captura.
- **`prestamo`** → **ningun movimiento**. Un equipo prestado y devuelto no cambia
  de cantidad, y una fila `-1`/`+1` seria historia inventada. Lo que si hace el
  trigger es actualizar `existencia.funcionamiento` con `estado_devolucion`
  cuando se registra la devolucion.

De ahi que el modulo de **Reportes** lea `practica_elemento`, no `movimiento`:
`movimiento` no ve los prestamos de equipo, porque no son cambios de saldo.

**Limite conocido de v1:** las casillas *Prestamo N3/N4/LUM* son observaciones,
no transacciones. Una practica de un laboratorio de N4 que pide prestado a N3 no
mueve el saldo de N3. Es exactamente lo que hace el prototipo hoy, y meterlo como
transaccion abre la pregunta de quien tiene permiso de descontar en el almacen
ajeno — que no es una decision de esquema, es una decision de los responsables.

### 4.7 Captura (`captura.sql`)

`campo_capturable` conserva su forma. Cambia el contenido: fuera `anaquel`,
`partida`, `revisado_por`; entran `mueble`, `fila_cajon`, `sub_ubicacion`,
`especificacion`, `cas`, `laboratorio`, `funcionamiento`, `origen_especie`,
`metodo_conservacion`, `temperatura`, `fecha_recoleccion`, `fecha_preparacion`,
`responsable_muestra`.

**`perfil_captura.almacen_id` pasa a nullable**, donde `NULL` significa "perfil
default para todos los almacenes" y una fila con almacen lo sobreescribe:

```sql
create table public.perfil_captura (
  id            bigint generated always as identity primary key,
  almacen_id    bigint references public.almacen (id),   -- NULL = default
  clasificacion public.clasificacion_articulo not null,
  nombre        text not null,
  notas         text,
  unique nulls not distinct (almacen_id, clasificacion)
);
```

Como el formato ya esta unificado, esto son **6 perfiles en el seed en vez de
24**, y dar de alta un quinto almacen no requiere ni una fila. El mecanismo por
almacen se conserva para el dia que uno diverja de verdad.

`formulario(p_almacen, p_clasificacion)` prefiere el perfil especifico del
almacen y cae al default:

```sql
with elegido as (
  select id from public.perfil_captura
  where clasificacion = p_clasificacion
    and (almacen_id = p_almacen or almacen_id is null)
  order by almacen_id nulls last   -- el especifico gana
  limit 1
)
select ... from elegido join public.perfil_campo ... order by orden
```

---

## 5 · Mapeo del formato al esquema

Una tabla por hoja. Todo lo no listado se ignora (`No.` es el consecutivo del
Excel; no se guarda).

### Reactivos (28 columnas)

| Columna del formato | Destino |
|---|---|
Sub-ubicacion | `ubicacion.componentes->>'sub_ubicacion'`
Anaquel | `ubicacion.componentes->>'mueble'`
Repisa / Fila | `componentes->>'repisa'` / `->>'fila_cajon'`
Clasificacion por color de almacenaje | `articulo_reactivo.color_almacenaje`
Existencia de hoja de seguridad | `articulo_reactivo.tiene_hoja_seguridad`
Sustancia quimica | `articulo.nombre_canonico` + `articulo_reactivo.cas` (extraido)
Marca / Presentacion | `existencia.marca` / `.presentacion`
Peso del frasco vacio / lleno | `existencia.peso_frasco_vacio` / `.peso_total`
Cantidad | `movimiento` tipo `carga_inicial` → `existencia.cantidad`
Unidad | valida contra `articulo.unidad_base` (ver seccion 6)
7.1-a Uso principal | `almacen.uso_principal` (D4)
Solido / Liquido / Gas | `articulo_reactivo.estado_fisico` (regla 11: uno solo)
Quimicas: caracteristica principal | `articulo_reactivo.caracteristica_quimica`
Toxicas: caracteristica principal | `articulo_reactivo.caracteristica_toxica`
Azul / Amarillo / Rojo | `riesgo_salud` / `riesgo_reactividad` / `riesgo_inflamabilidad`
Blanco: peligro especial | `articulo_reactivo.peligro_especial`
Su uso implica actividad peligrosa | `articulo_reactivo.implica_actividad_peligro`
Zona de riesgo / Personas expuestas | `almacen.zona_riesgo` / `.personas_expuestas` (D4)
Observaciones | `existencia.observaciones`

Los grados NFPA vienen como texto (`'Grado 2: Riesgo moderado'`) y el ETL los
normaliza a `0..4`.

### Insumos y Material (13 columnas, identicas entre si)

| Columna | Destino |
|---|---|
Clasificacion | `articulo.clasificacion` (`insumo` / `material`)
Articulo | `articulo.nombre_canonico`
Especificacion | `articulo.descripcion`
Marca / Cantidad / Unidad / Presentacion | como en Reactivos
Sub-ubicacion / Mueble / Repisa / Fila o cajon | `ubicacion.componentes`
Observaciones | `existencia.observaciones`

### Equipos (13 columnas)

| Columna | Destino |
|---|---|
Nombre | `articulo.nombre_canonico`, `clasificacion = 'equipo'`
Marca / Modelo | `existencia.marca` / `.modelo`
No. de serie | `existencia.numero_serie` (unique parcial)
No. de inventario UAEH | `existencia.numero_inventario_uaeh` (unique parcial)
Sub-ubicacion / Mueble o ubicacion | `ubicacion.componentes`
**Laboratorio** | `existencia.laboratorio_id`
**Funcionamiento** | `existencia.funcionamiento`
Fecha de ultimo chequeo | `existencia.fecha_chequeo`
Mantenimiento realizado | `existencia.mantenimiento`
Observaciones | `existencia.observaciones`

Regla 9: un renglon por equipo fisico → `cantidad = 1` siempre.

### Materia biologica (15 columnas)

| Columna | Destino |
|---|---|
Muestra | `articulo.nombre_canonico`, `clasificacion = 'materia_biologica'`
Origen o especie | `articulo_biologico.origen_especie`
Cantidad / Unidad / Presentacion | como en Reactivos
Metodo de conservacion | `existencia.metodo_conservacion`
Temperatura | `existencia.temperatura`
Fecha de recoleccion / preparacion | `existencia.fecha_recoleccion` / `.fecha_preparacion`
Responsable | `existencia.responsable_muestra`
Sub-ubicacion / Mueble / Repisa | `ubicacion.componentes`
Observaciones | `existencia.observaciones`

### Electronica (14 columnas)

| Columna | Destino |
|---|---|
Clasificacion | `articulo.clasificacion` (`componente` o `insumo`)
Familia | `articulo.familia` (26 valores)
Articulo / Especificacion | `articulo.nombre_canonico` / `.descripcion`
Cantidad / Unidad / Presentacion | como en Reactivos
Sub-ubicacion / Mueble | `ubicacion.componentes`
Horizontal / Vertical / Interior | `componentes->>'h'` / `'v'` / `'i'`
Observaciones | `existencia.observaciones`

---

## 6 · Contrato de la carga (ETL)

El esquema es la mitad del acuerdo; la otra mitad es que el cargador se comporte.

1. **Una fila en `carga` por archivo-hoja**, antes de cualquier existencia, con el
   encabezado (almacen, responsable, periodo, actualizado el). Todas las
   existencias de esa hoja llevan su `carga_id`.
2. **El almacen sale del nombre del archivo**, no de una columna (D1, Nivel 1 del
   Leeme).
3. **Normalizacion de vacios:** `'—'`, `''`, `'S/N'`, `'Sin serie'`,
   `'Sin modelo'`, `'Sin inventario'` → `NULL`. Es lo que hace que los unique
   parciales de serie e inventario funcionen.
4. **`trim` y colapso de espacios dobles** en todo texto (regla 3: 868 celdas
   con espacios sobrantes entre los diez archivos).
5. **La cantidad se escribe via `movimiento` tipo `carga_inicial`**, nunca
   directo a `existencia.cantidad`. Si la cantidad es cero, no se inserta
   movimiento y el trigger de `existencia` ya dejo el estado en `agotado`.
6. **La unidad del renglon se valida contra `articulo.unidad_base`.** Si difieren,
   es error de revision, **no** conversion silenciosa. El esquema mantiene la
   unidad solo en `articulo` justamente para que el mismo articulo no se registre
   en g en un almacen y en kg en otro; convertir a la callada anularia esa
   defensa.
7. **`buscar_articulo()` antes de crear.** Cada texto crudo que resuelva a un
   articulo existente se guarda como `articulo_alias` con `origen = 'migracion'`.
   Esto es lo que permite re-correr la carga sin perder el trabajo humano de
   decidir que es que.
8. **Los articulos creados por la carga nacen `verificado = false`** y caen en la
   cola de curacion.
9. **Idempotencia:** re-correr una carga no duplica. La llave natural de una
   existencia es (`articulo_id`, `almacen_id`, `ubicacion_id`, `marca`,
   `presentacion`) para consumibles, y `numero_serie` o
   `numero_inventario_uaeh` para equipos.

---

## 7 · RLS

La forma se conserva completa, porque funciona y ya esta probada: politicas
`to authenticated`, `revoke all ... from anon`, helpers envueltos en
`(select ...)` para que Postgres los evalue una vez por sentencia y no una vez
por renglon, e indice en toda columna que aparezca en una politica.

Politica base por tabla:

| Tabla | Lectura | Escritura |
|---|---|---|
`almacen`, `laboratorio`, `programa_educativo`, `asignatura`, `motivo_observacion`, `campo_capturable`, `perfil_captura`, `perfil_campo` | todos | solo admin |
`articulo`, `articulo_alias`, `articulo_reactivo`, `articulo_biologico` | todos | alta: quien puede escribir; update/delete: admin |
`ubicacion`, `existencia`, `movimiento`, `carga` | todos | su propio almacen, o admin |
`practica`, `practica_elemento` | todos | su propio almacen (por el `almacen_id` desnormalizado), o admin |
`practica_observacion` | todos | quien puede escribir en la practica (ver abajo) |
`perfil` | todos | el propio renglon, o admin |

`practica_observacion` es la unica que no tiene su propio `almacen_id`: son dos
columnas, y desnormalizar una tercera para la RLS seria peor que el `exists`.
La politica va contra la practica padre, envuelta para que se evalue una vez:

```sql
create policy practica_observacion_escritura on public.practica_observacion
  for all to authenticated
  using (exists (
    select 1 from public.practica p
    where p.id = practica_id
      and (p.almacen_id = (select private.almacen_actual())
           or (select private.es_admin()))
  ))
  with check (... la misma condicion ...);
```

El `practica_id` es la primera columna de la llave primaria, asi que el `exists`
resuelve por indice sin necesidad de uno nuevo.

**Cada politica lleva su prueba** en `supabase/tests/database/`, como manda
`CLAUDE.md`. Las pruebas nuevas que hacen falta:

- un responsable de N3 no puede insertar una `practica` en un laboratorio de N4
- un responsable de N3 no puede insertar un `practica_elemento` sobre una
  existencia de N4, ni falseando el `almacen_id` del payload
- un usuario `consulta` no puede insertar nada en ninguna de las tablas nuevas
- `anon` no lee nada
- la FK compuesta rechaza una existencia de N3 con `ubicacion_id` de N4
- el unique parcial rechaza dos equipos con el mismo `numero_serie`
- `practica_elemento_campos_por_metodo` rechaza un `peso` con `estado_devolucion`

---

## 8 · Decisiones que tome por default

Revisables; si ninguna se objeta, quedan asi.

| # | Decision | Por que |
|---|---|---|
| P1 | El codigo del QR sigue siendo `{clave}-{5 digitos}` (`N3-00042`), **no** el `INV-0001` del prototipo | La etiqueta dice a que almacen pertenece con solo leerla, sin consultar nada |
| P2 | `existencia.temperatura` es `text`, no `numeric` | Los valores reales son `'4 °C'` y `'Ambiente'`: es una condicion de conservacion, no una medicion que se calcule |
| P3 | `articulo_biologico` existe como tabla 1:1 aunque hoy tenga una sola columna | Colgar `origen_especie` de `articulo` la dejaria nula en 5 de 6 clasificaciones |
| P4 | Los prestamos de equipo no generan `movimiento` | Un `-1`/`+1` que se cancela es historia inventada; el prestamo vive en `practica_elemento` |
| P5 | `asignatura.programa_educativo_id` es nullable | Hay asignaturas compartidas entre programas; forzar el vinculo obliga a duplicarlas |

---

## 9 · Fuera de alcance

- **El Catalogo general institucional** (`Catalogo-Laboratorios.xlsx`, 8,064
  articulos con precio, unidad y clasificador de objeto de gasto, mas 418
  articulos nuevos y 121 equipos menores). Es otro sistema: compras, no
  inventario. Es de donde venia `existencia.partida`. Su revision del 17 de
  agosto encontro 18 articulos en dos archivos a la vez con precios que van de
  696 a 17,205, y 13 duplicados dentro del catalogo general — problemas que se
  resuelven con quien lleve el presupuesto, no con un esquema. Si entra, es un
  spec aparte.
- **El exportador del formato NOM-005-STPS.** El esquema conserva todos los
  campos normativos para poder generarlo; generarlo no es parte de esta
  depuracion.
- **Prestamos entre almacenes como transaccion** (seccion 4.6).
- **Catalogos cerrados de marcas y muebles.** La regla 4 los pide en desplegable;
  hoy son `text` libre. Vale la pena, pero es un cambio con vida propia y
  necesita que los responsables acuerden la lista primero.

---

## 10 · Resumen del cambio

**Se quita:** 1 tabla (`almacen_alias`), 1 columna de relacion
(`almacen.padre_id`), 5 columnas (`existencia.partida`,
`existencia.revisado_por`, `articulo_reactivo.uso_principal`,
`articulo_reactivo.clasificacion_ghs`, y `anaquel` como llave de
`componentes`), 1 valor de enum (`por_confirmar`), 3 campos capturables.

**Se agrega:** 8 tablas (`articulo_biologico`, `carga`, `programa_educativo`,
`asignatura`, `practica`, `practica_elemento`, `motivo_observacion`,
`practica_observacion`), 1 clasificacion, 3 enums, 2 valores de enum, 13
columnas, 1 funcion (`private.estado_calculado`), 4 restricciones de unicidad, 2
FK compuestas y 2 columnas generadas.

**Se cambia:** las llaves de `ubicacion.componentes`, 2 renombres en
`articulo_reactivo`, `perfil_captura.almacen_id` a nullable con semantica de
default, y `formulario()` para resolver el default.

## 11 · Criterio de terminado

```bash
pnpm typecheck && pnpm lint && pnpm build
supabase db reset      # las 7 migraciones nuevas + seed, desde cero
supabase test db       # incluidas las pruebas de RLS nuevas de la seccion 7
pnpm gen:types         # src/types/database.ts regenerado, nunca a mano
```

Los cuatro en cero. Y `CLAUDE.md` actualizado con la excepcion de la seccion 3,
con fecha, para que la reescritura del baseline no se vuelva costumbre.
