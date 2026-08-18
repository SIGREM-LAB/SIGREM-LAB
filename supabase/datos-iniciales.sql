-- Datos iniciales para el proyecto REMOTO.
--
-- `supabase db push` solo aplica migraciones; el seed.sql es exclusivo de
-- `supabase db reset` en local. Sin este script, la app desplegada arranca con
-- las tablas vacias y ni siquiera hay almacenes que mostrar.
--
-- Se corre una vez, contra el remoto:
--   psql "$DATABASE_URL" -f supabase/datos-iniciales.sql
-- o pegandolo en el SQL Editor del dashboard.
--
-- Es idempotente: volver a correrlo no duplica nada.
--
-- DIFERENCIA IMPORTANTE CON seed.sql: aqui NO van los usuarios de prueba
-- (admin@uaeh.local, n3@, n4@, lum@, le@, lectura@, todos con la misma
-- contrasenia). Esas cuentas existen para `supabase db reset` en local y meterlas
-- en produccion seria abrir seis puertas con llave conocida. Los usuarios reales
-- se dan de alta desde el dashboard de Auth, y su fila en public.perfil se crea
-- despues con el rol y el almacen que les toque.


-- ---------------------------------------------------------------------------
-- Almacenes
-- ---------------------------------------------------------------------------
-- uso_principal, zona_riesgo y personas_expuestas son constantes por almacen:
-- venian identicas en cada renglon de cada archivo. El exportador NOM las
-- reinyecta por renglon al generar el Excel.
insert into public.almacen (clave, nombre, uso_principal, zona_riesgo, personas_expuestas) values
  ('N3',  'Almacen Nivel 3',                        'Practicas de laboratorio en UCL', 'Laboratorio', 80),
  ('N4',  'Almacen Nivel 4',                        'Practicas de laboratorio en UCL', 'Laboratorio', 80),
  ('LUM', 'Almacen LUM',                            'Practicas de laboratorio en UCL', 'Laboratorio', 80),
  ('LE',  'Almacen del Laboratorio de Electronica', 'Practicas de laboratorio en UCL', 'Laboratorio', 40)
on conflict (clave) do nothing;


-- ---------------------------------------------------------------------------
-- Laboratorios
-- ---------------------------------------------------------------------------
-- Los cuatro primeros salen de la columna Laboratorio de la hoja Equipos del
-- formato unificado. Son los unicos nombres reales que tenemos.
insert into public.laboratorio (almacen_id, nombre)
select id, 'Analisis Sensorial' from public.almacen where clave = 'N4'
union all
select id, 'Laboratorio de ensenianza 5' from public.almacen where clave = 'N4'
union all
select id, 'Caracterizacion y procesamiento' from public.almacen where clave = 'LUM'
union all
select id, 'Laboratorio de Electronica' from public.almacen where clave = 'LE'
on conflict do nothing;

-- PENDIENTE DE CONFIRMAR con el responsable de N3: los ejemplos del formato no
-- traen ningun laboratorio de N3, y una practica necesita laboratorio porque de
-- ahi sale su almacen. Sin al menos uno, N3 no puede registrar practicas.
-- Este nombre es un marcador para que el entorno local funcione, no un dato real.
insert into public.laboratorio (almacen_id, nombre)
select id, 'Laboratorio de docencia N3 (por confirmar)'
  from public.almacen where clave = 'N3'
on conflict do nothing;


-- ---------------------------------------------------------------------------
-- Catalogos de practicas
-- ---------------------------------------------------------------------------
insert into public.programa_educativo (nombre) values
  ('Ingenieria en Alimentos'),
  ('Ingenieria en Biotecnologia'),
  ('Ingenieria Industrial'),
  ('Ingenieria en Electronica y Telecomunicaciones'),
  ('Ingenieria Mecanica'),
  ('Quimica en Alimentos'),
  ('Quimico Farmaceutico Biologo'),
  ('Ingenieria en Tecnologias del Software')
on conflict (nombre) do nothing;

-- Los nueve motivos son las casillas del prototipo. Como catalogo y no como
-- nueve columnas booleanas: agregar el decimo es un insert, no una migracion
-- mas un redespliegue del frontend.
insert into public.motivo_observacion (clave, etiqueta, orden) values
  ('no_tenemos',      'No tenemos',        1),
  ('prestamo_n4',     'Prestamo N4',       2),
  ('prestamo_n3',     'Prestamo N3',       3),
  ('prestamo_lum',    'Prestamo LUM',      4),
  ('contaminado',     'Contaminado',       5),
  ('se_termino',      'Se termino',        6),
  ('material_daniado','Material daniado',  7),
  ('equipo_daniado',  'Equipo daniado',    8),
  ('otro',            'Otro',              9)
on conflict (clave) do nothing;


-- ---------------------------------------------------------------------------
-- Campos capturables
-- ---------------------------------------------------------------------------
-- Catalogo cerrado: un perfil no puede declarar un campo que no existe aqui.
-- Sale de las columnas reales de las 6 hojas del formato unificado.
insert into public.campo_capturable (campo, etiqueta_default, tipo_dato, destino, opciones, ayuda) values
  ('nombre_articulo',    'Articulo',                  'texto',     'articulo.nombre_canonico', null, 'Pasa por busqueda difusa antes de crear uno nuevo'),
  ('especificacion',     'Especificacion',            'texto',     'articulo.descripcion',     null, 'Con el articulo forma la identidad: 1000 mL clase A no es 250 mL'),
  ('clasificacion',      'Clasificacion',             'seleccion', 'articulo.clasificacion',   array['reactivo','material','insumo','equipo','componente','materia_biologica'], null),
  ('unidad',             'Unidad de medida',          'texto',     'articulo.unidad_base',     null, 'La mas pequenia que se consume; el empaque va en Presentacion'),
  ('familia',            'Familia',                   'texto',     'articulo.familia',         null, 'Resistencia, Capacitor, CI Logica Digital...'),
  ('marca',              'Marca',                     'texto',     'existencia.marca',         null, null),
  ('modelo',             'Modelo',                    'texto',     'existencia.modelo',        null, null),
  ('presentacion',       'Presentacion',              'texto',     'existencia.presentacion',  null, 'El empaque: caja de 100, bidon de 4 L'),
  ('cantidad',           'Cantidad en existencia',    'numero',    'movimiento.carga_inicial', null, 'Entra como movimiento, no se escribe directo'),
  ('cantidad_minima',    'Cantidad minima',           'numero',    'existencia.cantidad_minima', null, 'Por debajo de esto el estado pasa a stock bajo'),
  ('peso_frasco_vacio',  'Peso del frasco vacio',     'numero',    'existencia.peso_frasco_vacio', null, 'Va ANTES del lleno: regla 13 del formato'),
  ('peso_total',         'Peso del frasco lleno',     'numero',    'existencia.peso_total',    null, 'La cantidad se deriva de lleno menos vacio'),
  ('numero_serie',       'Numero de serie',           'texto',     'existencia.numero_serie',  null, 'No se repite entre renglones'),
  ('numero_inventario',  'Numero de inventario UAEH', 'texto',     'existencia.numero_inventario_uaeh', null, 'No se repite entre renglones'),
  ('laboratorio',        'Laboratorio',               'seleccion', 'existencia.laboratorio_id', array['(desde laboratorio)'], 'Las opciones salen de la tabla laboratorio del almacen'),
  ('funcionamiento',     'Funcionamiento',            'seleccion', 'existencia.funcionamiento', array['Correcto','Presenta fallas'], null),
  ('mantenimiento',      'Mantenimiento realizado',   'texto',     'existencia.mantenimiento', null, null),
  ('fecha_chequeo',      'Fecha de ultimo chequeo',   'fecha',     'existencia.fecha_chequeo', null, null),
  ('fecha_adquisicion',  'Fecha de adquisicion',      'fecha',     'existencia.fecha_adquisicion', null, 'Dice la antiguedad cuando la caducidad esta ilegible'),
  ('fecha_caducidad',    'Fecha de caducidad',        'fecha',     'existencia.fecha_caducidad', null, 'Informativa: un reactivo caducado no se bloquea'),
  ('origen_especie',     'Origen o especie',          'texto',     'articulo_biologico.origen_especie', null, 'Zea mays, Rattus norvegicus, Aloe vera'),
  ('metodo_conservacion','Metodo de conservacion',    'texto',     'existencia.metodo_conservacion', null, 'Seco, Refrigeracion, Formol al 10%'),
  ('temperatura',        'Temperatura',               'texto',     'existencia.temperatura',   null, 'Admite Ambiente, no solo numeros'),
  ('fecha_recoleccion',  'Fecha de recoleccion',      'fecha',     'existencia.fecha_recoleccion', null, null),
  ('fecha_preparacion',  'Fecha de preparacion',      'fecha',     'existencia.fecha_preparacion', null, null),
  ('responsable_muestra','Responsable de la muestra', 'texto',     'existencia.responsable_muestra', null, null),
  ('observaciones',      'Observaciones',             'texto',     'existencia.observaciones', null, 'Aqui van las aclaraciones que no caben en una columna de numeros'),
  ('ubicacion_texto',    'Ubicacion',                 'texto',     'ubicacion.etiqueta',       null, null),
  ('sub_ubicacion',      'Sub-ubicacion',             'texto',     'ubicacion.componentes.sub_ubicacion', null, 'LUM-1, LUM-2, N3, N4, LE'),
  ('mueble',             'Mueble',                    'texto',     'ubicacion.componentes.mueble', null, 'Anaquel 2, Gabinete 301, Refrigerador, Separador 3'),
  ('repisa',             'Repisa',                    'texto',     'ubicacion.componentes.repisa',  null, null),
  ('fila_cajon',         'Fila o cajon',              'texto',     'ubicacion.componentes.fila_cajon', null, null),
  ('coord_h',            'Horizontal',                'texto',     'ubicacion.componentes.h',  null, 'Posicion dentro del mueble, solo numeros'),
  ('coord_v',            'Vertical',                  'texto',     'ubicacion.componentes.v',  null, 'Posicion dentro del mueble, solo numeros'),
  ('coord_i',            'Interior',                  'texto',     'ubicacion.componentes.i',  null, 'Posicion dentro del mueble, solo numeros'),
  ('cas',                'Numero CAS',                'texto',     'articulo_reactivo.cas',    null, 'Identificador universal de la sustancia'),
  ('color_almacenamiento','Color de almacenaje',      'seleccion', 'articulo_reactivo.color_almacenaje', array['verde','rojo','azul','blanco','amarillo','naranja'], 'Son seis: NO TOXICO no es un color'),
  ('hoja_seguridad',     'Existencia de hoja de seguridad', 'booleano', 'articulo_reactivo.tiene_hoja_seguridad', null, 'Si la tienes, no si hace falta'),
  ('estado_fisico',      'Estado fisico',             'seleccion', 'articulo_reactivo.estado_fisico', array['solido','liquido','gas'], 'Uno solo por reactivo'),
  ('caracteristica_quimica','Caracteristica quimica', 'texto',     'articulo_reactivo.caracteristica_quimica', null, null),
  ('caracteristica_toxica','Caracteristica toxica',   'texto',     'articulo_reactivo.caracteristica_toxica',  null, null),
  ('riesgo_salud',       'NFPA azul: riesgo a la salud',        'numero', 'articulo_reactivo.riesgo_salud',          null, 'Grado 0 a 4'),
  ('riesgo_reactividad', 'NFPA amarillo: reactividad',          'numero', 'articulo_reactivo.riesgo_reactividad',    null, 'Grado 0 a 4'),
  ('riesgo_inflamabilidad','NFPA rojo: inflamabilidad',         'numero', 'articulo_reactivo.riesgo_inflamabilidad', null, 'Grado 0 a 4'),
  ('peligro_especial',   'NFPA blanco: peligro especial',       'texto',  'articulo_reactivo.peligro_especial',      null, null),
  ('implica_peligro',    'Su uso implica actividad de peligro', 'booleano','articulo_reactivo.implica_actividad_peligro', null, null)
on conflict (campo) do nothing;


-- ---------------------------------------------------------------------------
-- Perfiles de captura: uno por clasificacion, para todos los almacenes
-- ---------------------------------------------------------------------------
-- almacen_id nulo = default. Con el formato unificado los cuatro almacenes
-- capturan igual, asi que son 6 perfiles y no 24. Si manana un almacen diverge,
-- se le da de alta el suyo y gana sobre este sin tocar nada mas.
insert into public.perfil_captura (almacen_id, clasificacion, nombre, notas) values
  (null, 'reactivo',          'Reactivos',         'Hoja Reactivos del formato unificado, 28 columnas'),
  (null, 'insumo',            'Insumos',           'Hoja Insumos, 13 columnas'),
  (null, 'material',          'Material',          'Hoja Material, 13 columnas'),
  (null, 'equipo',            'Equipos',           'Hoja Equipos, 13 columnas. Un renglon por equipo fisico'),
  (null, 'materia_biologica', 'Materia biologica', 'Hoja Materia biologica, 15 columnas'),
  (null, 'componente',        'Electronica',       'Hoja Electronica, 14 columnas')
on conflict do nothing;


-- ---------------------------------------------------------------------------
-- Los campos de cada perfil, en el orden de las columnas de su hoja
-- ---------------------------------------------------------------------------
-- Reactivos. El orden de peso_frasco_vacio ANTES de peso_total es la regla 13
-- y no es negociable: N3 y LUM los tenian invertidos entre si, y juntar los
-- archivos sin un orden acordado dejaba la mitad de los pesos al reves.
insert into public.perfil_campo (perfil_id, campo, obligatorio, orden)
select p.id, c.campo, c.obligatorio, c.orden
  from public.perfil_captura p,
       (values ('sub_ubicacion',          false,  1),
               ('mueble',                 false,  2),
               ('repisa',                 false,  3),
               ('fila_cajon',             false,  4),
               ('color_almacenamiento',   true,   5),
               ('hoja_seguridad',         true,   6),
               ('nombre_articulo',        true,   7),
               ('cas',                    false,  8),
               ('marca',                  false,  9),
               ('presentacion',           false, 10),
               ('peso_frasco_vacio',      false, 11),
               ('peso_total',             false, 12),
               ('cantidad',               true,  13),
               ('unidad',                 true,  14),
               ('estado_fisico',          true,  15),
               ('caracteristica_quimica', false, 16),
               ('caracteristica_toxica',  false, 17),
               ('riesgo_salud',           false, 18),
               ('riesgo_reactividad',     false, 19),
               ('riesgo_inflamabilidad',  false, 20),
               ('peligro_especial',       false, 21),
               ('implica_peligro',        false, 22),
               ('observaciones',          false, 23)
       ) as c(campo, obligatorio, orden)
 where p.almacen_id is null and p.clasificacion = 'reactivo'
on conflict do nothing;

-- Insumos y Material: las dos hojas son identicas entre si.
insert into public.perfil_campo (perfil_id, campo, obligatorio, orden)
select p.id, c.campo, c.obligatorio, c.orden
  from public.perfil_captura p,
       (values ('clasificacion',   true,   1),
               ('nombre_articulo', true,   2),
               ('especificacion',  false,  3),
               ('marca',           false,  4),
               ('cantidad',        true,   5),
               ('unidad',          true,   6),
               ('presentacion',    false,  7),
               ('sub_ubicacion',   false,  8),
               ('mueble',          false,  9),
               ('repisa',          false, 10),
               ('fila_cajon',      false, 11),
               ('observaciones',   false, 12)
       ) as c(campo, obligatorio, orden)
 where p.almacen_id is null and p.clasificacion in ('insumo', 'material')
on conflict do nothing;

-- Equipos. Sin `cantidad`: la regla 9 pide un renglon por equipo fisico, asi
-- que siempre es 1. Pedirla invita a capturar 3 y perder la trazabilidad de a
-- cual se le dio mantenimiento o cual se descompuso.
insert into public.perfil_campo (perfil_id, campo, obligatorio, orden)
select p.id, c.campo, c.obligatorio, c.orden
  from public.perfil_captura p,
       (values ('nombre_articulo',   true,   1),
               ('marca',             false,  2),
               ('modelo',            false,  3),
               ('numero_serie',      false,  4),
               ('numero_inventario', false,  5),
               ('sub_ubicacion',     false,  6),
               ('laboratorio',       false,  7),
               ('mueble',            false,  8),
               ('funcionamiento',    true,   9),
               ('fecha_chequeo',     false, 10),
               ('mantenimiento',     false, 11),
               ('observaciones',     false, 12)
       ) as c(campo, obligatorio, orden)
 where p.almacen_id is null and p.clasificacion = 'equipo'
on conflict do nothing;

-- Materia biologica.
insert into public.perfil_campo (perfil_id, campo, obligatorio, orden)
select p.id, c.campo, c.obligatorio, c.orden
  from public.perfil_captura p,
       (values ('nombre_articulo',     true,   1),
               ('origen_especie',      false,  2),
               ('cantidad',            true,   3),
               ('unidad',              true,   4),
               ('presentacion',        false,  5),
               ('metodo_conservacion', false,  6),
               ('temperatura',         false,  7),
               ('fecha_recoleccion',   false,  8),
               ('fecha_preparacion',   false,  9),
               ('responsable_muestra', false, 10),
               ('sub_ubicacion',       false, 11),
               ('mueble',              false, 12),
               ('repisa',              false, 13),
               ('observaciones',       false, 14)
       ) as c(campo, obligatorio, orden)
 where p.almacen_id is null and p.clasificacion = 'materia_biologica'
on conflict do nothing;

-- Electronica: la unica hoja con familia y con las tres coordenadas.
insert into public.perfil_campo (perfil_id, campo, obligatorio, orden)
select p.id, c.campo, c.obligatorio, c.orden
  from public.perfil_captura p,
       (values ('clasificacion',   true,   1),
               ('familia',         true,   2),
               ('nombre_articulo', true,   3),
               ('especificacion',  false,  4),
               ('cantidad',        true,   5),
               ('unidad',          true,   6),
               ('presentacion',    false,  7),
               ('sub_ubicacion',   false,  8),
               ('mueble',          false,  9),
               ('coord_h',         false, 10),
               ('coord_v',         false, 11),
               ('coord_i',         false, 12),
               ('observaciones',   false, 13)
       ) as c(campo, obligatorio, orden)
 where p.almacen_id is null and p.clasificacion = 'componente'
on conflict do nothing;
