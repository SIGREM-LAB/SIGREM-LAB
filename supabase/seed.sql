-- Datos semilla. Se corre despues de las migraciones en cada `supabase db reset`.
-- Cada tarea del plan de depuracion le agrega su seccion.


-- ---------------------------------------------------------------------------
-- Almacenes
-- ---------------------------------------------------------------------------
-- uso_principal, zona_riesgo y personas_expuestas son constantes por almacen:
-- venian identicas en cada renglon de cada archivo. El exportador NOM las
-- reinyecta por renglon al generar el Excel.
insert into public.almacen (clave, nombre, uso_principal, zona_riesgo, personas_expuestas) values
  ('N3',  'Almacén Nivel 3',                        'Prácticas de laboratorio en UCL', 'Laboratorio', 80),
  ('N4',  'Almacén Nivel 4',                        'Prácticas de laboratorio en UCL', 'Laboratorio', 80),
  ('LUM', 'Almacén LUM',                            'Prácticas de laboratorio en UCL', 'Laboratorio', 80),
  ('LE',  'Almacén del Laboratorio de Electrónica', 'Prácticas de laboratorio en UCL', 'Laboratorio', 40);


-- ---------------------------------------------------------------------------
-- Laboratorios
-- ---------------------------------------------------------------------------
-- Los cuatro primeros salen de la columna Laboratorio de la hoja Equipos del
-- formato unificado. Son los unicos nombres reales que tenemos.
insert into public.laboratorio (almacen_id, nombre)
select id, 'Análisis Sensorial' from public.almacen where clave = 'N4'
union all
select id, 'Laboratorio de enseñanza 5' from public.almacen where clave = 'N4'
union all
select id, 'Caracterización y procesamiento' from public.almacen where clave = 'LUM'
union all
select id, 'Laboratorio de Electrónica' from public.almacen where clave = 'LE';

-- PENDIENTE DE CONFIRMAR con el responsable de N3: los ejemplos del formato no
-- traen ningun laboratorio de N3, y una practica necesita laboratorio porque de
-- ahi sale su almacen. Sin al menos uno, N3 no puede registrar practicas.
-- Este nombre es un marcador para que el entorno local funcione, no un dato real.
insert into public.laboratorio (almacen_id, nombre)
select id, 'Laboratorio de docencia N3 (por confirmar)'
  from public.almacen where clave = 'N3';


-- ---------------------------------------------------------------------------
-- Usuarios de prueba
-- ---------------------------------------------------------------------------
-- Van aqui y no en la migracion de RLS aunque solo las pruebas de politicas los
-- usen por rol: movimiento.usuario_id y carga.cargado_por son not null con FK a
-- perfil, asi que sin al menos un perfil las pruebas de inventario no pueden
-- insertar un movimiento.
--
-- Todos con la contrasenia `sigrem2026`.
do $$
declare
  u   record;
  uid uuid;
  alm bigint;
begin
  for u in
    select * from (values
      ('admin@uaeh.local',   'Administrador UCL', 'admin'::public.rol_usuario,       null::text),
      -- La identidad del cargador. movimiento.usuario_id es not null y el
      -- trigger cae a auth.uid(), que por psycopg es NULL: sin un perfil propio
      -- el ETL no puede insertar un solo movimiento. Va aparte de admin@ para
      -- que los movimientos de carga_inicial se distingan de lo que capturo
      -- una persona. En remoto se da de alta desde el dashboard de Auth.
      ('carga@uaeh.local',   'Cargador de inventarios', 'admin'::public.rol_usuario, null),
      ('n3@uaeh.local',      'Responsable N3',    'responsable'::public.rol_usuario, 'N3'),
      ('n4@uaeh.local',      'Responsable N4',    'responsable'::public.rol_usuario, 'N4'),
      ('lum@uaeh.local',     'Responsable LUM',   'responsable'::public.rol_usuario, 'LUM'),
      ('le@uaeh.local',      'Responsable LE',    'responsable'::public.rol_usuario, 'LE'),
      ('lectura@uaeh.local', 'Solo consulta',     'consulta'::public.rol_usuario,    null)
    ) as t(correo, nombre, rol, clave)
  loop
    continue when exists (select 1 from auth.users where email = u.correo);

    uid := gen_random_uuid();

    -- Las columnas de token van en cadena vacia, NUNCA en null. GoTrue las lee
    -- en un `string` de Go, no en un puntero, y un null hace que /token
    -- conteste 500 con "converting NULL to string is unsupported". El usuario
    -- se crea bien y aun asi no puede entrar.
    insert into auth.users (
      instance_id, id, aud, role, email, encrypted_password,
      email_confirmed_at, created_at, updated_at,
      raw_app_meta_data, raw_user_meta_data,
      confirmation_token, recovery_token,
      email_change, email_change_token_new, email_change_token_current,
      phone_change, phone_change_token, reauthentication_token
    ) values (
      '00000000-0000-0000-0000-000000000000', uid, 'authenticated', 'authenticated',
      u.correo, extensions.crypt('sigrem2026', extensions.gen_salt('bf')),
      now(), now(), now(),
      '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb,
      '', '', '', '', '', '', '', ''
    );

    insert into auth.identities (
      id, user_id, identity_data, provider, provider_id,
      last_sign_in_at, created_at, updated_at
    ) values (
      gen_random_uuid(), uid,
      jsonb_build_object('sub', uid::text, 'email', u.correo),
      'email', uid::text, now(), now(), now()
    );

    alm := null;
    if u.clave is not null then
      select id into alm from public.almacen where clave = u.clave;
    end if;

    -- Upsert y no insert: el trigger usuario_nuevo_crea_perfil ya creo el
    -- perfil con rol 'consulta' al insertar en auth.users. Aqui se le pone el
    -- rol y el almacen que le tocan para las pruebas.
    insert into public.perfil (id, nombre, almacen_id, rol)
    values (uid, u.nombre, alm, u.rol)
    on conflict (id) do update
      set nombre = excluded.nombre,
          almacen_id = excluded.almacen_id,
          rol = excluded.rol;
  end loop;
end $$;


-- ---------------------------------------------------------------------------
-- Catalogos de practicas
-- ---------------------------------------------------------------------------
insert into public.programa_educativo (nombre) values
  ('Ingeniería en Alimentos'),
  ('Ingeniería en Biotecnología'),
  ('Ingeniería Industrial'),
  ('Ingeniería en Electrónica y Telecomunicaciones'),
  ('Ingeniería Mecánica'),
  ('Química en Alimentos'),
  ('Químico Farmacéutico Biólogo'),
  ('Ingeniería en Tecnologías del Software');

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


-- ---------------------------------------------------------------------------
-- Campos capturables
-- ---------------------------------------------------------------------------
-- Catalogo cerrado: un perfil no puede declarar un campo que no existe aqui.
-- Sale de las columnas reales de las 6 hojas del formato unificado.
insert into public.campo_capturable (campo, etiqueta_default, tipo_dato, destino, opciones, ayuda) values
  ('nombre_articulo',    'Artículo',                  'texto',     'articulo.nombre_canonico', null, 'Pasa por búsqueda difusa antes de crear uno nuevo'),
  ('especificacion',     'Especificación',            'texto',     'articulo.descripcion',     null, 'Con el artículo forma la identidad: 1000 mL clase A no es 250 mL'),
  ('clasificacion',      'Clasificación',             'seleccion', 'articulo.clasificacion',   array['reactivo','material','insumo','equipo','componente','materia_biologica'], null),
  ('unidad',             'Unidad de medida',          'texto',     'articulo.unidad_base',     null, 'La más pequeña que se consume; el empaque va en Presentación'),
  ('familia',            'Familia',                   'texto',     'articulo.familia',         null, 'Resistencia, Capacitor, CI Logica Digital...'),
  ('marca',              'Marca',                     'texto',     'existencia.marca',         null, null),
  ('modelo',             'Modelo',                    'texto',     'existencia.modelo',        null, null),
  ('presentacion',       'Presentación',              'texto',     'existencia.presentacion',  null, 'El empaque: caja de 100, bidón de 4 L'),
  ('cantidad',           'Cantidad en existencia',    'numero',    'movimiento.carga_inicial', null, 'Entra como movimiento, no se escribe directo'),
  ('cantidad_minima',    'Cantidad mínima',           'numero',    'existencia.cantidad_minima', null, 'Por debajo de esto el estado pasa a stock bajo'),
  ('peso_frasco_vacio',  'Peso del frasco vacío',     'numero',    'existencia.peso_frasco_vacio', null, 'Va ANTES del lleno: regla 13 del formato'),
  ('peso_total',         'Peso del frasco lleno',     'numero',    'existencia.peso_total',    null, 'La cantidad se deriva de lleno menos vacío'),
  ('numero_serie',       'Número de serie',           'texto',     'existencia.numero_serie',  null, 'No se repite entre renglones'),
  ('numero_inventario',  'Número de inventario UAEH', 'texto',     'existencia.numero_inventario_uaeh', null, 'No se repite entre renglones'),
  ('laboratorio',        'Laboratorio',               'seleccion', 'existencia.laboratorio_id', array['(desde laboratorio)'], 'Las opciones salen de la tabla laboratorio del almacén'),
  ('funcionamiento',     'Funcionamiento',            'seleccion', 'existencia.funcionamiento', array['Correcto','Presenta fallas'], null),
  ('mantenimiento',      'Mantenimiento realizado',   'texto',     'existencia.mantenimiento', null, null),
  ('fecha_chequeo',      'Fecha de último chequeo',   'fecha',     'existencia.fecha_chequeo', null, null),
  ('fecha_adquisicion',  'Fecha de adquisición',      'fecha',     'existencia.fecha_adquisicion', null, 'Dice la antigüedad cuando la caducidad está ilegible'),
  ('fecha_caducidad',    'Fecha de caducidad',        'fecha',     'existencia.fecha_caducidad', null, 'Informativa: un reactivo caducado no se bloquea'),
  ('origen_especie',     'Origen o especie',          'texto',     'articulo_biologico.origen_especie', null, 'Zea mays, Rattus norvegicus, Aloe vera'),
  ('metodo_conservacion','Método de conservación',    'texto',     'existencia.metodo_conservacion', null, 'Seco, Refrigeración, Formol al 10%'),
  ('temperatura',        'Temperatura',               'texto',     'existencia.temperatura',   null, 'Admite Ambiente, no solo números'),
  ('fecha_recoleccion',  'Fecha de recolección',      'fecha',     'existencia.fecha_recoleccion', null, null),
  ('fecha_preparacion',  'Fecha de preparación',      'fecha',     'existencia.fecha_preparacion', null, null),
  ('responsable_muestra','Responsable de la muestra', 'texto',     'existencia.responsable_muestra', null, null),
  ('observaciones',      'Observaciones',             'texto',     'existencia.observaciones', null, 'Aquí van las aclaraciones que no caben en una columna de números'),
  ('ubicacion_texto',    'Ubicación',                 'texto',     'ubicacion.etiqueta',       null, null),
  ('sub_ubicacion',      'Sub-ubicación',             'texto',     'ubicacion.componentes.sub_ubicacion', null, 'LUM-1, LUM-2, N3, N4, LE'),
  ('mueble',             'Mueble',                    'texto',     'ubicacion.componentes.mueble', null, 'Anaquel 2, Gabinete 301, Refrigerador, Separador 3'),
  ('repisa',             'Repisa',                    'texto',     'ubicacion.componentes.repisa',  null, null),
  ('fila_cajon',         'Fila o cajón',              'texto',     'ubicacion.componentes.fila_cajon', null, null),
  ('coord_h',            'Horizontal',                'texto',     'ubicacion.componentes.h',  null, 'Posición dentro del mueble, solo números'),
  ('coord_v',            'Vertical',                  'texto',     'ubicacion.componentes.v',  null, 'Posición dentro del mueble, solo números'),
  ('coord_i',            'Interior',                  'texto',     'ubicacion.componentes.i',  null, 'Posición dentro del mueble, solo números'),
  ('cas',                'Número CAS',                'texto',     'articulo_reactivo.cas',    null, 'Identificador universal de la sustancia'),
  ('color_almacenamiento','Color de almacenaje',      'seleccion', 'articulo_reactivo.color_almacenaje', array['verde','rojo','azul','blanco','amarillo','naranja'], 'Son seis: NO TÓXICO no es un color'),
  ('hoja_seguridad',     'Existencia de hoja de seguridad', 'booleano', 'articulo_reactivo.tiene_hoja_seguridad', null, 'Si la tienes, no si hace falta'),
  ('estado_fisico',      'Estado físico',             'seleccion', 'articulo_reactivo.estado_fisico', array['solido','liquido','gas'], 'Uno solo por reactivo'),
  ('caracteristica_quimica','Característica química', 'texto',     'articulo_reactivo.caracteristica_quimica', null, null),
  ('caracteristica_toxica','Característica tóxica',   'texto',     'articulo_reactivo.caracteristica_toxica',  null, null),
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
  (null, 'materia_biologica', 'Materia biológica', 'Hoja Materia biológica, 15 columnas'),
  (null, 'componente',        'Electrónica',       'Hoja Electrónica, 14 columnas');


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
 where p.almacen_id is null and p.clasificacion = 'reactivo';

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
 where p.almacen_id is null and p.clasificacion in ('insumo', 'material');

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
 where p.almacen_id is null and p.clasificacion = 'equipo';

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
 where p.almacen_id is null and p.clasificacion = 'materia_biologica';

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
 where p.almacen_id is null and p.clasificacion = 'componente';


-- ---------------------------------------------------------------------------
-- Plan academico de PRUEBA
-- ---------------------------------------------------------------------------
-- Datos desechables, solo para poder recorrer la pantalla a mano. El plan real
-- se captura desde /administracion/academico, desde cero: los catalogos que hay
-- en el repo no sirven de semilla, porque los 8 programas de aqui arriba y los
-- 11 del prototipo coinciden en uno solo de 88 combinaciones.
--
-- Esto vive en seed.sql y NO en datos-iniciales.sql a proposito: seed.sql solo
-- lo corre `supabase db reset` en local, asi que estas filas no pueden llegar a
-- produccion. Es la misma razon por la que los usuarios de prueba estan aqui.
--
-- Estan elegidos para ejercitar los tres casos raros, no para verse llenos:
--   Quimica General  -> compartida por los tres programas
--   Bioquimica       -> UNA fila, 3er semestre en uno y 6to en otro
--   Bromatologia     -> semestre NULL (optativa), tiene que ordenar al final
--   Bromatologia y Farmacognosia -> sin practicas, para ver el estado vacio
insert into public.asignatura (nombre) values
  ('Química General'),
  ('Bioquímica'),
  ('Análisis de Alimentos'),
  ('Bromatología'),
  ('Farmacognosia'),
  ('Microbiología');

insert into public.programa_asignatura (programa_educativo_id, asignatura_id, semestre)
select p.id, a.id, v.semestre
  from (values
    ('Química en Alimentos',            'Química General',       1),
    ('Química en Alimentos',            'Bioquímica',            3),
    ('Química en Alimentos',            'Análisis de Alimentos', 5),
    ('Química en Alimentos',            'Bromatología',       null),
    ('Químico Farmacéutico Biólogo',    'Química General',       1),
    ('Químico Farmacéutico Biólogo',    'Bioquímica',            6),
    ('Químico Farmacéutico Biólogo',    'Farmacognosia',         4),
    ('Ingeniería en Biotecnología',     'Química General',       1),
    ('Ingeniería en Biotecnología',     'Microbiología',         2)
  ) as v(programa, asignatura, semestre)
  join public.programa_educativo p on p.nombre = v.programa
  join public.asignatura         a on a.nombre = v.asignatura;

insert into public.practica_catalogo (asignatura_id, numero, nombre)
select a.id, v.numero, v.nombre
  from (values
    ('Química General',       1, 'Material de laboratorio y medición'),
    ('Química General',       2, 'Preparación de disoluciones'),
    ('Química General',       3, 'Titulación ácido-base'),
    ('Bioquímica',            1, 'Identificación de carbohidratos'),
    ('Bioquímica',            2, 'Actividad enzimática'),
    ('Análisis de Alimentos', 1, 'Determinación de humedad'),
    ('Microbiología',         1, 'Siembra en placa')
  ) as v(asignatura, numero, nombre)
  join public.asignatura a on a.nombre = v.asignatura;
