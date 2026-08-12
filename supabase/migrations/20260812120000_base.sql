-- Base: extensiones, esquema privado, normalizacion de texto y enums.
--
-- Diseno: docs/specs/2026-08-12-inventarios-ucl-datos-y-esquema-design.md

create extension if not exists pg_trgm  with schema extensions;
create extension if not exists unaccent with schema extensions;

-- Esquema para funciones internas. PostgREST solo expone `public`, asi que nada
-- de aqui es alcanzable desde la API.
create schema if not exists private;


-- ---------------------------------------------------------------------------
-- Normalizacion de texto para busqueda difusa
-- ---------------------------------------------------------------------------
-- unaccent() en su forma de UN argumento no es inmutable: depende del
-- diccionario activo en la sesion, y por eso Postgres no deja indexarla.
-- La forma de DOS argumentos, con el diccionario explicito, si lo es.
-- Este es el error clasico al montar busqueda difusa en espanol.
create or replace function public.norm_texto(t text)
returns text
language sql
immutable
strict
parallel safe
set search_path = ''
as $$
  select lower(extensions.unaccent('extensions.unaccent'::regdictionary, t))
$$;

comment on function public.norm_texto(text) is
  'Minusculas y sin acentos. Base de la busqueda difusa: "acido" encuentra "Acido".';


-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------

create type public.rol_usuario as enum (
  'admin',        -- cura el catalogo y escribe en cualquier almacen
  'responsable',  -- escribe en su propio almacen
  'consulta'      -- solo lectura
);

create type public.clasificacion_articulo as enum (
  'reactivo',
  'material',
  'insumo',
  'equipo',
  'componente'
);

create type public.estado_fisico as enum ('solido', 'liquido', 'gas');

create type public.estado_existencia as enum (
  'por_confirmar',  -- migrada del Excel, sin conteo fisico todavia
  'disponible',
  'stock_bajo',
  'agotado',
  'contaminado',
  'mantenimiento',
  'baja'
);

create type public.tipo_movimiento as enum (
  'entrada',
  'consumo',
  'merma',
  'ajuste_conteo',  -- conteo fisico: fija el saldo real
  'prestamo',
  'devolucion',
  'baja'
);

create type public.origen_alias as enum ('migracion', 'busqueda', 'fusion');
