# SIGREM-LAB

Inventarios de los 4 almacenes de la Unidad Central de Laboratorios, UAEH.

Diseño vigente: `docs/specs/2026-08-18-depuracion-esquema-formato-unificado-design.md`,
con su plan en `docs/plans/2026-08-18-depuracion-esquema.md`. El anterior
(`docs/specs/2026-08-12-inventarios-ucl-datos-y-esquema-design.md`) queda como
antecedente: sigue siendo útil para entender por qué se tomó cada decisión
original, pero donde se contradiga con el del 18 de agosto, manda el nuevo.

## Regla principal: usa lo que ya está instalado

Cada dependencia del `package.json` se eligió para cubrir un problema. **Si vas a
escribir código que resuelve algo que una de estas librerías ya resuelve, estás
escribiendo código de más.**

| Problema | Lo resuelve | No escribas |
|---|---|---|
| Componentes de interfaz | `@mui/material` | Botones, tablas, modales, menús, selects propios |
| Iconos | `@iconify/react` | SVG a mano; no instales otra librería de iconos |
| Datos del servidor: fetch, caché, reintentos, estados de carga | `@tanstack/react-query` | `useEffect` + `useState` para traer datos |
| Estado de formularios | `react-hook-form` | Un `useState` por campo |
| Validación | `zod` | `if (!valor) setError(...)` a mano |
| Acceso a la base | `@supabase/supabase-js` con `Database` | `fetch()` contra la API REST |
| Rutas | `react-router-dom` | Renderizado condicional por estado |

Antes de instalar cualquier dependencia nueva, pregunta.

## Reglas del proyecto

**Los tipos se generan, no se escriben.** Después de cada migración corre
`pnpm gen:types`. Nunca edites `src/types/database.ts` a mano ni declares a mano
la forma de una fila.

**El esquema solo cambia por migración.** Un archivo nuevo en
`supabase/migrations/`, nunca desde el dashboard. Una migración ya aplicada no
se edita: se agrega otra.

> **Excepción de una sola vez, 18 de agosto de 2026.** El baseline se reescribió
> completo: las 7 migraciones del 12 de agosto se borraron y se reemplazaron por
> 7 nuevas. Se pudo hacer porque no había ni un registro cargado, el proyecto
> remoto estaba vacío y el CLI no estaba vinculado, así que no existía historial
> de migraciones fuera de esta máquina. **Esa ventana se cierra con el primer
> `supabase db push`.** Después de ese push la regla vuelve a ser literal.
> Razonamiento completo en la §3 del spec vigente.

**Cada política de RLS lleva su prueba.** En producción la app llevará la
`anon key` dentro del binario; esa llave es pública y cualquiera puede
extraerla. Lo único que protege los datos son las políticas. Pruebas en
`supabase/tests/database/`, se corren con `supabase test db`.

**El formulario de alta se arma desde la base, no desde el código.** Cada
almacén captura campos distintos para el mismo tipo de cosa. La función
`formulario(almacen_id, clasificacion)` devuelve qué campos pedir. Nunca
resuelvas eso con condicionales sobre el almacén.

**`referencia/prototipo/` no se toca.** Es el diseño original de pantallas y
flujo, en otro stack (shadcn + Tailwind). Sirve para consultar el layout; no es
código de producción y está excluido de `tsconfig.json` y de ESLint.

## En español

Los identificadores del dominio van en español, igual que el esquema:
`existencia`, `almacen`, `articulo`, `movimiento`. Los comentarios y todo el
texto que ve el usuario, también.

## Antes de dar algo por terminado

```bash
pnpm typecheck && pnpm lint && pnpm build
supabase test db
```

Los cuatro tienen que salir en cero. No digas que algo funciona sin haberlos
corrido.

## Entorno local

```bash
supabase start          # requiere Docker Desktop corriendo
supabase db reset       # migraciones + seed desde cero
pnpm gen:types
pnpm dev
```

Usuarios de prueba: `admin@uaeh.local`, `n3@`, `n4@`, `lum@`, `le@`,
`lectura@` — todos con `sigrem2026`.
