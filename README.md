# SIGREM-LAB

Sistema Integral de Gestion de Reactivos, Materiales y Equipos de Laboratorio
— Unidad Central de Laboratorios, UAEH.

Administra el inventario de 4 almacenes (**N3, N4, LUM, LE**) y el consumo en practicas
de los laboratorios que dependen de ellos.

> **Diseno completo:** [`docs/specs/2026-08-12-inventarios-ucl-datos-y-esquema-design.md`](docs/specs/2026-08-12-inventarios-ucl-datos-y-esquema-design.md)
> Leelo antes de tocar el esquema. Explica por que el modelo tiene tres capas y por que
> las cantidades no se escriben directamente.

## Stack

| | |
|---|---|
| Frontend | React 19 + TypeScript + Vite |
| UI | MUI (Material UI) + Emotion |
| Estado de servidor | TanStack Query |
| Formularios | react-hook-form + zod |
| Backend | Supabase (Postgres + Auth + RLS) |
| ETL | Python + openpyxl |

## Arrancar

```bash
pnpm install
cp .env.example .env      # y rellenar
pnpm dev
```

Para la base de datos local (requiere Docker Desktop):

```bash
supabase start           # imprime la URL y la anon key para tu .env
supabase db reset        # aplica migraciones + seed desde cero
pnpm gen:types           # regenera src/types/database.ts
```

## Comandos

| Comando | Que hace |
|---|---|
| `pnpm dev` | Servidor de desarrollo |
| `pnpm build` | Typecheck + build de produccion |
| `pnpm typecheck` | Solo `tsc --noEmit` |
| `pnpm lint` | ESLint |
| `pnpm gen:types` | Regenera los tipos desde el esquema local |
| `pnpm db:reset` | Reconstruye la BD local desde las migraciones |
| `pnpm db:diff -- <nombre>` | Genera una migracion a partir de cambios locales |

## Estructura

```
src/
  features/      un modulo por dominio: inventario/, catalogo/, practicas/, reportes/
  components/    componentes compartidos entre features
  lib/           supabase.ts y utilidades transversales
  types/         database.ts (GENERADO, no editar a mano)
supabase/
  migrations/    SQL versionado — la fuente de verdad del esquema
etl/             scripts Python de migracion desde los Excel
docs/specs/      documentos de diseno
referencia/      prototipo original de pantallas y flujo (NO se compila ni se lintea)
```

## Convenciones

**1. El esquema solo cambia por migracion.** Nunca desde el dashboard de Supabase.
Cada cambio es un archivo en `supabase/migrations/`, commiteado. Es lo que permite
reconstruir la base desde cero en vez de rezar para que nadie haya tocado nada.

**2. Los tipos se generan, no se escriben.** Despues de cada migracion, `pnpm gen:types`
y commitear el resultado. Si cambia una columna y se olvida el frontend, TypeScript lo
grita en compilacion en vez de que lo descubra alguien en el almacen.

**3. Dev y prod separados.** Nunca probar contra los datos reales de los almacenes.

**4. Cada politica de RLS lleva su prueba.** La app se distribuira como binario con la
`anon key` dentro — esa llave es publica por diseno y cualquiera puede extraerla. Lo unico
que protege los datos son las politicas, no el cliente. Es la unica parte del sistema donde
escribir pruebas no es opcional.

## Datos de origen

Los Excel de los almacenes **no viven en git**: son binarios que git no sabe
diferenciar, y son datos institucionales reales de la UCL-UAEH. Se copian a mano en
`etl/Datos-Reales-JD2026/`, carpeta ignorada por `.gitignore`.

## `referencia/`

Prototipo original (React + shadcn/ui + Tailwind) construido para validar pantallas y flujo.
Se conserva como referencia visual; **no es codigo de produccion** y esta excluido de
`tsconfig.json` y de ESLint. Las pantallas se reimplementan con MUI.
`referencia/prototipo/INSTRUCCIONES.md` describe cada modulo con detalle.
