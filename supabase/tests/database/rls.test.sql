-- Pruebas de RLS. Se corren con: supabase test db
--
-- La regla del proyecto es que cada politica lleve su prueba. La RLS es la
-- unica seguridad real del sistema: la app llevara la anon key dentro del
-- binario y cualquiera puede extraerla, asi que lo unico que separa los datos
-- de un atacante son estas politicas.
--
-- Ojo con como falla cada clausula, porque no es igual:
--   USING falso      -> la fila no es visible -> 0 filas afectadas, SIN error
--   WITH CHECK falso -> error 42501
-- Editar algo ajeno es lo primero (silencioso). Intentar escribir algo que no
-- te corresponde es lo segundo (explota).

begin;
create extension if not exists pgtap with schema extensions;

select plan(30);


-- ---------------------------------------------------------------------------
-- Utilidades
-- ---------------------------------------------------------------------------
create function pg_temp.como(correo text) returns void
language plpgsql as $$
declare uid uuid;
begin
  -- Volver a postgres antes de buscar: si venimos de un `como()` previo la
  -- sesion ya es `authenticated`, y ese rol tiene denegada la lectura de
  -- auth.users. La denegacion es correcta; el que tiene que adaptarse es el
  -- helper de pruebas.
  perform set_config('role', 'postgres', true);

  select id into uid from auth.users where email = correo;
  if uid is null then
    raise exception 'El seed no creo el usuario %', correo;
  end if;
  perform set_config('request.jwt.claims',
    json_build_object('sub', uid::text, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
end $$;

create function pg_temp.como_postgres() returns void
language plpgsql as $$
begin
  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims', null, true);
end $$;

create function pg_temp.id_almacen(clave text) returns bigint
language sql as $$ select id from public.almacen where almacen.clave = $1 $$;


-- ---------------------------------------------------------------------------
-- Datos de trabajo (como postgres, sin RLS)
-- ---------------------------------------------------------------------------
select pg_temp.como_postgres();

insert into public.articulo (id, nombre_canonico, clasificacion, unidad_base, verificado)
overriding system value
values (900001, 'Acido succinico, solido, grado reactivo', 'reactivo', 'g', true);

insert into public.existencia (id, articulo_id, almacen_id, codigo, marca, cantidad_minima)
overriding system value
values (900001, 900001, pg_temp.id_almacen('N3'), 'N3-TEST1', 'SIGMA', 50);

insert into public.existencia (id, articulo_id, almacen_id, codigo, marca)
overriding system value
values (900002, 900001, pg_temp.id_almacen('N4'), 'N4-TEST1', 'MEYER');


-- ---------------------------------------------------------------------------
-- 1. Cobertura
-- ---------------------------------------------------------------------------
select is(
  (select count(*)::int from pg_tables
    where schemaname = 'public' and not rowsecurity),
  0,
  'Ninguna tabla de public se queda sin RLS'
);


-- ---------------------------------------------------------------------------
-- 2-6. Existencias: leo todo, escribo lo mio
-- ---------------------------------------------------------------------------
select pg_temp.como('n3@uaeh.local');

select is(
  (select count(*)::int from public.existencia),
  2,
  'El responsable de N3 lee las existencias de todos los almacenes'
);

select lives_ok(
  $$ insert into public.existencia (articulo_id, almacen_id, codigo)
     values (900001, (select id from public.almacen where clave = 'N3'), 'N3-TEST2') $$,
  'El responsable de N3 puede dar de alta en N3'
);

select throws_ok(
  $$ insert into public.existencia (articulo_id, almacen_id, codigo)
     values (900001, (select id from public.almacen where clave = 'N4'), 'N4-TEST9') $$,
  '42501',
  null,
  'El responsable de N3 NO puede dar de alta en N4 (WITH CHECK)'
);

-- El UPDATE no truena: la fila de N4 simplemente no es visible para el USING
-- de la politica, asi que afecta cero filas. Por eso hay que comprobar el dato.
select lives_ok(
  $$ update public.existencia set marca = 'CAMBIADA' where id = 900002 $$,
  'Editar una existencia ajena no lanza error: afecta cero filas'
);

select is(
  (select marca from public.existencia where id = 900002),
  'MEYER',
  'La existencia de N4 quedo intacta pese al UPDATE del responsable de N3'
);


-- ---------------------------------------------------------------------------
-- 7-11. Movimientos y el trigger de saldo
-- ---------------------------------------------------------------------------
-- Se manda almacen_id de N4 a proposito sobre una existencia de N3: el trigger
-- debe reescribirlo antes de que corra el WITH CHECK.
select lives_ok(
  $$ insert into public.movimiento
       (existencia_id, tipo, cantidad, cantidad_antes, cantidad_despues, almacen_id, usuario_id)
     values (900001, 'ajuste_conteo', 120, 0, 0,
             (select id from public.almacen where clave = 'N4'),
             (select auth.uid())) $$,
  'El responsable registra un conteo en su almacen'
);

select is(
  (select cantidad from public.existencia where id = 900001),
  120::numeric(14,4),
  'El trigger aplica el movimiento al saldo'
);

select is(
  (select estado::text from public.existencia where id = 900001),
  'disponible',
  'El estado se recalcula: 120 sobre un minimo de 50 es disponible'
);

select is(
  (select cantidad_antes::int || '->' || cantidad_despues::int
     from public.movimiento where existencia_id = 900001),
  '0->120',
  'cantidad_antes y cantidad_despues las escribe el trigger, no el cliente'
);

-- La prueba que mas importa: cierra el hueco por el que un responsable podia
-- escribir movimientos contra el almacen de otro.
select is(
  (select a.clave from public.movimiento m
     join public.almacen a on a.id = m.almacen_id
    where m.existencia_id = 900001 limit 1),
  'N3',
  'El trigger impone almacen_id desde la existencia, ignorando el del cliente'
);


-- ---------------------------------------------------------------------------
-- 12-14. La bitacora es de solo insercion
-- ---------------------------------------------------------------------------
select throws_ok(
  $$ update public.movimiento set cantidad = 999 where existencia_id = 900001 $$,
  '42501',
  null,
  'Nadie puede editar un movimiento ya registrado'
);

select throws_ok(
  $$ delete from public.movimiento where existencia_id = 900001 $$,
  '42501',
  null,
  'Nadie puede borrar un movimiento ya registrado'
);

select throws_ok(
  $$ insert into public.movimiento
       (existencia_id, tipo, cantidad, cantidad_antes, cantidad_despues, almacen_id, usuario_id)
     values (900001, 'consumo', -500, 0, 0,
             (select id from public.almacen where clave = 'N3'),
             (select auth.uid())) $$,
  'P0001',
  null,
  'Un consumo mayor al saldo se rechaza en el trigger'
);


-- ---------------------------------------------------------------------------
-- 15-17. Catalogo y escalamiento de privilegios
-- ---------------------------------------------------------------------------
select lives_ok(
  $$ insert into public.articulo (nombre_canonico, clasificacion, unidad_base)
     values ('Articulo nuevo de prueba', 'material', 'pieza') $$,
  'Un responsable puede crear un articulo sin pedir permiso a nadie'
);

select is(
  (select verificado from public.articulo where nombre_canonico = 'Articulo nuevo de prueba'),
  false,
  'El articulo creado por un responsable nace sin verificar'
);

-- Aqui SI truena: el USING pasa (es su propia fila) pero el WITH CHECK exige
-- que el rol siga siendo el mismo.
select throws_ok(
  $$ update public.perfil set rol = 'admin' where id = (select auth.uid()) $$,
  '42501',
  null,
  'Un responsable NO puede ascenderse a admin'
);


-- ---------------------------------------------------------------------------
-- 18. Solo consulta
-- ---------------------------------------------------------------------------
select pg_temp.como('lectura@uaeh.local');

select throws_ok(
  $$ insert into public.articulo (nombre_canonico, clasificacion, unidad_base)
     values ('No deberia entrar', 'material', 'pieza') $$,
  '42501',
  null,
  'El rol consulta no puede crear articulos'
);


-- ---------------------------------------------------------------------------
-- 19. El admin escribe en cualquier almacen
-- ---------------------------------------------------------------------------
select pg_temp.como('admin@uaeh.local');

select lives_ok(
  $$ update public.existencia set marca = 'CORREGIDA' where id = 900002 $$,
  'El admin puede editar existencias de cualquier almacen'
);


-- ---------------------------------------------------------------------------
-- 20-22. Perfiles de captura
-- ---------------------------------------------------------------------------
-- El formulario sale de datos, no de condicionales en React. Estas pruebas
-- fijan esa promesa: si alguien borra un campo del perfil de N3, truena aqui.
select is(
  (select count(*)::int from public.formulario(
     (select id from public.almacen where clave = 'N3'), 'reactivo')
    where campo in ('peso_total', 'peso_frasco_vacio')),
  2,
  'El formulario de reactivos de N3 pide los dos pesos del frasco'
);

-- Con el formato unificado los cuatro almacenes capturan igual, asi que N4 pide
-- exactamente lo mismo que N3: los dos salen del mismo perfil default.
select is(
  (select count(*)::int from public.formulario(
     (select id from public.almacen where clave = 'N4'), 'reactivo')
    where campo in ('peso_total', 'peso_frasco_vacio')),
  2,
  'N4 cae al mismo perfil default: el formato ya no distingue por almacen'
);

select pg_temp.como('n3@uaeh.local');

-- Cambiar un perfil altera el alta de todo un almacen: no es cosa de un
-- responsable, por muy suyo que sea el almacen.
--
-- DELETE solo tiene USING, no WITH CHECK. Con el USING en falso la fila es
-- invisible y el borrado afecta cero filas SIN lanzar error, asi que no basta
-- con esperar una excepcion: hay que comprobar que el campo sigue ahi.
select lives_ok(
  $$ delete from public.perfil_campo
      where campo = 'peso_total'
        and perfil_id = (select id from public.perfil_captura
                          where almacen_id is null and clasificacion = 'reactivo') $$,
  'El borrado de un campo de perfil no lanza error: afecta cero filas'
);

select is(
  (select count(*)::int from public.formulario(
     (select id from public.almacen where clave = 'N3'), 'reactivo')
    where campo = 'peso_total'),
  1,
  'El campo sigue en el perfil: un responsable no cambia la forma del formulario'
);



-- ---------------------------------------------------------------------------
-- 24-30. Practicas, cargas y catalogos nuevos
-- ---------------------------------------------------------------------------
select pg_temp.como_postgres();

insert into public.existencia (id, articulo_id, almacen_id)
overriding system value
values (900401, 900001, pg_temp.id_almacen('N4'));

insert into public.movimiento (existencia_id, tipo, cantidad, cantidad_antes,
                               cantidad_despues, almacen_id, usuario_id)
values (900401, 'carga_inicial', 100, 0, 0, pg_temp.id_almacen('N4'),
        (select id from public.perfil where nombre = 'Responsable N4'));

select pg_temp.como('n3@uaeh.local');

select throws_ok(
  $$ insert into public.practica (programa_educativo_id, laboratorio_id)
     values ((select id from public.programa_educativo limit 1),
             (select id from public.laboratorio
               where almacen_id = pg_temp.id_almacen('N4') limit 1)) $$,
  '42501',
  null,
  'El responsable de N3 no puede registrar una practica en un laboratorio de N4'
);

select lives_ok(
  $$ insert into public.practica (programa_educativo_id, laboratorio_id)
     values ((select id from public.programa_educativo limit 1),
             (select id from public.laboratorio
               where almacen_id = pg_temp.id_almacen('N3') limit 1)) $$,
  'El responsable de N3 si puede registrar una practica en su almacen'
);

-- La prueba que mas importa del modulo: se manda un elemento sobre una
-- existencia de N4 desde una practica de N3. El trigger reescribe el
-- almacen_id desde la existencia y el WITH CHECK lo rechaza.
select throws_ok(
  $$ insert into public.practica_elemento
       (practica_id, existencia_id, metodo_control, cantidad_entregada)
     values ((select id from public.practica
               where almacen_id = pg_temp.id_almacen('N3')
               order by id desc limit 1),
             900401, 'cantidad', 5) $$,
  '42501',
  null,
  'No se puede consumir una existencia de N4 desde una practica de N3'
);

select pg_temp.como('lectura@uaeh.local');

select is(
  (select count(*)::int from public.practica),
  1,
  'El usuario de consulta lee la practica que registro el responsable de N3'
);

select throws_ok(
  $$ insert into public.practica (programa_educativo_id, laboratorio_id)
     values ((select id from public.programa_educativo limit 1),
             (select id from public.laboratorio limit 1)) $$,
  '42501',
  null,
  'El usuario de consulta no puede registrar practicas'
);

select throws_ok(
  $$ insert into public.carga (almacen_id, archivo, hoja)
     values (pg_temp.id_almacen('N3'), 'x.xlsx', 'Reactivos') $$,
  '42501',
  null,
  'El usuario de consulta no puede registrar cargas'
);

select throws_ok(
  $$ insert into public.motivo_observacion (clave, etiqueta, orden)
     values ('inventado', 'Inventado', 99) $$,
  '42501',
  null,
  'Solo el admin cambia los catalogos cerrados'
);

select * from finish();
rollback;
