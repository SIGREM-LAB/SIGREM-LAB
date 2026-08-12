# Sistema de Inventarios UCL-UAEH — Diseño de datos y esquema inicial

**Fecha:** 2026-08-12
**Alcance de este documento:** modelo de datos, estrategia de migración desde los Excel existentes y organización del proyecto.
**Fuera de alcance:** módulo de Prácticas (v2), módulo de Reportes de prácticas (v2), empaquetado Tauri (al pasar a producción).

---

## 1. Contexto

La Unidad Central de Laboratorios (UCL) de la UAEH administra hoy sus inventarios en hojas de Excel independientes por almacén. Se recibieron 10 archivos que cubren 4 almacenes. Existe un prototipo en React (`SIGREM-LAB Desktop Application Design`) con las pantallas y el flujo deseado, construido sobre Zustand con persistencia en `localStorage`.

El sistema se desarrollará desde cero en **React + Supabase**, con un repositorio nuevo creado por otro integrante del equipo. El prototipo pasa a ser **material de referencia** para pantallas y flujo, no base de código.

### Estado de los datos de origen

Ubicación: `C:\dev\sigrem-lab\Inventarios\` (10 archivos, ~5,500 filas de datos).

| Familia | Archivos | Filas aprox. | Forma |
|---|---|---|---|
| Reactivos (N3, N4, LUM) | 3 | ~2,600 | Formato NOM-005-STPS. Encabezado de 3 niveles en filas 21–23, datos desde la 24. ~25 columnas reales |
| Materiales / insumos (N3, N4, LUM, Sensorial) | 4 | ~1,760 | Clasificación / Artículo / N columnas de cantidad (una por semestre) / unidad / ubicación / faltantes |
| Equipos serializados (LUM, LE) | 2 | ~330 | Equipo / marca / modelo / SN / número de inventario institucional / ubicación. 1 fila = 1 unidad física |
| Componentes electrónicos (LE) | 1 | ~820 | Tipo / Familia / Descripción / Total / Ubicación + coordenadas H/V/I de gaveta |

### Hallazgos que condicionan el diseño

1. **Existe un catálogo canónico.** La hoja `Descripciones` (2,314 filas: *"artículo de acuerdo al catálogo"* + *"Descripciones UCL"*) aparece en dos archivos. Es la semilla natural de la tabla de catálogo.
2. **Los Excel son censos semestrales, no saldos vivos.** Columnas como `Cantidad en existencia E-J 2026`, `J-D 2025`, `J-D 2024` son conteos físicos por periodo.
3. **No hay identificadores únicos en ningún archivo.** Los nombres se repiten con marcas, purezas y pesos distintos. Ejemplos reales: 3 filas de "Ácido succínico" (SIGMA, MEYER, RP), 6 osciloscopios "Agilent 54624A" con SN distintos, 5 filas de "Agitador magnético" con medidas distintas.
4. **El archivo de reactivos es un entregable regulatorio.** Formato `UAEH/UCL/NOM/01`, declarado *"para procesos de auditoría y acreditación"*, firmado por la dirección.
5. **Tres granularidades conviven:** frascos individuales con peso propio, activos serializados únicos, y montones contables agregados ("30 agitadores de vidrio" en una sola fila).

---

## 2. Decisiones tomadas

| # | Decisión | Resolución |
|---|---|---|
| D1 | Formato NOM-005-STPS | El esquema **conserva todos los campos normativos**, pero v1 **no genera** el formato oficial. Se preserva la opción sin inflar el alcance |
| D2 | Fuente de verdad de la existencia | **Saldo vivo respaldado por bitácora de movimientos.** El censo semestral entra como movimiento `ajuste_conteo` |
| D3 | Granularidad de identidad | **Dos niveles: catálogo (`articulo`) + existencia física.** El QR se pega a la existencia |
| D4 | Estrategia de migración | **Ruta C: migrar estructura, recontar cantidades** (§4) |
| D5 | Visibilidad entre almacenes | **Ver todos, editar solo el propio.** Habilita el préstamo entre almacenes |
| D6 | Almacén vs. laboratorio | **Son conceptos distintos.** 4 almacenes guardan stock; N laboratorios derivados consumen y registran prácticas |
| D7 | Análisis Sensorial | Laboratorio derivado; su inventario pertenece al almacén **N4** |
| D8 | Conectividad | **Online-only.** El cliente habla directo con Supabase |
| D9 | Alcance de v1 | **Solo Inventario**, en los 4 almacenes. Prácticas queda para v2 |
| D10 | Creación de artículos | **Cualquier responsable puede crear**, obligatoriamente vía búsqueda difusa. Los artículos nuevos nacen `verificado = false` |

**Almacenes:** N3, N4, LUM, LE (Electrónica). Todos los demás laboratorios derivan de estos cuatro.

---

## 3. Modelo de datos

### 3.1 Tres capas

| Capa | Responde a | Quién escribe |
|---|---|---|
| **Catálogo** (`articulo`) | ¿Qué cosa es? | Cualquier responsable vía búsqueda difusa; admin cura |
| **Existencia** | ¿Dónde está y cuánto hay? | Responsable de cada almacén |
| **Movimientos** | ¿Qué pasó, cuándo y quién lo hizo? | El sistema, nunca a mano |

La separación entre catálogo y existencia es lo que permite preguntar *"¿qué almacén tiene ácido succínico?"* — consulta que el flujo de préstamo entre almacenes (checkboxes "Préstamo N4/N3/LUM" del prototipo) requiere.

### 3.2 Esquema

> Las definiciones siguientes son un **bosquejo de diseño**. Al escribir las migraciones reales se validarán contra las buenas prácticas de Postgres de Supabase (índices, tipos, políticas, `search_path` de funciones).

#### Organización

```sql
create table almacen (
  id      smallint primary key generated always as identity,
  clave   text not null unique,              -- 'N3','N4','LUM','LE'
  nombre  text not null,
  activo  boolean not null default true
);

create table laboratorio (
  id          integer primary key generated always as identity,
  almacen_id  smallint not null references almacen(id),
  nombre      text not null,                 -- p.ej. 'Análisis Sensorial'
  activo      boolean not null default true,
  unique (almacen_id, nombre)
);

create table perfil (
  id          uuid primary key references auth.users(id) on delete cascade,
  nombre      text not null,
  almacen_id  smallint references almacen(id),   -- null solo para admin global
  rol         text not null check (rol in ('admin','responsable','consulta'))
);
```

#### Ubicaciones

Cada almacén usa un vocabulario propio: reactivos usa anaquel/repisa/fila, N3 usa "Gabinete 301", N4 usa "410", LE usa "Separador 1" más coordenadas H/V/I. Una tabla con etiqueta legible más componentes estructurados en `jsonb` cubre los cuatro casos sin cuatro tablas ni ocho columnas medio vacías.

```sql
create table ubicacion (
  id           bigint primary key generated always as identity,
  almacen_id   smallint not null references almacen(id),
  etiqueta     text not null,                       -- 'Anaquel 2 / Repisa 1 / Fila 4'
  componentes  jsonb not null default '{}'::jsonb,  -- {"anaquel":2,"repisa":1,"fila":4}
  unique (almacen_id, etiqueta)
);
```

#### Catálogo

```sql
create table articulo (
  id              bigint primary key generated always as identity,
  nombre_canonico text not null,
  descripcion     text,
  clasificacion   text not null
                  check (clasificacion in ('reactivo','material','insumo','equipo','componente')),
  unidad_base     text not null,                    -- 'g','mL','pieza'
  verificado      boolean not null default false,
  creado_por      uuid references perfil(id),
  creado_en       timestamptz not null default now()
);

create table articulo_alias (
  id          bigint primary key generated always as identity,
  articulo_id bigint not null references articulo(id) on delete cascade,
  texto       text not null,
  origen      text not null default 'busqueda'      -- 'migracion' | 'busqueda' | 'fusion'
);

-- Extensión 1:1, solo para clasificacion = 'reactivo'
create table articulo_reactivo (
  articulo_id             bigint primary key references articulo(id) on delete cascade,
  estado_fisico           text check (estado_fisico in ('solido','liquido','gas')),
  color_almacenamiento    text,                     -- Rojo | Azul | Amarillo | Blanco | Verde
  uso_principal           text,
  requiere_hoja_seguridad boolean,
  caracteristica_fisica   text,
  caracteristica_quimica  text,
  clasificacion_ghs       text,
  riesgo_salud            smallint check (riesgo_salud          between 0 and 4),
  riesgo_inflamabilidad   smallint check (riesgo_inflamabilidad between 0 and 4),
  riesgo_reactividad      smallint check (riesgo_reactividad    between 0 and 4),
  peligro_especial        text
);
```

Los grados NFPA vienen como texto en el Excel (`'Grado 3: Riesgo serio'`) y se normalizan a `smallint` 0–4 durante la migración.

#### Existencia

```sql
create table existencia (
  id                     uuid primary key default gen_random_uuid(),
  articulo_id            bigint   not null references articulo(id),
  almacen_id             smallint not null references almacen(id),
  ubicacion_id           bigint   references ubicacion(id),
  codigo                 text     not null unique,        -- 'N3-00042', secuencia por almacén
  marca                  text,
  presentacion           text,                            -- 'FRASCO'
  cantidad               numeric(14,4) not null default 0, -- mantenida por trigger
  cantidad_minima        numeric(14,4),
  numero_serie           text,                            -- equipos
  numero_inventario_uaeh text,                            -- activo institucional
  fecha_adquisicion      date,
  fecha_caducidad        date,
  estado                 text not null default 'por_confirmar'
                         check (estado in ('por_confirmar','disponible','stock_bajo',
                                           'agotado','contaminado','mantenimiento','baja')),
  creado_en              timestamptz not null default now()
);
```

**La marca vive en `existencia`, no en `articulo`.** Tres frascos de ácido succínico de SIGMA, MEYER y RP son el mismo artículo con tres existencias. En cambio "Zinc en polvo 95%" y "Zinc en polvo 93%" **sí** son artículos distintos: la pureza cambia la sustancia.

**La unidad vive solo en `articulo.unidad_base`, no en `existencia`.** Tener unidad en ambos niveles invita a que la misma sustancia se registre en `g` en un almacén y en `kg` en otro, y a partir de ahí ningún total agregado es confiable. Si durante la migración aparece un caso real donde el mismo artículo se mide en dos unidades distintas (p. ej. "Tubos Eppendorf" contados por bolsa en N3 y por pieza en N4), eso significa que **son dos artículos distintos** y así se modelan. Sin conversiones de unidad en v1.

#### Movimientos

```sql
create table movimiento (
  id               bigint primary key generated always as identity,
  existencia_id    uuid     not null references existencia(id),
  almacen_id       smallint not null references almacen(id),  -- desnormalizado: RLS sin join
  tipo             text not null check (tipo in
                     ('entrada','consumo','merma','ajuste_conteo','prestamo','devolucion','baja')),
  cantidad         numeric(14,4) not null,      -- con signo
  cantidad_antes   numeric(14,4) not null,
  cantidad_despues numeric(14,4) not null,
  practica_id      bigint,                      -- FK se agrega en v2
  usuario_id       uuid not null references perfil(id),
  motivo           text,
  ocurrido_en      timestamptz not null default now()
);
```

`almacen_id` se desnormaliza deliberadamente: permite que la política de RLS se evalúe sin un join a `existencia`, que es la diferencia entre una consulta rápida y una lenta cuando la bitácora crezca.

`cantidad_antes` y `cantidad_despues` **las calcula el trigger**, no el cliente. Son la foto del saldo en ese instante y existen para que una auditoría pueda detectar una inconsistencia sin recorrer toda la bitácora. `movimiento` es de solo inserción: no se actualiza ni se borra.

**`existencia.cantidad` nunca se escribe directo.** Un trigger `after insert on movimiento` la actualiza y recalcula `estado`. Consecuencias:

- La lectura es una sola columna (rápida, sin agregación)
- El saldo siempre es reconstruible desde la bitácora
- Un error de captura se corrige con un movimiento de ajuste, no borrando historia

### 3.3 Búsqueda difusa y curación del catálogo

Flujo obligatorio al registrar un artículo:

1. El responsable escribe `acido succinico`
2. El sistema busca por similitud, ignorando acentos, mayúsculas y errores de dedo
3. Muestra *"¿Te refieres a alguno de estos?"* → `Ácido succínico, sólido, grado reactivo` (94%), `Ácido salicílico, sólido` (71%)
4. Si elige uno, registra su existencia contra ese artículo y **el texto tecleado se guarda como alias**
5. Solo si marca explícitamente **"ninguno, es nuevo"** se abre el formulario de alta

```sql
create extension if not exists pg_trgm;
create extension if not exists unaccent;

-- unaccent() de 1 argumento NO es inmutable y no sirve para indexar.
-- La forma de 2 argumentos sí lo es. Es el error clásico aquí.
create function norm_texto(t text) returns text
  language sql immutable strict parallel safe as $$
    select lower(unaccent('unaccent'::regdictionary, t))
  $$;

create index articulo_nombre_trgm on articulo
  using gin (norm_texto(nombre_canonico) gin_trgm_ops);
create index articulo_alias_texto_trgm on articulo_alias
  using gin (norm_texto(texto) gin_trgm_ops);
```

**Tabla de alias.** Cada texto con el que alguien ha nombrado un artículo apunta al canónico. El catálogo aprende: entre más se usa, mejor sugiere. Es además **la misma maquinaria que necesita la migración** para deduplicar las ~5,500 filas de origen — se construye una vez y sirve para las dos cosas.

**Bandera `verificado`.** Un artículo creado por un responsable nace con `verificado = false`: se puede usar de inmediato, nadie se bloquea, pero cae en una cola que el admin revisa. Si resultó duplicado, `fusionar_articulo(origen, destino)` reapunta las existencias, conserva el nombre viejo como alias y no pierde nada.

El catálogo se degrada despacio y se limpia solo, en lugar de degradarse rápido y no limpiarse nunca.

### 3.4 Seguridad (RLS)

| Tabla | Lectura | Escritura |
|---|---|---|
| `articulo` | autenticados | **crear:** responsable (vía búsqueda difusa, `verificado=false`) · **editar/fusionar/verificar:** admin |
| `articulo_alias` | autenticados | se llena solo al usar el buscador |
| `articulo_reactivo` | autenticados | admin |
| `existencia`, `movimiento` | autenticados | `perfil.almacen_id = fila.almacen_id`, o admin |
| `almacen`, `laboratorio` | autenticados | admin |
| `ubicacion` | autenticados | su propio almacén, o admin |

**La RLS es la única seguridad real del sistema.** Cuando el proyecto se empaquete con Tauri para producción, se distribuirá un binario con la `anon key` de Supabase dentro. Esa llave es pública por diseño y cualquiera puede extraerla y hablarle directo a la base. Lo que lo detiene no es la app, son las políticas. De ahí dos reglas no negociables desde el primer día:

- La `service_role` key **jamás** toca el cliente
- **Cada política de RLS lleva su prueba.** Es la única parte del sistema donde escribir pruebas no es opcional

### 3.5 Diseñado pero apagado en v1

`practica` y `practica_elemento` **no se crean en v1**. La columna `movimiento.practica_id` sí existe desde el inicio (sin llave foránea) para que la bitácora no requiera una migración destructiva después; la FK se agrega junto con las tablas en v2.

El módulo de Prácticas es sencillo sobre un inventario confiable; al revés, no funciona.

---

## 4. Estrategia de migración — Ruta C

### 4.1 El planteamiento

La pregunta operativa no es *"¿migramos o tecleamos de cero?"* sino **"¿confiamos en las cantidades actuales?"**. Los Excel traen conteos de 2024, 2025 y 2026 que no siempre cuadran, notas como *"Cantidad lejana a los que se tenían al inicio"* y texto (`'Un frasco'`) en columnas numéricas.

Si la respuesta es "no del todo", hay que hacer un conteo físico de cualquier manera. La Ruta C aprovecha eso:

| Qué | De dónde sale | Por qué |
|---|---|---|
| Artículos, marcas, presentaciones, unidades | **Migrado** | Es lo caro de recapturar y lo que casi no cambia |
| Campos NOM de reactivos | **Migrado** | Carísimos de reconstruir: NFPA, GHS, color de almacenamiento |
| Ubicaciones | **Migrado** | "Gabinete 301", "Anaquel 2", coordenadas H/V/I |
| **Cantidades** | **Conteo físico en el sistema** | Entran como movimientos `ajuste_conteo`, con fecha y responsable |

El sistema arranca con el catálogo completo y las existencias en `estado = 'por_confirmar'`. El responsable recorre su almacén escaneando o buscando, y confirma o corrige. Al terminar, ese almacén queda con un saldo en el que sí se puede confiar, porque lo contó una persona, en una fecha, y quedó en la bitácora.

**El primer conteo deja de ser trabajo desechable y se convierte en el primer registro de auditoría del sistema.**

### 4.2 Arquitectura del ETL

Python 3.14 + openpyxl (ya disponibles), en tres etapas separadas:

```
etl/
├── extract/   Excel → tablas staging, una por archivo, FIEL al original, sin limpiar
├── rules/     normalización versionada en código (unidades, clasificación, ubicación, NFPA)
└── review/    lo que las reglas no resuelven → CSV de excepciones por almacén
```

**Regla que hace que esto funcione:** las decisiones humanas se guardan en `articulo_alias`, no en el CSV de excepciones. Así se puede re-correr la migración completa desde cero sin perder una sola hora de trabajo de los responsables. Se va a re-correr muchas veces.

### 4.3 Trampas detectadas en los archivos

| Trampa | Dónde | Consecuencia si se ignora |
|---|---|---|
| Encabezado de 3 niveles en filas 21–23 | Los 3 archivos de reactivos | Una lectura estándar devuelve basura |
| **El orden de las columnas de cantidad se invierte entre archivos** | LUM: `inicial − consumo = existencia`. N3 `E-J 2026`: `consumo − inicial = existencia` | Cantidades silenciosamente erróneas. **La peor, porque no truena** |
| 212–225 columnas reportadas, ~25 reales | Reactivos | Listas de validación estacionadas a la derecha; recortar por posición |
| N columnas de cantidad, una por semestre | Materiales: 1 en N3, 3 en N4, 6+ en LUM | Hay que elegir cuál es "la actual" archivo por archivo |
| Texto en columnas numéricas | `'Un frasco'`, `'S/N'`, celdas vacías | Revienta el cast; va a excepciones |
| Dos hojas por archivo | N3 tiene `E-J 2026` y `2025 actualización` | Importar la hoja vieja por error |
| Typos en datos de ubicación | "Respisa", "procesamineto" | Fragmenta el catálogo de ubicaciones |

### 4.4 Trabajo independiente de la decisión pendiente

Estas piezas son necesarias en cualquier ruta y no deben esperar:

- Semilla del catálogo desde las 2,314 filas de `Descripciones` (es el catálogo oficial UCL)
- Alta de los 4 almacenes, sus laboratorios derivados y sus responsables
- La maquinaria de búsqueda difusa y alias

---

## 5. Organización del proyecto

### 5.1 Situación actual (2026-08-12)

- El proyecto se movió de OneDrive a **`C:\dev\sigrem-lab`**. Los 10 Excel se verificaron por SHA256 tras el movimiento: idénticos
- El repositorio de la aplicación es **`github.com/MayraCas/SIGREM-LAB`**, clonado en `C:\dev\sigrem-lab\SIGREM-LAB\`
- El prototipo queda como **referencia de pantallas y flujo**, no como base de código. Vive en `referencia/prototipo/` dentro del repo (sin `node_modules`), excluido de `tsconfig.json` y de ESLint

**Decisiones de stack tomadas al organizar el repo:**

| Decisión | Resolución | Motivo |
|---|---|---|
| TypeScript vs. JavaScript | **TypeScript** (migrado el 2026-08-12, con 4 archivos fuente) | Sin TS no existe `supabase gen types`, que es la red de seguridad del §5.3 cuando cambie el esquema |
| Versión de TypeScript | **6.0.3, fijada** | TS 7.0 eliminó `baseUrl` y `typescript-eslint` aún no la soporta ([issue #10940](https://github.com/typescript-eslint/typescript-eslint/issues/10940)). Subir a 7.x cuando haya soporte |
| MUI vs. Tailwind | **MUI + Emotion**; Tailwind eliminado | Un solo sistema de estilos. Los ~60 componentes `ui/` del prototipo son shadcn (Radix + Tailwind) y **no transfieren**: las pantallas se reimplementan con MUI |

### 5.2 Estructura del repo (ya creada)

```
SIGREM-LAB/
├── supabase/
│   ├── migrations/        SQL versionado — fuente de verdad del esquema
│   └── config.toml        creado con `supabase init`
├── src/
│   ├── features/          inventario/ · catalogo/ · practicas/ · reportes/
│   ├── components/        compartidos entre features
│   ├── lib/supabase.ts    cliente tipado con Database
│   └── types/database.ts  GENERADO por `pnpm gen:types`, no editar a mano
├── etl/                   scripts Python de migración
│   ├── requirements.txt
│   └── datos/             vacío en git; manifest.csv con SHA256 de los 10 Excel
├── docs/specs/            este documento
└── referencia/prototipo/  diseño original, no se compila ni se lintea
```

Los Excel de origen viven fuera del repo, en `C:\dev\sigrem-lab\Inventarios\` y en el OneDrive del equipo. `etl/datos/manifest.csv` permite verificar que todos trabajan contra la misma versión.

Lo que **no** se conserva del prototipo: los stores de Zustand con `persist` a `localStorage` (`inventoryStore.ts`, `practicasStore.ts`) dejan de ser fuente de verdad — ese papel lo toman Supabase y TanStack Query.

### 5.3 Tres disciplinas que deciden si esto sale bien

1. **El esquema solo cambia por migración.** Nunca desde el dashboard de Supabase. Cada cambio es un archivo SQL commiteado. Es la diferencia entre poder reconstruir la base de cero y rezar para que nadie toque nada.
2. **Tipos generados, no escritos.** `supabase gen types typescript` produce `database.ts` desde el esquema real. Si cambia una columna y se olvida el frontend, TypeScript lo grita en vez de que lo descubra un usuario.
3. **Dev y prod separados.** Nunca probar contra los datos reales de los almacenes. Local con `supabase start` (requiere Docker Desktop) o un segundo proyecto en la nube.

### 5.4 Deuda conocida del prototipo

`AuthContext.tsx:35` acepta **cualquier contraseña de 4 caracteres o más** y tiene los usuarios en un diccionario en el código. Aceptable en un prototipo; debe morir en el Hito 1, no al final.

---

## 6. Hitos de v1

| # | Hito | Entrega |
|---|---|---|
| 0 | Fundación | Repo, dependencias, proyecto Supabase de dev, estructura *(en curso por el equipo)* |
| 1 | Auth + base | Supabase Auth real, `almacen`/`laboratorio`/`perfil`, **RLS con pruebas** |
| 2 | Catálogo | Semilla de 2,314 artículos, búsqueda difusa, alias, fusión |
| 3 | Existencias | CRUD, ubicaciones, generación e impresión de QR |
| 4 | Movimientos | Bitácora, trigger de saldo, ajuste por conteo |
| 5 | Datos reales | ETL de estructura + primer conteo físico por almacén |
| 6 | Reportes | Existencias, stock bajo, caducidades, por almacén |

Prácticas y sus reportes quedan para v2, sobre un inventario ya confiable.
El empaquetado con Tauri se hará al pasar a producción.

**Cada hito se convierte en su propio plan de implementación.** Este documento es el diseño que los seis comparten; no se intenta un solo plan para todo v1.

---

## 7. Riesgos

| Riesgo | Mitigación |
|---|---|
| **Reorganizar vs. cargar de cero sigue sin decidirse** (§8) | No bloquea los hitos 1–4. Cerrarla mientras se construyen |
| **El orden invertido de columnas de cantidad** produce errores silenciosos | Validación por archivo con muestreo manual contra el Excel antes de aceptar la carga |
| **El catálogo es un compromiso organizacional**, no solo una tabla | Nombrar un dueño responsable de la cola `verificado = false` |
| **El primer conteo físico consume tiempo de los responsables** | Negociarlo por adelantado, no asumirlo |
| **Los ~820 componentes electrónicos de LE** son un dominio aparte | Candidato natural a posponer si aprieta el calendario |
| Sin pruebas de RLS, la seguridad es aparente | Pruebas de política obligatorias en el Hito 1 |

---

## 8. Puntos abiertos

| # | Punto | Quién decide | Bloquea |
|---|---|---|---|
| A1 | ¿Se reorganiza la información existente o se carga de cero? La Ruta C es la propuesta, falta confirmarla con los responsables | Equipo + responsables de almacén | Hito 5 |
| A2 | Estructura definitiva del repo y quién integra `supabase/` y `etl/` | Equipo | Hito 1 |
| A3 | Lista de laboratorios derivados por almacén (más allá de Análisis Sensorial → N4) | Responsables de almacén | Hito 1 (dato, no esquema) |
| A4 | Dev local con Docker o segundo proyecto en la nube | Equipo | Hito 0 |

**Diagnóstico disponible para A1:** se puede producir un análisis cuantificado de los Excel — cuántos artículos únicos hay tras normalizar, cuánto se duplica entre almacenes, cuántas filas traen datos inservibles y cuántas horas-persona implica cada ruta — para que la decisión se tome con datos y no a ojo.
