-- Corrección de acentos del texto visible, para bases YA sembradas.
--
--   psql "$DATABASE_URL" -f supabase/correccion-acentos.sql
--
-- `datos-iniciales.sql` ya trae el texto bien escrito, pero es idempotente con
-- `on conflict do nothing`: volver a correrlo NO actualiza las filas que ya
-- existen. Este script sí. En local no hace falta —`supabase db reset` vuelve a
-- sembrar desde cero— pero el proyecto remoto ya tiene los nombres viejos.
--
-- El que importa de verdad es el laboratorio de N4.
--
--   «ensenianza» no es un acento perdido: es la ñ transliterada como «ni».
--   unaccent() convierte ñ→n, así que norm_texto('Laboratorio de ensenianza 5')
--   da «...ensenianza 5» y norm_texto('Laboratorio de enseñanza 5') da
--   «...ensenanza 5». NO casan. El cargador busca el laboratorio por
--   norm_texto(), así que con el nombre viejo la hoja de Equipos de N4 se
--   rechaza entera y no hay forma de arreglarlo desde el ETL.
--
-- Es idempotente: correrlo dos veces no hace nada la segunda.

begin;

-- ---------------------------------------------------------------------------
-- Almacenes
-- ---------------------------------------------------------------------------
update public.almacen set nombre = 'Almacén Nivel 3' where clave = 'N3';
update public.almacen set nombre = 'Almacén Nivel 4' where clave = 'N4';
update public.almacen set nombre = 'Almacén LUM'     where clave = 'LUM';
update public.almacen set nombre = 'Almacén del Laboratorio de Electrónica'
 where clave = 'LE';

update public.almacen set uso_principal = 'Prácticas de laboratorio en UCL'
 where uso_principal = 'Practicas de laboratorio en UCL';

-- ---------------------------------------------------------------------------
-- Laboratorios
-- ---------------------------------------------------------------------------
update public.laboratorio set nombre = 'Análisis Sensorial'
 where nombre = 'Analisis Sensorial';
update public.laboratorio set nombre = 'Laboratorio de enseñanza 5'
 where nombre = 'Laboratorio de ensenianza 5';
update public.laboratorio set nombre = 'Caracterización y procesamiento'
 where nombre = 'Caracterizacion y procesamiento';
update public.laboratorio set nombre = 'Laboratorio de Electrónica'
 where nombre = 'Laboratorio de Electronica';

-- ---------------------------------------------------------------------------
-- Programas educativos
-- ---------------------------------------------------------------------------
update public.programa_educativo set nombre = v.nuevo
  from (values
    ('Ingenieria en Alimentos',                      'Ingeniería en Alimentos'),
    ('Ingenieria en Biotecnologia',                  'Ingeniería en Biotecnología'),
    ('Ingenieria Industrial',                        'Ingeniería Industrial'),
    ('Ingenieria en Electronica y Telecomunicaciones','Ingeniería en Electrónica y Telecomunicaciones'),
    ('Ingenieria Mecanica',                          'Ingeniería Mecánica'),
    ('Quimica en Alimentos',                         'Química en Alimentos'),
    ('Quimico Farmaceutico Biologo',                 'Químico Farmacéutico Biólogo'),
    ('Ingenieria en Tecnologias del Software',       'Ingeniería en Tecnologías del Software')
  ) as v(viejo, nuevo)
 where public.programa_educativo.nombre = v.viejo;

-- ---------------------------------------------------------------------------
-- Motivos de observación
-- ---------------------------------------------------------------------------
-- La `clave` no se toca: es el identificador que usa la app.
update public.motivo_observacion set etiqueta = 'Préstamo N4'    where clave = 'prestamo_n4';
update public.motivo_observacion set etiqueta = 'Préstamo N3'    where clave = 'prestamo_n3';
update public.motivo_observacion set etiqueta = 'Préstamo LUM'   where clave = 'prestamo_lum';
update public.motivo_observacion set etiqueta = 'Se terminó'     where clave = 'se_termino';
update public.motivo_observacion set etiqueta = 'Material dañado' where clave = 'material_daniado';
update public.motivo_observacion set etiqueta = 'Equipo dañado'  where clave = 'equipo_daniado';

-- ---------------------------------------------------------------------------
-- Etiquetas y ayudas de los campos capturables
-- ---------------------------------------------------------------------------
-- `campo` y `destino` no se tocan: son identificadores.
update public.campo_capturable set etiqueta_default = v.nuevo
  from (values
    ('nombre_articulo',      'Artículo'),
    ('especificacion',       'Especificación'),
    ('clasificacion',        'Clasificación'),
    ('presentacion',         'Presentación'),
    ('cantidad_minima',      'Cantidad mínima'),
    ('peso_frasco_vacio',    'Peso del frasco vacío'),
    ('numero_serie',         'Número de serie'),
    ('numero_inventario',    'Número de inventario UAEH'),
    ('fecha_chequeo',        'Fecha de último chequeo'),
    ('fecha_adquisicion',    'Fecha de adquisición'),
    ('fecha_recoleccion',    'Fecha de recolección'),
    ('fecha_preparacion',    'Fecha de preparación'),
    ('metodo_conservacion',  'Método de conservación'),
    ('sub_ubicacion',        'Sub-ubicación'),
    ('fila_cajon',           'Fila o cajón'),
    ('ubicacion_texto',      'Ubicación'),
    ('cas',                  'Número CAS'),
    ('estado_fisico',        'Estado físico'),
    ('caracteristica_quimica','Característica química'),
    ('caracteristica_toxica','Característica tóxica')
  ) as v(campo, nuevo)
 where public.campo_capturable.campo = v.campo;

update public.campo_capturable set ayuda = v.nuevo
  from (values
    ('nombre_articulo',   'Pasa por búsqueda difusa antes de crear uno nuevo'),
    ('especificacion',    'Con el artículo forma la identidad: 1000 mL clase A no es 250 mL'),
    ('unidad',            'La más pequeña que se consume; el empaque va en Presentación'),
    ('presentacion',      'El empaque: caja de 100, bidón de 4 L'),
    ('peso_total',        'La cantidad se deriva de lleno menos vacío'),
    ('laboratorio',       'Las opciones salen de la tabla laboratorio del almacén'),
    ('fecha_adquisicion', 'Dice la antigüedad cuando la caducidad está ilegible'),
    ('metodo_conservacion','Seco, Refrigeración, Formol al 10%'),
    ('temperatura',       'Admite Ambiente, no solo números'),
    ('observaciones',     'Aquí van las aclaraciones que no caben en una columna de números'),
    ('coord_h',           'Posición dentro del mueble, solo números'),
    ('coord_v',           'Posición dentro del mueble, solo números'),
    ('coord_i',           'Posición dentro del mueble, solo números'),
    ('color_almacenamiento','Son seis: NO TÓXICO no es un color')
  ) as v(campo, nuevo)
 where public.campo_capturable.campo = v.campo;

-- ---------------------------------------------------------------------------
-- Perfiles de captura
-- ---------------------------------------------------------------------------
update public.perfil_captura set nombre = 'Materia biológica'
 where nombre = 'Materia biologica';
update public.perfil_captura set nombre = 'Electrónica'
 where nombre = 'Electronica';
update public.perfil_captura set notas = 'Hoja Materia biológica, 15 columnas'
 where notas = 'Hoja Materia biologica, 15 columnas';
update public.perfil_captura set notas = 'Hoja Electrónica, 14 columnas'
 where notas = 'Hoja Electronica, 14 columnas';

-- ---------------------------------------------------------------------------
-- Comprobación
-- ---------------------------------------------------------------------------
select a.clave, l.nombre as laboratorio
  from public.laboratorio l
  join public.almacen a on a.id = l.almacen_id
 order by a.clave, l.nombre;

commit;
