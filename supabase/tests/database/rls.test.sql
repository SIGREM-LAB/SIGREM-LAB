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

select plan(73);


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
values (900001, 'Acido succinico, solido, grado reactivo', 'reactivo', 'g', true),
       (900002, 'Acetona, liquido, grado A.C.S.',          'reactivo', 'mL', true);

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

-- Se cuentan LOS FIXTURES, no la tabla entera. Contar todo solo funciona con la
-- base recien reseteada: en cuanto el ETL carga renglones reales -o en cuanto
-- alguien captura uno- el numero cambia y la prueba miente sobre lo que probaba.
-- Lo que importa aqui es que las DOS filas se vean: la de N3 y la de N4.
select is(
  (select count(*)::int from public.existencia where id in (900001, 900002)),
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

-- ---------------------------------------------------------------------------
-- 31-40. Escritura: quien puede, y sobre que columnas
-- ---------------------------------------------------------------------------
-- Estas diez cierran los dos huecos que encontro la revision de roles del 21 de
-- agosto. La prueba 18 no los detecto porque solo ejercita `articulo`.

-- El escenario del hueco A: un usuario de rol `consulta` AL QUE SE LE ASIGNO un
-- almacen. Es un estado alcanzable -nada lo prohibe- y hasta ahora le daba
-- permiso de escritura, porque las politicas solo comparaban el almacen.
select pg_temp.como_postgres();
update public.perfil set almacen_id = pg_temp.id_almacen('N3')
 where id = (select id from auth.users where email = 'lectura@uaeh.local');

select pg_temp.como('lectura@uaeh.local');

select throws_ok(
  $$ insert into public.existencia (articulo_id, almacen_id, cantidad)
     values (900001, (select id from public.almacen where clave = 'N3'), 5) $$,
  '42501', null,
  'Un consulta con almacen asignado no puede crear existencias'
);

select throws_ok(
  $$ insert into public.movimiento (existencia_id, tipo, cantidad,
                                    almacen_id, cantidad_antes, cantidad_despues)
     values (900001, 'entrada', 5, 0, 0, 0) $$,
  '42501', null,
  'Un consulta con almacen asignado no puede registrar movimientos'
);

select throws_ok(
  $$ insert into public.ubicacion (almacen_id, etiqueta)
     values ((select id from public.almacen where clave = 'N3'), 'N3 . Colada') $$,
  '42501', null,
  'Un consulta con almacen asignado no puede crear ubicaciones'
);

-- Devolver el perfil a como estaba: las pruebas no se heredan estado entre si.
select pg_temp.como_postgres();
update public.perfil set almacen_id = null
 where id = (select id from auth.users where email = 'lectura@uaeh.local');

-- El hueco B: el saldo, el codigo del QR y el ancla de permisos no se escriben
-- desde el cliente. La bitacora es el unico camino.
select pg_temp.como('n3@uaeh.local');

select throws_ok(
  $$ update public.existencia set cantidad = 99999 where id = 900001 $$,
  '42501', null,
  'Un responsable no puede escribir el saldo directo'
);

select throws_ok(
  $$ update public.existencia set codigo = 'N3-FALSO' where id = 900001 $$,
  '42501', null,
  'Un responsable no puede reescribir el codigo de la etiqueta'
);

select throws_ok(
  $$ update public.existencia set almacen_id = 2 where id = 900001 $$,
  '42501', null,
  'Un responsable no puede mudar una existencia a otro almacen'
);

-- Lo que si le toca sigue funcionando: si esto se rompe, el arreglo se paso de
-- estricto y la pantalla de alta nace muerta.
select lives_ok(
  $$ update public.existencia
        set observaciones = 'Frasco rayado', marca = 'MEYER'
      where id = 900001 $$,
  'Un responsable si edita las columnas descriptivas de lo suyo'
);

-- El trigger nuevo: fijar un minimo por encima del saldo cambia el estado sin
-- que medie un movimiento. Antes solo se recalculaba al insertar.
select pg_temp.como_postgres();
insert into public.movimiento (existencia_id, tipo, cantidad,
                               almacen_id, cantidad_antes, cantidad_despues, usuario_id)
values (900001, 'carga_inicial', 100, 0, 0, 0,
        (select id from auth.users where email = 'admin@uaeh.local'));

select pg_temp.como('n3@uaeh.local');
update public.existencia set cantidad_minima = 500 where id = 900001;

select is(
  (select estado from public.existencia where id = 900001),
  'stock_bajo'::public.estado_existencia,
  'Subir el minimo por encima del saldo deja la existencia en stock_bajo'
);

-- Y el camino legitimo no se rompio: el trigger de movimiento es security
-- definer, asi que los privilegios de columna de authenticated no lo alcanzan.
select lives_ok(
  $$ insert into public.movimiento (existencia_id, tipo, cantidad,
                                    almacen_id, cantidad_antes, cantidad_despues)
     values (900001, 'consumo', -10, 0, 0, 0) $$,
  'Un responsable sigue moviendo el saldo por la bitacora'
);

-- Se afirma el INVARIANTE, no un numero. Escribir el saldo esperado a mano
-- ataria esta prueba a la aritmetica de las de arriba -la 7 ya dejo 120 ahi- y
-- se rompe en cuanto alguien inserta un movimiento mas.
--
-- Lo que de verdad importa: el saldo de la existencia SIEMPRE coincide con lo
-- que dice el ultimo renglon de la bitacora. Si el trigger no hubiera corrido,
-- por los privilegios de columna, los dos numeros se separarian.
select is(
  (select cantidad from public.existencia where id = 900001),
  (select cantidad_despues from public.movimiento
    where existencia_id = 900001 order by id desc limit 1),
  'El saldo coincide con el ultimo movimiento: el trigger corrio pese al revoke'
);

-- ---------------------------------------------------------------------------
-- 41. La vista del listado, frente a la llave publica
-- ---------------------------------------------------------------------------
-- El otro candado: aunque la vista herede la RLS por `security_invoker`, anon
-- no tiene por que alcanzarla. Dos candados en la puerta, como ya hace
-- `movimiento` con su revoke de update y delete.
select pg_temp.como_postgres();
select set_config('role', 'anon', true);

select throws_ok(
  $$ select count(*) from public.existencia_listado $$,
  '42501', null,
  'anon no puede leer la vista del listado'
);

select throws_ok(
  $$ select count(*) from public.almacen_resumen $$,
  '42501', null,
  'anon tampoco puede leer el resumen del menu'
);

select pg_temp.como_postgres();


-- ---------------------------------------------------------------------------
-- 43-50. Renglones pendientes de revision
-- ---------------------------------------------------------------------------
-- La tabla que aparta lo que el cargador no puede resolver solo. Se rige por
-- las mismas reglas que `existencia`: leo todo, escribo lo mio. Lo propio de
-- aqui es que `revisado_por` la pone la base, no el cliente: es la firma de
-- quien dio el visto bueno.
insert into public.carga_pendiente
  (id, almacen_id, archivo, hoja, fila, motivo, renglon, problemas)
overriding system value
values
  (900001, pg_temp.id_almacen('N3'), 'N3.xlsx', 'Insumos', 13, 'regla',
   '{"articulo": "Guantes de latex", "unidad": "paquete"}'::jsonb,
   '[{"regla": "Regla 2", "columna": "G", "valor": "paquete",
      "detalle": "es un empaque, no una unidad de consumo"}]'::jsonb),
  (900002, pg_temp.id_almacen('N4'), 'N4.xlsx', 'Insumos', 20, 'regla',
   '{"articulo": "Pipeta Pasteur", "unidad": "caja"}'::jsonb,
   '[{"regla": "Regla 2", "columna": "G", "valor": "caja",
      "detalle": "es un empaque, no una unidad de consumo"}]'::jsonb);

select pg_temp.como('n3@uaeh.local');

select is(
  (select count(*)::int from public.carga_pendiente where id in (900001, 900002)),
  2,
  'El responsable de N3 lee los pendientes de todos los almacenes'
);

select lives_ok(
  $$ insert into public.carga_pendiente
       (almacen_id, archivo, hoja, fila, motivo, renglon, problemas)
     values ((select id from public.almacen where clave = 'N3'),
             'N3.xlsx', 'Material', 99, 'regla', '{"articulo": "Vaso"}'::jsonb,
             '[{"regla": "Regla 1", "detalle": "texto en columna de numeros"}]'::jsonb) $$,
  'El responsable de N3 puede apartar un renglon de N3'
);

select throws_ok(
  $$ insert into public.carga_pendiente
       (almacen_id, archivo, hoja, fila, motivo, renglon, problemas)
     values ((select id from public.almacen where clave = 'N4'),
             'N4.xlsx', 'Material', 99, 'regla', '{"articulo": "Vaso"}'::jsonb,
             '[{"regla": "Regla 1", "detalle": "texto en columna de numeros"}]'::jsonb) $$,
  '42501', null,
  'El responsable de N3 NO puede apartar un renglon de N4 (WITH CHECK)'
);

-- `descartado` y no `resuelto`: desde la migracion del 26 de agosto, `resuelto`
-- exige la existencia que salio del renglon y solo `resolver_pendiente()` puede
-- ponerla. `descartado` sigue siendo un UPDATE normal —es el renglon que se
-- miro y NO debe cargarse— y ejercita el mismo grant y el mismo trigger de
-- firma. La prueba 53 cubre que la otra puerta quedo cerrada.
select lives_ok(
  $$ update public.carga_pendiente
        set estado = 'descartado', nota = 'Renglon repetido en el archivo'
      where id = 900001 $$,
  'El responsable de N3 puede cerrar un pendiente suyo'
);

-- El cliente no mando `revisado_por`: lo puso el trigger. Es lo que impide
-- firmar en nombre de otro.
-- Se compara contra `auth.uid()` de esta misma sesion y no contra auth.users:
-- el rol `authenticated` tiene denegada la lectura de esa tabla, como ya
-- advierte el helper `como()` de arriba. Ademas dice mejor lo que importa: la
-- firma es la del usuario que hizo el UPDATE.
select is(
  (select revisado_por from public.carga_pendiente where id = 900001),
  (select auth.uid()),
  'La base firma la revision con quien la hizo, no con lo que mande el cliente'
);

-- Ajeno: el USING de la politica no lo ve, asi que afecta cero filas y no
-- truena. Por eso se comprueba el dato, no la ausencia de error.
select lives_ok(
  $$ update public.carga_pendiente set estado = 'descartado' where id = 900002 $$,
  'Revisar un pendiente ajeno no lanza error: afecta cero filas'
);

select is(
  (select estado from public.carga_pendiente where id = 900002),
  'pendiente'::public.estado_pendiente,
  'El pendiente de N4 sigue sin revisar pese al UPDATE del responsable de N3'
);

-- `fila` es el hallazgo del cargador, no un campo de la pantalla. El revoke por
-- columna es lo que lo protege, y sin el revoke a nivel tabla que va antes no
-- serviria de nada.
select throws_ok(
  $$ update public.carga_pendiente set fila = 1 where id = 900001 $$,
  '42501', null,
  'Ni el responsable puede reescribir la fila de Excel de un pendiente'
);


-- ---------------------------------------------------------------------------
-- 51-52. La ficha NOM de un reactivo
-- ---------------------------------------------------------------------------
-- `articulo_reactivo` se quedo hasta ahora con lectura y admin, mientras su
-- gemela `articulo_biologico` si tenia alta. No se notaba porque el unico que
-- llenaba esa ficha era el cargador, que corre con la llave de servicio. Se
-- nota en cuanto una persona crea un reactivo desde la pantalla de depuracion:
-- sin esta politica el frasco entraria sin rombo, sin CAS y sin color.
select lives_ok(
  $$ insert into public.articulo_reactivo (articulo_id, cas, riesgo_salud)
     values (900001, '110-15-6', 2) $$,
  'El responsable puede capturar la ficha NOM del reactivo que acaba de crear'
);

select pg_temp.como('lectura@uaeh.local');

select throws_ok(
  $$ insert into public.articulo_reactivo (articulo_id, cas)
     values (900002, '67-64-1') $$,
  '42501', null,
  'Un usuario de consulta NO puede capturar una ficha NOM (WITH CHECK)'
);


-- ---------------------------------------------------------------------------
-- 53-62. Resolver un pendiente lo mete al inventario
-- ---------------------------------------------------------------------------
-- El agujero que cierra `resolver_pendiente`: hasta ahora dar el visto bueno
-- dejaba el renglon revisado y el inventario igual que antes. Lo que se prueba
-- aqui son sus tres promesas —la cantidad entra por movimiento, corre con los
-- privilegios de quien llama, y resolver dos veces no duplica— mas el candado
-- que impide llegar a `resuelto` por fuera.
select pg_temp.como_postgres();

insert into public.carga_pendiente
  (id, almacen_id, archivo, hoja, fila, motivo, renglon, problemas, existencia_id)
overriding system value
values
  -- Unidad de empaque: el caso de 88 de los 337 renglones de N3.
  (900003, pg_temp.id_almacen('N3'), 'N3.xlsx', 'Insumos', 21, 'regla',
   '{"articulo": "Papel filtro Whatman No. 3", "especificacion": "125 mm",
     "unidad": "caja", "cantidad": 2, "marca": "Sin marca",
     "sub_ubicacion": "N3", "mueble": "Gabinete 309", "repisa": "—"}'::jsonb,
   '[{"regla": "Regla 2", "columna": "G", "valor": "caja",
      "detalle": "es un empaque, no una unidad de consumo"}]'::jsonb,
   null),
  -- Choque por llave natural: el caso de los otros 224.
  (900004, pg_temp.id_almacen('N3'), 'N3.xlsx', 'Reactivos', 33, 'posible_duplicado',
   '{"sustancia": "Acido succinico, solido, grado reactivo", "unidad": "g",
     "cantidad": 50, "marca": "SIGMA"}'::jsonb,
   '[{"regla": "Llave natural", "columna": "", "valor": 50,
      "detalle": "otro renglon del mismo archivo ocupa la misma llave"}]'::jsonb,
   900001),
  (900005, pg_temp.id_almacen('N4'), 'N4.xlsx', 'Insumos', 44, 'regla',
   '{"articulo": "Vaso de precipitados", "unidad": "pieza", "cantidad": 3}'::jsonb,
   '[{"regla": "Regla 1", "detalle": "texto en columna de numeros"}]'::jsonb,
   null);

select pg_temp.como('n3@uaeh.local');

select throws_ok(
  $$ update public.carga_pendiente set estado = 'resuelto' where id = 900003 $$,
  '23514', null,
  'Marcar resuelto a mano ya no cuela: resuelto significa que entro a existencia'
);

-- El renglon llega YA corregido, que es lo que manda la pantalla: la unidad deja
-- de ser un empaque y la cantidad viene en piezas.
create temporary table resuelta as
select public.resolver_pendiente(
  900003,
  '{"articulo": "Papel filtro Whatman No. 3", "especificacion": "125 mm",
    "unidad": "pieza", "cantidad": 100, "marca": "Sin marca",
    "sub_ubicacion": "N3", "mueble": "Gabinete 309", "repisa": "—"}'::jsonb,
  'nueva', 'Cada caja trae 100 hojas') as id;

select isnt(
  (select id from resuelta), null,
  'Resolver un pendiente devuelve la existencia que creo'
);

select is(
  (select e.cantidad from public.existencia e where e.id = (select id from resuelta)),
  100::numeric(14,4),
  'La existencia nueva quedo con la cantidad del renglon corregido'
);

-- La comprobacion que de verdad importa: el saldo NO se escribio a mano. Si
-- alguien cambiara la funcion para hacer `insert into existencia (cantidad)`,
-- la prueba de arriba seguiria pasando y esta no.
select is(
  (select m.tipo::text from public.movimiento m
    where m.existencia_id = (select id from resuelta)),
  'carga_inicial',
  'La cantidad entro por movimiento, no escribiendo existencia.cantidad'
);

select is(
  (select existencia_resuelta_id from public.carga_pendiente where id = 900003),
  (select id from resuelta),
  'El pendiente queda apuntando a la existencia en que se convirtio'
);

select is(
  (select revisado_por from public.carga_pendiente where id = 900003),
  (select auth.uid()),
  'La base firma tambien la revision que pasa por resolver_pendiente'
);

-- Idempotencia. Un doble clic, un reintento de la red o dos pestañas abiertas
-- sobre el mismo renglon no pueden acabar en dos frascos donde hay uno.
select is(
  public.resolver_pendiente(900003),
  (select id from resuelta),
  'Resolver un pendiente ya resuelto devuelve la misma existencia'
);

select is(
  (select count(*)::int from public.existencia e
     join public.articulo a on a.id = e.articulo_id
    where a.nombre_canonico = 'Papel filtro Whatman No. 3'),
  1,
  'Resolver dos veces no crea una segunda existencia'
);

-- El otro veredicto: no es un frasco mas, es el mismo renglon de inventario.
-- Se le suma al que ya esta, y tambien por movimiento.
select public.resolver_pendiente(900004, null, 'duplicado', 'Es el mismo frasco');

-- Por el motivo y no solo por el tipo: la existencia 900001 ya trae una carga
-- inicial de las pruebas de arriba, y lo que se mide aqui es el efecto de ESTE
-- movimiento sobre el saldo, no el saldo acumulado.
select is(
  (select cantidad_despues - cantidad_antes from public.movimiento
    where existencia_id = 900001 and tipo = 'carga_inicial'
      and motivo like 'Depuracion de%'),
  50::numeric(14,4),
  'El veredicto duplicado suma su cantidad a la existencia con la que choco'
);

-- SECURITY INVOKER: la funcion no le presta a nadie privilegios que no tenga.
-- Conocer el id de un pendiente de N4 no alcanza para resolverlo.
select throws_ok(
  $$ select public.resolver_pendiente(900005) $$,
  '42501', null,
  'El responsable de N3 no puede resolver un pendiente de N4 aunque sepa su id'
);

select pg_temp.como_postgres();


-- ---------------------------------------------------------------------------
-- 63-73. El plan academico: quien lo lee y quien lo escribe
-- ---------------------------------------------------------------------------
select pg_temp.como_postgres();

insert into public.programa_educativo (id, nombre) overriding system value
values (900801, 'Programa academico de prueba');

insert into public.asignatura (id, nombre) overriding system value
values (900811, 'Asignatura de prueba RLS');

insert into public.programa_asignatura (programa_educativo_id, asignatura_id, semestre)
values (900801, 900811, 4);

insert into public.practica_catalogo (id, asignatura_id, numero, nombre)
overriding system value
values (900821, 900811, 1, 'Practica de prueba RLS');

select pg_temp.como('n3@uaeh.local');

-- La lectura abierta no es un descuido: es lo que permitira que el formulario
-- de registro de practicas arme sus tres selects. Si estas dos dan 0, la
-- pantalla de practicas sale vacia y nadie sabe por que.
select is(
  (select count(*)::int from public.programa_asignatura where asignatura_id = 900811),
  1,
  'El responsable de N3 lee el plan academico'
);

select is(
  (select count(*)::int from public.practica_catalogo where id = 900821),
  1,
  'El responsable de N3 lee el catalogo de practicas'
);

select throws_ok(
  $$ insert into public.programa_asignatura (programa_educativo_id, asignatura_id, semestre)
     values (900801, 900811, 5) $$,
  '42501', null,
  'El responsable no vincula asignaturas: el plan es de los cuatro almacenes'
);

select throws_ok(
  $$ insert into public.practica_catalogo (asignatura_id, numero, nombre)
     values (900811, 2, 'Practica colada') $$,
  '42501', null,
  'El responsable no da de alta practicas del plan'
);

-- Ojo con como falla cada clausula: USING falso no explota, deja 0 filas. Por
-- eso estas dos se miden contando y no con throws_ok.
update public.practica_catalogo set nombre = 'Renombrada a la mala' where id = 900821;
select is(
  (select nombre from public.practica_catalogo where id = 900821),
  'Practica de prueba RLS',
  'El responsable no edita el catalogo, y falla en silencio'
);

delete from public.programa_asignatura where asignatura_id = 900811;
select is(
  (select count(*)::int from public.programa_asignatura where asignatura_id = 900811),
  1,
  'El responsable no desvincula asignaturas, y tambien falla en silencio'
);

-- security invoker: la funcion no presta privilegios. Misma prueba que la de
-- resolver_pendiente.
select throws_ok(
  $$ select public.vincular_asignatura(900801, 'Colada por la funcion', 1::smallint) $$,
  '42501', null,
  'vincular_asignatura no le presta al responsable privilegios que no tiene'
);

select pg_temp.como('admin@uaeh.local');

select lives_ok(
  $$ select public.vincular_asignatura(900801, 'Asignatura creada por el admin', 7::smallint) $$,
  'El admin si vincula asignaturas, y la funcion crea la que falta'
);

-- Comprobando el valor y no con lives_ok: un update contra un USING falso deja
-- 0 filas SIN lanzar excepcion, asi que lives_ok pasaria aunque la politica del
-- admin no existiera. Esta version se cae si la escritura no aterriza.
update public.practica_catalogo set nombre = 'Renombrada por el admin' where id = 900821;
select is(
  (select nombre from public.practica_catalogo where id = 900821),
  'Renombrada por el admin',
  'El admin edita el catalogo de practicas'
);

-- anon lleva la llave dentro del binario y cualquiera puede extraerla. El plan
-- academico no es secreto, pero la regla del proyecto es que anon no llega a
-- ninguna tabla.
select set_config('role', 'anon', true);

select throws_ok(
  $$ select count(*) from public.programa_asignatura $$,
  '42501', null,
  'anon no lee el plan academico'
);

select throws_ok(
  $$ select count(*) from public.practica_catalogo $$,
  '42501', null,
  'anon no lee el catalogo de practicas'
);

select pg_temp.como_postgres();


select * from finish();
rollback;
