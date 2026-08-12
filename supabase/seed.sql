-- Seed de DESARROLLO LOCAL.
--
-- Se ejecuta con `supabase db reset` sobre la base local. NO debe correr nunca
-- contra produccion: crea usuarios con contrasenas conocidas para poder probar
-- las politicas de RLS.

-- ---------------------------------------------------------------------------
-- Los 4 almacenes
-- ---------------------------------------------------------------------------
insert into public.almacen (clave, nombre) values
  ('N3',  'Almacen Nivel 3'),
  ('N4',  'Almacen Nivel 4'),
  ('LUM', 'Almacen LUM'),
  ('LE',  'Almacen del Laboratorio de Electronica')
on conflict (clave) do nothing;

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
