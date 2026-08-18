-- Datos semilla. Se corre despues de las migraciones en cada `supabase db reset`.
-- Cada tarea del plan de depuracion le agrega su seccion.


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
  ('LE',  'Almacen del Laboratorio de Electronica', 'Practicas de laboratorio en UCL', 'Laboratorio', 40);


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
select id, 'Laboratorio de Electronica' from public.almacen where clave = 'LE';

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

    insert into public.perfil (id, nombre, almacen_id, rol)
    values (uid, u.nombre, alm, u.rol);
  end loop;
end $$;


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
  ('Ingenieria en Tecnologias del Software');

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
  ('otro',            'Otro',              9);
