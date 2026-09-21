-- El formato unificado, descrito para poder REGENERARLO.
--
-- El ETL ya sabe leerlo (`CAMPOS` en etl/extract/formato.py). Esto es el otro
-- sentido: que la app pueda escribir un libro que el personal reconozca -y que
-- el propio ETL pueda volver a leer-.
--
-- Va en la base y no en un diccionario de TypeScript por lo que ya razona el
-- comentario de `private.clave_renglon`: un mapa en el frontend hay que
-- acordarse de actualizarlo, y olvidarlo no rompe la compilacion; manda el
-- valor con la llave equivocada y el campo se pierde en silencio.
--
-- Se acepta que existan DOS copias -esta y la del ETL- y no se refactoriza
-- aquel: funciona y esta probado contra archivos reales. Lo que impide que se
-- separen es la prueba de ida y vuelta, que exporta y vuelve a leer.
--
-- Los titulos NO estan escritos a mano: salen de los libros reales de N4 y
-- Actopan, leidos con openpyxl en la fila de encabezado de cada hoja. Es la
-- unica forma de que el archivo exportado diga lo mismo que el que el personal
-- tiene abierto.
create table public.hoja_formato (
  hoja               text primary key,
  clasificacion      public.clasificacion_articulo,
  fila_encabezado    integer not null,
  celda_responsable  text not null,
  celda_periodo      text not null,
  celda_actualizado  text not null,
  orden              integer not null unique
);

comment on table public.hoja_formato is
  'Una fila por hoja del formato unificado. El orden es el de HOJAS_DE_DATOS del ETL.';

comment on column public.hoja_formato.clasificacion is
  'Nula en Insumos, Material y Electronica: esas tres traen la clasificacion en el renglon, no en la hoja. Es lo mismo que dice private.hoja_de().';

create table public.columna_formato (
  hoja    text not null references public.hoja_formato (hoja) on delete cascade,
  campo   text not null,
  columna text not null,
  titulo  text not null,

  -- El tipo va aqui y no se adivina en el cliente. Sin el, `cantidad` y
  -- `peso_vacio` saldrian como texto y el libro exportado reintroduciria por la
  -- puerta de salida lo que el ETL limpio en la de entrada -los originales
  -- traian «Un frasco» en columna numerica-.
  --
  -- Los componentes de ubicacion se quedan en texto a proposito: son etiquetas
  -- que el ETL reensambla como cadena («Repisa 3 · Fila 2»), no magnitudes.
  tipo    text not null default 'texto'
          check (tipo in ('texto', 'numero', 'entero', 'fecha')),

  orden   integer not null,

  primary key (hoja, campo),
  unique (hoja, columna)
);

comment on table public.columna_formato is
  'Que columna del Excel es que campo. Espejo de CAMPOS en etl/extract/formato.py.';

-- El orden es el de HOJAS_DE_DATOS y no el alfabetico: el catalogo de articulos
-- es global, asi que el orden en que se escriben las hojas tiene que ser
-- reproducible por la misma razon que lo es al leerlas.
--
-- «Material biologico», no «Materia biologica». El ETL buscaba el segundo y los
-- libros traen el primero, asi que esa hoja no se leia y nadie se enteraba.
-- Corregido en etl/extract/formato.py el mismo dia que esta migracion.
insert into public.hoja_formato
  (hoja, clasificacion, fila_encabezado, celda_responsable, celda_periodo, celda_actualizado, orden)
values
  ('Reactivos',          'reactivo',          9, 'F4', 'B5', 'F5', 1),
  ('Insumos',             null,               8, 'F4', 'B5', 'F5', 2),
  ('Material',            null,               8, 'F4', 'B5', 'F5', 3),
  ('Equipos',            'equipo',            8, 'F4', 'B5', 'F5', 4),
  ('Material biológico', 'materia_biologica', 8, 'F4', 'B5', 'F5', 5),
  ('Electrónica',         null,               8, 'F4', 'B5', 'F5', 6);

insert into public.columna_formato (hoja, campo, columna, titulo, tipo, orden) values
  -- Reactivos
  ('Reactivos', 'sub_ubicacion', 'B', $$Sub-ubicación$$, 'texto', 1),
  ('Reactivos', 'mueble', 'C', $$Anaquel$$, 'texto', 2),
  ('Reactivos', 'repisa', 'D', $$Repisa$$, 'texto', 3),
  ('Reactivos', 'fila_cajon', 'E', $$Fila$$, 'texto', 4),
  ('Reactivos', 'color', 'F', $$Clasificación por color de almacenaje$$, 'texto', 5),
  ('Reactivos', 'hoja_seguridad', 'G', $$Existencia de hoja de seguridad$$, 'texto', 6),
  ('Reactivos', 'sustancia', 'H', $$Sustancia química$$, 'texto', 7),
  ('Reactivos', 'marca', 'I', $$Marca$$, 'texto', 8),
  ('Reactivos', 'presentacion', 'J', $$Presentación$$, 'texto', 9),
  ('Reactivos', 'peso_vacio', 'K', $$Peso del frasco vacío$$, 'numero', 10),
  ('Reactivos', 'peso_total', 'L', $$Peso del frasco lleno$$, 'numero', 11),
  ('Reactivos', 'cantidad', 'M', $$Cantidad$$, 'numero', 12),
  ('Reactivos', 'unidad', 'N', $$Unidad$$, 'texto', 13),
  ('Reactivos', 'solido', 'P', $$Sólido$$, 'texto', 14),
  ('Reactivos', 'liquido', 'Q', $$Líquido$$, 'texto', 15),
  ('Reactivos', 'gas', 'R', $$Gas$$, 'texto', 16),
  ('Reactivos', 'caracteristica_quimica', 'S', $$Característica principal$$, 'texto', 17),
  ('Reactivos', 'caracteristica_toxica', 'T', $$Característica principal$$, 'texto', 18),
  ('Reactivos', 'riesgo_salud', 'U', $$Azul: Riesgo a la salud$$, 'entero', 19),
  ('Reactivos', 'riesgo_reactividad', 'V', $$Amarillo: Riesgo de reactividad$$, 'entero', 20),
  ('Reactivos', 'riesgo_inflamabilidad', 'W', $$Rojo: Riesgo de inflamabilidad$$, 'entero', 21),
  ('Reactivos', 'peligro_especial', 'X', $$Blanco: Peligro especial$$, 'texto', 22),
  ('Reactivos', 'implica_peligro', 'Y', $$¿Su uso implica alguna actividad peligrosa?$$, 'texto', 23),
  ('Reactivos', 'observaciones', 'AB', $$Observaciones$$, 'texto', 24),
  -- Insumos
  ('Insumos', 'clasificacion', 'B', $$Clasificación$$, 'texto', 1),
  ('Insumos', 'articulo', 'C', $$Artículo$$, 'texto', 2),
  ('Insumos', 'especificacion', 'D', $$Especificación$$, 'texto', 3),
  ('Insumos', 'marca', 'E', $$Marca$$, 'texto', 4),
  ('Insumos', 'cantidad', 'F', $$Cantidad$$, 'numero', 5),
  ('Insumos', 'unidad', 'G', $$Unidad$$, 'texto', 6),
  ('Insumos', 'presentacion', 'H', $$Presentación$$, 'texto', 7),
  ('Insumos', 'sub_ubicacion', 'I', $$Sub-ubicación$$, 'texto', 8),
  ('Insumos', 'mueble', 'J', $$Mueble$$, 'texto', 9),
  ('Insumos', 'repisa', 'K', $$Repisa$$, 'texto', 10),
  ('Insumos', 'fila_cajon', 'L', $$Fila o cajón$$, 'texto', 11),
  ('Insumos', 'observaciones', 'M', $$Observaciones$$, 'texto', 12),
  -- Material
  ('Material', 'clasificacion', 'B', $$Clasificación$$, 'texto', 1),
  ('Material', 'articulo', 'C', $$Artículo$$, 'texto', 2),
  ('Material', 'especificacion', 'D', $$Especificación$$, 'texto', 3),
  ('Material', 'marca', 'E', $$Marca$$, 'texto', 4),
  ('Material', 'cantidad', 'F', $$Cantidad$$, 'numero', 5),
  ('Material', 'unidad', 'G', $$Unidad$$, 'texto', 6),
  ('Material', 'presentacion', 'H', $$Presentación$$, 'texto', 7),
  ('Material', 'sub_ubicacion', 'I', $$Sub-ubicación$$, 'texto', 8),
  ('Material', 'mueble', 'J', $$Mueble$$, 'texto', 9),
  ('Material', 'repisa', 'K', $$Repisa$$, 'texto', 10),
  ('Material', 'fila_cajon', 'L', $$Fila o cajón$$, 'texto', 11),
  ('Material', 'observaciones', 'M', $$Observaciones$$, 'texto', 12),
  -- Equipos
  ('Equipos', 'articulo', 'B', $$Nombre$$, 'texto', 1),
  ('Equipos', 'marca', 'C', $$Marca$$, 'texto', 2),
  ('Equipos', 'modelo', 'D', $$Modelo$$, 'texto', 3),
  ('Equipos', 'numero_serie', 'E', $$No. de serie$$, 'texto', 4),
  ('Equipos', 'numero_inventario', 'F', $$No. de inventario UAEH$$, 'texto', 5),
  ('Equipos', 'sub_ubicacion', 'G', $$Sub-ubicación$$, 'texto', 6),
  ('Equipos', 'laboratorio', 'H', $$Laboratorio$$, 'texto', 7),
  ('Equipos', 'mueble', 'I', $$Mueble o ubicación$$, 'texto', 8),
  ('Equipos', 'funcionamiento', 'J', $$Funcionamiento$$, 'texto', 9),
  ('Equipos', 'fecha_chequeo', 'K', $$Fecha de último chequeo$$, 'fecha', 10),
  ('Equipos', 'mantenimiento', 'L', $$Mantenimiento realizado$$, 'texto', 11),
  ('Equipos', 'observaciones', 'M', $$Observaciones$$, 'texto', 12),
  -- Material biológico
  ('Material biológico', 'articulo', 'B', $$Nombre común$$, 'texto', 1),
  ('Material biológico', 'origen_especie', 'C', $$Especie/Nombre cietífico$$, 'texto', 2),
  ('Material biológico', 'cantidad', 'E', $$Cantidad$$, 'numero', 3),
  ('Material biológico', 'unidad', 'F', $$Unidad$$, 'texto', 4),
  ('Material biológico', 'presentacion', 'G', $$Presentación$$, 'texto', 5),
  ('Material biológico', 'metodo_conservacion', 'H', $$Método de conservación$$, 'texto', 6),
  ('Material biológico', 'fecha_recoleccion', 'I', $$Fecha de recolección$$, 'fecha', 7),
  ('Material biológico', 'fecha_preparacion', 'J', $$Fecha de preparación$$, 'fecha', 8),
  ('Material biológico', 'responsable_muestra', 'K', $$Responsable$$, 'texto', 9),
  ('Material biológico', 'sub_ubicacion', 'L', $$Sub-ubicación$$, 'texto', 10),
  ('Material biológico', 'mueble', 'M', $$Mueble$$, 'texto', 11),
  ('Material biológico', 'repisa', 'N', $$Repisa$$, 'texto', 12),
  ('Material biológico', 'observaciones', 'O', $$Observaciones$$, 'texto', 13),
  -- Electrónica
  ('Electrónica', 'clasificacion', 'B', $$Clasificación$$, 'texto', 1),
  ('Electrónica', 'familia', 'C', $$Familia$$, 'texto', 2),
  ('Electrónica', 'articulo', 'D', $$Artículo$$, 'texto', 3),
  ('Electrónica', 'especificacion', 'E', $$Especificación$$, 'texto', 4),
  ('Electrónica', 'cantidad', 'F', $$Cantidad$$, 'numero', 5),
  ('Electrónica', 'unidad', 'G', $$Unidad$$, 'texto', 6),
  ('Electrónica', 'presentacion', 'H', $$Presentación$$, 'texto', 7),
  ('Electrónica', 'sub_ubicacion', 'I', $$Sub-ubicación$$, 'texto', 8),
  ('Electrónica', 'mueble', 'J', $$Mueble$$, 'texto', 9),
  ('Electrónica', 'coord_h', 'K', $$Horizontal$$, 'texto', 10),
  ('Electrónica', 'coord_v', 'L', $$Vertical$$, 'texto', 11),
  ('Electrónica', 'coord_i', 'M', $$Interior$$, 'texto', 12),
  ('Electrónica', 'observaciones', 'N', $$Observaciones$$, 'texto', 13);

alter table public.hoja_formato    enable row level security;
alter table public.columna_formato enable row level security;

-- El formato no es dato de nadie: es la descripcion de un documento publico.
-- Se lee con sesion y no se escribe desde la app: cambiarlo es una migracion.
create policy hoja_formato_lectura on public.hoja_formato
  for select to authenticated using (true);

create policy columna_formato_lectura on public.columna_formato
  for select to authenticated using (true);

revoke insert, update, delete on public.hoja_formato    from authenticated;
revoke insert, update, delete on public.columna_formato from authenticated;
revoke all on public.hoja_formato    from anon;
revoke all on public.columna_formato from anon;


-- ---------------------------------------------------------------------------
-- Como se ve una hoja
-- ---------------------------------------------------------------------------
-- Mismo contrato que `public.formulario(almacen, clasificacion)`: la base dice
-- como se arma, el cliente solo lo dibuja.
create or replace function public.formato_hoja(p_hoja text)
returns table (campo text, columna text, titulo text, tipo text, orden integer)
language sql
stable
set search_path = ''
as $$
  select cf.campo, cf.columna, cf.titulo, cf.tipo, cf.orden
  from public.columna_formato cf
  where cf.hoja = p_hoja
  order by cf.orden
$$;

grant execute on function public.formato_hoja(text) to authenticated;
revoke execute on function public.formato_hoja(text) from anon, public;


-- ---------------------------------------------------------------------------
-- private.hoja_de: el mismo nombre equivocado
-- ---------------------------------------------------------------------------
-- Devolvia 'Materia biológica', que no es como se llama la hoja en ningun libro
-- real. Se corrige aqui para que `crear_existencia` y el exportador hablen del
-- mismo documento.
create or replace function private.hoja_de(p_clasificacion public.clasificacion_articulo)
returns text
language sql
immutable
parallel safe
set search_path = ''
as $$
  select case p_clasificacion
    when 'reactivo'          then 'Reactivos'
    when 'equipo'            then 'Equipos'
    when 'materia_biologica' then 'Material biológico'
    -- Las tres restantes no tienen hoja propia: su clasificacion viaja en el
    -- renglon, y `crear_existencia` la escribe ahi antes de llamar.
    else null
  end
$$;
