-- Base: extensiones, esquema privado, normalizacion de texto y enums.
--
-- Diseno: docs/specs/2026-08-18-depuracion-esquema-formato-unificado-design.md

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

-- Una entrada por hoja del formato unificado. materia_biologica es la sexta:
-- muestras, especies y preparaciones, que el esquema anterior no contemplaba.
create type public.clasificacion_articulo as enum (
  'reactivo',
  'material',
  'insumo',
  'equipo',
  'componente',
  'materia_biologica'
);

create type public.estado_fisico as enum ('solido', 'liquido', 'gas');

-- Sin `por_confirmar`. Ese estado significaba "migrada del Excel, sin conteo
-- fisico todavia", y deja de tener sentido: no se cargan existencias
-- historicas, se arranca con los datos de hoy, asi que la carga ES el conteo.
create type public.estado_existencia as enum (
  'disponible',
  'stock_bajo',
  'agotado',
  'contaminado',
  'mantenimiento',
  'baja'
);

-- `carga_inicial` va al frente y separado de `entrada`: sin el, el primer
-- reporte de consumo contaria la carga de arranque como compra del mes.
create type public.tipo_movimiento as enum (
  'carga_inicial',
  'entrada',
  'consumo',
  'merma',
  'ajuste_conteo',  -- conteo fisico: fija el saldo real
  'prestamo',
  'devolucion',
  'baja'
);

create type public.origen_alias as enum ('migracion', 'busqueda', 'fusion');

-- Regla 12 del formato: los colores de almacenaje son seis. "NO TOXICO" no es
-- un color; los 143 renglones de N3 que lo dicen pasan a verde. Como enum y no
-- como texto para que no vuelvan a aparecer catorce formas de escribirlos.
create type public.color_almacenaje as enum (
  'verde',
  'rojo',
  'azul',
  'blanco',
  'amarillo',
  'naranja'
);

-- Solo los dos valores que trae la columna Funcionamiento del formato. Va
-- aparte de estado_existencia a proposito: son dos ejes distintos, y un equipo
-- puede estar `presenta_fallas` y seguir `disponible` para practicas. Agregar
-- un valor a un enum es una linea; quitarlo no se puede.
create type public.funcionamiento_equipo as enum (
  'correcto',
  'presenta_fallas'
);

-- Los tres metodos de control de una practica: los reactivos se pesan, los
-- materiales se cuentan, los equipos se prestan.
create type public.metodo_control as enum ('peso', 'cantidad', 'prestamo');
