# Módulo de Prácticas · Plan de implementación

> **Para agentes:** SUB-SKILL REQUERIDA: usa `superpowers:subagent-driven-development`
> (recomendado) o `superpowers:executing-plans` para ejecutar este plan tarea por
> tarea. Los pasos llevan casilla (`- [ ]`) para ir marcándolos.

**Meta:** la pantalla `/practicas`, donde un responsable captura lo que una
práctica consumió, prestó y rompió, y al finalizar descuenta el inventario.

**Arquitectura:** una migración aditiva agrega `metodo_de_control()` —el mapa de
clasificación a método, que hoy decide el cliente sin que nadie lo verifique—,
la columna `metodos` en `motivo_observacion`, las tablas
`practica_elemento_observacion` y `practica_borrador`, y la RPC transaccional
`registrar_practica()`. Encima va una ruta `/practicas` de dos columnas: la
captura a la izquierda y el Panel de Control a la derecha, que elige su
sub-panel según el método del producto seleccionado.

**Stack:** Postgres 17 + Supabase CLI + pgTAP para la base; React 19, MUI 9,
TanStack Query 5, react-hook-form 7 + zod 4, Vitest + Testing Library para la
pantalla.

**Spec:** `docs/specs/2026-09-03-modulo-practicas-design.md` — este plan discute
desde ahí; léelos juntos.

## Restricciones globales

- **Los commits los hace la persona, no el agente.** Cada tarea termina con un
  punto de commit: deja el árbol limpio y verde, di qué archivos tocaste, y
  **para**. No corras `git commit` ni `git add`.
- **`pantalla_practicas/` no se toca ni se versiona.** Ya está en `.gitignore`.
  Es la entrada de diseño; lo que sobrevive de ella es el spec.
- **Identificadores del dominio en español**, igual que el esquema: `practica`,
  `practica_elemento`, `existencia`, `motivo`, `borrador`. Comentarios y texto
  de usuario, también.
- **Los tipos se generan.** `pnpm gen:types` después de la migración. Nunca
  editar `src/types/database.ts` a mano ni declarar a mano la forma de una fila.
- **El esquema sólo cambia por migración.** Un archivo nuevo en
  `supabase/migrations/`. La ventana de reescribir el baseline se cerró el 18
  de agosto.
- **Cada política de RLS lleva su prueba** en `supabase/tests/database/`.
- **Nada de dependencias nuevas.** Todo lo que este plan necesita ya está en
  `package.json`. Sin librería de QR y sin librería de balanza: esos dos botones
  se dibujan apagados (Tarea 8 y Tarea 10).
- **MUI 9:** `<Grid size={{ xs: 12, md: 6 }}>`, nunca `<Grid item xs>`. Las
  props de sistema van en `sx`, no sueltas: `<Stack sx={{ alignItems: 'center' }}>`.
  Colores por token del tema (`institucional.main`, `secondary.main`), nunca hex.
- **`supabase-js` no lanza excepciones.** Siempre `if (error) throw error`.
- **Nunca escribir `existencia.cantidad` ni las columnas generadas.** `consumo`
  y `perdidas` se muestran calculadas en vivo pero **no se envían**: las calcula
  la base.
- **Verificación de cierre**, los cinco en cero:
  `pnpm test && pnpm typecheck && pnpm lint && pnpm build` y `supabase test db`.
- **Docker Desktop tiene que estar corriendo** para todo lo de la Tarea 1. Al 3
  de septiembre no lo estaba: `supabase status` devolvía
  `failed to connect to the docker API`. Arráncalo antes de empezar.
- **Rama:** trabajar sobre una rama de feature nueva a partir de `main`, o sobre
  `feat/panel-academico` si aún no se ha integrado. Pregunta antes de crearla.

## Una corrección al spec

La §8 del spec cuenta 12 pruebas de RLS y 9 de esquema. Al escribirlas como
llamadas reales de pgTAP salen algunas más, porque una fila de la lista es a
veces dos asertos. Los números que manda este plan son los de las Tareas 1:

| Suite | Spec | Este plan |
|---|---|---|
| `esquema.test.sql` | `plan(69)` | **`plan(71)`** |
| `rls.test.sql` | `plan(85)` | **`plan(86)`** |

No cambia nada del diseño; cambia el argumento de `plan()`.

---

## Estructura de archivos

**Base de datos**

| Archivo | Responsabilidad |
|---|---|
| `supabase/migrations/20260903120000_practicas.sql` | *Crear.* `metodo_de_control()`, la vista con su columna nueva, `motivo_observacion.metodos`, las dos tablas, `registrar_practica()`, RLS y políticas. Una sola migración |
| `supabase/tests/database/esquema.test.sql` | *Modificar.* +11 pruebas |
| `supabase/tests/database/rls.test.sql` | *Modificar.* +13 pruebas |
| `supabase/seed.sql` | *Modificar.* `metodos` y el `orden` nuevo de los 9 motivos |
| `supabase/datos-iniciales.sql` | *Modificar.* Lo mismo. Este sí llega a producción |
| `src/types/database.ts` | *Regenerar.* Nunca a mano |

**Pantalla** — todo bajo `src/features/practicas/`

| Archivo | Responsabilidad |
|---|---|
| `metodos.ts` | Etiqueta, icono y color de cada `metodo_control`. Puro |
| `esquemas.ts` | Los tipos de la captura, los esquemas de zod y `estaCompleto()`. Puro |
| `campoNumero.ts` | Leer un `<input type="number">` sin convertir el vacio en cero. Puro |
| `borrador.ts` | Serializar, restaurar y descartar por versión. Puro |
| `consultas.ts` | Hooks de Query, la mutación de registro, la del borrador y `mensajeDeError` |
| `PaginaPracticas.tsx` | Ensamblaje, estado de la captura y de la selección |
| `DatosPractica.tsx` | La cascada, laboratorio y fecha |
| `AgregarProductos.tsx` | Escanear QR (apagado) y Buscar producto |
| `DialogoBuscar.tsx` | El modal de búsqueda de existencias |
| `TablaProductos.tsx` | Productos Utilizados, con el contador y el chip de estado |
| `PanelControl.tsx` | El panel derecho: elige sub-panel por método |
| `CapturaPeso.tsx` | Peso inicial, peso final, consumo calculado |
| `CapturaCantidad.tsx` | Entregada, devuelta, dañada, pérdidas calculadas |
| `CapturaPrestamo.tsx` | Estado de salida y de devolución |
| `Observaciones.tsx` | Las casillas filtradas por método y la descripción adicional |

**Fuera del feature**

| Archivo | Cambio |
|---|---|
| `src/App.tsx` | Una ruta `/practicas` dentro de `RutaProtegida` + `Layout` |
| `src/app/navegacion.ts` | La entrada de Prácticas pasa a `disponible: true` |

---

## Tarea 1: La migración de prácticas

Cierra los tres huecos del esquema (método de control falseable, registro no
atómico, sin borrador) y agrega lo que la pantalla necesita leer.

**Archivos:**
- Crear: `supabase/migrations/20260903120000_practicas.sql`
- Modificar: `supabase/tests/database/esquema.test.sql`
- Modificar: `supabase/tests/database/rls.test.sql`
- Modificar: `supabase/seed.sql`
- Modificar: `supabase/datos-iniciales.sql`
- Regenerar: `src/types/database.ts`

**Interfaces:**
- Consume: nada. Es la primera tarea.
- Produce:
  - `public.metodo_de_control(public.clasificacion_articulo) → public.metodo_control`
  - `public.existencia_listado.metodo_control` — columna nueva, al final
  - `public.motivo_observacion.metodos public.metodo_control[]`
  - `public.practica_elemento_observacion (practica_elemento_id bigint, motivo text)`
  - `public.practica_borrador (usuario_id uuid, contenido jsonb, actualizado_en timestamptz)`
  - `public.registrar_practica(bigint, bigint, bigint, bigint, date, text, jsonb) → text`

---

- [ ] **Paso 1: Comprobar que el reset local funciona ANTES de tocar nada**

Docker Desktop tiene que estar corriendo. Si no lo está, `supabase status`
devuelve `failed to connect to the docker API` y nada de esta tarea se puede
verificar.

```bash
supabase start
supabase db reset
supabase test db
```

Esperado: las dos suites en verde, `esquema.test.sql` con `plan(60)` y
`rls.test.sql` con `plan(73)`.

**Si falla aquí**, el problema es anterior a este plan. Arréglalo o repórtalo
antes de escribir una línea de la migración: si empiezas con la base roja no vas
a poder distinguir tu error del que ya estaba.

---

- [ ] **Paso 2: Escribir las pruebas de esquema, que deben fallar**

En `supabase/tests/database/esquema.test.sql`, sube el plan de `plan(60)` a
`plan(71)` y agrega esto **antes** de `select * from finish();`.

```sql
-- ---------------------------------------------------------------------------
-- Metodo de control: el mapa que antes decidia el cliente
-- ---------------------------------------------------------------------------
-- Sale de lo que cada clasificacion ya declara que captura en perfil_campo:
-- reactivo es la unica con los dos pesos, equipo la unica sin cantidad y con
-- funcionamiento, y el resto se cuenta.
select is(public.metodo_de_control('reactivo'),          'peso'::public.metodo_control,
          'Un reactivo se pesa');
select is(public.metodo_de_control('equipo'),            'prestamo'::public.metodo_control,
          'Un equipo se presta');
select is(public.metodo_de_control('material'),          'cantidad'::public.metodo_control,
          'El material se cuenta');
select is(public.metodo_de_control('insumo'),            'cantidad'::public.metodo_control,
          'Los insumos se cuentan');
select is(public.metodo_de_control('componente'),        'cantidad'::public.metodo_control,
          'Los componentes de electronica se cuentan');
select is(public.metodo_de_control('materia_biologica'), 'cantidad'::public.metodo_control,
          'La materia biologica se cuenta: su perfil pide cantidad y no pide pesos');

-- ---------------------------------------------------------------------------
-- La vista: lo que falla en silencio si alguien la recrea mal
-- ---------------------------------------------------------------------------
-- Sin security_invoker la vista corre como su dueno y publica el inventario
-- entero a anon, y todo lo demas sigue funcionando igual. Esta prueba existe
-- desde el 21 de agosto; se repite aqui porque este plan hace un
-- create or replace sobre la vista.
select is(
  (select reloptions::text[] @> array['security_invoker=on']
     from pg_class where relname = 'existencia_listado'),
  true,
  'existencia_listado sigue con security_invoker despues del create or replace'
);

select has_column('public', 'existencia_listado', 'metodo_control',
  'existencia_listado expone metodo_control, que es lo que elige el panel');

-- ---------------------------------------------------------------------------
-- motivo_observacion.metodos
-- ---------------------------------------------------------------------------
select throws_ok(
  $$ update public.motivo_observacion
        set metodos = '{}'::public.metodo_control[] where clave = 'otro' $$,
  '23514', null,
  'Un motivo que no aplica a ningun metodo no se veria nunca: es un error, no un dato'
);

select is(
  (select metodos from public.motivo_observacion where clave = 'equipo_daniado'),
  array['prestamo']::public.metodo_control[],
  'Equipo daniado solo sale en el panel de prestamo'
);

select is(
  (select count(*)::int from public.motivo_observacion
    where metodos @> array['cantidad']::public.metodo_control[] and activo),
  8,
  'El panel de cantidad ofrece ocho motivos: los cinco del diseno mas los tres consumibles'
);
```

---

- [ ] **Paso 3: Correr las pruebas de esquema y confirmar que fallan**

```bash
supabase test db
```

Esperado: `esquema.test.sql` falla. Los primeros seis asertos revientan con
`function public.metodo_de_control(...) does not exist`, y el resto con columna
o relación inexistente. **Confirma que ves esos errores y no otros.** Si falla
por un `plan()` mal contado, arregla el número ahora.

---

- [ ] **Paso 4: Escribir la migración**

Crea `supabase/migrations/20260903120000_practicas.sql`:

```sql
-- El modulo de Practicas: lo que hace falta para que la pantalla /practicas
-- pueda registrar una sesion completa.
--
-- Diseno: docs/specs/2026-09-03-modulo-practicas-design.md
--
-- Todo esto es aditivo. No se toca ninguna tabla, trigger ni politica existente; el
-- unico `create or replace` es sobre la vista del listado, y solo para
-- agregarle una columna al final.
--
-- Los tres huecos que cierra, en orden de gravedad:
--   1. `practica_elemento.metodo_control` lo declaraba el cliente y nada lo
--      ataba a la clasificacion del articulo. Un equipo se podia registrar como
--      consumido por peso.
--   2. Registrar una practica eran 1+N+M escrituras sueltas: si la tercera
--      fallaba quedaban dos elementos ya aplicados, con su `movimiento` escrito
--      -que es de solo insercion- colgando de una practica que el responsable
--      no puede corregir.
--   3. No habia borrador, y `practica_elemento` no admite filas a medias.

-- ---------------------------------------------------------------------------
-- El metodo de control, en un solo lugar
-- ---------------------------------------------------------------------------
-- El mapa no es una opinion: sale de lo que cada clasificacion ya declara que
-- captura en perfil_campo. `reactivo` es la unica que pide peso_frasco_vacio y
-- peso_total -regla 13 del formato-, asi que es la unica que se pesa. `equipo`
-- es la unica sin `cantidad` y con `funcionamiento`: la regla 9 pide un renglon
-- por equipo fisico, asi que siempre es 1 y lo unico que cambia al devolverlo
-- es en que estado volvio. Eso es exactamente un prestamo.
--
-- `immutable` para poder usarla dentro de la vista sin costo por fila.
create or replace function public.metodo_de_control(
  p_clasificacion public.clasificacion_articulo
) returns public.metodo_control
language sql
immutable
parallel safe
set search_path = ''
as $$
  select case p_clasificacion
    when 'reactivo' then 'peso'::public.metodo_control
    when 'equipo'   then 'prestamo'::public.metodo_control
    else 'cantidad'::public.metodo_control
  end
$$;

comment on function public.metodo_de_control(public.clasificacion_articulo) is
  'Que metodo de control le toca a cada clasificacion. Fuente unica: la usan la vista del listado y registrar_practica, asi que el panel del frontend y lo que se guarda no pueden discrepar.';

-- El `alter default privileges` de la migracion de grants cubre tablas, no
-- funciones, y una funcion nueva es ejecutable por PUBLIC salvo que se revoque.
revoke all on function public.metodo_de_control(public.clasificacion_articulo)
  from public, anon;
grant execute on function public.metodo_de_control(public.clasificacion_articulo)
  to authenticated;


-- ---------------------------------------------------------------------------
-- La vista del listado gana una columna, al final
-- ---------------------------------------------------------------------------
-- Al final y no en medio porque `create or replace view` es lo unico que
-- Postgres admite sin recrear la vista, y solo acepta columnas nuevas al final.
-- Recrearla obligaria a un `drop ... cascade` y a repetir `security_invoker`,
-- que es el detalle que falla en silencio: sin el, la vista corre como su dueno
-- y publica el inventario entero a anon. Hay una prueba en esquema.test.sql que
-- lo vigila, y existe justo porque una vista mal creada funciona igual de bien
-- hasta el dia malo.
create or replace view public.existencia_listado
with (security_invoker = on) as
select e.id, e.codigo, e.marca, e.cantidad, e.estado, e.almacen_id,
       e.ubicacion_id, e.fecha_caducidad, e.creado_en,
       a.id as articulo_id,
       a.nombre_canonico, a.descripcion, a.clasificacion, a.unidad_base,
       al.clave   as almacen_clave,
       u.etiqueta as ubicacion,
       public.norm_texto(a.nombre_canonico)     as nombre_norm,
       public.norm_texto(coalesce(e.marca, '')) as marca_norm,
       public.metodo_de_control(a.clasificacion) as metodo_control
from public.existencia e
join public.articulo a  on a.id  = e.articulo_id
join public.almacen  al on al.id = e.almacen_id
left join public.ubicacion u on u.id = e.ubicacion_id;

-- `create or replace view` conserva los privilegios, pero repetirlos es barato
-- y deja el archivo autoexplicativo.
grant select on public.existencia_listado to authenticated;
revoke all  on public.existencia_listado from anon;


-- ---------------------------------------------------------------------------
-- Los motivos aprenden a que metodo aplican
-- ---------------------------------------------------------------------------
-- Podria ser un switch de nueve lineas en el frontend. Va como columna por la
-- misma razon por la que los motivos son un catalogo y no nueve booleanos:
-- mover "No tenemos" a los materiales tiene que ser un update, no una migracion
-- mas un redespliegue. Es la misma decision que ya se tomo con campo_capturable.
--
-- El default con los tres es lo que hace que esta migracion no rompa lo que ya
-- este cargado: un motivo existente sigue saliendo en todos los paneles hasta
-- que alguien decida otra cosa.
alter table public.motivo_observacion
  add column metodos public.metodo_control[] not null
    default array['peso','cantidad','prestamo']::public.metodo_control[];

alter table public.motivo_observacion
  add constraint motivo_observacion_metodos_no_vacio
  check (cardinality(metodos) > 0);

comment on column public.motivo_observacion.metodos is
  'En que paneles se ofrece este motivo. Es para armar la interfaz, NO una restriccion: no se valida contra el metodo del elemento, porque cambiar esto no debe volver ilegal una practica que fue correcta el dia que se capturo.';

-- El `orden` se rehace porque el sembrado saca los tres prestamos antes que
-- Contaminado y Se termino, y el diseno los pone al final.
--
-- El panel de cantidad lleva los tres consumibles ademas de Material daniado, y
-- es el unico punto donde esto se aparta del mockup. La razon es la asimetria
-- del error: una casilla de mas cuesta un renglon en un panel que ya tiene
-- barra de desplazamiento; una de menos empuja a escribir "se acabo la caja de
-- pipetas" en Otro y en el texto libre, que es precisamente lo que el catalogo
-- venia a evitar.
update public.motivo_observacion m
   set orden = v.orden, metodos = v.metodos
  from (values
    ('no_tenemos',       1, array['peso','cantidad']::public.metodo_control[]),
    ('contaminado',      2, array['peso','cantidad']::public.metodo_control[]),
    ('se_termino',       3, array['peso','cantidad']::public.metodo_control[]),
    ('material_daniado', 4, array['cantidad']::public.metodo_control[]),
    ('equipo_daniado',   5, array['prestamo']::public.metodo_control[]),
    ('prestamo_n4',      6, array['peso','cantidad','prestamo']::public.metodo_control[]),
    ('prestamo_n3',      7, array['peso','cantidad','prestamo']::public.metodo_control[]),
    ('prestamo_lum',     8, array['peso','cantidad','prestamo']::public.metodo_control[]),
    ('otro',             9, array['peso','cantidad','prestamo']::public.metodo_control[])
  ) as v(clave, orden, metodos)
 where m.clave = v.clave;


-- ---------------------------------------------------------------------------
-- Las observaciones son del producto, no de la sesion
-- ---------------------------------------------------------------------------
-- "Contaminado" es una propiedad del frasco; "Equipo daniado", de ese equipo.
-- Colgadas de la practica -que es donde estan hoy, en practica_observacion- una
-- sesion con tres productos que marca Contaminado no dice cual se contamino, y
-- el modulo de Reportes se queda sin poder responderlo.
--
-- practica_observacion NO se borra: nada la lee -solo aparece en los tipos
-- generados- asi que dejarla no cuesta nada, y borrarla seria una migracion
-- destructiva sobre una tabla con dos politicas ya probadas.
create table public.practica_elemento_observacion (
  practica_elemento_id bigint not null
    references public.practica_elemento (id) on delete cascade,
  motivo               text   not null references public.motivo_observacion (clave),
  primary key (practica_elemento_id, motivo)
);

create index practica_elemento_observacion_motivo_idx
  on public.practica_elemento_observacion (motivo);

-- Sin almacen_id desnormalizado, por lo mismo que practica_observacion: son dos
-- columnas, y una tercera solo para la RLS sale mas cara que el exists.
-- practica_elemento_id es la primera columna de la llave primaria, asi que la
-- subconsulta resuelve por indice sin necesidad de uno nuevo.


-- ---------------------------------------------------------------------------
-- El borrador
-- ---------------------------------------------------------------------------
-- La opcion natural -practica.estado en 'borrador'/'finalizada'- no cabe.
-- practica_elemento tiene un check que exige los campos completos segun el
-- metodo, y un trigger AFTER INSERT que descuenta el inventario en el acto. Un
-- producto "Pendiente" no es una fila valida de esa tabla, y para que lo fuera
-- habria que aflojar el check y condicionar los dos triggers: cuatro piezas ya
-- probadas, tocadas para dar soporte a algo que ni siquiera es un hecho
-- ocurrido. Y el check aflojado se queda aflojado para siempre, incluso para
-- las practicas finalizadas, que es donde de verdad importa.
--
-- Asi, `practica` conserva su invariante: una fila en practica es un hecho
-- ocurrido, completo, en una sola transaccion.
create table public.practica_borrador (
  -- Uno por persona. La pantalla captura una practica a la vez, y una llave
  -- primaria sobre usuario_id hace que "recuperar mi borrador" sea un select
  -- sin ambiguedad y que guardar sea un upsert sin carreras.
  usuario_id     uuid primary key references public.perfil (id) on delete cascade,

  -- Opaco para la base a proposito. Lo que va dentro lleva su propio `version`
  -- y el frontend descarta lo que no entienda: un borrador que se pierde es una
  -- molestia, un practica_elemento incompleto que se cuela a Reportes es un
  -- dato malo.
  contenido      jsonb not null,
  actualizado_en timestamptz not null default now()
);

comment on table public.practica_borrador is
  'La captura a medio hacer, una por persona. No es una practica: es la hoja de trabajo de quien la esta llenando.';

create or replace function private.asignar_borrador()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- El cliente NO decide de quien es el borrador. Al reves que en movimiento
  -- -donde el valor del cliente gana y lo que protege es almacen_id- aqui la
  -- RLS se ancla justo en usuario_id, asi que el trigger lo impone.
  --
  -- El coalesce al reves cubre a quien corre sin sesion: el ETL, un job o las
  -- pruebas, donde auth.uid() es NULL.
  new.usuario_id     := coalesce((select auth.uid()), new.usuario_id);
  new.actualizado_en := now();
  return new;
end;
$$;

create trigger practica_borrador_asigna_dueno
  before insert or update on public.practica_borrador
  for each row execute function private.asignar_borrador();


-- ---------------------------------------------------------------------------
-- registrar_practica: 1 cabecera + N elementos + M observaciones, atomico
-- ---------------------------------------------------------------------------
-- security invoker y no definer: la funcion no le presta a nadie privilegios
-- que no tenga. La RLS de practica y de practica_elemento sigue mandando, y un
-- usuario de rol consulta que la llame recibe 42501. Mismo criterio que
-- vincular_asignatura y resolver_pendiente.
create or replace function public.registrar_practica(
  p_programa          bigint,
  p_laboratorio       bigint,
  p_asignatura        bigint,
  p_practica_catalogo bigint,
  p_fecha             date,
  p_observaciones     text,
  p_elementos         jsonb
) returns text
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_practica bigint;
  v_folio    text;
  v_elemento jsonb;
  v_metodo   public.metodo_control;
  v_id       bigint;
  v_motivo   text;
begin
  if p_elementos is null
     or jsonb_typeof(p_elementos) <> 'array'
     or jsonb_array_length(p_elementos) = 0 then
    raise exception 'Una practica necesita al menos un producto';
  end if;

  -- folio, almacen_id y registrado_por los pone practica_asigna_folio. Se
  -- omiten a proposito: las tres son NOT NULL, y en Postgres los constraints se
  -- comprueban DESPUES de los triggers BEFORE ROW, asi que omitirlas es
  -- correcto y ademas es la unica forma de que el cliente no las falsee.
  insert into public.practica (programa_educativo_id, laboratorio_id, asignatura_id,
                               practica_catalogo_id, fecha, observaciones)
  values (p_programa, p_laboratorio, p_asignatura, p_practica_catalogo,
          coalesce(p_fecha, current_date), p_observaciones)
  returning id, folio into v_practica, v_folio;

  for v_elemento in select * from jsonb_array_elements(p_elementos)
  loop
    -- El metodo lo decide la base leyendo QUE ES la cosa. Lo que mande el
    -- cliente en el json se ignora: es el hueco que esta migracion cierra.
    select public.metodo_de_control(a.clasificacion)
      into v_metodo
      from public.existencia e
      join public.articulo  a on a.id = e.articulo_id
     where e.id = (v_elemento->>'existencia_id')::bigint;

    if v_metodo is null then
      raise exception 'La existencia % no existe', v_elemento->>'existencia_id';
    end if;

    -- Los `case` son lo que hace que un peso_inicial mandado sobre un equipo se
    -- descarte ANTES de llegar al check, en vez de reventar contra
    -- practica_elemento_campos_por_metodo con un mensaje que nadie entiende.
    insert into public.practica_elemento (
      practica_id, existencia_id, metodo_control,
      peso_inicial, peso_final,
      cantidad_entregada, cantidad_devuelta, cantidad_danada,
      estado_salida, estado_devolucion,
      observaciones)
    values (
      v_practica,
      (v_elemento->>'existencia_id')::bigint,
      v_metodo,
      case when v_metodo = 'peso' then (v_elemento->>'peso_inicial')::numeric end,
      case when v_metodo = 'peso' then (v_elemento->>'peso_final')::numeric end,
      case when v_metodo = 'cantidad' then (v_elemento->>'cantidad_entregada')::numeric end,
      case when v_metodo = 'cantidad' then (v_elemento->>'cantidad_devuelta')::numeric end,
      case when v_metodo = 'cantidad' then (v_elemento->>'cantidad_danada')::numeric end,
      case when v_metodo = 'prestamo'
           then (v_elemento->>'estado_salida')::public.funcionamiento_equipo end,
      case when v_metodo = 'prestamo'
           then (v_elemento->>'estado_devolucion')::public.funcionamiento_equipo end,
      nullif(btrim(coalesce(v_elemento->>'observaciones', '')), ''))
    returning id into v_id;

    for v_motivo in
      select jsonb_array_elements_text(coalesce(v_elemento->'motivos', '[]'::jsonb))
    loop
      insert into public.practica_elemento_observacion (practica_elemento_id, motivo)
      values (v_id, v_motivo)
      on conflict do nothing;
    end loop;
  end loop;

  return v_folio;
end;
$$;

comment on function public.registrar_practica(bigint, bigint, bigint, bigint, date, text, jsonb) is
  'Registra una practica completa en una transaccion y devuelve su folio. El metodo de control lo deriva de la clasificacion del articulo: lo que mande el cliente se ignora.';

revoke all on function public.registrar_practica(
  bigint, bigint, bigint, bigint, date, text, jsonb) from public, anon;
grant execute on function public.registrar_practica(
  bigint, bigint, bigint, bigint, date, text, jsonb) to authenticated;


-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
-- Nota de rendimiento: toda llamada a funcion va envuelta en (select ...). Sin
-- eso Postgres la evalua una vez POR FILA en vez de una vez por sentencia.
alter table public.practica_elemento_observacion enable row level security;
alter table public.practica_borrador            enable row level security;

revoke all on public.practica_elemento_observacion,
              public.practica_borrador from anon;

-- Calcado de practica_observacion: la politica va contra el elemento padre.
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
  with check (exists (select 1 from public.practica_elemento e
                       where e.id = practica_elemento_id
                         and ((select private.es_admin())
                              or e.almacen_id = (select private.almacen_actual()))));

-- El borrador es de quien lo escribe, y de nadie mas. SIN politica de admin, y
-- es deliberado: un admin no tiene por que leer la captura a medio hacer de un
-- responsable. No es un dato del sistema, es su hoja de trabajo. Lo que el
-- admin si ve -y corrige- es la practica ya finalizada.
create policy practica_borrador_propio on public.practica_borrador
  for all to authenticated
  using      (usuario_id = (select auth.uid()))
  with check (usuario_id = (select auth.uid()));
```

---

- [ ] **Paso 5: Correr las pruebas de esquema y confirmar que pasan**

```bash
supabase db reset
supabase test db
```

Esperado: `esquema.test.sql` en verde con sus 71. `rls.test.sql` sigue en verde
con 73 — todavía no se ha tocado.

Si el aserto de los ocho motivos de `cantidad` falla contando 5, es que el
`update` no corrió: revisa que las claves del `values` coincidan exactamente
con las de `seed.sql` (`material_daniado`, con `ni`, no `ñ`).

---

- [ ] **Paso 6: Escribir las pruebas de RLS, que deben fallar**

En `supabase/tests/database/rls.test.sql`, sube `plan(73)` a `plan(86)` y agrega
esto antes de `select * from finish();`. Reusa los helpers que ya están
definidos arriba en ese archivo: `pg_temp.como(correo)`,
`pg_temp.como_postgres()` y `pg_temp.id_almacen(clave)`.

```sql
-- ---------------------------------------------------------------------------
-- Datos de trabajo para practicas (como postgres, sin RLS)
-- ---------------------------------------------------------------------------
select pg_temp.como_postgres();

-- Una practica por almacen, cada una con un elemento, para poder probar que un
-- responsable escribe en la suya y no en la ajena.
insert into public.practica (id, programa_educativo_id, laboratorio_id, registrado_por)
overriding system value
select 900801,
       (select id from public.programa_educativo limit 1),
       l.id,
       (select id from public.perfil where nombre = 'Responsable N3')
  from public.laboratorio l
  join public.almacen a on a.id = l.almacen_id
 where a.clave = 'N3' limit 1;

insert into public.practica (id, programa_educativo_id, laboratorio_id, registrado_por)
overriding system value
select 900802,
       (select id from public.programa_educativo limit 1),
       l.id,
       (select id from public.perfil where nombre = 'Responsable N4')
  from public.laboratorio l
  join public.almacen a on a.id = l.almacen_id
 where a.clave = 'N4' limit 1;

-- Un elemento en cada una, sobre una existencia del almacen que le toca.
insert into public.practica_elemento (id, practica_id, existencia_id, metodo_control,
                                      cantidad_entregada)
overriding system value
select 900811, 900801, e.id, 'cantidad', 1
  from public.existencia e
 where e.almacen_id = pg_temp.id_almacen('N3') limit 1;

insert into public.practica_elemento (id, practica_id, existencia_id, metodo_control,
                                      cantidad_entregada)
overriding system value
select 900812, 900802, e.id, 'cantidad', 1
  from public.existencia e
 where e.almacen_id = pg_temp.id_almacen('N4') limit 1;


-- ---------------------------------------------------------------------------
-- practica_elemento_observacion
-- ---------------------------------------------------------------------------
select pg_temp.como('n3@uaeh.local');

select lives_ok(
  $$ insert into public.practica_elemento_observacion (practica_elemento_id, motivo)
     values (900811, 'material_daniado') $$,
  'Un responsable observa un elemento de su propio almacen'
);

select throws_ok(
  $$ insert into public.practica_elemento_observacion (practica_elemento_id, motivo)
     values (900812, 'material_daniado') $$,
  '42501', null,
  'Un responsable de N3 NO observa un elemento de N4'
);

-- La lectura es abierta: la practica es el documento que respalda un consumo, y
-- N4 tiene que poder ver por que N3 descontó lo que descontó.
select is(
  (select count(*)::int from public.practica_elemento_observacion
    where practica_elemento_id = 900811),
  1,
  'Las observaciones de cualquier almacen se leen'
);

select pg_temp.como('lectura@uaeh.local');

select throws_ok(
  $$ insert into public.practica_elemento_observacion (practica_elemento_id, motivo)
     values (900811, 'otro') $$,
  '42501', null,
  'El rol consulta no observa nada'
);

select pg_temp.como('admin@uaeh.local');

select lives_ok(
  $$ insert into public.practica_elemento_observacion (practica_elemento_id, motivo)
     values (900812, 'otro') $$,
  'El admin observa en cualquier almacen'
);


-- ---------------------------------------------------------------------------
-- practica_borrador: la hoja de trabajo de cada quien
-- ---------------------------------------------------------------------------
select pg_temp.como('n3@uaeh.local');

select lives_ok(
  $$ insert into public.practica_borrador (usuario_id, contenido)
     values ((select auth.uid()), '{"version":1}'::jsonb) $$,
  'Cada quien guarda su propio borrador'
);

select is(
  (select count(*)::int from public.practica_borrador),
  1,
  'Un responsable ve su borrador'
);

-- El trigger reescribe usuario_id al del que llama. Sin eso, el WITH CHECK lo
-- rechazaria igual, pero con un 42501 en vez de guardando lo correcto.
select pg_temp.como('n4@uaeh.local');

select lives_ok(
  $$ insert into public.practica_borrador (usuario_id, contenido)
     values ((select id from public.perfil where nombre = 'Responsable N3'),
             '{"version":1}'::jsonb) $$,
  'Mandar el usuario_id de otro no falla: el trigger lo reescribe al propio'
);

select is(
  (select count(*)::int from public.practica_borrador),
  1,
  'N4 sigue viendo solo el suyo, no el que intento suplantar'
);

select pg_temp.como('admin@uaeh.local');

select is(
  (select count(*)::int from public.practica_borrador),
  0,
  'Ni el admin lee el borrador de otro: no es un dato del sistema, es una hoja de trabajo'
);


-- ---------------------------------------------------------------------------
-- registrar_practica
-- ---------------------------------------------------------------------------
select pg_temp.como('lectura@uaeh.local');

select throws_ok(
  $$ select public.registrar_practica(
       (select id from public.programa_educativo limit 1),
       (select l.id from public.laboratorio l
          join public.almacen a on a.id = l.almacen_id
         where a.clave = 'N3' limit 1),
       null, null, current_date, null,
       jsonb_build_array(jsonb_build_object(
         'existencia_id', (select id from public.existencia
                            where almacen_id = pg_temp.id_almacen('N3') limit 1),
         'cantidad_entregada', 1))) $$,
  '42501', null,
  'El rol consulta no registra practicas'
);

select pg_temp.como('n3@uaeh.local');

select throws_ok(
  $$ select public.registrar_practica(
       (select id from public.programa_educativo limit 1),
       (select l.id from public.laboratorio l
          join public.almacen a on a.id = l.almacen_id
         where a.clave = 'N4' limit 1),
       null, null, current_date, null,
       jsonb_build_array(jsonb_build_object(
         'existencia_id', (select id from public.existencia
                            where almacen_id = pg_temp.id_almacen('N4') limit 1),
         'cantidad_entregada', 1))) $$,
  '42501', null,
  'Un responsable de N3 no registra una practica en un laboratorio de N4'
);
```

---

- [ ] **Paso 7: Correr las pruebas de RLS y confirmar que pasan**

```bash
supabase db reset
supabase test db
```

Esperado: las dos suites en verde, `esquema.test.sql` con 71 y `rls.test.sql`
con 86.

**Si el `lives_ok` del borrador de N4 falla con 42501**, el trigger no está
imponiendo `usuario_id`: revisa que el `coalesce` esté en el orden
`(auth.uid(), new.usuario_id)` y no al revés.

---

- [ ] **Paso 8: Reflejar los motivos en el seed y en los datos iniciales**

El `update` de la migración arregla lo que ya esté cargado. Falta que un
`db reset` desde cero produzca lo mismo, y que `datos-iniciales.sql` —que sí
llega a producción— no reintroduzca el orden viejo.

En **ambos** archivos, `supabase/seed.sql` y `supabase/datos-iniciales.sql`,
sustituye el `insert into public.motivo_observacion (...)` por:

```sql
-- Los nueve motivos son las casillas del prototipo. Como catalogo y no como
-- nueve columnas booleanas: agregar el decimo es un insert, no una migracion
-- mas un redespliegue del frontend.
--
-- `metodos` dice en que panel se ofrece cada uno. Los tres consumibles
-- -no tenemos, contaminado, se termino- salen tanto en peso como en cantidad:
-- una caja de pipetas se termina y un lote de cajas Petri se contamina igual
-- que un frasco. Los dos "daniado" van cada uno a su metodo, donde el nombre
-- ya dice a que se refiere.
insert into public.motivo_observacion (clave, etiqueta, orden, metodos) values
  ('no_tenemos',      'No tenemos',       1, array['peso','cantidad']::public.metodo_control[]),
  ('contaminado',     'Contaminado',      2, array['peso','cantidad']::public.metodo_control[]),
  ('se_termino',      'Se terminó',       3, array['peso','cantidad']::public.metodo_control[]),
  ('material_daniado','Material dañado',  4, array['cantidad']::public.metodo_control[]),
  ('equipo_daniado',  'Equipo dañado',    5, array['prestamo']::public.metodo_control[]),
  ('prestamo_n4',     'Préstamo N4',      6, array['peso','cantidad','prestamo']::public.metodo_control[]),
  ('prestamo_n3',     'Préstamo N3',      7, array['peso','cantidad','prestamo']::public.metodo_control[]),
  ('prestamo_lum',    'Préstamo LUM',     8, array['peso','cantidad','prestamo']::public.metodo_control[]),
  ('otro',            'Otro',             9, array['peso','cantidad','prestamo']::public.metodo_control[]);
```

En `datos-iniciales.sql`, conserva el `on conflict (clave) do nothing` si el
original lo trae. Compruébalo antes de pegar: ese archivo es idempotente a
propósito y este plan no debe quitarle esa propiedad.

Luego:

```bash
supabase db reset
supabase test db
```

Esperado: las dos suites siguen en verde. La prueba de los ocho motivos de
`cantidad` ahora pasa por el seed, no por el `update` de la migración, y tiene
que dar lo mismo: ése es el punto.

---

- [ ] **Paso 9: Regenerar los tipos**

```bash
pnpm gen:types
pnpm typecheck
```

Esperado: `typecheck` en cero. En `src/types/database.ts` tienen que aparecer
`practica_elemento_observacion`, `practica_borrador`, `metodo_de_control`,
`registrar_practica`, y la columna `metodo_control` dentro de
`existencia_listado`.

**Ojo con el tipo de la columna de la vista.** Supabase genera las columnas de
las vistas como anulables aunque la expresión no pueda serlo, así que
`metodo_control` va a salir como `Database['public']['Enums']['metodo_control'] | null`.
No lo corrijas a mano: la Tarea 3 lo resuelve donde se consume.

---

- [ ] **Paso 10: Punto de commit**

Deja el árbol limpio y verde y **para aquí**. Los commits los hace la persona.

Archivos tocados:

```
supabase/migrations/20260903120000_practicas.sql   (nuevo)
supabase/tests/database/esquema.test.sql
supabase/tests/database/rls.test.sql
supabase/seed.sql
supabase/datos-iniciales.sql
src/types/database.ts                              (generado)
```

Mensaje sugerido: `feat(practicas): metodo de control derivado, observaciones por producto, borrador y RPC`

---

## Tarea 2: `metodos.ts`, cómo se ve cada método

Etiqueta, icono y color de los tres métodos de control, en un solo lugar. Si
esto vive repartido, la tabla dice "Peso" y el panel dice "Control por Peso" con
otro icono, y nadie se entera hasta que alguien lo ve en pantalla.

**Archivos:**
- Crear: `src/features/practicas/metodos.ts`
- Test: `src/features/practicas/metodos.test.ts`

**Interfaces:**
- Consume: `Enums<'metodo_control'>` y `Enums<'clasificacion_articulo'>` de
  `@/types/database` (Tarea 1).
- Produce:
  - `type Metodo = Enums<'metodo_control'>` y `type Clasificacion = Enums<'clasificacion_articulo'>`
  - `ASPECTO_METODO: Record<Metodo, { etiqueta: string; titulo: string; icono: string; color: string }>`
  - `aspectoDeMetodo(metodo: Metodo | null): { etiqueta; titulo; icono; color }`
  - `ETIQUETA_CLASIFICACION: Record<Enums<'clasificacion_articulo'>, string>`

---

- [ ] **Paso 1: Escribir la prueba, que debe fallar**

```ts
// src/features/practicas/metodos.test.ts
import { describe, expect, test } from 'vitest'

import { aspectoDeMetodo, ASPECTO_METODO, ETIQUETA_CLASIFICACION } from './metodos'

describe('aspectoDeMetodo', () => {
  test('cada método tiene etiqueta, título, icono y color', () => {
    for (const metodo of ['peso', 'cantidad', 'prestamo'] as const) {
      const aspecto = aspectoDeMetodo(metodo)

      expect(aspecto.etiqueta.length).toBeGreaterThan(0)
      expect(aspecto.titulo.length).toBeGreaterThan(0)
      expect(aspecto.icono).toMatch(/^mdi:/)
      expect(aspecto.color.length).toBeGreaterThan(0)
    }
  })

  test('el título es el del Panel de Control, con el método dentro', () => {
    expect(aspectoDeMetodo('peso').titulo).toBe('Control por Peso')
    expect(aspectoDeMetodo('cantidad').titulo).toBe('Control por Cantidad')
    expect(aspectoDeMetodo('prestamo').titulo).toBe('Control por Préstamo')
  })

  // La columna metodo_control de la vista sale anulable en los tipos generados
  // aunque la expresión no pueda serlo. Que un null no reviente la tabla.
  test('un método nulo devuelve un aspecto neutro en vez de reventar', () => {
    const aspecto = aspectoDeMetodo(null)

    expect(aspecto.etiqueta).toBe('Sin método')
    expect(aspecto.icono).toMatch(/^mdi:/)
  })

  test('no se le olvida ningún método del enum', () => {
    expect(Object.keys(ASPECTO_METODO).sort()).toEqual(['cantidad', 'peso', 'prestamo'])
  })
})

describe('ETIQUETA_CLASIFICACION', () => {
  test('cubre las seis clasificaciones del formato unificado', () => {
    expect(Object.keys(ETIQUETA_CLASIFICACION).sort()).toEqual([
      'componente',
      'equipo',
      'insumo',
      'material',
      'materia_biologica',
      'reactivo',
    ])
  })

  test('la etiqueta es la que ve el usuario, en español y con acentos', () => {
    expect(ETIQUETA_CLASIFICACION.materia_biologica).toBe('Materia biológica')
    expect(ETIQUETA_CLASIFICACION.reactivo).toBe('Reactivo')
  })
})
```

---

- [ ] **Paso 2: Correr y confirmar que falla**

```bash
pnpm vitest run src/features/practicas/metodos.test.ts
```

Esperado: FAIL, `Failed to resolve import "./metodos"`.

---

- [ ] **Paso 3: Escribir el módulo**

```ts
// src/features/practicas/metodos.ts
import type { Enums } from '@/types/database'

export type Metodo = Enums<'metodo_control'>
export type Clasificacion = Enums<'clasificacion_articulo'>

type AspectoMetodo = {
  /** Lo que dice el chip de la tabla: una palabra. */
  etiqueta: string
  /** El encabezado del Panel de Control. */
  titulo: string
  icono: string
  /** Token del tema, nunca un hex: un hex suelto no responde al modo oscuro. */
  color: string
}

/**
 * Cómo se ve cada método de control. Vive aquí y no repartido por los
 * componentes porque si no, la tabla dice "Peso" y el panel dice otra cosa con
 * otro icono, y eso no lo atrapa ninguna prueba de tipos.
 *
 * Qué método le toca a cada existencia NO se decide aquí: lo decide
 * `metodo_de_control()` en la base y llega en la fila de `existencia_listado`.
 * Repetir ese mapa en TypeScript es justo lo que la migración vino a evitar.
 */
export const ASPECTO_METODO: Record<Metodo, AspectoMetodo> = {
  peso: {
    etiqueta: 'Peso',
    titulo: 'Control por Peso',
    icono: 'mdi:scale-balance',
    color: 'institucional.main',
  },
  cantidad: {
    etiqueta: 'Cantidad',
    titulo: 'Control por Cantidad',
    icono: 'mdi:package-variant-closed',
    color: 'secondary.main',
  },
  prestamo: {
    etiqueta: 'Préstamo',
    titulo: 'Control por Préstamo',
    icono: 'mdi:microscope',
    color: 'info.main',
  },
}

const NEUTRO: AspectoMetodo = {
  etiqueta: 'Sin método',
  titulo: 'Sin método de control',
  icono: 'mdi:help-circle-outline',
  color: 'text.disabled',
}

/**
 * `metodo_control` sale anulable de los tipos generados: Supabase marca así
 * todas las columnas de una vista, aunque la expresión que la produce no pueda
 * devolver nulo. En vez de un `!` en cada uso, el nulo tiene su aspecto.
 */
export function aspectoDeMetodo(metodo: Metodo | null | undefined): AspectoMetodo {
  if (metodo === null || metodo === undefined) return NEUTRO
  return ASPECTO_METODO[metodo] ?? NEUTRO
}

/** Las seis hojas del formato unificado, como las lee una persona. */
export const ETIQUETA_CLASIFICACION: Record<Clasificacion, string> = {
  reactivo: 'Reactivo',
  material: 'Material',
  insumo: 'Insumo',
  equipo: 'Equipo',
  componente: 'Componente',
  materia_biologica: 'Materia biológica',
}
```

---

- [ ] **Paso 4: Correr y confirmar que pasa**

```bash
pnpm vitest run src/features/practicas/metodos.test.ts
pnpm typecheck
```

Esperado: las 6 pruebas en verde y `typecheck` en cero.

**Si `info.main` no existe en el tema**, `typecheck` no lo va a atrapar —es un
string— pero MUI lo va a ignorar en tiempo de ejecución. Comprueba en
`src/tema.ts` que la paleta lo declare; si no, usa `primary.light`.

---

- [ ] **Paso 5: Punto de commit**

Archivos: `src/features/practicas/metodos.ts`, `src/features/practicas/metodos.test.ts`.
Mensaje sugerido: `feat(practicas): etiquetas e iconos de los tres metodos de control`

---

## Tarea 3: `esquemas.ts`, la forma de la captura y cuándo está completa

El tipo de lo que se captura por producto, la validación de la cabecera, y —lo
importante— **una sola función que decide si un producto está completo**. Ese
criterio aparece en tres sitios de la pantalla (el chip de la fila, el contador
"(n/m completados)" y si Finalizar se apaga) y tiene que ser el mismo que
`practica_elemento_campos_por_metodo` exige en la base. Escrito una vez y
probado.

**Archivos:**
- Crear: `src/features/practicas/esquemas.ts`
- Test: `src/features/practicas/esquemas.test.ts`

**Interfaces:**
- Consume: `Metodo`, `Clasificacion` de `./metodos` (Tarea 2);
  `Enums<'funcionamiento_equipo'>` de `@/types/database`.
- Produce:
  - `type ElementoCaptura` — la fila de la captura, con todos sus campos
  - `type FilaExistencia` — la forma mínima de una fila de `existencia_listado`
  - `elementoDesdeExistencia(fila: FilaExistencia): ElementoCaptura`
  - `consumoDe(el): number | null` y `perdidasDe(el): number | null`
  - `errorDeElemento(el): string | null`
  - `estaCompleto(el): boolean`
  - `esquemaCabecera` (zod) y `type Cabecera = z.infer<typeof esquemaCabecera>`
  - `type PayloadElemento` y `aPayloadElementos(elementos): PayloadElemento[]`

---

- [ ] **Paso 1: Escribir la prueba, que debe fallar**

```ts
// src/features/practicas/esquemas.test.ts
import { describe, expect, test } from 'vitest'

import {
  aPayloadElementos,
  consumoDe,
  elementoDesdeExistencia,
  errorDeElemento,
  esquemaCabecera,
  estaCompleto,
  perdidasDe,
  type ElementoCaptura,
} from './esquemas'

const FILA = {
  id: 12,
  codigo: 'N3-00042',
  nombre_canonico: 'Etanol 96%',
  clasificacion: 'reactivo' as const,
  unidad_base: 'ml',
  almacen_clave: 'N3',
  cantidad: 2000,
  ubicacion: 'Lab 2',
  metodo_control: 'peso' as const,
}

function peso(campos: Partial<ElementoCaptura> = {}): ElementoCaptura {
  return { ...elementoDesdeExistencia(FILA), ...campos }
}

function cantidad(campos: Partial<ElementoCaptura> = {}): ElementoCaptura {
  return {
    ...elementoDesdeExistencia({
      ...FILA,
      clasificacion: 'material',
      metodo_control: 'cantidad',
    }),
    ...campos,
  }
}

function prestamo(campos: Partial<ElementoCaptura> = {}): ElementoCaptura {
  return {
    ...elementoDesdeExistencia({
      ...FILA,
      clasificacion: 'equipo',
      metodo_control: 'prestamo',
    }),
    ...campos,
  }
}

describe('elementoDesdeExistencia', () => {
  test('nace con todos los campos de captura vacíos', () => {
    const el = peso()

    expect(el.existenciaId).toBe(12)
    expect(el.pesoInicial).toBeNull()
    expect(el.pesoFinal).toBeNull()
    expect(el.motivos).toEqual([])
    expect(el.observaciones).toBe('')
  })

  // La columna sale anulable de los tipos generados aunque la expresión no
  // pueda serlo. Que un nulo no deje al elemento sin método.
  test('un metodo_control nulo se deriva de la clasificación', () => {
    expect(elementoDesdeExistencia({ ...FILA, metodo_control: null }).metodo).toBe('peso')
  })
})

describe('consumoDe y perdidasDe', () => {
  test('el consumo es inicial menos final', () => {
    expect(consumoDe(peso({ pesoInicial: 526, pesoFinal: 520 }))).toBe(6)
  })

  test('sin los dos pesos no hay consumo que mostrar', () => {
    expect(consumoDe(peso({ pesoInicial: 526 }))).toBeNull()
  })

  test('las pérdidas son entregada menos devuelta menos dañada', () => {
    expect(
      perdidasDe(cantidad({ cantidadEntregada: 10, cantidadDevuelta: 7, cantidadDanada: 2 })),
    ).toBe(1)
  })

  test('devuelta y dañada nulas cuentan como cero', () => {
    expect(perdidasDe(cantidad({ cantidadEntregada: 10 }))).toBe(10)
  })

  test('un método que no es el suyo no calcula nada', () => {
    expect(consumoDe(cantidad({ cantidadEntregada: 10 }))).toBeNull()
    expect(perdidasDe(peso({ pesoInicial: 526, pesoFinal: 520 }))).toBeNull()
  })
})

describe('errorDeElemento — peso', () => {
  test('faltan los dos pesos', () => {
    expect(errorDeElemento(peso())).toBe('Captura el peso inicial y el final')
  })

  // El mismo par que practica_elemento_peso_coherente exige en la base. Si esto
  // se relaja, la persona llena todo y revienta al finalizar.
  test('el peso final no puede ser mayor que el inicial', () => {
    expect(errorDeElemento(peso({ pesoInicial: 520, pesoFinal: 526 }))).toBe(
      'El peso final no puede ser mayor que el inicial',
    )
  })

  test('un peso negativo no existe', () => {
    expect(errorDeElemento(peso({ pesoInicial: -1, pesoFinal: -2 }))).toBe(
      'Los pesos no pueden ser negativos',
    )
  })

  test('con los dos pesos coherentes, no hay error', () => {
    expect(errorDeElemento(peso({ pesoInicial: 526, pesoFinal: 520 }))).toBeNull()
  })

  test('pesar lo mismo antes y después es válido: consumo cero', () => {
    expect(errorDeElemento(peso({ pesoInicial: 526, pesoFinal: 526 }))).toBeNull()
  })
})

describe('errorDeElemento — cantidad', () => {
  test('falta la entregada', () => {
    expect(errorDeElemento(cantidad())).toBe('Captura la cantidad entregada')
  })

  // practica_elemento_devolucion_coherente.
  test('lo devuelto y lo dañado no pueden sumar más de lo entregado', () => {
    expect(
      errorDeElemento(cantidad({ cantidadEntregada: 5, cantidadDevuelta: 4, cantidadDanada: 2 })),
    ).toBe('Lo devuelto y lo dañado no pueden sumar más de lo entregado')
  })

  test('una cantidad negativa no existe', () => {
    expect(errorDeElemento(cantidad({ cantidadEntregada: -1 }))).toBe(
      'Las cantidades no pueden ser negativas',
    )
  })

  test('entregada sola es válida: todo se perdió', () => {
    expect(errorDeElemento(cantidad({ cantidadEntregada: 10 }))).toBeNull()
  })
})

describe('errorDeElemento — préstamo', () => {
  test('falta el estado de salida', () => {
    expect(errorDeElemento(prestamo())).toBe('Elige el estado de salida del equipo')
  })

  // El de devolución es opcional a propósito: un equipo puede quedarse prestado
  // de un día para otro, y el trigger sólo actualiza funcionamiento si viene.
  test('el estado de devolución es opcional', () => {
    expect(errorDeElemento(prestamo({ estadoSalida: 'correcto' }))).toBeNull()
  })

  test('con los dos estados tampoco hay error', () => {
    expect(
      errorDeElemento(prestamo({ estadoSalida: 'correcto', estadoDevolucion: 'presenta_fallas' })),
    ).toBeNull()
  })
})

describe('estaCompleto', () => {
  test('es exactamente lo contrario de tener error', () => {
    expect(estaCompleto(peso({ pesoInicial: 526, pesoFinal: 520 }))).toBe(true)
    expect(estaCompleto(peso())).toBe(false)
  })
})

describe('esquemaCabecera', () => {
  const valida = {
    programaId: 1,
    semestre: 3,
    asignaturaId: 2,
    practicaCatalogoId: 4,
    laboratorioId: 5,
    fecha: '2026-09-03',
  }

  test('una cabecera completa pasa', () => {
    expect(esquemaCabecera.safeParse(valida).success).toBe(true)
  })

  test('el semestre nulo pasa: es una optativa, no un hueco', () => {
    expect(esquemaCabecera.safeParse({ ...valida, semestre: null }).success).toBe(true)
  })

  test.each([
    ['programaId', 'Elige el programa educativo'],
    ['asignaturaId', 'Elige la asignatura'],
    ['practicaCatalogoId', 'Elige la práctica'],
    ['laboratorioId', 'Elige el laboratorio'],
  ])('sin %s el mensaje lo dice en español', (campo, mensaje) => {
    const resultado = esquemaCabecera.safeParse({ ...valida, [campo]: null })

    expect(resultado.success).toBe(false)
    if (!resultado.success) {
      expect(resultado.error.issues[0].message).toBe(mensaje)
    }
  })
})

describe('aPayloadElementos', () => {
  test('cada método manda sólo sus campos', () => {
    const payload = aPayloadElementos([
      peso({ pesoInicial: 526, pesoFinal: 520, motivos: ['se_termino'] }),
      cantidad({ cantidadEntregada: 10, cantidadDevuelta: 8 }),
      prestamo({ estadoSalida: 'correcto', observaciones: '  con rayón  ' }),
    ])

    expect(payload[0]).toEqual({
      existencia_id: 12,
      peso_inicial: 526,
      peso_final: 520,
      observaciones: null,
      motivos: ['se_termino'],
    })

    expect(payload[1]).toEqual({
      existencia_id: 12,
      cantidad_entregada: 10,
      cantidad_devuelta: 8,
      cantidad_danada: null,
      observaciones: null,
      motivos: [],
    })

    expect(payload[2]).toEqual({
      existencia_id: 12,
      estado_salida: 'correcto',
      estado_devolucion: null,
      observaciones: 'con rayón',
      motivos: [],
    })
  })

  // El consumo y las pérdidas son columnas generadas: la aritmética vive en la
  // base porque una resta que calcula el frontend se puede equivocar en
  // silencio. Que no se cuelen aunque se muestren en pantalla. Y metodo_control
  // tampoco viaja: derivarlo en la base es el hueco que cerró la Tarea 1.
  test('no manda consumo, perdidas ni metodo_control', () => {
    const [fila] = aPayloadElementos([peso({ pesoInicial: 526, pesoFinal: 520 })])

    expect(fila).not.toHaveProperty('consumo')
    expect(fila).not.toHaveProperty('perdidas')
    expect(fila).not.toHaveProperty('metodo_control')
  })
})
```

---

- [ ] **Paso 2: Correr y confirmar que falla**

```bash
pnpm vitest run src/features/practicas/esquemas.test.ts
```

Esperado: FAIL, `Failed to resolve import "./esquemas"`.

---

- [ ] **Paso 3: Escribir el módulo**

```ts
// src/features/practicas/esquemas.ts
import { z } from 'zod'

import type { Enums } from '@/types/database'
import type { Clasificacion, Metodo } from './metodos'

export type Funcionamiento = Enums<'funcionamiento_equipo'>

/**
 * Un producto dentro de la captura en curso.
 *
 * Lleva junto lo que se muestra —código, nombre, cuánto hay— y lo que se
 * captura. Los dos viajan al borrador, así que restaurarlo no necesita volver a
 * consultar el inventario: si un producto se dio de baja mientras el borrador
 * dormía, la fila sigue legible y el error sale al finalizar, que es donde debe
 * salir.
 */
export type ElementoCaptura = {
  existenciaId: number
  codigo: string
  nombre: string
  clasificacion: Clasificacion
  unidadBase: string
  almacenClave: string
  ubicacion: string | null
  /** El saldo al momento de agregarlo. Informativo. */
  disponible: number
  /** Lo decide la base y llega en la fila; aquí nunca se recalcula. */
  metodo: Metodo

  pesoInicial: number | null
  pesoFinal: number | null

  cantidadEntregada: number | null
  cantidadDevuelta: number | null
  cantidadDanada: number | null

  estadoSalida: Funcionamiento | null
  estadoDevolucion: Funcionamiento | null

  observaciones: string
  motivos: string[]
}

/** La forma mínima de una fila de `existencia_listado` que esto necesita. */
export type FilaExistencia = {
  id: number
  codigo: string | null
  nombre_canonico: string | null
  clasificacion: Clasificacion | null
  unidad_base: string | null
  almacen_clave: string | null
  cantidad: number | null
  ubicacion: string | null
  metodo_control: Metodo | null
}

/**
 * Respaldo para cuando `metodo_control` llega nulo. No es que se espere que
 * pase —la expresión de la vista no puede devolver nulo— pero Supabase marca
 * anulables todas las columnas de una vista, y un `!` aquí sería confiar en eso
 * para siempre. Refleja `public.metodo_de_control()`; la base sigue mandando.
 */
function metodoDeRespaldo(clasificacion: Clasificacion | null): Metodo {
  if (clasificacion === 'reactivo') return 'peso'
  if (clasificacion === 'equipo') return 'prestamo'
  return 'cantidad'
}

export function elementoDesdeExistencia(fila: FilaExistencia): ElementoCaptura {
  return {
    existenciaId: fila.id,
    codigo: fila.codigo ?? '—',
    nombre: fila.nombre_canonico ?? 'Sin nombre',
    clasificacion: fila.clasificacion ?? 'material',
    unidadBase: fila.unidad_base ?? '',
    almacenClave: fila.almacen_clave ?? '',
    ubicacion: fila.ubicacion,
    disponible: fila.cantidad ?? 0,
    metodo: fila.metodo_control ?? metodoDeRespaldo(fila.clasificacion),

    pesoInicial: null,
    pesoFinal: null,
    cantidadEntregada: null,
    cantidadDevuelta: null,
    cantidadDanada: null,
    estadoSalida: null,
    estadoDevolucion: null,

    observaciones: '',
    motivos: [],
  }
}

// ---------------------------------------------------------------------------
// Lo calculado, sólo para mostrar
// ---------------------------------------------------------------------------
// `consumo` y `perdidas` son columnas generadas en la base. Estas dos funciones
// existen para pintar el número mientras se captura; lo que se guarda lo calcula
// Postgres. `aPayloadElementos` es quien garantiza que no se envíen.

export function consumoDe(el: ElementoCaptura): number | null {
  if (el.metodo !== 'peso') return null
  if (el.pesoInicial === null || el.pesoFinal === null) return null
  return el.pesoInicial - el.pesoFinal
}

export function perdidasDe(el: ElementoCaptura): number | null {
  if (el.metodo !== 'cantidad') return null
  if (el.cantidadEntregada === null) return null
  return el.cantidadEntregada - (el.cantidadDevuelta ?? 0) - (el.cantidadDanada ?? 0)
}

// ---------------------------------------------------------------------------
// Cuándo un producto está completo
// ---------------------------------------------------------------------------
/**
 * Devuelve el problema del producto, o `null` si no tiene ninguno.
 *
 * Es el espejo de `practica_elemento_campos_por_metodo`,
 * `practica_elemento_peso_coherente` y `practica_elemento_devolucion_coherente`.
 * Que estén los dos lados no es duplicación por gusto: la base es la que manda
 * y no se puede saltar, pero si el frontend no lo dice antes, la persona llena
 * los tres paneles y descubre el problema al finalizar, cuando ya no sabe cuál
 * de los productos fue.
 *
 * Si un check cambia en una migración, este archivo cambia con él.
 */
export function errorDeElemento(el: ElementoCaptura): string | null {
  if (el.metodo === 'peso') {
    if (el.pesoInicial === null || el.pesoFinal === null) {
      return 'Captura el peso inicial y el final'
    }
    if (el.pesoInicial < 0 || el.pesoFinal < 0) {
      return 'Los pesos no pueden ser negativos'
    }
    if (el.pesoFinal > el.pesoInicial) {
      return 'El peso final no puede ser mayor que el inicial'
    }
    return null
  }

  if (el.metodo === 'cantidad') {
    if (el.cantidadEntregada === null) return 'Captura la cantidad entregada'
    if (
      el.cantidadEntregada < 0 ||
      (el.cantidadDevuelta ?? 0) < 0 ||
      (el.cantidadDanada ?? 0) < 0
    ) {
      return 'Las cantidades no pueden ser negativas'
    }
    if ((el.cantidadDevuelta ?? 0) + (el.cantidadDanada ?? 0) > el.cantidadEntregada) {
      return 'Lo devuelto y lo dañado no pueden sumar más de lo entregado'
    }
    return null
  }

  // Préstamo. El estado de devolución es opcional a propósito: un equipo puede
  // quedarse prestado de un día para otro, y el trigger sólo actualiza
  // `existencia.funcionamiento` si viene.
  if (el.estadoSalida === null) return 'Elige el estado de salida del equipo'
  return null
}

export function estaCompleto(el: ElementoCaptura): boolean {
  return errorDeElemento(el) === null
}

// ---------------------------------------------------------------------------
// La cabecera
// ---------------------------------------------------------------------------
// Los mensajes van en el esquema y no en el JSX: así el texto que ve el usuario
// vive junto a la regla que lo produce.
const requerido = (mensaje: string) =>
  z.number({ error: mensaje }).int(mensaje).positive(mensaje)

export const esquemaCabecera = z.object({
  programaId: requerido('Elige el programa educativo'),
  /** `null` es "Optativa", que el plan de estudios sí contempla. */
  semestre: z.number().int().min(1).max(12).nullable(),
  asignaturaId: requerido('Elige la asignatura'),
  practicaCatalogoId: requerido('Elige la práctica'),
  laboratorioId: requerido('Elige el laboratorio'),
  fecha: z.string().min(1, 'Elige la fecha'),
})

export type Cabecera = z.infer<typeof esquemaCabecera>

// ---------------------------------------------------------------------------
// El payload de registrar_practica
// ---------------------------------------------------------------------------
export type PayloadElemento = {
  existencia_id: number
  peso_inicial?: number | null
  peso_final?: number | null
  cantidad_entregada?: number | null
  cantidad_devuelta?: number | null
  cantidad_danada?: number | null
  estado_salida?: Funcionamiento | null
  estado_devolucion?: Funcionamiento | null
  observaciones: string | null
  motivos: string[]
}

/**
 * Arma el objeto que va a la RPC **recorriendo el método**, no volcando el
 * elemento entero. Ésa es la propiedad que hace que un campo de otro método
 * sencillamente no exista en el envío.
 *
 * No manda `metodo_control`: lo deriva `registrar_practica` de la clasificación
 * del artículo, y es el hueco que la migración vino a cerrar. Tampoco manda
 * `consumo` ni `perdidas`, que son columnas generadas.
 */
export function aPayloadElementos(elementos: ElementoCaptura[]): PayloadElemento[] {
  return elementos.map((el) => {
    const comun = {
      existencia_id: el.existenciaId,
      observaciones: el.observaciones.trim() === '' ? null : el.observaciones.trim(),
      motivos: el.motivos,
    }

    if (el.metodo === 'peso') {
      return { ...comun, peso_inicial: el.pesoInicial, peso_final: el.pesoFinal }
    }

    if (el.metodo === 'cantidad') {
      return {
        ...comun,
        cantidad_entregada: el.cantidadEntregada,
        cantidad_devuelta: el.cantidadDevuelta,
        cantidad_danada: el.cantidadDanada,
      }
    }

    return { ...comun, estado_salida: el.estadoSalida, estado_devolucion: el.estadoDevolucion }
  })
}
```

---

- [ ] **Paso 4: Correr y confirmar que pasa**

```bash
pnpm vitest run src/features/practicas/esquemas.test.ts
pnpm typecheck
```

Esperado: las 27 pruebas en verde y `typecheck` en cero.

**Si los mensajes de zod no salen como los espera la prueba**, es la diferencia
entre zod 3 y zod 4: en zod 4 el parámetro es `{ error: '...' }`, no
`{ required_error: '...' }`. Este proyecto tiene zod 4 (`^4.4.3` en
`package.json`). No cambies la prueba para que pase: cambia el esquema.

---

- [ ] **Paso 5: Punto de commit**

Archivos: `src/features/practicas/esquemas.ts`, `src/features/practicas/esquemas.test.ts`.

Mensaje sugerido: `feat(practicas): la forma de la captura y cuando un producto esta completo`

---

## Tarea 4: `borrador.ts`, serializar y restaurar sin confiar en lo guardado

`practica_borrador.contenido` es `jsonb` opaco para la base: Postgres no valida
nada de lo que va dentro. Este módulo es la única puerta, y su trabajo real es
**descartar con calma** lo que no entienda. Un borrador que se pierde es una
molestia; un borrador medio restaurado que se registra como práctica es un dato
malo.

**Archivos:**
- Crear: `src/features/practicas/borrador.ts`
- Test: `src/features/practicas/borrador.test.ts`

**Interfaces:**
- Consume: `ElementoCaptura`, `Cabecera` de `./esquemas` (Tarea 3).
- Produce:
  - `VERSION_BORRADOR: 1`
  - `type CabeceraParcial = Partial<Cabecera>`
  - `type ContenidoBorrador = { version: number; cabecera: CabeceraParcial; elementos: ElementoCaptura[] }`
  - `serializarBorrador(cabecera, elementos): ContenidoBorrador`
  - `restaurarBorrador(crudo: unknown): { cabecera: CabeceraParcial; elementos: ElementoCaptura[] } | null`

---

- [ ] **Paso 1: Escribir la prueba, que debe fallar**

```ts
// src/features/practicas/borrador.test.ts
import { describe, expect, test } from 'vitest'

import { restaurarBorrador, serializarBorrador, VERSION_BORRADOR } from './borrador'
import { elementoDesdeExistencia } from './esquemas'

const ELEMENTO = {
  ...elementoDesdeExistencia({
    id: 12,
    codigo: 'N3-00042',
    nombre_canonico: 'Etanol 96%',
    clasificacion: 'reactivo' as const,
    unidad_base: 'ml',
    almacen_clave: 'N3',
    cantidad: 2000,
    ubicacion: 'Lab 2',
    metodo_control: 'peso' as const,
  }),
  pesoInicial: 526,
  pesoFinal: 520,
  motivos: ['se_termino'],
}

const CABECERA = {
  programaId: 1,
  semestre: 3,
  asignaturaId: 2,
  practicaCatalogoId: 4,
  laboratorioId: 5,
  fecha: '2026-09-03',
}

describe('serializar y restaurar', () => {
  test('ida y vuelta es identidad', () => {
    const guardado = serializarBorrador(CABECERA, [ELEMENTO])
    const recuperado = restaurarBorrador(JSON.parse(JSON.stringify(guardado)))

    expect(recuperado).toEqual({ cabecera: CABECERA, elementos: [ELEMENTO] })
  })

  test('lo guardado lleva la versión, que es lo que permite descartarlo después', () => {
    expect(serializarBorrador(CABECERA, []).version).toBe(VERSION_BORRADOR)
  })

  test('una cabecera a medias se guarda igual: para eso es un borrador', () => {
    const guardado = serializarBorrador({ programaId: 1 }, [])

    expect(restaurarBorrador(guardado)).toEqual({ cabecera: { programaId: 1 }, elementos: [] })
  })
})

describe('restaurarBorrador descarta lo que no entiende', () => {
  test('una versión distinta se descarta entera', () => {
    const viejo = { ...serializarBorrador(CABECERA, [ELEMENTO]), version: 999 }

    expect(restaurarBorrador(viejo)).toBeNull()
  })

  test.each([
    ['null', null],
    ['un número', 7],
    ['una cadena', 'borrador'],
    ['un arreglo', []],
    ['un objeto sin versión', { cabecera: {}, elementos: [] }],
    ['elementos que no son arreglo', { version: 1, cabecera: {}, elementos: 'no' }],
    ['cabecera que no es objeto', { version: 1, cabecera: 'no', elementos: [] }],
  ])('%s se descarta sin reventar', (_nombre, crudo) => {
    expect(restaurarBorrador(crudo)).toBeNull()
  })

  // Un elemento sin existenciaId no se puede registrar: la RPC lo necesita para
  // saber sobre qué existencia escribir. Se cae el borrador entero y no sólo esa
  // fila: restaurar la mitad de una captura es peor que no restaurarla, porque
  // la persona no sabe qué le falta.
  test('un elemento sin existenciaId tumba el borrador completo', () => {
    const roto = serializarBorrador(CABECERA, [
      ELEMENTO,
      { ...ELEMENTO, existenciaId: undefined as unknown as number },
    ])

    expect(restaurarBorrador(roto)).toBeNull()
  })

  test('un elemento con un método que no existe tumba el borrador', () => {
    const roto = serializarBorrador(CABECERA, [
      { ...ELEMENTO, metodo: 'telepatia' as unknown as typeof ELEMENTO.metodo },
    ])

    expect(restaurarBorrador(roto)).toBeNull()
  })
})
```

---

- [ ] **Paso 2: Correr y confirmar que falla**

```bash
pnpm vitest run src/features/practicas/borrador.test.ts
```

Esperado: FAIL, `Failed to resolve import "./borrador"`.

---

- [ ] **Paso 3: Escribir el módulo**

```ts
// src/features/practicas/borrador.ts
import { ASPECTO_METODO } from './metodos'
import type { Cabecera, ElementoCaptura } from './esquemas'

/**
 * Sube cada vez que cambia la forma de `ContenidoBorrador`. Un borrador guardado
 * con otra versión se descarta entero, con aviso.
 *
 * Ése es el precio de guardar la captura como `jsonb` opaco, y es el precio
 * correcto: la alternativa era aflojar `practica_elemento_campos_por_metodo` y
 * condicionar los dos triggers de descuento para poder guardar productos a
 * medias en su tabla real. Perder un borrador es una molestia; un
 * `practica_elemento` incompleto que se cuela a Reportes es un dato malo.
 */
export const VERSION_BORRADOR = 1

/** La cabecera a medias: para eso es un borrador. */
export type CabeceraParcial = Partial<Cabecera>

export type ContenidoBorrador = {
  version: number
  cabecera: CabeceraParcial
  elementos: ElementoCaptura[]
}

export function serializarBorrador(
  cabecera: CabeceraParcial,
  elementos: ElementoCaptura[],
): ContenidoBorrador {
  return { version: VERSION_BORRADOR, cabecera, elementos }
}

function esObjeto(valor: unknown): valor is Record<string, unknown> {
  return typeof valor === 'object' && valor !== null && !Array.isArray(valor)
}

/**
 * Lo mínimo que un elemento tiene que traer para poder registrarse. No se
 * revalida la captura —un producto a medias es legítimo en un borrador— sólo la
 * identidad y el método, que son de lo que dependen la tabla y el panel.
 */
function elementoUtilizable(valor: unknown): valor is ElementoCaptura {
  if (!esObjeto(valor)) return false
  if (typeof valor.existenciaId !== 'number') return false
  if (typeof valor.metodo !== 'string') return false
  if (!(valor.metodo in ASPECTO_METODO)) return false
  return true
}

/**
 * Devuelve la captura guardada, o `null` si no se puede confiar en ella.
 *
 * `null` en vez de una restauración parcial, y a propósito: media captura
 * restaurada es peor que ninguna, porque quien la ve no sabe qué le falta y la
 * finaliza creyendo que está completa.
 */
export function restaurarBorrador(
  crudo: unknown,
): { cabecera: CabeceraParcial; elementos: ElementoCaptura[] } | null {
  if (!esObjeto(crudo)) return null
  if (crudo.version !== VERSION_BORRADOR) return null
  if (!esObjeto(crudo.cabecera)) return null
  if (!Array.isArray(crudo.elementos)) return null
  if (!crudo.elementos.every(elementoUtilizable)) return null

  return {
    cabecera: crudo.cabecera as CabeceraParcial,
    elementos: crudo.elementos,
  }
}
```

---

- [ ] **Paso 4: Correr y confirmar que pasa**

```bash
pnpm vitest run src/features/practicas/borrador.test.ts
pnpm typecheck
```

Esperado: las 12 pruebas en verde y `typecheck` en cero.

---

- [ ] **Paso 5: Punto de commit**

Archivos: `src/features/practicas/borrador.ts`, `src/features/practicas/borrador.test.ts`.

Mensaje sugerido: `feat(practicas): serializar y restaurar el borrador, descartando lo que no se entiende`

---

## Tarea 5: `consultas.ts`, los hooks y el traductor de errores

Todo lo que habla con Supabase. Nada de `useEffect` + `useState` para traer
datos, y **siempre** `if (error) throw error`: sin esa línea, `supabase-js`
devuelve `{ data: null, error }` sin lanzar, Query cree que todo salió bien y la
pantalla se queda en blanco sin decir por qué. Es el error más común de este
stack.

**Archivos:**
- Crear: `src/features/practicas/consultas.ts`
- Test: `src/features/practicas/consultas.test.ts` — sólo `mensajeDeError` y
  `motivosDeMetodo`, que son puros. Los hooks se prueban a mano con el guion de
  la Tarea 11: montar un doble de `supabase` para cada uno cuesta más de lo que
  atrapa.

**Interfaces:**
- Consume: `PayloadElemento`, `Cabecera` de `./esquemas` (Tarea 3);
  `ContenidoBorrador` de `./borrador` (Tarea 4); `normalizarTermino` de
  `@/features/inventario/presentacion`; `usePerfil` de
  `@/features/auth/usePerfil`.
- Produce:
  - `mensajeDeError(error: unknown): string`
  - `type Motivo = { clave: string; etiqueta: string; metodos: Metodo[] }`
  - `motivosDeMetodo(motivos: Motivo[], metodo: Metodo): Motivo[]`
  - `useProgramas()`, `useSemestresDePrograma(programaId)`,
    `useAsignaturasDeSemestre(programaId, semestre)`,
    `usePracticasDeAsignatura(asignaturaId)`, `useLaboratorios()`
  - `useMotivos()`
  - `useBuscarExistencias(termino)`
  - `useBorrador()`, `useGuardarBorrador()`, `useBorrarBorrador()`
  - `useRegistrarPractica()`

---

- [ ] **Paso 1: Escribir la prueba, que debe fallar**

```ts
// src/features/practicas/consultas.test.ts
import { describe, expect, test } from 'vitest'

import { mensajeDeError, motivosDeMetodo, type Motivo } from './consultas'

const MOTIVOS: Motivo[] = [
  { clave: 'no_tenemos', etiqueta: 'No tenemos', metodos: ['peso', 'cantidad'] },
  { clave: 'material_daniado', etiqueta: 'Material dañado', metodos: ['cantidad'] },
  { clave: 'equipo_daniado', etiqueta: 'Equipo dañado', metodos: ['prestamo'] },
  { clave: 'otro', etiqueta: 'Otro', metodos: ['peso', 'cantidad', 'prestamo'] },
]

describe('motivosDeMetodo', () => {
  test('el panel de préstamo no ofrece "Material dañado"', () => {
    expect(motivosDeMetodo(MOTIVOS, 'prestamo').map((m) => m.clave)).toEqual([
      'equipo_daniado',
      'otro',
    ])
  })

  test('el de cantidad ofrece los consumibles y su propio dañado', () => {
    expect(motivosDeMetodo(MOTIVOS, 'cantidad').map((m) => m.clave)).toEqual([
      'no_tenemos',
      'material_daniado',
      'otro',
    ])
  })

  test('conserva el orden en que vinieron, que es el de la consulta', () => {
    expect(motivosDeMetodo(MOTIVOS, 'peso').map((m) => m.clave)).toEqual(['no_tenemos', 'otro'])
  })
})

describe('mensajeDeError', () => {
  test('42501 explica que el almacén no es el suyo, no "permission denied"', () => {
    expect(mensajeDeError({ code: '42501', message: 'permission denied' })).toBe(
      'No puedes registrar prácticas en este almacén. Revisa el laboratorio elegido.',
    )
  })

  test('el check de los pesos se traduce', () => {
    expect(
      mensajeDeError({
        code: '23514',
        message: 'violates check constraint "practica_elemento_peso_coherente"',
      }),
    ).toBe('El peso final no puede ser mayor que el inicial')
  })

  test('el check de la devolución se traduce', () => {
    expect(
      mensajeDeError({
        code: '23514',
        message: 'violates check constraint "practica_elemento_devolucion_coherente"',
      }),
    ).toBe('Lo devuelto y lo dañado no pueden sumar más de lo entregado')
  })

  // La excepción de aplicar_movimiento cuando el consumo deja la existencia en
  // negativo. No es un código: es un raise exception con texto, y ese texto ya
  // dice lo que hay que decir.
  test('un saldo negativo se muestra tal cual lo dice la base', () => {
    const mensaje = 'El movimiento dejaria la existencia 12 en -3; la cantidad no puede ser negativa'

    expect(mensajeDeError({ code: 'P0001', message: mensaje })).toBe(mensaje)
  })

  test('la práctica sin productos se traduce', () => {
    expect(mensajeDeError({ code: 'P0001', message: 'Una practica necesita al menos un producto' }))
      .toBe('Agrega al menos un producto antes de finalizar')
  })

  // Lo desconocido pasa con su mensaje original a propósito: un "algo salió mal"
  // genérico esconde justo la pista que hace falta para arreglarlo.
  test('lo desconocido conserva su mensaje', () => {
    expect(mensajeDeError({ code: '23999', message: 'algo raro' })).toBe('algo raro')
  })

  test('lo que ni siquiera es un objeto tiene su propio mensaje', () => {
    expect(mensajeDeError('vaya')).toBe('No se pudo completar la operación')
    expect(mensajeDeError(null)).toBe('No se pudo completar la operación')
  })
})
```

---

- [ ] **Paso 2: Correr y confirmar que falla**

```bash
pnpm vitest run src/features/practicas/consultas.test.ts
```

Esperado: FAIL, `Failed to resolve import "./consultas"`.

---

- [ ] **Paso 3: Escribir el módulo**

```ts
// src/features/practicas/consultas.ts
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { usePerfil } from '@/features/auth/usePerfil'
import { normalizarTermino } from '@/features/inventario/presentacion'
import { supabase } from '@/lib/supabase'
import type { ContenidoBorrador } from './borrador'
import type { Cabecera, PayloadElemento } from './esquemas'
import type { Metodo } from './metodos'

// ---------------------------------------------------------------------------
// Los errores, en español
// ---------------------------------------------------------------------------
/**
 * Las restricciones de la migración son la última línea de defensa y funcionan;
 * lo que no puede pasar es que alguien lea
 * `violates check constraint "practica_elemento_peso_coherente"`.
 *
 * Lo desconocido se deja pasar con su mensaje original: un "algo salió mal"
 * genérico esconde justo la pista que hace falta para arreglarlo.
 */
export function mensajeDeError(error: unknown): string {
  if (typeof error !== 'object' || error === null) {
    return 'No se pudo completar la operación'
  }

  const { code, message } = error as { code?: string; message?: string }

  if (code === '42501') {
    return 'No puedes registrar prácticas en este almacén. Revisa el laboratorio elegido.'
  }

  if (code === '23514') {
    if (message?.includes('practica_elemento_peso_coherente')) {
      return 'El peso final no puede ser mayor que el inicial'
    }
    if (message?.includes('practica_elemento_devolucion_coherente')) {
      return 'Lo devuelto y lo dañado no pueden sumar más de lo entregado'
    }
    if (message?.includes('practica_elemento_campos_por_metodo')) {
      return 'Un producto quedó con campos que no corresponden a su método de control'
    }
  }

  if (code === '23503') {
    if (message?.includes('practica_catalogo_coincide')) {
      return 'La práctica elegida no es de esa asignatura'
    }
    if (message?.includes('practica_pareja_valida')) {
      return 'Esa asignatura no pertenece al programa elegido'
    }
  }

  if (message === 'Una practica necesita al menos un producto') {
    return 'Agrega al menos un producto antes de finalizar'
  }

  return message ?? 'No se pudo completar la operación'
}

// ---------------------------------------------------------------------------
// Catálogos
// ---------------------------------------------------------------------------
export type Programa = { id: number; nombre: string }
export type Asignatura = { id: number; nombre: string }
export type PracticaCatalogo = { id: number; numero: number; nombre: string }
export type Laboratorio = { id: number; nombre: string; almacenClave: string }
export type Motivo = { clave: string; etiqueta: string; metodos: Metodo[] }

export function useProgramas() {
  return useQuery({
    queryKey: ['practicas', 'programas'],
    queryFn: async (): Promise<Programa[]> => {
      const { data, error } = await supabase
        .from('programa_educativo')
        .select('id, nombre')
        .eq('activo', true)
        .order('nombre')
      if (error) throw error
      return data
    },
  })
}

/**
 * Los semestres que ese programa realmente usa, no del 1 al 12.
 *
 * `null` es "Optativa" —lo que el spec del 1 de septiembre decidió que
 * significa un semestre nulo— y va al final: un `order by semestre` ingenuo
 * pone los nulos primero, y entonces lo primero que se ve del plan de estudios
 * son las optativas.
 */
export function useSemestresDePrograma(programaId: number | null) {
  return useQuery({
    queryKey: ['practicas', 'semestres', programaId],
    enabled: programaId !== null,
    queryFn: async (): Promise<(number | null)[]> => {
      const { data, error } = await supabase
        .from('programa_asignatura')
        .select('semestre')
        .eq('programa_educativo_id', programaId as number)
      if (error) throw error

      const distintos = [...new Set(data.map((f) => f.semestre))]
      return distintos.sort((a, b) => (a ?? Number.MAX_SAFE_INTEGER) - (b ?? Number.MAX_SAFE_INTEGER))
    },
  })
}

/**
 * `.is('semestre', null)` y no `.eq(...)`: en SQL nada es igual a NULL, así que
 * un `eq` con nulo devuelve cero filas y las optativas desaparecerían.
 */
export function useAsignaturasDeSemestre(programaId: number | null, semestre: number | null) {
  const activo = programaId !== null
  return useQuery({
    queryKey: ['practicas', 'asignaturas', programaId, semestre],
    enabled: activo,
    queryFn: async (): Promise<Asignatura[]> => {
      let consulta = supabase
        .from('programa_asignatura')
        .select('asignatura:asignatura_id (id, nombre)')
        .eq('programa_educativo_id', programaId as number)

      consulta = semestre === null ? consulta.is('semestre', null) : consulta.eq('semestre', semestre)

      const { data, error } = await consulta
      if (error) throw error

      return data
        .map((f) => ({ id: f.asignatura.id, nombre: f.asignatura.nombre }))
        .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))
    },
  })
}

export function usePracticasDeAsignatura(asignaturaId: number | null) {
  return useQuery({
    queryKey: ['practicas', 'catalogo', asignaturaId],
    enabled: asignaturaId !== null,
    queryFn: async (): Promise<PracticaCatalogo[]> => {
      const { data, error } = await supabase
        .from('practica_catalogo')
        .select('id, numero, nombre')
        .eq('asignatura_id', asignaturaId as number)
        .eq('activo', true)
        .order('numero')
      if (error) throw error
      return data
    },
  })
}

/**
 * Los laboratorios donde esta persona puede registrar.
 *
 * Filtrados al almacén del perfil, y no por gusto: `practica_escritura` rechaza
 * insertar en un laboratorio de otro almacén, y el `almacen_id` de la práctica
 * sale justo de aquí. Ofrecer los cuatro es ofrecer un error para el final. El
 * admin sí los ve todos, porque para él la política es cierta.
 */
export function useLaboratorios() {
  const { data: perfil } = usePerfil()
  const almacenId = perfil?.almacen?.id ?? null
  const esAdmin = perfil?.rol === 'admin'

  return useQuery({
    queryKey: ['practicas', 'laboratorios', esAdmin ? 'todos' : almacenId],
    enabled: perfil !== undefined,
    queryFn: async (): Promise<Laboratorio[]> => {
      let consulta = supabase
        .from('laboratorio')
        .select('id, nombre, almacen:almacen_id (clave)')
        .eq('activo', true)
        .order('nombre')

      if (!esAdmin) {
        // Sin almacén no hay dónde registrar. `-1` devuelve vacío en vez de
        // devolver los cuatro, que es el modo de falla seguro.
        consulta = consulta.eq('almacen_id', almacenId ?? -1)
      }

      const { data, error } = await consulta
      if (error) throw error
      return data.map((l) => ({ id: l.id, nombre: l.nombre, almacenClave: l.almacen.clave }))
    },
  })
}

/**
 * Los nueve motivos con su columna `metodos`. Se piden una vez y se filtran en
 * memoria: son nueve filas que cambian una vez al año, y una consulta por panel
 * sería un viaje por cada clic en la tabla.
 */
export function useMotivos() {
  return useQuery({
    queryKey: ['practicas', 'motivos'],
    staleTime: 10 * 60 * 1000,
    queryFn: async (): Promise<Motivo[]> => {
      const { data, error } = await supabase
        .from('motivo_observacion')
        .select('clave, etiqueta, metodos')
        .eq('activo', true)
        .order('orden')
      if (error) throw error
      return data.map((m) => ({ clave: m.clave, etiqueta: m.etiqueta, metodos: m.metodos }))
    },
  })
}

/**
 * Qué casillas se ofrecen en un panel. La lista NO está escrita aquí: viene de
 * `motivo_observacion.metodos`, para que mover "No tenemos" a otro método sea un
 * `update` y no un redespliegue.
 */
export function motivosDeMetodo(motivos: Motivo[], metodo: Metodo): Motivo[] {
  return motivos.filter((m) => m.metodos.includes(metodo))
}

// ---------------------------------------------------------------------------
// Búsqueda de productos
// ---------------------------------------------------------------------------
/**
 * Filtrada al almacén de quien busca, por lo mismo que `useLaboratorios`:
 * `practica_elemento_escritura` rechaza una existencia de otro almacén. Dejar
 * buscar en los cuatro significa capturar los pesos de un producto de N4 y
 * comerse un 42501 al final de todo el trabajo.
 *
 * Lo dado de baja no se ofrece: no se puede consumir de un frasco dado de baja.
 */
export function useBuscarExistencias(termino: string) {
  const { data: perfil } = usePerfil()
  const almacenId = perfil?.almacen?.id ?? null
  const esAdmin = perfil?.rol === 'admin'
  const normalizado = normalizarTermino(termino)

  return useQuery({
    queryKey: ['practicas', 'existencias', normalizado, esAdmin ? 'todos' : almacenId],
    enabled: perfil !== undefined,
    placeholderData: keepPreviousData,
    queryFn: async () => {
      let consulta = supabase
        .from('existencia_listado')
        .select(
          'id, codigo, nombre_canonico, clasificacion, unidad_base, almacen_clave, cantidad, ubicacion, metodo_control',
        )
        .neq('estado', 'baja')
        .order('codigo')
        .limit(40)

      if (!esAdmin) consulta = consulta.eq('almacen_id', almacenId ?? -1)

      if (normalizado !== '') {
        // `nombre_norm` y `marca_norm` ya vienen en minúsculas y sin acentos, así
        // que va `like` y no `ilike`: es lo que deja al predicado usar el índice
        // trigram. `codigo` no está normalizado, y ahí sí `ilike`.
        consulta = consulta.or(
          `nombre_norm.like.*${normalizado}*,marca_norm.like.*${normalizado}*,codigo.ilike.*${normalizado}*`,
        )
      }

      const { data, error } = await consulta
      if (error) throw error
      return data
    },
  })
}

// ---------------------------------------------------------------------------
// El borrador
// ---------------------------------------------------------------------------
// La RLS ya limita cada borrador a su dueño: no hace falta filtrar por usuario.
// `maybeSingle` y no `single` porque no tener borrador es lo normal, no un error.

export function useBorrador() {
  return useQuery({
    queryKey: ['practicas', 'borrador'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('practica_borrador')
        .select('contenido, actualizado_en')
        .maybeSingle()
      if (error) throw error
      return data
    },
  })
}

export function useGuardarBorrador() {
  const qc = useQueryClient()
  const { data: perfil } = usePerfil()

  return useMutation({
    mutationFn: async (contenido: ContenidoBorrador) => {
      if (perfil === undefined) throw new Error('Todavía no se conoce tu perfil')

      // `usuario_id` viaja porque es la llave del upsert, pero no es lo que
      // decide de quién es el borrador: el trigger lo reescribe con auth.uid().
      const { error } = await supabase
        .from('practica_borrador')
        .upsert({ usuario_id: perfil.id, contenido }, { onConflict: 'usuario_id' })
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['practicas', 'borrador'] }),
  })
}

export function useBorrarBorrador() {
  const qc = useQueryClient()
  const { data: perfil } = usePerfil()

  return useMutation({
    mutationFn: async () => {
      if (perfil === undefined) return
      const { error } = await supabase
        .from('practica_borrador')
        .delete()
        .eq('usuario_id', perfil.id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['practicas', 'borrador'] }),
  })
}

// ---------------------------------------------------------------------------
// Finalizar
// ---------------------------------------------------------------------------
/**
 * Una sola llamada, una sola transacción. Devuelve el folio (`PRA-0001`), que es
 * lo único que la pantalla no podía saber antes de guardar.
 *
 * Invalida el inventario porque los triggers acaban de mover saldos: si no, la
 * pantalla de Inventario sigue mostrando lo de antes.
 */
export function useRegistrarPractica() {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async (v: { cabecera: Cabecera; elementos: PayloadElemento[] }) => {
      const { data, error } = await supabase.rpc('registrar_practica', {
        p_programa: v.cabecera.programaId,
        p_laboratorio: v.cabecera.laboratorioId,
        p_asignatura: v.cabecera.asignaturaId,
        p_practica_catalogo: v.cabecera.practicaCatalogoId,
        p_fecha: v.cabecera.fecha,
        // La descripción adicional es de cada producto (D1 del spec); la
        // práctica entera no tiene texto libre en esta pantalla.
        p_observaciones: undefined,
        p_elementos: v.elementos,
      })
      if (error) throw error
      return data as string
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['existencias'] })
      qc.invalidateQueries({ queryKey: ['resumen-estados'] })
      qc.invalidateQueries({ queryKey: ['practicas', 'existencias'] })
    },
  })
}
```

---

- [ ] **Paso 4: Correr y confirmar que pasa**

```bash
pnpm vitest run src/features/practicas/consultas.test.ts
pnpm typecheck
pnpm lint
```

Esperado: las 10 pruebas en verde, `typecheck` y `lint` en cero.

**Si `typecheck` se queja de `f.asignatura` en `useAsignaturasDeSemestre`**, es
que PostgREST resolvió el embebido como arreglo. Comprueba que la FK sea
`asignatura_id` a secas y compara con `useAsignaturasDePrograma` en
`src/features/academico/consultas.ts`, que hace exactamente lo mismo y compila.

**Si `p_observaciones: undefined` no compila**, mándalo como `null`: la firma lo
admite y el efecto es el mismo.

---

- [ ] **Paso 5: Punto de commit**

Archivos: `src/features/practicas/consultas.ts`, `src/features/practicas/consultas.test.ts`.

Mensaje sugerido: `feat(practicas): consultas, mutaciones y traductor de errores`

---

## Tarea 6: La ruta, el menú y el esqueleto de la pantalla

Encender la entrada de Prácticas y montar el armazón de dos columnas. A partir
de aquí la pantalla existe y se puede ver crecer.

**Archivos:**
- Crear: `src/features/practicas/PaginaPracticas.tsx`
- Modificar: `src/app/navegacion.ts` — un `false` que pasa a `true`
- Modificar: `src/app/navegacion.test.ts:35` — la prueba que lo vigila
- Modificar: `src/App.tsx` — una ruta

**Interfaces:**
- Consume: `EncabezadoPagina`, `CuerpoPagina` de `@/app/EncabezadoPagina`.
- Produce: `PaginaPracticas` — componente sin props, montado en `/practicas`.

**Sin guardia de rol, a diferencia del panel académico.** Los tres roles abren
esta pantalla: un usuario de `consulta` puede armar la captura y ver los saldos,
y al finalizar la RLS le niega la escritura y `mensajeDeError` le dice por qué.
Esconderle la pantalla no protegería nada —lo que protege son las políticas— y
sí le quitaría una consulta legítima.

---

- [ ] **Paso 1: Actualizar la prueba del menú, que debe fallar**

En `src/app/navegacion.test.ts:35`, cambia la línea que afirma que Prácticas
sigue apagada. La prueba de arriba explica por qué esto importa: *un item
disponible sin ruta registrada en App.tsx es un enlace roto*.

```ts
    expect(items.find((i) => i.ruta === '/inventario')?.disponible).toBe(true)
    expect(items.find((i) => i.ruta === '/practicas')?.disponible).toBe(true)
    expect(items.find((i) => i.ruta === '/reportes')?.disponible).toBe(false)
```

Y cambia el nombre de la prueba, que ya no dice la verdad:

```ts
  test('inventario y practicas ya estan disponibles; reportes sigue apagado', () => {
```

---

- [ ] **Paso 2: Correr y confirmar que falla**

```bash
pnpm vitest run src/app/navegacion.test.ts
```

Esperado: FAIL, `expected false to be true`.

---

- [ ] **Paso 3: Encender la entrada del menú**

En `src/app/navegacion.ts`, dentro de `menuDeNavegacion`, la entrada de
Prácticas. **Cambia sólo esa línea**: la ruta, la etiqueta, el icono, el grupo,
la descripción y el color ya estaban decididos y no se tocan.

```ts
    {
      ruta: '/practicas',
      etiqueta: 'Prácticas',
      icono: 'mdi:flask-outline',
      grupo: 'operacion',
      descripcion: 'Registrar el consumo de cada práctica',
      color: 'secondary.main',
      disponible: true,
    },
```

---

- [ ] **Paso 4: Crear el esqueleto de la pantalla**

```tsx
// src/features/practicas/PaginaPracticas.tsx
import { Icon } from '@iconify/react'
import { Button, Card, CardContent, Grid, Stack, Typography } from '@mui/material'

import { CuerpoPagina, EncabezadoPagina } from '@/app/EncabezadoPagina'

/**
 * Registro de práctica.
 *
 * Dos columnas: la captura a la izquierda y el Panel de Control pegado a la
 * derecha, que muestra los campos del producto seleccionado en la tabla. En
 * pantalla chica —las máquinas del almacén son de ~1024 px— el panel se va
 * abajo, que es lo que hace `size={{ xs: 12, lg: 4 }}`.
 */
export function PaginaPracticas() {
  return (
    <>
      <EncabezadoPagina
        titulo="Registro de práctica"
        descripcion="Captura de uso de reactivos, materiales y equipos"
        acciones={
          <>
            <Button
              variant="outlined"
              color="secondary"
              startIcon={<Icon icon="mdi:content-save-outline" />}
              disabled
            >
              Guardar borrador
            </Button>
            <Button variant="contained" startIcon={<Icon icon="mdi:send-outline" />} disabled>
              Finalizar práctica
            </Button>
          </>
        }
      />

      <CuerpoPagina>
        <Grid container spacing={2} sx={{ alignItems: 'flex-start' }}>
          <Grid size={{ xs: 12, lg: 8 }}>
            <Stack spacing={2}>
              <Card>
                <CardContent>
                  <Typography variant="h2" sx={{ color: 'institucional.main', mb: 2 }}>
                    Datos de la práctica
                  </Typography>
                  <Typography sx={{ color: 'text.secondary' }}>
                    La cascada llega en la Tarea 7.
                  </Typography>
                </CardContent>
              </Card>
            </Stack>
          </Grid>

          {/* `position: sticky` para que el panel siga a la vista mientras se
              recorre una tabla larga: capturar obliga a mirar los dos lados. */}
          <Grid size={{ xs: 12, lg: 4 }}>
            <Card sx={{ position: { lg: 'sticky' }, top: { lg: 16 } }}>
              <CardContent>
                <Typography variant="h2" sx={{ color: 'institucional.main', mb: 2 }}>
                  Panel de control
                </Typography>
                <Stack spacing={1} sx={{ alignItems: 'center', py: 6 }}>
                  <Icon icon="mdi:package-variant-closed" width={40} aria-hidden />
                  <Typography sx={{ color: 'text.secondary' }}>Seleccione un producto</Typography>
                  <Typography variant="body2" sx={{ color: 'text.disabled' }}>
                    Haga clic en una fila de la tabla
                  </Typography>
                </Stack>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </CuerpoPagina>
    </>
  )
}
```

---

- [ ] **Paso 5: Registrar la ruta**

En `src/App.tsx`, dentro del `<Route element={<Layout />}>`, después de la de
depuración y antes del bloque `<SoloAdmin>`:

```tsx
                  {/* Sin guardia de rol: los tres roles la abren. Lo que impide
                      que un usuario de consulta registre algo es la RLS, no
                      esconderle la pantalla. */}
                  <Route path="/practicas" element={<PaginaPracticas />} />
```

Y su importación, en orden alfabético con las demás:

```tsx
import { PaginaPracticas } from '@/features/practicas/PaginaPracticas'
```

---

- [ ] **Paso 6: Correr y confirmar que pasa**

```bash
pnpm test && pnpm typecheck && pnpm lint && pnpm build
```

Esperado: los cuatro en cero.

Y a ojo, con `pnpm dev`: entra como `n3@uaeh.local` / `sigrem2026`, haz clic en
Prácticas en la barra lateral. Tiene que abrir la pantalla con las dos tarjetas
y los dos botones apagados, y la barra lateral tiene que marcar Prácticas como
la sección activa.

---

- [ ] **Paso 7: Punto de commit**

Archivos: `src/features/practicas/PaginaPracticas.tsx`, `src/App.tsx`,
`src/app/navegacion.ts`, `src/app/navegacion.test.ts`.

Mensaje sugerido: `feat(practicas): ruta, entrada de menu y esqueleto de la pantalla`

---

## Tarea 7: `DatosPractica.tsx`, la cascada

Programa → semestre → asignatura → práctica, más laboratorio y fecha. Los cuatro
primeros van encadenados: cada uno se apaga hasta que el anterior tiene valor, y
**cambiar uno limpia los de abajo**. Sin eso queda una asignatura de un programa
que ya no está seleccionado, que es exactamente lo que la FK compuesta
`practica_pareja_valida` rechazaría al final de todo el trabajo.

**Archivos:**
- Crear: `src/features/practicas/DatosPractica.tsx`
- Test: `src/features/practicas/DatosPractica.test.tsx`

**Interfaces:**
- Consume: `CabeceraParcial` de `./borrador` (Tarea 4); `Programa`,
  `Asignatura`, `PracticaCatalogo`, `Laboratorio` de `./consultas` (Tarea 5);
  `etiquetaSemestre` de `@/features/academico/semestres`.
- Produce:

```tsx
type Props = {
  valores: CabeceraParcial
  onCambiar: (parcial: CabeceraParcial) => void
  programas: Programa[]
  semestres: (number | null)[]
  asignaturas: Asignatura[]
  practicas: PracticaCatalogo[]
  laboratorios: Laboratorio[]
  deshabilitado: boolean
}
export function DatosPractica(props: Props): JSX.Element
```

**El componente no consulta nada.** Recibe las listas ya resueltas y avisa de los
cambios hacia arriba. Así se puede probar sin montar un doble de Supabase, y la
regla de "limpiar lo de abajo" queda a la vista en un solo lugar.

`etiquetaSemestre` se reutiliza de `academico/`: es la misma decisión de que
`null` significa "Optativa", y tenerla dos veces es tenerla mal una vez.

---

- [ ] **Paso 1: Escribir la prueba, que debe fallar**

```tsx
// src/features/practicas/DatosPractica.test.tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, test, vi } from 'vitest'

import { DatosPractica } from './DatosPractica'

const BASE = {
  programas: [
    { id: 1, nombre: 'Química en Alimentos' },
    { id: 2, nombre: 'Ingeniería en Biotecnología' },
  ],
  semestres: [1, 3, null],
  asignaturas: [{ id: 10, nombre: 'Bioquímica' }],
  practicas: [{ id: 100, numero: 2, nombre: 'Actividad enzimática' }],
  laboratorios: [{ id: 5, nombre: 'Laboratorio de docencia N3', almacenClave: 'N3' }],
  deshabilitado: false,
}

function montar(valores = {}, onCambiar = vi.fn()) {
  render(<DatosPractica {...BASE} valores={valores} onCambiar={onCambiar} />)
  return onCambiar
}

describe('DatosPractica', () => {
  test('sin programa elegido, los tres de abajo están apagados', () => {
    montar()

    expect(screen.getByLabelText('Semestre')).toHaveAttribute('aria-disabled', 'true')
    expect(screen.getByLabelText('Asignatura')).toHaveAttribute('aria-disabled', 'true')
    expect(screen.getByLabelText('Número de práctica')).toHaveAttribute('aria-disabled', 'true')
  })

  test('con programa y semestre, asignatura se enciende', () => {
    montar({ programaId: 1, semestre: 3 })

    expect(screen.getByLabelText('Asignatura')).not.toHaveAttribute('aria-disabled', 'true')
  })

  // Ésta es la que importa: sin ella queda una asignatura de un programa que ya
  // no está elegido, y la FK compuesta lo rechaza al finalizar.
  test('cambiar de programa limpia semestre, asignatura y práctica', async () => {
    const onCambiar = montar({
      programaId: 1,
      semestre: 3,
      asignaturaId: 10,
      practicaCatalogoId: 100,
    })

    await userEvent.click(screen.getByLabelText('Programa educativo'))
    await userEvent.click(screen.getByRole('option', { name: 'Ingeniería en Biotecnología' }))

    expect(onCambiar).toHaveBeenCalledWith({
      programaId: 2,
      semestre: undefined,
      asignaturaId: undefined,
      practicaCatalogoId: undefined,
    })
  })

  test('cambiar de semestre limpia asignatura y práctica, pero no el programa', async () => {
    const onCambiar = montar({
      programaId: 1,
      semestre: 3,
      asignaturaId: 10,
      practicaCatalogoId: 100,
    })

    await userEvent.click(screen.getByLabelText('Semestre'))
    await userEvent.click(screen.getByRole('option', { name: '1°' }))

    expect(onCambiar).toHaveBeenCalledWith({
      semestre: 1,
      asignaturaId: undefined,
      practicaCatalogoId: undefined,
    })
  })

  test('cambiar de asignatura limpia sólo la práctica', async () => {
    const onCambiar = montar({ programaId: 1, semestre: 3, practicaCatalogoId: 100 })

    await userEvent.click(screen.getByLabelText('Asignatura'))
    await userEvent.click(screen.getByRole('option', { name: 'Bioquímica' }))

    expect(onCambiar).toHaveBeenCalledWith({ asignaturaId: 10, practicaCatalogoId: undefined })
  })

  // null no es un hueco: es una optativa, que el plan de estudios sí contempla.
  test('el semestre nulo se ofrece como Optativa', async () => {
    montar({ programaId: 1 })

    await userEvent.click(screen.getByLabelText('Semestre'))

    expect(screen.getByRole('option', { name: 'Optativa' })).toBeInTheDocument()
  })

  test('la práctica se ofrece con su número y su nombre', async () => {
    montar({ programaId: 1, semestre: 3, asignaturaId: 10 })

    await userEvent.click(screen.getByLabelText('Número de práctica'))

    expect(
      screen.getByRole('option', { name: 'Práctica 2 — Actividad enzimática' }),
    ).toBeInTheDocument()
  })

  // El laboratorio NO depende de la cascada: sale del almacén de quien captura,
  // y de él sale el almacen_id de la práctica. No puede ser "Todas".
  test('el laboratorio se elige y no depende del programa', () => {
    montar()

    expect(screen.getByLabelText('Laboratorio')).not.toHaveAttribute('aria-disabled', 'true')
  })

  test('el laboratorio dice de qué almacén es', async () => {
    montar()

    await userEvent.click(screen.getByLabelText('Laboratorio'))

    expect(
      screen.getByRole('option', { name: 'Laboratorio de docencia N3 · N3' }),
    ).toBeInTheDocument()
  })
})
```

---

- [ ] **Paso 2: Correr y confirmar que falla**

```bash
pnpm vitest run src/features/practicas/DatosPractica.test.tsx
```

Esperado: FAIL, `Failed to resolve import "./DatosPractica"`.

---

- [ ] **Paso 3: Escribir el componente**

```tsx
// src/features/practicas/DatosPractica.tsx
import { FormControl, Grid, InputLabel, MenuItem, Select, TextField } from '@mui/material'

import { etiquetaSemestre } from '@/features/academico/semestres'
import type { CabeceraParcial } from './borrador'
import type { Asignatura, Laboratorio, PracticaCatalogo, Programa } from './consultas'

type Props = {
  valores: CabeceraParcial
  /** Recibe sólo lo que cambió, ya con los de abajo limpiados. */
  onCambiar: (parcial: CabeceraParcial) => void
  programas: Programa[]
  semestres: (number | null)[]
  asignaturas: Asignatura[]
  practicas: PracticaCatalogo[]
  laboratorios: Laboratorio[]
  deshabilitado: boolean
}

/**
 * `null` no viaja en un `<Select>` de MUI: su `value` es una cadena. La
 * optativa se representa con este centinela, que nunca es un semestre real.
 */
const OPTATIVA = 'optativa'

export function DatosPractica({
  valores,
  onCambiar,
  programas,
  semestres,
  asignaturas,
  practicas,
  laboratorios,
  deshabilitado,
}: Props) {
  const sinPrograma = valores.programaId === undefined
  const sinSemestre = valores.semestre === undefined
  const sinAsignatura = valores.asignaturaId === undefined

  return (
    <Grid container spacing={2}>
      <Grid size={{ xs: 12, md: 6 }}>
        <FormControl fullWidth disabled={deshabilitado}>
          <InputLabel id="rot-programa">Programa educativo</InputLabel>
          <Select
            labelId="rot-programa"
            label="Programa educativo"
            value={valores.programaId ?? ''}
            // Elegir otro programa TIENE que limpiar lo de abajo. El prototipo
            // lo parcheaba a mano en cada onChange; aquí está en un solo sitio y
            // con prueba.
            onChange={(e) =>
              onCambiar({
                programaId: Number(e.target.value),
                semestre: undefined,
                asignaturaId: undefined,
                practicaCatalogoId: undefined,
              })
            }
          >
            {programas.map((p) => (
              <MenuItem key={p.id} value={p.id}>
                {p.nombre}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </Grid>

      <Grid size={{ xs: 12, md: 6 }}>
        <FormControl fullWidth disabled={deshabilitado || sinPrograma}>
          <InputLabel id="rot-semestre">Semestre</InputLabel>
          <Select
            labelId="rot-semestre"
            label="Semestre"
            value={valores.semestre === undefined ? '' : (valores.semestre ?? OPTATIVA)}
            onChange={(e) =>
              onCambiar({
                semestre: e.target.value === OPTATIVA ? null : Number(e.target.value),
                asignaturaId: undefined,
                practicaCatalogoId: undefined,
              })
            }
          >
            {semestres.map((s) => (
              <MenuItem key={s ?? OPTATIVA} value={s ?? OPTATIVA}>
                {etiquetaSemestre(s)}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </Grid>

      <Grid size={{ xs: 12, md: 6 }}>
        <FormControl fullWidth disabled={deshabilitado || sinPrograma || sinSemestre}>
          <InputLabel id="rot-asignatura">Asignatura</InputLabel>
          <Select
            labelId="rot-asignatura"
            label="Asignatura"
            value={valores.asignaturaId ?? ''}
            onChange={(e) =>
              onCambiar({
                asignaturaId: Number(e.target.value),
                practicaCatalogoId: undefined,
              })
            }
          >
            {asignaturas.map((a) => (
              <MenuItem key={a.id} value={a.id}>
                {a.nombre}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </Grid>

      {/* El selector del catálogo, NO el folio. El folio (PRA-0001) lo asigna el
          trigger y sólo se conoce al finalizar; se muestra en el aviso de éxito. */}
      <Grid size={{ xs: 12, md: 6 }}>
        <FormControl fullWidth disabled={deshabilitado || sinAsignatura}>
          <InputLabel id="rot-practica">Número de práctica</InputLabel>
          <Select
            labelId="rot-practica"
            label="Número de práctica"
            value={valores.practicaCatalogoId ?? ''}
            onChange={(e) => onCambiar({ practicaCatalogoId: Number(e.target.value) })}
          >
            {practicas.map((p) => (
              <MenuItem key={p.id} value={p.id}>
                {`Práctica ${p.numero} — ${p.nombre}`}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </Grid>

      {/* No depende de la cascada y no puede ser "Todas": practica.laboratorio_id
          es NOT NULL y de él sale el almacen_id de la práctica, que es de dónde
          se descuenta y el ancla de toda la RLS. La lista ya viene filtrada al
          almacén de quien captura. */}
      <Grid size={{ xs: 12, md: 6 }}>
        <FormControl fullWidth disabled={deshabilitado}>
          <InputLabel id="rot-laboratorio">Laboratorio</InputLabel>
          <Select
            labelId="rot-laboratorio"
            label="Laboratorio"
            value={valores.laboratorioId ?? ''}
            onChange={(e) => onCambiar({ laboratorioId: Number(e.target.value) })}
          >
            {laboratorios.map((l) => (
              <MenuItem key={l.id} value={l.id}>
                {`${l.nombre} · ${l.almacenClave}`}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </Grid>

      <Grid size={{ xs: 12, md: 6 }}>
        <TextField
          fullWidth
          type="date"
          label="Fecha"
          value={valores.fecha ?? ''}
          disabled={deshabilitado}
          onChange={(e) => onCambiar({ fecha: e.target.value })}
          slotProps={{ inputLabel: { shrink: true } }}
        />
      </Grid>
    </Grid>
  )
}
```

---

- [ ] **Paso 4: Correr y confirmar que pasa**

```bash
pnpm vitest run src/features/practicas/DatosPractica.test.tsx
pnpm typecheck
```

Esperado: las 9 pruebas en verde y `typecheck` en cero.

**Si `getByLabelText('Semestre')` no encuentra nada**, es que el `<Select>` de
MUI no está asociando el `InputLabel`: comprueba que `labelId` del `Select`
coincida con el `id` del `InputLabel` y que el `label` esté en los dos.

**Si el aserto de `aria-disabled` falla**, MUI marca el elemento con rol
`combobox`. Cambia el aserto a
`expect(screen.getByLabelText('Semestre')).toHaveAttribute('aria-disabled', 'true')`
sobre el nodo que MUI sí etiqueta, o usa `.closest('[aria-disabled]')`. No
quites la prueba: que la cascada se apague es la mitad de lo que hace este
componente.

---

- [ ] **Paso 5: Punto de commit**

Archivos: `src/features/practicas/DatosPractica.tsx`,
`src/features/practicas/DatosPractica.test.tsx`.

Mensaje sugerido: `feat(practicas): la cascada de programa, semestre, asignatura y practica`

---

## Tarea 8: Agregar productos y el diálogo de búsqueda

Los dos botones de "Agregar Productos" y el modal que sale de "Buscar producto".

**"Escanear QR" se dibuja apagado**, con un `title` que explica por qué. No hay
librería de cámara instalada y CLAUDE.md pide preguntar antes de agregar
dependencias; la decisión tomada fue no agregarla en esta entrega. El botón se
queda visible por lo mismo que las entradas apagadas del menú: el diseño
aprobado se ve completo y nadie se topa con un botón que no hace nada.

El campo de código del diálogo **sí sirve para un lector físico de código de
barras o QR**, que se comporta como un teclado: escribe el código y manda Enter.
Ésa es la parte del escaneo que sí funciona hoy, y no cuesta nada.

**Archivos:**
- Crear: `src/features/practicas/AgregarProductos.tsx`
- Crear: `src/features/practicas/DialogoBuscar.tsx`
- Test: `src/features/practicas/AgregarProductos.test.tsx`
- Test: `src/features/practicas/DialogoBuscar.test.tsx`

**Interfaces:**
- Consume: `FilaExistencia` de `./esquemas` (Tarea 3); `aspectoDeMetodo`,
  `ETIQUETA_CLASIFICACION` de `./metodos` (Tarea 2).
- Produce:

```tsx
export function AgregarProductos(props: {
  onBuscar: () => void
  deshabilitado: boolean
}): JSX.Element

export function DialogoBuscar(props: {
  abierto: boolean
  termino: string
  onTermino: (t: string) => void
  filas: FilaExistencia[]
  cargando: boolean
  yaAgregados: number[]
  onAgregar: (fila: FilaExistencia) => void
  onCerrar: () => void
}): JSX.Element
```

`DialogoBuscar` no consulta: recibe `filas` y avisa del término hacia arriba, que
es quien tiene el `useBuscarExistencias`. Igual que `DatosPractica`, así se
prueba sin doble de Supabase.

---

- [ ] **Paso 1: Escribir las pruebas, que deben fallar**

```tsx
// src/features/practicas/AgregarProductos.test.tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, test, vi } from 'vitest'

import { AgregarProductos } from './AgregarProductos'

describe('AgregarProductos', () => {
  test('Buscar producto avisa hacia arriba', async () => {
    const onBuscar = vi.fn()
    render(<AgregarProductos onBuscar={onBuscar} deshabilitado={false} />)

    await userEvent.click(screen.getByRole('button', { name: /buscar producto/i }))

    expect(onBuscar).toHaveBeenCalledOnce()
  })

  // Visible pero apagado, como las entradas pendientes del menú: el diseño
  // aprobado se ve completo y nadie se topa con un botón que no hace nada.
  test('Escanear QR está apagado y dice por qué', () => {
    render(<AgregarProductos onBuscar={vi.fn()} deshabilitado={false} />)

    const boton = screen.getByRole('button', { name: /escanear qr/i })

    expect(boton).toBeDisabled()
    expect(boton.closest('[title]')).toHaveAttribute(
      'title',
      expect.stringContaining('lector'),
    )
  })

  test('sin laboratorio elegido no se pueden agregar productos', () => {
    render(<AgregarProductos onBuscar={vi.fn()} deshabilitado />)

    expect(screen.getByRole('button', { name: /buscar producto/i })).toBeDisabled()
  })
})
```

```tsx
// src/features/practicas/DialogoBuscar.test.tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, test, vi } from 'vitest'

import { DialogoBuscar } from './DialogoBuscar'

const FILAS = [
  {
    id: 12,
    codigo: 'N3-00042',
    nombre_canonico: 'Etanol 96%',
    clasificacion: 'reactivo' as const,
    unidad_base: 'ml',
    almacen_clave: 'N3',
    cantidad: 2000,
    ubicacion: 'Lab 2',
    metodo_control: 'peso' as const,
  },
  {
    id: 13,
    codigo: 'N3-00043',
    nombre_canonico: 'Vaso de precipitado 250 ml',
    clasificacion: 'material' as const,
    unidad_base: 'piezas',
    almacen_clave: 'N3',
    cantidad: 24,
    ubicacion: 'Lab 1',
    metodo_control: 'cantidad' as const,
  },
]

function montar(extra = {}) {
  const props = {
    abierto: true,
    termino: '',
    onTermino: vi.fn(),
    filas: FILAS,
    cargando: false,
    yaAgregados: [] as number[],
    onAgregar: vi.fn(),
    onCerrar: vi.fn(),
    ...extra,
  }
  render(<DialogoBuscar {...props} />)
  return props
}

describe('DialogoBuscar', () => {
  test('cada fila muestra código, nombre, clasificación, almacén y saldo', () => {
    montar()

    expect(screen.getByText('N3-00042')).toBeInTheDocument()
    expect(screen.getByText('Etanol 96%')).toBeInTheDocument()
    expect(screen.getByText('Reactivo')).toBeInTheDocument()
    expect(screen.getByText('N3 · 2000 ml')).toBeInTheDocument()
    expect(screen.getByText('Lab 2')).toBeInTheDocument()
  })

  test('agregar avisa con la fila completa', async () => {
    const { onAgregar } = montar()

    await userEvent.click(screen.getByRole('button', { name: /agregar etanol 96%/i }))

    expect(onAgregar).toHaveBeenCalledWith(FILAS[0])
  })

  // Sin esto se agrega dos veces el mismo frasco y quedan dos practica_elemento
  // sobre la misma existencia, cada uno descontando por su cuenta.
  test('lo que ya está en la captura no se puede agregar otra vez', () => {
    montar({ yaAgregados: [12] })

    expect(screen.getByRole('button', { name: /agregar etanol 96%/i })).toBeDisabled()
    expect(screen.getByRole('button', { name: /agregar vaso de precipitado/i })).toBeEnabled()
  })

  test('teclear avisa del término hacia arriba', async () => {
    const { onTermino } = montar()

    await userEvent.type(screen.getByLabelText('Código o nombre'), 'eta')

    expect(onTermino).toHaveBeenCalled()
  })

  test('sin resultados lo dice, en vez de quedarse en blanco', () => {
    montar({ filas: [], termino: 'zzz' })

    expect(screen.getByText(/no hay productos que coincidan/i)).toBeInTheDocument()
  })

  test('mientras carga no dice que no hay nada', () => {
    montar({ filas: [], termino: 'zzz', cargando: true })

    expect(screen.queryByText(/no hay productos que coincidan/i)).not.toBeInTheDocument()
  })
})
```

---

- [ ] **Paso 2: Correr y confirmar que fallan**

```bash
pnpm vitest run src/features/practicas/AgregarProductos.test.tsx src/features/practicas/DialogoBuscar.test.tsx
```

Esperado: FAIL, los dos por `Failed to resolve import`.

---

- [ ] **Paso 3: Escribir `AgregarProductos`**

```tsx
// src/features/practicas/AgregarProductos.tsx
import { Icon } from '@iconify/react'
import { Button, Stack, Tooltip } from '@mui/material'

type Props = {
  onBuscar: () => void
  /** Sin laboratorio elegido no hay almacén, y sin almacén no hay qué buscar. */
  deshabilitado: boolean
}

const AVISO_QR =
  'El escaneo con cámara todavía no está conectado. Un lector físico de código ' +
  'de barras o QR sí funciona: enfoca el campo de búsqueda y dispara.'

export function AgregarProductos({ onBuscar, deshabilitado }: Props) {
  return (
    <Stack direction="row" spacing={2} sx={{ flexWrap: 'wrap' }}>
      {/* El Tooltip envuelve un <span> porque un botón deshabilitado no dispara
          eventos del ratón, y sin el span el Tooltip nunca aparecería. */}
      <Tooltip title={AVISO_QR}>
        <span>
          <Button
            variant="contained"
            color="secondary"
            startIcon={<Icon icon="mdi:qrcode-scan" />}
            disabled
          >
            Escanear QR
          </Button>
        </span>
      </Tooltip>

      <Button
        variant="outlined"
        color="secondary"
        startIcon={<Icon icon="mdi:magnify" />}
        onClick={onBuscar}
        disabled={deshabilitado}
      >
        Buscar producto
      </Button>
    </Stack>
  )
}
```

---

- [ ] **Paso 4: Escribir `DialogoBuscar`**

```tsx
// src/features/practicas/DialogoBuscar.tsx
import { Icon } from '@iconify/react'
import {
  Box,
  Chip,
  Dialog,
  DialogContent,
  DialogTitle,
  IconButton,
  LinearProgress,
  List,
  ListItem,
  ListItemText,
  Stack,
  TextField,
  Typography,
} from '@mui/material'

import type { FilaExistencia } from './esquemas'
import { ETIQUETA_CLASIFICACION } from './metodos'

type Props = {
  abierto: boolean
  termino: string
  onTermino: (termino: string) => void
  filas: FilaExistencia[]
  cargando: boolean
  /** Los que ya están en la captura: no se ofrecen dos veces. */
  yaAgregados: number[]
  onAgregar: (fila: FilaExistencia) => void
  onCerrar: () => void
}

export function DialogoBuscar({
  abierto,
  termino,
  onTermino,
  filas,
  cargando,
  yaAgregados,
  onAgregar,
  onCerrar,
}: Props) {
  const agregados = new Set(yaAgregados)
  const vacio = !cargando && filas.length === 0

  return (
    <Dialog open={abierto} onClose={onCerrar} fullWidth maxWidth="sm">
      <DialogTitle sx={{ color: 'institucional.main' }}>
        Buscar producto
        <IconButton
          aria-label="Cerrar"
          onClick={onCerrar}
          sx={{ position: 'absolute', right: 8, top: 8 }}
        >
          <Icon icon="mdi:close" />
        </IconButton>
      </DialogTitle>

      <DialogContent>
        {/* autoFocus para que un lector físico de código de barras dispare
            directo aquí: se comporta como un teclado y termina con Enter. */}
        <TextField
          autoFocus
          fullWidth
          label="Código o nombre"
          placeholder="N3-00042, etanol…"
          value={termino}
          onChange={(e) => onTermino(e.target.value)}
          sx={{ mt: 1 }}
        />

        {cargando ? <LinearProgress sx={{ mt: 2 }} /> : null}

        {vacio ? (
          <Stack spacing={1} sx={{ alignItems: 'center', py: 6 }}>
            <Icon icon="mdi:package-variant-remove" width={40} aria-hidden />
            <Typography sx={{ color: 'text.secondary' }}>
              No hay productos que coincidan
            </Typography>
            <Typography variant="body2" sx={{ color: 'text.disabled', textAlign: 'center' }}>
              Sólo se ofrecen los de tu almacén: son los únicos sobre los que puedes registrar.
            </Typography>
          </Stack>
        ) : null}

        <List>
          {filas.map((fila) => {
            const nombre = fila.nombre_canonico ?? 'Sin nombre'
            const yaEsta = agregados.has(fila.id)

            return (
              <ListItem
                key={fila.id}
                divider
                secondaryAction={
                  <IconButton
                    aria-label={`Agregar ${nombre}`}
                    onClick={() => onAgregar(fila)}
                    disabled={yaEsta}
                    color="secondary"
                  >
                    <Icon icon={yaEsta ? 'mdi:check' : 'mdi:plus'} />
                  </IconButton>
                }
              >
                <ListItemText
                  disableTypography
                  primary={
                    <Stack direction="row" spacing={1} sx={{ alignItems: 'center', mb: 0.5 }}>
                      <Typography
                        variant="body2"
                        sx={{ fontFamily: 'monospace', color: 'institucional.main' }}
                      >
                        {fila.codigo}
                      </Typography>
                      {fila.clasificacion === null ? null : (
                        <Chip
                          size="small"
                          variant="outlined"
                          label={ETIQUETA_CLASIFICACION[fila.clasificacion]}
                        />
                      )}
                    </Stack>
                  }
                  secondary={
                    <Box>
                      <Typography>{nombre}</Typography>
                      <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                        {`${fila.almacen_clave ?? ''} · ${fila.cantidad ?? 0} ${fila.unidad_base ?? ''}`}
                      </Typography>
                      {fila.ubicacion === null ? null : (
                        <Typography variant="body2" sx={{ color: 'text.disabled' }}>
                          {fila.ubicacion}
                        </Typography>
                      )}
                    </Box>
                  }
                />
              </ListItem>
            )
          })}
        </List>
      </DialogContent>
    </Dialog>
  )
}
```

---

- [ ] **Paso 5: Correr y confirmar que pasan**

```bash
pnpm vitest run src/features/practicas/AgregarProductos.test.tsx src/features/practicas/DialogoBuscar.test.tsx
pnpm typecheck
```

Esperado: las 9 pruebas en verde y `typecheck` en cero.

**Si el aserto del `title` del tooltip falla**, MUI pone el `title` en el
elemento envuelto sólo al mostrarse. Cambia ese aserto por uno sobre
`aria-label` del botón y pon el aviso también ahí; lo que se prueba es que el
botón esté apagado y que quede dicho por qué, no dónde vive el texto.

---

- [ ] **Paso 6: Punto de commit**

Archivos: `AgregarProductos.tsx`, `AgregarProductos.test.tsx`,
`DialogoBuscar.tsx`, `DialogoBuscar.test.tsx`, todos bajo
`src/features/practicas/`.

Mensaje sugerido: `feat(practicas): agregar productos y el dialogo de busqueda`

---

## Tarea 9: `TablaProductos.tsx`, la tabla y el contador

Los productos agregados, con su método, su estado —Pendiente o Completado— y el
contador "(n/m completados)" del encabezado. Hacer clic en una fila la
selecciona, que es lo que llena el Panel de Control.

El criterio de "completado" **no se escribe aquí**: sale de `estaCompleto()`, que
la Tarea 3 dejó probado y que es el espejo de los tres checks de la base. Éste es
uno de los tres sitios donde ese criterio se usa, y por eso vive fuera.

**Archivos:**
- Crear: `src/features/practicas/TablaProductos.tsx`
- Test: `src/features/practicas/TablaProductos.test.tsx`

**Interfaces:**
- Consume: `ElementoCaptura`, `estaCompleto` de `./esquemas` (Tarea 3);
  `aspectoDeMetodo`, `ETIQUETA_CLASIFICACION` de `./metodos` (Tarea 2).
- Produce:

```tsx
export function TablaProductos(props: {
  elementos: ElementoCaptura[]
  seleccionado: number | null
  onElegir: (existenciaId: number) => void
  onQuitar: (existenciaId: number) => void
}): JSX.Element
```

---

- [ ] **Paso 1: Escribir la prueba, que debe fallar**

```tsx
// src/features/practicas/TablaProductos.test.tsx
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, test, vi } from 'vitest'

import { elementoDesdeExistencia, type ElementoCaptura } from './esquemas'
import { TablaProductos } from './TablaProductos'

function elemento(
  id: number,
  nombre: string,
  clasificacion: 'reactivo' | 'material' | 'equipo',
  metodo: 'peso' | 'cantidad' | 'prestamo',
  campos: Partial<ElementoCaptura> = {},
): ElementoCaptura {
  return {
    ...elementoDesdeExistencia({
      id,
      codigo: `N3-0000${id}`,
      nombre_canonico: nombre,
      clasificacion,
      unidad_base: 'ml',
      almacen_clave: 'N3',
      cantidad: 100,
      ubicacion: 'Lab 1',
      metodo_control: metodo,
    }),
    ...campos,
  }
}

const ETANOL = elemento(1, 'Etanol 96%', 'reactivo', 'peso', {
  pesoInicial: 526,
  pesoFinal: 520,
})
const VASO = elemento(2, 'Vaso de precipitado', 'material', 'cantidad')
const PHMETRO = elemento(3, 'pH-metro Hanna', 'equipo', 'prestamo', {
  estadoSalida: 'correcto',
})

function montar(extra = {}) {
  const props = {
    elementos: [ETANOL, VASO, PHMETRO],
    seleccionado: null as number | null,
    onElegir: vi.fn(),
    onQuitar: vi.fn(),
    ...extra,
  }
  render(<TablaProductos {...props} />)
  return props
}

describe('TablaProductos', () => {
  test('el contador dice cuántos van de cuántos', () => {
    montar()

    expect(screen.getByText('(2/3 completados)')).toBeInTheDocument()
  })

  test('cada fila muestra código, nombre, tipo y método', () => {
    montar()

    const fila = screen.getByRole('row', { name: /etanol 96%/i })

    expect(within(fila).getByText('N3-00001')).toBeInTheDocument()
    expect(within(fila).getByText('Reactivo')).toBeInTheDocument()
    expect(within(fila).getByText('Peso')).toBeInTheDocument()
  })

  // El chip sale de estaCompleto(), que es el espejo de los checks de la base.
  // Si esto y el botón de Finalizar discreparan, alguien finalizaría creyendo
  // que está completo y se comería un 23514.
  test('el estado de cada fila sale de si le falta captura', () => {
    montar()

    expect(within(screen.getByRole('row', { name: /etanol/i })).getByText('Completado'))
      .toBeInTheDocument()
    expect(within(screen.getByRole('row', { name: /vaso/i })).getByText('Pendiente'))
      .toBeInTheDocument()
  })

  test('hacer clic en una fila la selecciona', async () => {
    const { onElegir } = montar()

    await userEvent.click(screen.getByRole('row', { name: /vaso/i }))

    expect(onElegir).toHaveBeenCalledWith(2)
  })

  test('quitar avisa hacia arriba y no selecciona la fila', async () => {
    const { onQuitar, onElegir } = montar()

    await userEvent.click(screen.getByRole('button', { name: /quitar vaso de precipitado/i }))

    expect(onQuitar).toHaveBeenCalledWith(2)
    expect(onElegir).not.toHaveBeenCalled()
  })

  test('la fila seleccionada se marca para lectores de pantalla', () => {
    montar({ seleccionado: 2 })

    expect(screen.getByRole('row', { name: /vaso/i })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('row', { name: /etanol/i })).toHaveAttribute('aria-selected', 'false')
  })

  test('sin productos lo dice, con la instrucción de qué hacer', () => {
    montar({ elementos: [] })

    expect(screen.getByText('Sin productos')).toBeInTheDocument()
    expect(screen.getByText(/buscar producto/i)).toBeInTheDocument()
    expect(screen.queryByText(/completados/)).not.toBeInTheDocument()
  })
})
```

---

- [ ] **Paso 2: Correr y confirmar que falla**

```bash
pnpm vitest run src/features/practicas/TablaProductos.test.tsx
```

Esperado: FAIL, `Failed to resolve import "./TablaProductos"`.

---

- [ ] **Paso 3: Escribir el componente**

```tsx
// src/features/practicas/TablaProductos.tsx
import { Icon } from '@iconify/react'
import {
  Box,
  Chip,
  IconButton,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material'

import { estaCompleto, type ElementoCaptura } from './esquemas'
import { aspectoDeMetodo, ETIQUETA_CLASIFICACION } from './metodos'

type Props = {
  elementos: ElementoCaptura[]
  seleccionado: number | null
  onElegir: (existenciaId: number) => void
  onQuitar: (existenciaId: number) => void
}

export function TablaProductos({ elementos, seleccionado, onElegir, onQuitar }: Props) {
  const completados = elementos.filter(estaCompleto).length

  return (
    <Box>
      <Stack direction="row" spacing={1} sx={{ alignItems: 'baseline', mb: 2 }}>
        <Typography variant="h2" sx={{ color: 'institucional.main' }}>
          Productos utilizados
        </Typography>
        {elementos.length === 0 ? null : (
          <Typography sx={{ color: 'text.secondary' }}>
            {`(${completados}/${elementos.length} completados)`}
          </Typography>
        )}
      </Stack>

      {elementos.length === 0 ? (
        <Stack spacing={1} sx={{ alignItems: 'center', py: 6 }}>
          <Icon icon="mdi:package-variant-closed" width={40} aria-hidden />
          <Typography sx={{ color: 'text.secondary' }}>Sin productos</Typography>
          <Typography variant="body2" sx={{ color: 'text.disabled', textAlign: 'center' }}>
            Usa «Buscar producto» para agregar lo que se usó en la práctica
          </Typography>
        </Stack>
      ) : (
        // La tabla desborda a lo ancho en 1024 px, que es la resolución de las
        // máquinas del almacén. Con overflow propio, la que se desplaza es ella
        // y no la página entera.
        <TableContainer sx={{ overflowX: 'auto' }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Código</TableCell>
                <TableCell>Nombre</TableCell>
                <TableCell>Tipo</TableCell>
                <TableCell>Método</TableCell>
                <TableCell>Estado</TableCell>
                <TableCell align="right">Quitar</TableCell>
              </TableRow>
            </TableHead>

            <TableBody>
              {elementos.map((el) => {
                const completo = estaCompleto(el)
                const metodo = aspectoDeMetodo(el.metodo)

                return (
                  <TableRow
                    key={el.existenciaId}
                    hover
                    selected={seleccionado === el.existenciaId}
                    aria-selected={seleccionado === el.existenciaId}
                    onClick={() => onElegir(el.existenciaId)}
                    sx={{ cursor: 'pointer' }}
                  >
                    <TableCell sx={{ fontFamily: 'monospace', color: 'institucional.main' }}>
                      {el.codigo}
                    </TableCell>
                    <TableCell>{el.nombre}</TableCell>
                    <TableCell>
                      <Stack direction="row" spacing={0.5} sx={{ alignItems: 'center' }}>
                        <Box sx={{ color: metodo.color, display: 'flex' }}>
                          <Icon icon={metodo.icono} aria-hidden />
                        </Box>
                        <span>{ETIQUETA_CLASIFICACION[el.clasificacion]}</span>
                      </Stack>
                    </TableCell>
                    <TableCell>
                      <Chip size="small" variant="outlined" label={metodo.etiqueta} />
                    </TableCell>
                    <TableCell>
                      <Stack
                        direction="row"
                        spacing={0.5}
                        sx={{ alignItems: 'center', color: completo ? 'success.main' : 'warning.main' }}
                      >
                        <Icon
                          icon={completo ? 'mdi:check-circle-outline' : 'mdi:clock-outline'}
                          aria-hidden
                        />
                        <span>{completo ? 'Completado' : 'Pendiente'}</span>
                      </Stack>
                    </TableCell>
                    <TableCell align="right">
                      <IconButton
                        aria-label={`Quitar ${el.nombre}`}
                        size="small"
                        // stopPropagation: sin esto, quitar también dispara el
                        // onClick de la fila y selecciona lo que acaba de irse.
                        onClick={(evento) => {
                          evento.stopPropagation()
                          onQuitar(el.existenciaId)
                        }}
                      >
                        <Icon icon="mdi:trash-can-outline" />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </Box>
  )
}
```

---

- [ ] **Paso 4: Correr y confirmar que pasa**

```bash
pnpm vitest run src/features/practicas/TablaProductos.test.tsx
pnpm typecheck
```

Esperado: las 8 pruebas en verde y `typecheck` en cero.

**Si `success.main` o `warning.main` no existen en el tema**, revisa
`src/tema.ts`: la paleta declara `primary`, `secondary`, `error` e
`institucional` explícitamente, y MUI completa el resto con sus valores por
omisión. Si no completa esos dos, usa `secondary.main` para pendiente y
`primary.main` para completado, pero **no** metas un hex.

---

- [ ] **Paso 5: Punto de commit**

Archivos: `src/features/practicas/TablaProductos.tsx`,
`src/features/practicas/TablaProductos.test.tsx`.

Mensaje sugerido: `feat(practicas): tabla de productos utilizados con su contador`

---

## Tarea 10: El Panel de Control y sus tres capturas

El panel derecho: la cabecera del producto elegido, el sub-panel que le toca
según su método, las casillas de observación filtradas y la descripción
adicional.

**El sub-panel se elige por `metodo_control`, que llega en la fila.** Nunca por
la clasificación ni por un condicional sobre el almacén: el método lo decide
`metodo_de_control()` en la base, y es la misma función que usa
`registrar_practica`. Ésa es la razón de que el panel y lo que se guarda no
puedan discrepar.

**"Leer balanza" se dibuja apagado**, mismo trato que "Escanear QR". Leer una
balanza pide Web Serial —sólo Chromium, sólo HTTPS— y saber marca, modelo y
protocolo del aparato. El peso se teclea.

**Archivos:**
- Crear: `src/features/practicas/CapturaPeso.tsx`
- Crear: `src/features/practicas/CapturaCantidad.tsx`
- Crear: `src/features/practicas/CapturaPrestamo.tsx`
- Crear: `src/features/practicas/Observaciones.tsx`
- Crear: `src/features/practicas/PanelControl.tsx`
- Test: `src/features/practicas/PanelControl.test.tsx`
- Test: `src/features/practicas/Observaciones.test.tsx`

**Interfaces:**
- Consume: `ElementoCaptura`, `consumoDe`, `perdidasDe`, `errorDeElemento` de
  `./esquemas` (Tarea 3); `Motivo`, `motivosDeMetodo` de `./consultas`
  (Tarea 5); `aspectoDeMetodo` de `./metodos` (Tarea 2).
- Produce, y las cuatro primeras comparten forma:

```tsx
type PropsCaptura = {
  elemento: ElementoCaptura
  onCambiar: (parcial: Partial<ElementoCaptura>) => void
}

export function CapturaPeso(p: PropsCaptura): JSX.Element
export function CapturaCantidad(p: PropsCaptura): JSX.Element
export function CapturaPrestamo(p: PropsCaptura): JSX.Element

export function Observaciones(p: PropsCaptura & { motivos: Motivo[] }): JSX.Element

export function PanelControl(props: {
  elemento: ElementoCaptura | null
  motivos: Motivo[]
  onCambiar: (parcial: Partial<ElementoCaptura>) => void
}): JSX.Element
```

---

- [ ] **Paso 1: Escribir las pruebas, que deben fallar**

```tsx
// src/features/practicas/PanelControl.test.tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, test, vi } from 'vitest'

import type { Motivo } from './consultas'
import { elementoDesdeExistencia, type ElementoCaptura } from './esquemas'
import { PanelControl } from './PanelControl'

const MOTIVOS: Motivo[] = [
  { clave: 'no_tenemos', etiqueta: 'No tenemos', metodos: ['peso', 'cantidad'] },
  { clave: 'material_daniado', etiqueta: 'Material dañado', metodos: ['cantidad'] },
  { clave: 'equipo_daniado', etiqueta: 'Equipo dañado', metodos: ['prestamo'] },
  { clave: 'otro', etiqueta: 'Otro', metodos: ['peso', 'cantidad', 'prestamo'] },
]

function crear(
  metodo: 'peso' | 'cantidad' | 'prestamo',
  clasificacion: 'reactivo' | 'material' | 'equipo',
  campos: Partial<ElementoCaptura> = {},
): ElementoCaptura {
  return {
    ...elementoDesdeExistencia({
      id: 1,
      codigo: 'N3-00042',
      nombre_canonico: 'Etanol 96%',
      clasificacion,
      unidad_base: 'ml',
      almacen_clave: 'N3',
      cantidad: 2000,
      ubicacion: 'Lab 2',
      metodo_control: metodo,
    }),
    ...campos,
  }
}

function montar(elemento: ElementoCaptura | null, onCambiar = vi.fn()) {
  render(<PanelControl elemento={elemento} motivos={MOTIVOS} onCambiar={onCambiar} />)
  return onCambiar
}

describe('PanelControl — vacío', () => {
  test('sin producto elegido invita a elegir uno', () => {
    montar(null)

    expect(screen.getByText('Seleccione un producto')).toBeInTheDocument()
    expect(screen.getByText(/haga clic en una fila/i)).toBeInTheDocument()
  })
})

describe('PanelControl — elige el sub-panel por el método', () => {
  test('peso', () => {
    montar(crear('peso', 'reactivo'))

    expect(screen.getByText('Control por Peso')).toBeInTheDocument()
    expect(screen.getByLabelText(/peso inicial/i)).toBeInTheDocument()
    expect(screen.queryByLabelText(/cantidad entregada/i)).not.toBeInTheDocument()
  })

  test('cantidad', () => {
    montar(crear('cantidad', 'material'))

    expect(screen.getByText('Control por Cantidad')).toBeInTheDocument()
    expect(screen.getByLabelText(/cantidad entregada/i)).toBeInTheDocument()
    expect(screen.queryByLabelText(/peso inicial/i)).not.toBeInTheDocument()
  })

  test('préstamo', () => {
    montar(crear('prestamo', 'equipo'))

    expect(screen.getByText('Control por Préstamo')).toBeInTheDocument()
    expect(screen.getByLabelText(/estado de salida/i)).toBeInTheDocument()
    expect(screen.queryByLabelText(/peso inicial/i)).not.toBeInTheDocument()
  })
})

describe('PanelControl — peso', () => {
  test('el consumo se calcula en vivo', () => {
    montar(crear('peso', 'reactivo', { pesoInicial: 526, pesoFinal: 520 }))

    expect(screen.getByText('6 ml')).toBeInTheDocument()
  })

  test('teclear el peso inicial avisa hacia arriba como número', async () => {
    const onCambiar = montar(crear('peso', 'reactivo'))

    await userEvent.type(screen.getByLabelText(/peso inicial/i), '526')

    expect(onCambiar).toHaveBeenLastCalledWith({ pesoInicial: 526 })
  })

  test('borrar el campo lo deja nulo, no en cero', async () => {
    const onCambiar = montar(crear('peso', 'reactivo', { pesoInicial: 5 }))

    await userEvent.clear(screen.getByLabelText(/peso inicial/i))

    expect(onCambiar).toHaveBeenLastCalledWith({ pesoInicial: null })
  })

  // Web Serial pide Chromium, HTTPS y saber el protocolo del aparato. Apagado,
  // como Escanear QR.
  test('Leer balanza está apagado', () => {
    montar(crear('peso', 'reactivo'))

    for (const boton of screen.getAllByRole('button', { name: /leer balanza/i })) {
      expect(boton).toBeDisabled()
    }
  })
})

describe('PanelControl — cantidad', () => {
  test('las pérdidas se calculan en vivo', () => {
    montar(
      crear('cantidad', 'material', {
        cantidadEntregada: 10,
        cantidadDevuelta: 7,
        cantidadDanada: 2,
      }),
    )

    expect(screen.getByText('1 ml')).toBeInTheDocument()
  })
})

describe('PanelControl — el error del producto se ve donde se captura', () => {
  test('un peso final mayor que el inicial lo dice ahí mismo', () => {
    montar(crear('peso', 'reactivo', { pesoInicial: 520, pesoFinal: 526 }))

    expect(screen.getByText('El peso final no puede ser mayor que el inicial'))
      .toBeInTheDocument()
  })

  test('un producto correcto muestra que está completo', () => {
    montar(crear('peso', 'reactivo', { pesoInicial: 526, pesoFinal: 520 }))

    expect(screen.getByText('Producto completado')).toBeInTheDocument()
  })
})
```

```tsx
// src/features/practicas/Observaciones.test.tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, test, vi } from 'vitest'

import type { Motivo } from './consultas'
import { elementoDesdeExistencia } from './esquemas'
import { Observaciones } from './Observaciones'

const MOTIVOS: Motivo[] = [
  { clave: 'no_tenemos', etiqueta: 'No tenemos', metodos: ['peso', 'cantidad'] },
  { clave: 'material_daniado', etiqueta: 'Material dañado', metodos: ['cantidad'] },
  { clave: 'equipo_daniado', etiqueta: 'Equipo dañado', metodos: ['prestamo'] },
  { clave: 'otro', etiqueta: 'Otro', metodos: ['peso', 'cantidad', 'prestamo'] },
]

function elemento(metodo: 'peso' | 'cantidad' | 'prestamo', motivos: string[] = []) {
  return {
    ...elementoDesdeExistencia({
      id: 1,
      codigo: 'N3-00042',
      nombre_canonico: 'Etanol 96%',
      clasificacion: metodo === 'prestamo' ? ('equipo' as const) : ('reactivo' as const),
      unidad_base: 'ml',
      almacen_clave: 'N3',
      cantidad: 2000,
      ubicacion: null,
      metodo_control: metodo,
    }),
    motivos,
  }
}

describe('Observaciones', () => {
  // La lista NO está escrita en el componente: sale de motivo_observacion.metodos,
  // para que mover un motivo de panel sea un update y no un redespliegue.
  test('el panel de préstamo no ofrece "Material dañado"', () => {
    render(<Observaciones elemento={elemento('prestamo')} motivos={MOTIVOS} onCambiar={vi.fn()} />)

    expect(screen.getByLabelText('Equipo dañado')).toBeInTheDocument()
    expect(screen.queryByLabelText('Material dañado')).not.toBeInTheDocument()
  })

  test('el de cantidad ofrece los consumibles y su propio dañado', () => {
    render(<Observaciones elemento={elemento('cantidad')} motivos={MOTIVOS} onCambiar={vi.fn()} />)

    expect(screen.getByLabelText('No tenemos')).toBeInTheDocument()
    expect(screen.getByLabelText('Material dañado')).toBeInTheDocument()
    expect(screen.queryByLabelText('Equipo dañado')).not.toBeInTheDocument()
  })

  test('marcar una casilla la agrega a los motivos', async () => {
    const onCambiar = vi.fn()
    render(<Observaciones elemento={elemento('peso')} motivos={MOTIVOS} onCambiar={onCambiar} />)

    await userEvent.click(screen.getByLabelText('No tenemos'))

    expect(onCambiar).toHaveBeenCalledWith({ motivos: ['no_tenemos'] })
  })

  test('desmarcarla la quita sin tocar las demás', async () => {
    const onCambiar = vi.fn()
    render(
      <Observaciones
        elemento={elemento('peso', ['no_tenemos', 'otro'])}
        motivos={MOTIVOS}
        onCambiar={onCambiar}
      />,
    )

    await userEvent.click(screen.getByLabelText('No tenemos'))

    expect(onCambiar).toHaveBeenCalledWith({ motivos: ['otro'] })
  })

  test('la descripción adicional avisa hacia arriba', async () => {
    const onCambiar = vi.fn()
    render(<Observaciones elemento={elemento('peso')} motivos={MOTIVOS} onCambiar={onCambiar} />)

    await userEvent.type(screen.getByLabelText(/descripción adicional/i), 'x')

    expect(onCambiar).toHaveBeenLastCalledWith({ observaciones: 'x' })
  })
})
```

---

- [ ] **Paso 2: Correr y confirmar que fallan**

```bash
pnpm vitest run src/features/practicas/PanelControl.test.tsx src/features/practicas/Observaciones.test.tsx
```

Esperado: FAIL, los dos por `Failed to resolve import`.

---

- [ ] **Paso 3: Escribir los tres sub-paneles de captura**

Los tres comparten un ayudante para leer números: un `<input type="number">`
vacío devuelve `''`, y convertirlo con `Number('')` da `0`. Un cero capturado y
un campo en blanco son cosas distintas —el primero significa "se consumió todo",
el segundo "falta capturar"— y confundirlos hace que `estaCompleto()` diga que
sí cuando no.

```tsx
// src/features/practicas/campoNumero.ts
/**
 * Lo que teclea la persona, como número o como nulo.
 *
 * `Number('')` es `0`, y ese cero silencioso es lo que haría que un campo en
 * blanco pasara por capturado. Vacío es `null`, y `estaCompleto()` lo ve.
 */
export function aNumero(texto: string): number | null {
  const limpio = texto.trim()
  if (limpio === '') return null
  const valor = Number(limpio)
  return Number.isNaN(valor) ? null : valor
}

/** El valor de un `<input>` controlado: nunca `null`, que React no admite. */
export function aTexto(valor: number | null): string {
  return valor === null ? '' : String(valor)
}
```

```tsx
// src/features/practicas/CapturaPeso.tsx
import { Icon } from '@iconify/react'
import { Box, IconButton, Stack, TextField, Tooltip, Typography } from '@mui/material'

import { aNumero, aTexto } from './campoNumero'
import { consumoDe, type ElementoCaptura } from './esquemas'

type Props = {
  elemento: ElementoCaptura
  onCambiar: (parcial: Partial<ElementoCaptura>) => void
}

const AVISO_BALANZA =
  'La balanza todavía no está conectada al sistema. Teclea el peso que marque.'

/** El botón de la balanza, apagado. Mismo trato que «Escanear QR». */
function BotonBalanza() {
  return (
    <Tooltip title={AVISO_BALANZA}>
      <span>
        <IconButton aria-label="Leer balanza" disabled color="secondary">
          <Icon icon="mdi:scale-balance" />
        </IconButton>
      </span>
    </Tooltip>
  )
}

export function CapturaPeso({ elemento, onCambiar }: Props) {
  const consumo = consumoDe(elemento)

  return (
    <Stack spacing={2}>
      <Stack direction="row" spacing={1} sx={{ alignItems: 'flex-start' }}>
        <TextField
          fullWidth
          type="number"
          label={`Peso inicial (${elemento.unidadBase})`}
          value={aTexto(elemento.pesoInicial)}
          onChange={(e) => onCambiar({ pesoInicial: aNumero(e.target.value) })}
        />
        <BotonBalanza />
      </Stack>

      <Stack direction="row" spacing={1} sx={{ alignItems: 'flex-start' }}>
        <TextField
          fullWidth
          type="number"
          label={`Peso final (${elemento.unidadBase})`}
          value={aTexto(elemento.pesoFinal)}
          onChange={(e) => onCambiar({ pesoFinal: aNumero(e.target.value) })}
        />
        <BotonBalanza />
      </Stack>

      {/* Se muestra pero NO se envía: `consumo` es una columna generada, y la
          aritmética vive en la base porque una resta que calcula el frontend se
          puede equivocar en silencio. */}
      <Box sx={{ bgcolor: 'action.hover', borderRadius: 1, p: 1.5 }}>
        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
          Consumo calculado
        </Typography>
        <Typography variant="h2" sx={{ color: 'institucional.main' }}>
          {consumo === null ? '—' : `${consumo} ${elemento.unidadBase}`}
        </Typography>
      </Box>
    </Stack>
  )
}
```

```tsx
// src/features/practicas/CapturaCantidad.tsx
import { Box, Stack, TextField, Typography } from '@mui/material'

import { aNumero, aTexto } from './campoNumero'
import { perdidasDe, type ElementoCaptura } from './esquemas'

type Props = {
  elemento: ElementoCaptura
  onCambiar: (parcial: Partial<ElementoCaptura>) => void
}

export function CapturaCantidad({ elemento, onCambiar }: Props) {
  const perdidas = perdidasDe(elemento)

  return (
    <Stack spacing={2}>
      <TextField
        fullWidth
        type="number"
        label="Cantidad entregada"
        value={aTexto(elemento.cantidadEntregada)}
        onChange={(e) => onCambiar({ cantidadEntregada: aNumero(e.target.value) })}
      />
      <TextField
        fullWidth
        type="number"
        label="Cantidad devuelta"
        value={aTexto(elemento.cantidadDevuelta)}
        onChange={(e) => onCambiar({ cantidadDevuelta: aNumero(e.target.value) })}
      />
      {/* Dañada y perdida se capturan por separado porque la base escribe DOS
          movimientos distintos: 'merma' para lo dañado y 'consumo' para lo no
          devuelto. Juntarlas tiraría esa distinción. */}
      <TextField
        fullWidth
        type="number"
        label="Cantidad dañada"
        value={aTexto(elemento.cantidadDanada)}
        onChange={(e) => onCambiar({ cantidadDanada: aNumero(e.target.value) })}
      />

      <Box sx={{ bgcolor: 'action.hover', borderRadius: 1, p: 1.5 }}>
        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
          Pérdidas calculadas
        </Typography>
        <Typography variant="h2" sx={{ color: 'institucional.main' }}>
          {perdidas === null ? '—' : `${perdidas} ${elemento.unidadBase}`}
        </Typography>
      </Box>
    </Stack>
  )
}
```

```tsx
// src/features/practicas/CapturaPrestamo.tsx
import { FormControl, InputLabel, MenuItem, Select, Stack } from '@mui/material'

import type { ElementoCaptura, Funcionamiento } from './esquemas'

type Props = {
  elemento: ElementoCaptura
  onCambiar: (parcial: Partial<ElementoCaptura>) => void
}

/**
 * Dos opciones y no cuatro. El enum `funcionamiento_equipo` de la base es
 * `correcto` / `presenta_fallas`; el «Bueno / Regular / Dañado / Mantenimiento»
 * del prototipo viejo no existe en el esquema.
 */
const ESTADOS: { valor: Funcionamiento; etiqueta: string }[] = [
  { valor: 'correcto', etiqueta: 'Correcto' },
  { valor: 'presenta_fallas', etiqueta: 'Presenta fallas' },
]

export function CapturaPrestamo({ elemento, onCambiar }: Props) {
  return (
    <Stack spacing={2}>
      <FormControl fullWidth>
        <InputLabel id="rot-salida">Estado de salida</InputLabel>
        <Select
          labelId="rot-salida"
          label="Estado de salida"
          value={elemento.estadoSalida ?? ''}
          onChange={(e) => onCambiar({ estadoSalida: e.target.value as Funcionamiento })}
        >
          {ESTADOS.map((e) => (
            <MenuItem key={e.valor} value={e.valor}>
              {e.etiqueta}
            </MenuItem>
          ))}
        </Select>
      </FormControl>

      {/* Opcional: un equipo puede quedarse prestado de un día para otro. Si
          viene, el trigger actualiza `existencia.funcionamiento`. */}
      <FormControl fullWidth>
        <InputLabel id="rot-devolucion">Estado de devolución</InputLabel>
        <Select
          labelId="rot-devolucion"
          label="Estado de devolución"
          value={elemento.estadoDevolucion ?? ''}
          onChange={(e) => onCambiar({ estadoDevolucion: e.target.value as Funcionamiento })}
        >
          {ESTADOS.map((e) => (
            <MenuItem key={e.valor} value={e.valor}>
              {e.etiqueta}
            </MenuItem>
          ))}
        </Select>
      </FormControl>
    </Stack>
  )
}
```

---

- [ ] **Paso 4: Escribir `Observaciones`**

```tsx
// src/features/practicas/Observaciones.tsx
import { Checkbox, FormControlLabel, FormGroup, Stack, TextField, Typography } from '@mui/material'

import { motivosDeMetodo, type Motivo } from './consultas'
import type { ElementoCaptura } from './esquemas'

type Props = {
  elemento: ElementoCaptura
  motivos: Motivo[]
  onCambiar: (parcial: Partial<ElementoCaptura>) => void
}

/**
 * Las casillas del producto elegido. **Qué casillas se ofrecen no está escrito
 * aquí**: sale de `motivo_observacion.metodos`, que es lo que hace que mover
 * «No tenemos» a otro panel sea un `update` y no un redespliegue.
 *
 * Van por producto y no por práctica: «Contaminado» es una propiedad del frasco,
 * y colgadas de la sesión no dirían cuál de los tres productos se contaminó.
 */
export function Observaciones({ elemento, motivos, onCambiar }: Props) {
  const disponibles = motivosDeMetodo(motivos, elemento.metodo)
  const marcados = new Set(elemento.motivos)

  function alternar(clave: string) {
    const siguiente = marcados.has(clave)
      ? elemento.motivos.filter((m) => m !== clave)
      : [...elemento.motivos, clave]
    onCambiar({ motivos: siguiente })
  }

  return (
    <Stack spacing={1}>
      <Typography
        variant="body2"
        sx={{ color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '0.06em' }}
      >
        Observaciones
      </Typography>

      <FormGroup>
        {disponibles.map((motivo) => (
          <FormControlLabel
            key={motivo.clave}
            label={motivo.etiqueta}
            control={
              <Checkbox
                checked={marcados.has(motivo.clave)}
                onChange={() => alternar(motivo.clave)}
              />
            }
          />
        ))}
      </FormGroup>

      <TextField
        fullWidth
        multiline
        minRows={2}
        label="Descripción adicional"
        placeholder="Lo que no cabe en una casilla…"
        value={elemento.observaciones}
        onChange={(e) => onCambiar({ observaciones: e.target.value })}
      />
    </Stack>
  )
}
```

---

- [ ] **Paso 5: Escribir `PanelControl`**

```tsx
// src/features/practicas/PanelControl.tsx
import { Icon } from '@iconify/react'
import { Alert, Box, Divider, Paper, Stack, Typography } from '@mui/material'

import { CapturaCantidad } from './CapturaCantidad'
import { CapturaPeso } from './CapturaPeso'
import { CapturaPrestamo } from './CapturaPrestamo'
import type { Motivo } from './consultas'
import { errorDeElemento, type ElementoCaptura } from './esquemas'
import { aspectoDeMetodo } from './metodos'
import { Observaciones } from './Observaciones'

type Props = {
  elemento: ElementoCaptura | null
  motivos: Motivo[]
  onCambiar: (parcial: Partial<ElementoCaptura>) => void
}

export function PanelControl({ elemento, motivos, onCambiar }: Props) {
  if (elemento === null) {
    return (
      <Stack spacing={1} sx={{ alignItems: 'center', py: 6 }}>
        <Icon icon="mdi:package-variant-closed" width={40} aria-hidden />
        <Typography sx={{ color: 'text.secondary' }}>Seleccione un producto</Typography>
        <Typography variant="body2" sx={{ color: 'text.disabled' }}>
          Haga clic en una fila de la tabla
        </Typography>
      </Stack>
    )
  }

  const metodo = aspectoDeMetodo(elemento.metodo)
  const error = errorDeElemento(elemento)

  return (
    <Stack spacing={2}>
      {/* Qué producto se está capturando. Sin esto, quien llena tres productos
          seguidos pierde de vista cuál es cuál. */}
      <Paper
        variant="outlined"
        sx={{ p: 1.5, borderLeft: '4px solid', borderLeftColor: metodo.color }}
      >
        <Typography sx={{ fontWeight: 600 }}>{elemento.nombre}</Typography>
        <Typography variant="body2" sx={{ fontFamily: 'monospace', color: metodo.color }}>
          {elemento.codigo}
        </Typography>
        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
          {`${elemento.almacenClave} · ${elemento.disponible} ${elemento.unidadBase}`}
        </Typography>
      </Paper>

      <Stack
        direction="row"
        spacing={1}
        sx={{ alignItems: 'center', color: metodo.color, fontWeight: 600 }}
      >
        <Icon icon={metodo.icono} aria-hidden />
        <span>{metodo.titulo}</span>
      </Stack>

      {/* El sub-panel se elige por el método que trae la fila, que lo puso
          `metodo_de_control()` en la base. Nunca por la clasificación ni por un
          condicional sobre el almacén. */}
      <Box>
        {elemento.metodo === 'peso' ? (
          <CapturaPeso elemento={elemento} onCambiar={onCambiar} />
        ) : null}
        {elemento.metodo === 'cantidad' ? (
          <CapturaCantidad elemento={elemento} onCambiar={onCambiar} />
        ) : null}
        {elemento.metodo === 'prestamo' ? (
          <CapturaPrestamo elemento={elemento} onCambiar={onCambiar} />
        ) : null}
      </Box>

      <Divider />

      <Observaciones elemento={elemento} motivos={motivos} onCambiar={onCambiar} />

      {/* El problema se dice donde se captura, no al finalizar: si sale hasta el
          envío, quien lo lee ya no sabe cuál de los productos fue. */}
      {error === null ? (
        <Alert severity="success" icon={<Icon icon="mdi:check-circle-outline" />}>
          Producto completado
        </Alert>
      ) : (
        <Alert severity="warning" icon={<Icon icon="mdi:alert-outline" />}>
          {error}
        </Alert>
      )}
    </Stack>
  )
}
```

---

- [ ] **Paso 6: Correr y confirmar que pasan**

```bash
pnpm vitest run src/features/practicas/PanelControl.test.tsx src/features/practicas/Observaciones.test.tsx
pnpm typecheck && pnpm lint
```

Esperado: las 15 pruebas en verde, `typecheck` y `lint` en cero.

**Si la prueba de «borrar el campo lo deja nulo» falla con `pesoInicial: 0`**, es
que el componente está usando `Number(e.target.value)` en vez de `aNumero`. Ése
es justo el bug que `campoNumero.ts` viene a evitar: arréglalo en el componente,
no en la prueba.

---

- [ ] **Paso 7: Punto de commit**

Archivos: `campoNumero.ts`, `CapturaPeso.tsx`, `CapturaCantidad.tsx`,
`CapturaPrestamo.tsx`, `Observaciones.tsx`, `Observaciones.test.tsx`,
`PanelControl.tsx`, `PanelControl.test.tsx`, todos bajo
`src/features/practicas/`.

Mensaje sugerido: `feat(practicas): panel de control con las tres capturas y las observaciones por producto`

---

## Tarea 11: Ensamblar la pantalla, el borrador y finalizar

Todo junto. `PaginaPracticas` deja de ser un esqueleto: mantiene el estado de la
captura, cuelga las consultas, ofrece restaurar el borrador y finaliza.

**Archivos:**
- Modificar: `src/features/practicas/PaginaPracticas.tsx` — se reescribe entero
- Test: `src/features/practicas/PaginaPracticas.test.tsx`

**Interfaces:**
- Consume: todo lo de las Tareas 2 a 10.
- Produce: nada nuevo. Es la hoja del árbol.

**Qué se prueba automáticamente y qué no.** Las reglas de estado —agregar,
quitar, seleccionar, cuándo se apaga Finalizar— se prueban con un doble de
`./consultas` completo. Lo que no se prueba aquí es la RLS con usuarios reales,
que es lo que cubre el guion manual del Paso 5.

---

- [ ] **Paso 1: Escribir la prueba, que debe fallar**

```tsx
// src/features/practicas/PaginaPracticas.test.tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, test, vi } from 'vitest'

const registrar = vi.fn()
const guardarBorrador = vi.fn()
const borrarBorrador = vi.fn()

// El doble reemplaza la capa de datos entera. Lo que se prueba aquí son las
// reglas de estado de la pantalla, no las consultas: ésas se ejercitan en el
// guion manual, contra la base de verdad y con usuarios de verdad.
vi.mock('./consultas', async () => {
  const real = await vi.importActual<typeof import('./consultas')>('./consultas')
  return {
    ...real,
    useProgramas: () => ({ data: [{ id: 1, nombre: 'Química en Alimentos' }] }),
    useSemestresDePrograma: () => ({ data: [3] }),
    useAsignaturasDeSemestre: () => ({ data: [{ id: 10, nombre: 'Bioquímica' }] }),
    usePracticasDeAsignatura: () => ({
      data: [{ id: 100, numero: 2, nombre: 'Actividad enzimática' }],
    }),
    useLaboratorios: () => ({
      data: [{ id: 5, nombre: 'Laboratorio de docencia N3', almacenClave: 'N3' }],
    }),
    useMotivos: () => ({
      data: [{ clave: 'otro', etiqueta: 'Otro', metodos: ['peso', 'cantidad', 'prestamo'] }],
    }),
    useBuscarExistencias: () => ({
      data: [
        {
          id: 12,
          codigo: 'N3-00042',
          nombre_canonico: 'Etanol 96%',
          clasificacion: 'reactivo',
          unidad_base: 'ml',
          almacen_clave: 'N3',
          cantidad: 2000,
          ubicacion: 'Lab 2',
          metodo_control: 'peso',
        },
      ],
      isPending: false,
    }),
    useBorrador: () => ({ data: null, isPending: false }),
    useGuardarBorrador: () => ({ mutate: guardarBorrador, isPending: false }),
    useBorrarBorrador: () => ({ mutate: borrarBorrador, isPending: false }),
    useRegistrarPractica: () => ({ mutate: registrar, isPending: false }),
  }
})

const { PaginaPracticas } = await import('./PaginaPracticas')

function montar() {
  render(
    <MemoryRouter>
      <PaginaPracticas />
    </MemoryRouter>,
  )
}

/** Llena la cascada completa: es el prerrequisito de casi todo lo demás. */
async function llenarCabecera() {
  await userEvent.click(screen.getByLabelText('Programa educativo'))
  await userEvent.click(screen.getByRole('option', { name: 'Química en Alimentos' }))
  await userEvent.click(screen.getByLabelText('Semestre'))
  await userEvent.click(screen.getByRole('option', { name: '3°' }))
  await userEvent.click(screen.getByLabelText('Asignatura'))
  await userEvent.click(screen.getByRole('option', { name: 'Bioquímica' }))
  await userEvent.click(screen.getByLabelText('Número de práctica'))
  await userEvent.click(screen.getByRole('option', { name: /Práctica 2/ }))
  await userEvent.click(screen.getByLabelText('Laboratorio'))
  await userEvent.click(screen.getByRole('option', { name: /Laboratorio de docencia N3/ }))
}

async function agregarEtanol() {
  await userEvent.click(screen.getByRole('button', { name: /buscar producto/i }))
  await userEvent.click(screen.getByRole('button', { name: /agregar etanol 96%/i }))
  await userEvent.click(screen.getByRole('button', { name: 'Cerrar' }))
}

beforeEach(() => {
  registrar.mockClear()
  guardarBorrador.mockClear()
  borrarBorrador.mockClear()
})

describe('PaginaPracticas', () => {
  test('arranca con el panel vacío y sin productos', () => {
    montar()

    expect(screen.getByText('Seleccione un producto')).toBeInTheDocument()
    expect(screen.getByText('Sin productos')).toBeInTheDocument()
  })

  // Sin laboratorio no hay almacén, y sin almacén no hay sobre qué buscar.
  test('no se pueden agregar productos antes de elegir laboratorio', () => {
    montar()

    expect(screen.getByRole('button', { name: /buscar producto/i })).toBeDisabled()
  })

  test('agregar un producto lo pone en la tabla y lo selecciona', async () => {
    montar()
    await llenarCabecera()
    await agregarEtanol()

    expect(screen.getByRole('row', { name: /etanol 96%/i })).toBeInTheDocument()
    expect(screen.getByText('Control por Peso')).toBeInTheDocument()
  })

  test('quitar un producto lo saca de la tabla y vacía el panel', async () => {
    montar()
    await llenarCabecera()
    await agregarEtanol()
    await userEvent.click(screen.getByRole('button', { name: /quitar etanol 96%/i }))

    expect(screen.getByText('Sin productos')).toBeInTheDocument()
    expect(screen.getByText('Seleccione un producto')).toBeInTheDocument()
  })

  test('finalizar está apagado sin productos', async () => {
    montar()
    await llenarCabecera()

    expect(screen.getByRole('button', { name: /finalizar práctica/i })).toBeDisabled()
  })

  // El mismo criterio que el chip de la tabla y que los checks de la base. Si
  // discreparan, alguien finalizaría creyendo que está completo.
  test('finalizar está apagado con un producto pendiente', async () => {
    montar()
    await llenarCabecera()
    await agregarEtanol()

    expect(screen.getByRole('button', { name: /finalizar práctica/i })).toBeDisabled()
  })

  test('con todo capturado, finalizar manda el payload sin metodo_control', async () => {
    montar()
    await llenarCabecera()
    await agregarEtanol()

    await userEvent.type(screen.getByLabelText(/peso inicial/i), '526')
    await userEvent.type(screen.getByLabelText(/peso final/i), '520')
    await userEvent.click(screen.getByRole('button', { name: /finalizar práctica/i }))

    expect(registrar).toHaveBeenCalledOnce()
    const [{ cabecera, elementos }] = registrar.mock.calls[0]

    expect(cabecera.laboratorioId).toBe(5)
    expect(cabecera.practicaCatalogoId).toBe(100)
    expect(elementos).toEqual([
      {
        existencia_id: 12,
        peso_inicial: 526,
        peso_final: 520,
        observaciones: null,
        motivos: [],
      },
    ])
  })

  test('guardar borrador manda la captura tal como va, a medias', async () => {
    montar()
    await llenarCabecera()
    await agregarEtanol()

    await userEvent.click(screen.getByRole('button', { name: /guardar borrador/i }))

    expect(guardarBorrador).toHaveBeenCalledOnce()
    const [contenido] = guardarBorrador.mock.calls[0]

    expect(contenido.version).toBe(1)
    expect(contenido.elementos).toHaveLength(1)
    expect(contenido.elementos[0].pesoInicial).toBeNull()
  })

  test('guardar borrador está apagado si no hay nada que guardar', () => {
    montar()

    expect(screen.getByRole('button', { name: /guardar borrador/i })).toBeDisabled()
  })
})
```

---

- [ ] **Paso 2: Correr y confirmar que falla**

```bash
pnpm vitest run src/features/practicas/PaginaPracticas.test.tsx
```

Esperado: FAIL. La pantalla todavía es el esqueleto de la Tarea 6, así que casi
todo falla por no encontrar los controles.

---

- [ ] **Paso 3: Reescribir `PaginaPracticas`**

```tsx
// src/features/practicas/PaginaPracticas.tsx
import { useState } from 'react'
import { Icon } from '@iconify/react'
import { Alert, Button, Card, CardContent, Grid, Snackbar, Stack, Typography } from '@mui/material'

import { CuerpoPagina, EncabezadoPagina } from '@/app/EncabezadoPagina'
import { AgregarProductos } from './AgregarProductos'
import { restaurarBorrador, serializarBorrador, type CabeceraParcial } from './borrador'
import {
  mensajeDeError,
  useAsignaturasDeSemestre,
  useBorrador,
  useBorrarBorrador,
  useBuscarExistencias,
  useGuardarBorrador,
  useLaboratorios,
  useMotivos,
  usePracticasDeAsignatura,
  useProgramas,
  useRegistrarPractica,
  useSemestresDePrograma,
} from './consultas'
import { DatosPractica } from './DatosPractica'
import { DialogoBuscar } from './DialogoBuscar'
import {
  aPayloadElementos,
  elementoDesdeExistencia,
  esquemaCabecera,
  estaCompleto,
  type ElementoCaptura,
  type FilaExistencia,
} from './esquemas'
import { PanelControl } from './PanelControl'
import { TablaProductos } from './TablaProductos'

/** La fecha de hoy en el formato que espera un `<input type="date">`. */
function hoy(): string {
  return new Date().toISOString().slice(0, 10)
}

type Aviso = { tipo: 'success' | 'error' | 'info'; texto: string }

export function PaginaPracticas() {
  const [cabecera, setCabecera] = useState<CabeceraParcial>({ fecha: hoy() })
  const [elementos, setElementos] = useState<ElementoCaptura[]>([])
  const [seleccionado, setSeleccionado] = useState<number | null>(null)
  const [buscando, setBuscando] = useState(false)
  const [termino, setTermino] = useState('')
  const [aviso, setAviso] = useState<Aviso | null>(null)
  const [borradorAtendido, setBorradorAtendido] = useState(false)

  const programas = useProgramas()
  const semestres = useSemestresDePrograma(cabecera.programaId ?? null)
  const asignaturas = useAsignaturasDeSemestre(
    cabecera.programaId ?? null,
    cabecera.semestre ?? null,
  )
  const practicas = usePracticasDeAsignatura(cabecera.asignaturaId ?? null)
  const laboratorios = useLaboratorios()
  const motivos = useMotivos()
  const existencias = useBuscarExistencias(termino)
  const borrador = useBorrador()

  const guardar = useGuardarBorrador()
  const borrar = useBorrarBorrador()
  const registrar = useRegistrarPractica()

  const elemento = elementos.find((e) => e.existenciaId === seleccionado) ?? null
  const hayAlgo = elementos.length > 0 || cabecera.programaId !== undefined
  const todosCompletos = elementos.length > 0 && elementos.every(estaCompleto)
  const cabeceraValida = esquemaCabecera.safeParse(cabecera).success

  // Restaurar el borrador guardado. Se ofrece una vez y no se aplica solo: pisar
  // en silencio lo que alguien acaba de empezar a capturar sería peor que no
  // tener borrador.
  const hayBorrador = borrador.data !== null && borrador.data !== undefined
  const mostrarRestaurar = hayBorrador && !borradorAtendido && elementos.length === 0

  function restaurar() {
    setBorradorAtendido(true)
    const contenido = restaurarBorrador(borrador.data?.contenido)

    if (contenido === null) {
      // Un borrador de otra versión se descarta entero: media captura
      // restaurada es peor que ninguna, porque quien la ve no sabe qué falta.
      setAviso({ tipo: 'info', texto: 'El borrador guardado es de una versión anterior y no se pudo recuperar' })
      borrar.mutate()
      return
    }

    setCabecera(contenido.cabecera)
    setElementos(contenido.elementos)
    setSeleccionado(contenido.elementos[0]?.existenciaId ?? null)
  }

  function agregar(fila: FilaExistencia) {
    if (elementos.some((e) => e.existenciaId === fila.id)) return
    const nuevo = elementoDesdeExistencia(fila)
    setElementos([...elementos, nuevo])
    setSeleccionado(nuevo.existenciaId)
  }

  function quitar(existenciaId: number) {
    setElementos(elementos.filter((e) => e.existenciaId !== existenciaId))
    if (seleccionado === existenciaId) setSeleccionado(null)
  }

  function cambiarElemento(parcial: Partial<ElementoCaptura>) {
    setElementos(
      elementos.map((e) => (e.existenciaId === seleccionado ? { ...e, ...parcial } : e)),
    )
  }

  function alGuardarBorrador() {
    setBorradorAtendido(true)
    guardar.mutate(serializarBorrador(cabecera, elementos), {
      onSuccess: () => setAviso({ tipo: 'success', texto: 'Borrador guardado' }),
      onError: (error) => setAviso({ tipo: 'error', texto: mensajeDeError(error) }),
    })
  }

  function finalizar() {
    const validada = esquemaCabecera.safeParse(cabecera)
    if (!validada.success) {
      setAviso({ tipo: 'error', texto: validada.error.issues[0].message })
      return
    }

    registrar.mutate(
      { cabecera: validada.data, elementos: aPayloadElementos(elementos) },
      {
        onSuccess: (folio) => {
          // El folio es lo único que la pantalla no podía saber antes de
          // guardar: lo asigna el trigger.
          setAviso({ tipo: 'success', texto: `Práctica ${folio} registrada` })
          setCabecera({ fecha: hoy() })
          setElementos([])
          setSeleccionado(null)
          // El borrador ya cumplió. Si esto falla no importa: la práctica ya está.
          borrar.mutate()
        },
        // Si falla, la captura NO se limpia: el trabajo no se pierde por un
        // error de red ni por un 42501.
        onError: (error) => setAviso({ tipo: 'error', texto: mensajeDeError(error) }),
      },
    )
  }

  return (
    <>
      <EncabezadoPagina
        titulo="Registro de práctica"
        descripcion="Captura de uso de reactivos, materiales y equipos"
        acciones={
          <>
            <Button
              variant="outlined"
              color="secondary"
              startIcon={<Icon icon="mdi:content-save-outline" />}
              onClick={alGuardarBorrador}
              disabled={!hayAlgo || guardar.isPending}
            >
              Guardar borrador
            </Button>
            <Button
              variant="contained"
              startIcon={<Icon icon="mdi:send-outline" />}
              onClick={finalizar}
              disabled={!todosCompletos || !cabeceraValida || registrar.isPending}
            >
              Finalizar práctica
            </Button>
          </>
        }
      />

      <CuerpoPagina>
        {mostrarRestaurar ? (
          <Alert
            severity="info"
            sx={{ mb: 2 }}
            action={
              <>
                <Button size="small" onClick={restaurar}>
                  Recuperar
                </Button>
                <Button
                  size="small"
                  onClick={() => {
                    setBorradorAtendido(true)
                    borrar.mutate()
                  }}
                >
                  Descartar
                </Button>
              </>
            }
          >
            Tienes una práctica a medio capturar
          </Alert>
        ) : null}

        <Grid container spacing={2} sx={{ alignItems: 'flex-start' }}>
          <Grid size={{ xs: 12, lg: 8 }}>
            <Stack spacing={2}>
              <Card>
                <CardContent>
                  <Typography variant="h2" sx={{ color: 'institucional.main', mb: 2 }}>
                    Datos de la práctica
                  </Typography>
                  <DatosPractica
                    valores={cabecera}
                    onCambiar={(parcial) => setCabecera({ ...cabecera, ...parcial })}
                    programas={programas.data ?? []}
                    semestres={semestres.data ?? []}
                    asignaturas={asignaturas.data ?? []}
                    practicas={practicas.data ?? []}
                    laboratorios={laboratorios.data ?? []}
                    deshabilitado={registrar.isPending}
                  />
                </CardContent>
              </Card>

              <Card>
                <CardContent>
                  <Typography variant="h2" sx={{ color: 'institucional.main', mb: 2 }}>
                    Agregar productos
                  </Typography>
                  <AgregarProductos
                    onBuscar={() => setBuscando(true)}
                    // Sin laboratorio no hay almacén, y la búsqueda sale
                    // filtrada por almacén.
                    deshabilitado={cabecera.laboratorioId === undefined || registrar.isPending}
                  />
                </CardContent>
              </Card>

              <Card>
                <CardContent>
                  <TablaProductos
                    elementos={elementos}
                    seleccionado={seleccionado}
                    onElegir={setSeleccionado}
                    onQuitar={quitar}
                  />
                </CardContent>
              </Card>
            </Stack>
          </Grid>

          {/* sticky para que el panel siga a la vista mientras se recorre una
              tabla larga: capturar obliga a mirar los dos lados. */}
          <Grid size={{ xs: 12, lg: 4 }}>
            <Card sx={{ position: { lg: 'sticky' }, top: { lg: 16 } }}>
              <CardContent>
                <Typography variant="h2" sx={{ color: 'institucional.main', mb: 2 }}>
                  Panel de control
                </Typography>
                <PanelControl
                  elemento={elemento}
                  motivos={motivos.data ?? []}
                  onCambiar={cambiarElemento}
                />
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </CuerpoPagina>

      <DialogoBuscar
        abierto={buscando}
        termino={termino}
        onTermino={setTermino}
        filas={existencias.data ?? []}
        cargando={existencias.isPending}
        yaAgregados={elementos.map((e) => e.existenciaId)}
        onAgregar={agregar}
        onCerrar={() => setBuscando(false)}
      />

      <Snackbar
        open={aviso !== null}
        autoHideDuration={6000}
        onClose={() => setAviso(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert severity={aviso?.tipo ?? 'info'} onClose={() => setAviso(null)}>
          {aviso?.texto}
        </Alert>
      </Snackbar>
    </>
  )
}
```

---

- [ ] **Paso 4: Correr la verificación completa**

```bash
pnpm test && pnpm typecheck && pnpm lint && pnpm build
supabase test db
```

Esperado: los cinco en cero. **Pega la salida real, no la promesa.**

---

- [ ] **Paso 5: Correr el guion manual**

Lo que las pruebas automáticas no alcanzan. `supabase start` y `pnpm dev`.

```
 1. Entra como n3@uaeh.local / sigrem2026 y abre Prácticas
    -> Sale la pantalla de dos columnas. El panel derecho dice "Seleccione un
       producto" y los dos botones de arriba están apagados.

 2. Elige un programa educativo
    -> Semestre se enciende y sólo ofrece los semestres que ese programa usa.
       Asignatura y Número de práctica siguen apagados.

 3. Recorre la cascada hasta Número de práctica
    -> Cada select enciende el siguiente. El de práctica dice
       "Práctica 2 — Actividad enzimática", no un folio.

 4. Vuelve al primer select y cambia de programa
    -> Semestre, Asignatura y Número de práctica se vacían. Ésta es la regla que
       la FK compuesta rechazaría al final si no se cumpliera.

 5. Abre Laboratorio
    -> Sólo salen los de N3. Ningún laboratorio de N4, LUM ni LE.

 6. Elige laboratorio y pulsa Buscar producto
    -> El modal abre con el cursor ya en el campo. Sólo se listan existencias
       de N3, con su código, clasificación, "N3 · 2000 ml" y su ubicación.

 7. Agrega un reactivo, un material y un equipo
    -> Los tres entran a la tabla, cada uno con su método: Peso, Cantidad y
       Préstamo. El contador dice "(0/3 completados)" y los tres salen
       "Pendiente".

 8. Haz clic en el reactivo
    -> El panel dice "Control por Peso" con Peso inicial y Peso final. El botón
       de la balanza está apagado y su tooltip explica que se teclee.

 9. Teclea 526 y 520
    -> "Consumo calculado 6 ml". El chip de esa fila pasa a "Completado" y el
       contador a "(1/3 completados)".

10. Pon el peso final en 600
    -> El panel dice "El peso final no puede ser mayor que el inicial" ahí
       mismo, sin esperar a Finalizar, y la fila vuelve a "Pendiente".

11. Con el reactivo elegido, mira las observaciones
    -> Salen No tenemos, Contaminado, Se terminó, los tres préstamos y Otro.
       NO sale "Material dañado" ni "Equipo dañado".

12. Elige el material y luego el equipo
    -> El material ofrece "Material dañado" y no "Equipo dañado"; el equipo, al
       revés. El equipo además muestra Estado de salida y de devolución con dos
       opciones: Correcto y Presenta fallas.

13. Completa los tres y pulsa Guardar borrador
    -> Aviso "Borrador guardado".

14. Recarga con F5
    -> Sale el aviso "Tienes una práctica a medio capturar" con Recuperar y
       Descartar. Recuperar devuelve los tres productos con lo capturado.

15. Pulsa Finalizar práctica
    -> Aviso "Práctica PRA-0001 registrada". La pantalla se vacía y el aviso de
       borrador ya no aparece al recargar.

16. Ve a Inventario y busca el reactivo
    -> Su cantidad bajó 6. En su panel de movimientos hay uno de tipo consumo
       con motivo "Consumo en practica".

17. Busca el equipo que devolviste con "Presenta fallas"
    -> Su funcionamiento cambió. NO hay ningún movimiento suyo: un préstamo
       devuelto no cambia de cantidad, y un -1/+1 que se cancela es historia
       inventada.

18. Cierra sesión, entra como lectura@uaeh.local y abre Prácticas
    -> La pantalla se ve y se puede recorrer. Al pulsar Finalizar sale
       "No puedes registrar prácticas en este almacén", no un 42501 crudo ni
       una pantalla en blanco.

19. Entra como n4@uaeh.local y abre Prácticas
    -> Laboratorio sólo ofrece los de N4, y la búsqueda sólo existencias de N4.
       El borrador de N3 no aparece por ningún lado.

20. Entra como admin@uaeh.local
    -> Laboratorio ofrece los cuatro almacenes y la búsqueda también.

21. `supabase stop` y pulsa Finalizar
    -> Sale un mensaje entendible, no una pantalla en blanco.

22. Recorre la pantalla entera con Tab
    -> Se llega a los seis selects, a los dos botones de agregar, a las filas de
       la tabla y a todos los campos del panel. El botón de QR y el de la
       balanza se saltan por estar apagados.

23. Reduce la ventana a 1024 px, que es lo que tienen las máquinas del almacén
    -> El Panel de Control se va debajo de la captura. La tabla de productos se
       desplaza a lo ancho dentro de su tarjeta; la página NO se desplaza a lo
       ancho.

24. Cambia a modo oscuro con el botón del tema
    -> No hay ningún color quemado: los chips, los avisos y el borde del panel
       responden al modo.
```

Si algún paso no se puede correr —por ejemplo, no hay existencias de equipo
cargadas en N3— **dilo explícitamente** en vez de omitirlo.

---

- [ ] **Paso 6: Punto de commit**

Archivos: `src/features/practicas/PaginaPracticas.tsx`,
`src/features/practicas/PaginaPracticas.test.tsx`.

Mensaje sugerido: `feat(practicas): ensamblaje de la pantalla, borrador y finalizar`

---

## Al entregar

Tres partes, en este orden:

**1. Qué se construyó.** Una o dos líneas.

**2. Verificación automática.** La salida real de
`pnpm test && pnpm typecheck && pnpm lint && pnpm build` y de
`supabase test db`. La salida, no la promesa.

**3. El guion manual del Paso 5**, con lo que pasó en cada paso. Lo que no se
haya podido correr se dice, no se omite.

Y recuerda: **los commits los hace la persona**. Deja el árbol listo y dile qué
archivos tocaste.
