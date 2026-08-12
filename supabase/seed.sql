-- Seed de DESARROLLO LOCAL.
--
-- Se ejecuta con `supabase db reset` sobre la base local. NO debe correr nunca
-- contra produccion: crea usuarios con contrasenas conocidas para poder probar
-- las politicas de RLS.

-- ---------------------------------------------------------------------------
-- Los 4 almacenes
-- ---------------------------------------------------------------------------
insert into public.almacen (clave, nombre, uso_principal, zona_riesgo, personas_expuestas) values
  ('N3',  'Almacen Nivel 3',                        'Practicas de laboratorio en UCL-LUM', 'Laboratorio', 80),
  ('N4',  'Almacen Nivel 4',                        'Practicas de laboratorio en UCL-LUM', 'Laboratorio', 80),
  ('LUM', 'Almacen LUM',                            'Practicas de laboratorio en UCL-LUM', 'Laboratorio', 80),
  ('LE',  'Almacen del Laboratorio de Electronica',  null,                                  null,          null)
on conflict (clave) do nothing;

-- La columna Almacen de los Excel viene sucia y con subdivisiones.
-- 'N1-1' aparece en el archivo de N3 y NO es ninguno de los cuatro:
-- queda apuntado a N3 provisionalmente. PENDIENTE confirmarlo.
insert into public.almacen_alias (texto, almacen_id)
select t.texto, a.id
from public.almacen a
join (values
  ('N3','N3'), ('N3','n3'), ('N3','N1-1'),
  ('N4','N4'), ('N4','4'),  ('N4','n4'),
  ('LUM','LUM'), ('LUM','LUM-1'), ('LUM','LUM-2'),
  ('LE','LE'),  ('LE','LE-LUM-UCL')
) as t(clave, texto) on t.clave = a.clave
on conflict (texto) do nothing;

-- ---------------------------------------------------------------------------
-- Laboratorios derivados
-- ---------------------------------------------------------------------------
-- Aqui ocurren las practicas. Consumen del almacen del que dependen pero no
-- guardan existencias propias.
-- PENDIENTE: falta la lista completa por almacen (punto abierto A3 del spec).
insert into public.laboratorio (almacen_id, nombre)
select a.id, l.nombre
from public.almacen a
join (values
  ('N4', 'Analisis Sensorial')
) as l(clave, nombre) on l.clave = a.clave
on conflict (almacen_id, nombre) do nothing;


-- ---------------------------------------------------------------------------
-- Vocabulario de campos capturables
-- ---------------------------------------------------------------------------
insert into public.campo_capturable (campo, etiqueta_default, tipo_dato, destino, opciones, ayuda) values
  ('nombre_articulo',    'Articulo',                  'texto',     'articulo.nombre_canonico', null, 'Pasa por busqueda difusa antes de crear uno nuevo'),
  ('clasificacion',      'Clasificacion',             'seleccion', 'articulo.clasificacion',   array['reactivo','material','insumo','equipo','componente'], null),
  ('unidad',             'Unidad de medida',          'texto',     'articulo.unidad_base',     null, null),
  ('familia',            'Familia',                   'texto',     'articulo.familia',         null, 'Resistencia, Capacitor, CI Logica Digital...'),
  ('marca',              'Marca',                     'texto',     'existencia.marca',         null, null),
  ('modelo',             'Modelo',                    'texto',     'existencia.modelo',        null, null),
  ('presentacion',       'Presentacion',              'texto',     'existencia.presentacion',  null, null),
  ('cantidad',           'Cantidad en existencia',    'numero',    'movimiento.ajuste_conteo', null, 'Entra como movimiento de conteo, no se escribe directo'),
  ('cantidad_minima',    'Cantidad minima',           'numero',    'existencia.cantidad_minima', null, 'Por debajo de esto el estado pasa a stock bajo'),
  ('peso_total',         'Peso del frasco lleno',     'numero',    'existencia.peso_total',    null, 'La cantidad se deriva de lleno menos vacio'),
  ('peso_frasco_vacio',  'Peso del frasco vacio',     'numero',    'existencia.peso_frasco_vacio', null, null),
  ('numero_serie',       'Numero de serie',           'texto',     'existencia.numero_serie',  null, null),
  ('numero_inventario',  'Numero de inventario UAEH', 'texto',     'existencia.numero_inventario_uaeh', null, null),
  ('partida',            'Partida',                   'texto',     'existencia.partida',       null, null),
  ('mantenimiento',      'Mantenimiento',             'texto',     'existencia.mantenimiento', null, null),
  ('fecha_chequeo',      'Fecha de chequeo',          'fecha',     'existencia.fecha_chequeo', null, null),
  ('fecha_caducidad',    'Fecha de caducidad',        'fecha',     'existencia.fecha_caducidad', null, null),
  ('revisado_por',       'Revisado por',              'texto',     'existencia.revisado_por',  null, 'Turno matutino / vespertino'),
  ('observaciones',      'Observaciones',             'texto',     'existencia.observaciones', null, null),
  ('ubicacion_texto',    'Ubicacion',                 'texto',     'ubicacion.etiqueta',       null, null),
  ('anaquel',            'Anaquel',                   'texto',     'ubicacion.componentes.anaquel', null, null),
  ('repisa',             'Repisa',                    'texto',     'ubicacion.componentes.repisa',  null, null),
  ('fila',               'Fila',                      'texto',     'ubicacion.componentes.fila',    null, null),
  ('coord_h',            'Coordenada H',              'texto',     'ubicacion.componentes.h',  null, null),
  ('coord_v',            'Coordenada V',              'texto',     'ubicacion.componentes.v',  null, null),
  ('coord_i',            'Coordenada I',              'texto',     'ubicacion.componentes.i',  null, null),
  ('color_almacenamiento','Color de almacenaje NOM-114','seleccion','articulo_reactivo.color_almacenamiento', array['Rojo','Azul','Amarillo','Blanco','Verde'], null),
  ('hoja_seguridad',     'Tiene hoja de seguridad',   'booleano',  'articulo_reactivo.requiere_hoja_seguridad', null, null),
  ('estado_fisico',      'Estado fisico',             'seleccion', 'articulo_reactivo.estado_fisico', array['solido','liquido','gas'], null),
  ('caracteristica_quimica','Caracteristica quimica', 'texto',     'articulo_reactivo.caracteristica_quimica', null, null),
  ('caracteristica_toxica','Caracteristica toxica',   'texto',     'articulo_reactivo.caracteristica_toxica',  null, null),
  ('riesgo_salud',       'NFPA azul: riesgo a la salud',        'numero', 'articulo_reactivo.riesgo_salud',          null, 'Grado 0 a 4'),
  ('riesgo_reactividad', 'NFPA amarillo: reactividad',          'numero', 'articulo_reactivo.riesgo_reactividad',    null, 'Grado 0 a 4'),
  ('riesgo_inflamabilidad','NFPA rojo: inflamabilidad',         'numero', 'articulo_reactivo.riesgo_inflamabilidad', null, 'Grado 0 a 4'),
  ('peligro_especial',   'NFPA blanco: peligro especial',       'texto',  'articulo_reactivo.peligro_especial',      null, null),
  ('implica_peligro',    'Su uso implica actividad de peligro', 'booleano','articulo_reactivo.implica_actividad_peligro', null, null)
on conflict (campo) do nothing;


-- ---------------------------------------------------------------------------
-- Perfiles: un formulario por (almacen x tipo)
-- ---------------------------------------------------------------------------
insert into public.perfil_captura (almacen_id, clasificacion, nombre, notas)
select a.id, p.clas::public.clasificacion_articulo, p.nombre, p.notas
from public.almacen a
join (values
  ('N3', 'reactivo',   'Reactivos N3',            'Pesa frascos: la cantidad se deriva de lleno menos vacio'),
  ('N3', 'material',   'Materiales N3',           null),
  ('N3', 'insumo',     'Insumos N3',              null),
  ('N3', 'equipo',     'Equipos N3',              'N3 no lleva archivo aparte de equipos: mismo formulario que materiales'),
  ('N4', 'reactivo',   'Reactivos N4',            'Captura la cantidad directa, sin pesar el frasco'),
  ('N4', 'material',   'Materiales N4',           null),
  ('N4', 'insumo',     'Insumos N4',              null),
  ('N4', 'equipo',     'Equipos N4',              'Incluye los del laboratorio de Analisis Sensorial'),
  ('LUM','reactivo',   'Reactivos LUM',           'Pesa frascos, igual que N3'),
  ('LUM','material',   'Materiales LUM',          null),
  ('LUM','insumo',     'Insumos LUM',             null),
  ('LUM','equipo',     'Equipos LUM',             'Archivo propio: lleva mantenimiento y fecha de chequeo'),
  ('LE', 'equipo',     'Equipos Electronica',     'Serializados: numero de serie y numero de inventario institucional'),
  ('LE', 'componente', 'Componentes Electronica', 'Se navega por familia y coordenadas H/V/I de gaveta')
) as p(clave, clas, nombre, notas) on p.clave = a.clave
on conflict (almacen_id, clasificacion) do nothing;


-- Los campos de cada perfil, definidos por "layout" para no repetirlos.
with layout as (
  select * from (values
    -- Reactivos que pesan el frasco (N3, LUM)
    ('react_peso','anaquel',                false, 10), ('react_peso','repisa',              false, 11),
    ('react_peso','fila',                   false, 12), ('react_peso','color_almacenamiento', true, 13),
    ('react_peso','hoja_seguridad',         false, 14), ('react_peso','nombre_articulo',      true, 15),
    ('react_peso','marca',                  false, 16), ('react_peso','presentacion',        false, 17),
    ('react_peso','peso_total',             false, 18), ('react_peso','peso_frasco_vacio',   false, 19),
    ('react_peso','cantidad',                true, 20), ('react_peso','unidad',               true, 21),
    ('react_peso','estado_fisico',          false, 22), ('react_peso','caracteristica_quimica', false, 23),
    ('react_peso','caracteristica_toxica',  false, 24), ('react_peso','riesgo_salud',        false, 25),
    ('react_peso','riesgo_reactividad',     false, 26), ('react_peso','riesgo_inflamabilidad', false, 27),
    ('react_peso','peligro_especial',       false, 28), ('react_peso','implica_peligro',     false, 29),
    ('react_peso','observaciones',          false, 30),

    -- Reactivos con cantidad directa (N4)
    ('react_simple','anaquel',              false, 10), ('react_simple','repisa',            false, 11),
    ('react_simple','fila',                 false, 12), ('react_simple','color_almacenamiento', true, 13),
    ('react_simple','hoja_seguridad',       false, 14), ('react_simple','nombre_articulo',    true, 15),
    ('react_simple','marca',                false, 16), ('react_simple','presentacion',      false, 17),
    ('react_simple','cantidad',              true, 18), ('react_simple','unidad',             true, 19),
    ('react_simple','estado_fisico',        false, 20), ('react_simple','caracteristica_quimica', false, 21),
    ('react_simple','caracteristica_toxica',false, 22), ('react_simple','riesgo_salud',      false, 23),
    ('react_simple','riesgo_reactividad',   false, 24), ('react_simple','riesgo_inflamabilidad', false, 25),
    ('react_simple','peligro_especial',     false, 26), ('react_simple','implica_peligro',   false, 27),
    ('react_simple','observaciones',        false, 28),

    -- Materiales, insumos y equipos contados (N3, N4, LUM)
    ('material','clasificacion',   true, 10), ('material','nombre_articulo',  true, 11),
    ('material','cantidad',        true, 12), ('material','unidad',           true, 13),
    ('material','ubicacion_texto', true, 14), ('material','cantidad_minima', false, 15),
    ('material','observaciones',  false, 16),

    -- Equipos con bitacora de mantenimiento (LUM)
    ('equipo_mtto','nombre_articulo',  true, 10), ('equipo_mtto','marca',         false, 11),
    ('equipo_mtto','modelo',          false, 12), ('equipo_mtto','ubicacion_texto', true, 13),
    ('equipo_mtto','mantenimiento',   false, 14), ('equipo_mtto','fecha_chequeo', false, 15),
    ('equipo_mtto','observaciones',   false, 16),

    -- Equipos serializados (LE)
    ('equipo_serie','nombre_articulo',    true, 10), ('equipo_serie','marca',           false, 11),
    ('equipo_serie','modelo',            false, 12), ('equipo_serie','numero_serie',    false, 13),
    ('equipo_serie','numero_inventario', false, 14), ('equipo_serie','partida',         false, 15),
    ('equipo_serie','ubicacion_texto',    true, 16), ('equipo_serie','observaciones',   false, 17),

    -- Componentes electronicos (LE)
    ('componente','familia',         true, 10), ('componente','nombre_articulo',  true, 11),
    ('componente','cantidad',        true, 12), ('componente','ubicacion_texto',  true, 13),
    ('componente','coord_h',        false, 14), ('componente','coord_v',         false, 15),
    ('componente','coord_i',        false, 16), ('componente','observaciones',   false, 17)
  ) as t(layout, campo, obligatorio, orden)
),
asignacion as (
  select * from (values
    ('N3','reactivo','react_peso'),   ('LUM','reactivo','react_peso'),
    ('N4','reactivo','react_simple'),
    ('N3','material','material'),     ('N3','insumo','material'),  ('N3','equipo','material'),
    ('N4','material','material'),     ('N4','insumo','material'),  ('N4','equipo','material'),
    ('LUM','material','material'),    ('LUM','insumo','material'),
    ('LUM','equipo','equipo_mtto'),
    ('LE','equipo','equipo_serie'),   ('LE','componente','componente')
  ) as t(clave, clas, layout)
)
insert into public.perfil_campo (perfil_id, campo, obligatorio, orden)
select p.id, l.campo, l.obligatorio, l.orden
from asignacion asg
join public.almacen a on a.clave = asg.clave
join public.perfil_captura p
  on p.almacen_id = a.id and p.clasificacion = asg.clas::public.clasificacion_articulo
join layout l on l.layout = asg.layout
on conflict (perfil_id, campo) do nothing;

-- N3 es el unico almacen que registra el turno que hizo la revision.
insert into public.perfil_campo (perfil_id, campo, obligatorio, orden)
select p.id, 'revisado_por', false, 90
from public.perfil_captura p
join public.almacen a on a.id = p.almacen_id
where a.clave = 'N3' and p.clasificacion in ('material','insumo','equipo')
on conflict (perfil_id, campo) do nothing;


-- ---------------------------------------------------------------------------
-- Usuarios de prueba
-- ---------------------------------------------------------------------------
-- Va todo en un solo bloque DO a proposito: el CLI manda este archivo como un
-- unico batch y Postgres lo parsea completo antes de ejecutar nada, asi que
-- crear una funcion auxiliar aqui y llamarla mas abajo falla con "does not
-- exist". Un DO es una sola sentencia y no tiene ese problema.
--
-- Contrasena de todos: sigrem2026
do $$
declare
  u   record;
  uid uuid;
  alm bigint;
begin
  for u in
    select * from (values
      ('admin@uaeh.local',   'Administrador UCL', 'admin'::public.rol_usuario,       null::text),
      ('n3@uaeh.local',      'Responsable N3',    'responsable'::public.rol_usuario, 'N3'),
      ('n4@uaeh.local',      'Responsable N4',    'responsable'::public.rol_usuario, 'N4'),
      ('lum@uaeh.local',     'Responsable LUM',   'responsable'::public.rol_usuario, 'LUM'),
      ('le@uaeh.local',      'Responsable LE',    'responsable'::public.rol_usuario, 'LE'),
      ('lectura@uaeh.local', 'Solo consulta',     'consulta'::public.rol_usuario,    null)
    ) as t(correo, nombre, rol, clave)
  loop
    continue when exists (select 1 from auth.users where email = u.correo);

    uid := gen_random_uuid();

    insert into auth.users (
      instance_id, id, aud, role, email, encrypted_password,
      email_confirmed_at, created_at, updated_at,
      raw_app_meta_data, raw_user_meta_data
    ) values (
      '00000000-0000-0000-0000-000000000000', uid, 'authenticated', 'authenticated',
      u.correo, extensions.crypt('sigrem2026', extensions.gen_salt('bf')),
      now(), now(), now(),
      '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb
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

    insert into public.perfil (id, nombre, almacen_id, rol)
    values (uid, u.nombre, alm, u.rol);
  end loop;
end $$;
