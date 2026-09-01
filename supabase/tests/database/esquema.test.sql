-- Pruebas de estructura: enums, restricciones, triggers y columnas generadas.
-- Se corren con: supabase test db
--
-- Complementa rls.test.sql, que prueba las politicas. Aqui se prueba que el
-- esquema no deje pasar datos imposibles; alla, que no deje pasar a quien no debe.

begin;
create extension if not exists pgtap with schema extensions;

select plan(60);

-- Las pruebas corren como postgres, que se salta la RLS. Es lo correcto aqui:
-- este archivo prueba la forma del esquema, no quien puede ver que. Eso es
-- asunto de rls.test.sql.
create function pg_temp.como_postgres() returns void
language plpgsql as $$
begin
  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims', null, true);
end $$;

-- Los valores de un enum son un contrato con el ETL y con el frontend. Si
-- alguien agrega o quita uno sin actualizar el resto, esto lo detiene.
select set_eq(
  $$ select unnest(enum_range(null::public.clasificacion_articulo))::text $$,
  array['reactivo','material','insumo','equipo','componente','materia_biologica'],
  'clasificacion_articulo tiene una entrada por hoja del formato unificado'
);

-- por_confirmar se quito: la carga de hoy ES el conteo inicial.
select set_eq(
  $$ select unnest(enum_range(null::public.estado_existencia))::text $$,
  array['disponible','stock_bajo','agotado','contaminado','mantenimiento','baja'],
  'estado_existencia ya no incluye por_confirmar'
);

-- carga_inicial va al frente para que los reportes de consumo no lo cuenten
-- como compra del mes.
select set_eq(
  $$ select unnest(enum_range(null::public.tipo_movimiento))::text $$,
  array['carga_inicial','entrada','consumo','merma','ajuste_conteo',
        'prestamo','devolucion','baja'],
  'tipo_movimiento incluye carga_inicial'
);

-- La forma de dos argumentos de unaccent es la unica inmutable, y por eso la
-- unica indexable. Es el error clasico al montar busqueda difusa en espanol.
select is(
  public.norm_texto('Ácido Succínico'),
  'acido succinico',
  'norm_texto baja a minusculas y quita acentos'
);


-- ---------------------------------------------------------------------------
-- Organizacion
-- ---------------------------------------------------------------------------

-- almacen_alias existia para mapear el texto sucio de la columna Almacen
-- ('4', 'n4', 'N1-1'). En el formato unificado el almacen lo dice el nombre del
-- archivo, asi que la tabla sobra. Si alguien la revive, esto lo detiene.
select hasnt_table('public', 'almacen_alias',
  'almacen_alias no existe: la sub-ubicacion es ubicacion, no almacen');

select hasnt_column('public', 'almacen', 'padre_id',
  'almacen no tiene padre_id: LUM-1 y LUM-2 son sub-ubicaciones');

-- Redundante con la PK a primera vista, pero es lo que permite la FK compuesta
-- de existencia. Sin esta llave candidata no hay forma declarativa de exigir
-- que el laboratorio de una existencia pertenezca a su mismo almacen.
select col_is_unique('public', 'laboratorio', array['id','almacen_id'],
  'laboratorio(id, almacen_id) es unico: habilita la FK compuesta de existencia');


-- ---------------------------------------------------------------------------
-- Catalogo
-- ---------------------------------------------------------------------------
select pg_temp.como_postgres();

insert into public.articulo (nombre_canonico, descripcion, clasificacion, unidad_base)
values ('Matraz volumetrico', '1000 mL, clase A, con tapon', 'material', 'pieza');

-- El formato separa Articulo + Especificacion. Ese par, mas la unidad, ES el
-- articulo: dos matraces de distinto volumen son dos articulos.
select lives_ok(
  $$ insert into public.articulo (nombre_canonico, descripcion, clasificacion, unidad_base)
     values ('Matraz volumetrico', '250 mL, forma baja', 'material', 'pieza') $$,
  'Mismo nombre con especificacion distinta son dos articulos'
);

select throws_ok(
  $$ insert into public.articulo (nombre_canonico, descripcion, clasificacion, unidad_base)
     values ('Matraz volumetrico', '1000 mL, clase A, con tapon', 'material', 'pieza') $$,
  '23505',
  null,
  'Mismo nombre y misma especificacion se rechaza'
);

-- La parte que importa de `nulls not distinct`: sin el, dos filas con
-- especificacion vacia se cuelan como distintas y el catalogo se duplica solo.
insert into public.articulo (nombre_canonico, descripcion, clasificacion, unidad_base)
values ('Papel filtro', null, 'insumo', 'pieza');

select throws_ok(
  $$ insert into public.articulo (nombre_canonico, descripcion, clasificacion, unidad_base)
     values ('Papel filtro', null, 'insumo', 'pieza') $$,
  '23505',
  null,
  'Dos articulos sin especificacion no se cuelan como distintos (nulls not distinct)'
);

-- El CAS identifica el compuesto, no el grado: el esquema define que
-- "Zinc en polvo 95%" y "93%" son dos articulos, y los dos son CAS 7440-66-6.
select lives_ok(
  $$ with a as (
       insert into public.articulo (nombre_canonico, clasificacion, unidad_base)
       values ('Zinc en polvo, solido, pureza 95%', 'reactivo', 'g'),
              ('Zinc en polvo, solido, pureza 93%', 'reactivo', 'g')
       returning id)
     insert into public.articulo_reactivo (articulo_id, cas) select id, '7440-66-6' from a $$,
  'Dos articulos pueden compartir el mismo CAS'
);

-- El formato pregunta "Existencia de hoja de seguridad": si la tienes, no si la
-- necesitas. Con el nombre viejo un false era ambiguo.
select has_column('public', 'articulo_reactivo', 'tiene_hoja_seguridad',
  'articulo_reactivo tiene tiene_hoja_seguridad, no requiere_hoja_seguridad');

select hasnt_column('public', 'articulo_reactivo', 'clasificacion_ghs',
  'clasificacion_ghs se fue: no existe en el formato que se va a capturar');

select hasnt_column('public', 'articulo_reactivo', 'uso_principal',
  'uso_principal se fue de articulo_reactivo: vive en almacen');

-- Se busca con acento y en otra caja; el catalogo lo guarda sin acento. Que
-- esto encuentre las dos filas es lo que hace `buscar_articulo` util: el
-- `distinct on (articulo_id)` devuelve un renglon por articulo, no uno por
-- alias, asi que los dos matraces salen una vez cada uno.
-- Acotada a los dos matraces que crea esta prueba. Contar el resultado entero
-- solo funciona con el catalogo vacio: los datos reales traen sus propios
-- matraces, y hasta una pipeta volumetrica pasa el umbral.
--
-- Sigue probando las dos cosas a la vez. Que salgan 2 y no mas significa que el
-- `distinct on (articulo_id)` devuelve un renglon por articulo y no uno por
-- alias; que salgan 2 y no 0, que el acento y la caja no estorbaron.
--
-- El maximo sube de 10 a 500 a proposito: el `limit` de buscar_articulo recorta
-- por articulo_id, asi que con el catalogo cargado un tope bajo dejaria fuera
-- estos fixtures solo por tener id alto.
select is(
  (select count(*)::int
     from public.buscar_articulo('Matraz Volumétrico', 0.3, 500) b
     join public.articulo a on a.id = b.articulo_id
    where a.nombre_canonico = 'Matraz volumetrico'),
  2,
  'buscar_articulo ignora acentos y mayusculas, y devuelve un renglon por articulo'
);


-- ---------------------------------------------------------------------------
-- Inventario
-- ---------------------------------------------------------------------------
select pg_temp.como_postgres();

create function pg_temp.id_almacen(clave text) returns bigint
language sql as $$ select id from public.almacen where almacen.clave = $1 $$;

insert into public.articulo (id, nombre_canonico, clasificacion, unidad_base)
overriding system value
values (900001, 'Acido succinico, solido, grado reactivo', 'reactivo', 'g'),
       (900002, 'Agitador vortex',                        'equipo',   'pieza');

insert into public.ubicacion (id, almacen_id, etiqueta, componentes)
overriding system value
values (900001, pg_temp.id_almacen('N3'), 'Anaquel 2 / 3 / 4',
        '{"sub_ubicacion":"N3","mueble":"Anaquel 2","repisa":"3","fila_cajon":"4"}'),
       (900002, pg_temp.id_almacen('N4'), 'Gabinete 301',
        '{"sub_ubicacion":"N4","mueble":"Gabinete 301"}');

-- Hoy nada impide que una existencia de N3 apunte a un anaquel de N4. Con la FK
-- compuesta es imposible por construccion, sin triggers ni validacion en la app.
select throws_ok(
  $$ insert into public.existencia (articulo_id, almacen_id, ubicacion_id)
     values (900001, pg_temp.id_almacen('N3'), 900002) $$,
  '23503',
  null,
  'Una existencia de N3 no puede apuntar a una ubicacion de N4'
);

select lives_ok(
  $$ insert into public.existencia (articulo_id, almacen_id, ubicacion_id)
     values (900001, pg_temp.id_almacen('N3'), 900001) $$,
  'Una existencia de N3 si puede apuntar a una ubicacion de N3'
);

-- Regla 6 del formato: celda vacia significa cero. El estado tiene que salir
-- coherente aunque ningun movimiento haya corrido todavia.
select is(
  (select estado::text from public.existencia
    where articulo_id = 900001 and ubicacion_id = 900001),
  'agotado',
  'Una existencia recien creada con cantidad 0 nace agotada, no disponible'
);

select matches(
  (select codigo from public.existencia
    where articulo_id = 900001 and ubicacion_id = 900001),
  '^N3-[0-9]{5}$',
  'El codigo del QR lleva la clave del almacen y cinco digitos'
);

-- Regla 10: la serie y el numero de inventario no se repiten entre renglones.
-- Hoy en N4 tres numeros de serie se repiten en 30 equipos y nada lo impide.
insert into public.existencia (id, articulo_id, almacen_id, numero_serie, numero_inventario_uaeh)
overriding system value
-- Series sinteticas, no copiadas del Excel. La version anterior usaba
-- '10017662023004', que es una serie REAL de un equipo de N4: en cuanto el ETL
-- cargo ese renglon, el fixture choco contra el indice unico y aborto el
-- archivo entero en la prueba 19 de 47.
values (900101, 900002, pg_temp.id_almacen('N4'), 'SERIE-PRUEBA-900101', 'INV-PRUEBA-900101');

select throws_ok(
  $$ insert into public.existencia (articulo_id, almacen_id, numero_serie)
     values (900002, pg_temp.id_almacen('N4'), 'SERIE-PRUEBA-900101') $$,
  '23505',
  null,
  'Dos equipos no pueden compartir numero de serie'
);

select throws_ok(
  $$ insert into public.existencia (articulo_id, almacen_id, numero_inventario_uaeh)
     values (900002, pg_temp.id_almacen('N4'), 'INV-PRUEBA-900101') $$,
  '23505',
  null,
  'Dos equipos no pueden compartir numero de inventario UAEH'
);

-- El ETL normaliza 'Sin serie' y '-' a NULL, y el unico parcial tiene que
-- dejar pasar tantos NULL como haga falta.
select lives_ok(
  $$ insert into public.existencia (articulo_id, almacen_id, numero_serie)
     values (900002, pg_temp.id_almacen('N4'), null),
            (900002, pg_temp.id_almacen('N4'), null) $$,
  'Varias existencias sin numero de serie conviven: el unico es parcial'
);

-- La cantidad nunca se escribe directo. La carga inicial pasa por movimiento
-- para que exista bitacora desde el primer renglon.
select lives_ok(
  $$ insert into public.movimiento (existencia_id, tipo, cantidad, cantidad_antes,
                                    cantidad_despues, almacen_id, usuario_id)
     values (900101, 'carga_inicial', 1, 0, 0, pg_temp.id_almacen('N4'),
             (select id from public.perfil limit 1)) $$,
  'La carga inicial se registra como movimiento'
);

select is(
  (select cantidad from public.existencia where id = 900101),
  1::numeric(14,4),
  'El trigger aplica la carga inicial al saldo'
);

select is(
  (select estado::text from public.existencia where id = 900101),
  'disponible',
  'Con saldo y sin minimo, el estado queda disponible'
);

-- Un reactivo caducado hace anios sigue disponible: la caducidad es
-- informativa y no bloquea. Decisiones D2 y D5 del spec.
select is(
  private.estado_calculado(50, 10, 'disponible'),
  'disponible'::public.estado_existencia,
  'estado_calculado no mira la caducidad: un caducado con saldo sigue disponible'
);

select is(
  private.estado_calculado(5, 10, 'disponible'),
  'stock_bajo'::public.estado_existencia,
  'Por debajo del minimo, stock_bajo'
);

select is(
  private.estado_calculado(0, 10, 'contaminado'),
  'contaminado'::public.estado_existencia,
  'Un estado puesto a mano manda sobre el calculado'
);

select hasnt_column('public', 'existencia', 'partida',
  'partida se fue: es del catalogo de compras, no del inventario');

select hasnt_column('public', 'existencia', 'revisado_por',
  'revisado_por se fue: quien reviso lo dice movimiento.usuario_id');


-- ---------------------------------------------------------------------------
-- Practicas
-- ---------------------------------------------------------------------------
select pg_temp.como_postgres();

insert into public.existencia (id, articulo_id, almacen_id)
overriding system value
values (900201, 900001, pg_temp.id_almacen('N3')),   -- reactivo, se pesa
       (900202, 900001, pg_temp.id_almacen('N3')),   -- material, por cantidad
       (900203, 900002, pg_temp.id_almacen('N3'));   -- equipo, prestamo

insert into public.movimiento (existencia_id, tipo, cantidad, cantidad_antes,
                               cantidad_despues, almacen_id, usuario_id)
values (900201, 'carga_inicial', 500, 0, 0, pg_temp.id_almacen('N3'),
        (select id from public.perfil limit 1)),
       (900202, 'carga_inicial',  20, 0, 0, pg_temp.id_almacen('N3'),
        (select id from public.perfil limit 1)),
       (900203, 'carga_inicial',   1, 0, 0, pg_temp.id_almacen('N3'),
        (select id from public.perfil limit 1));

insert into public.practica (id, programa_educativo_id, laboratorio_id, registrado_por)
overriding system value
values (900301,
        (select id from public.programa_educativo limit 1),
        (select id from public.laboratorio
          where almacen_id = pg_temp.id_almacen('N3') limit 1),
        (select id from public.perfil limit 1));

select matches(
  (select folio from public.practica where id = 900301),
  '^PRA-[0-9]{4}$',
  'El folio de la practica lo pone el trigger'
);

-- El almacen_id lo escribe el trigger desde el laboratorio, igual que en
-- movimiento: si lo mandara el cliente podria falsearlo.
select is(
  (select a.clave from public.practica p join public.almacen a on a.id = p.almacen_id
    where p.id = 900301),
  'N3',
  'El trigger deriva almacen_id del laboratorio de la practica'
);

-- Union discriminada: un reactivo con estado_devolucion es un renglon imposible.
select throws_ok(
  $$ insert into public.practica_elemento
       (practica_id, existencia_id, metodo_control, peso_inicial, peso_final,
        estado_devolucion)
     values (900301, 900201, 'peso', 100, 90, 'correcto') $$,
  '23514',
  null,
  'Un elemento por peso no puede traer estado_devolucion'
);

select throws_ok(
  $$ insert into public.practica_elemento
       (practica_id, existencia_id, metodo_control, peso_inicial, peso_final)
     values (900301, 900201, 'peso', 90, 100) $$,
  '23514',
  null,
  'El peso final no puede ser mayor que el inicial'
);

-- La aritmetica vive en la base. El bug de la semana del 11 de agosto fue una
-- resta al reves que no daba error.
insert into public.practica_elemento
  (practica_id, existencia_id, metodo_control, peso_inicial, peso_final)
values (900301, 900201, 'peso', 196.8, 139.8);

select is(
  (select consumo from public.practica_elemento
    where existencia_id = 900201),
  57.0::numeric(14,4),
  'consumo es columna generada: 196.8 - 139.8'
);

select is(
  (select cantidad from public.existencia where id = 900201),
  443.0::numeric(14,4),
  'El consumo por peso descuenta del saldo via movimiento'
);

-- Dos columnas para danada y perdidas, dos movimientos: juntarlas en uno solo
-- desperdiciaria la distincion que el formulario si captura.
insert into public.practica_elemento
  (practica_id, existencia_id, metodo_control,
   cantidad_entregada, cantidad_devuelta, cantidad_danada)
values (900301, 900202, 'cantidad', 10, 7, 2);

select is(
  (select perdidas from public.practica_elemento where existencia_id = 900202),
  1.0::numeric(14,4),
  'perdidas es columna generada: 10 - 7 - 2'
);

select set_eq(
  $$ select tipo::text || ':' || cantidad::text from public.movimiento
      where existencia_id = 900202 and tipo <> 'carga_inicial' $$,
  array['merma:-2.0000','consumo:-1.0000'],
  'Un elemento por cantidad genera merma por lo daniado y consumo por lo perdido'
);

-- Un equipo prestado y devuelto no cambia de cantidad. Una fila -1/+1 que se
-- cancela seria historia inventada.
insert into public.practica_elemento
  (practica_id, existencia_id, metodo_control, estado_salida, estado_devolucion)
values (900301, 900203, 'prestamo', 'correcto', 'presenta_fallas');

select is(
  (select count(*)::int from public.movimiento
    where existencia_id = 900203 and tipo <> 'carga_inicial'),
  0,
  'Un prestamo de equipo no genera movimiento: la cantidad no cambia'
);

select is(
  (select funcionamiento::text from public.existencia where id = 900203),
  'presenta_fallas',
  'La devolucion actualiza el funcionamiento del equipo'
);


-- ---------------------------------------------------------------------------
-- Perfiles de captura
-- ---------------------------------------------------------------------------
select pg_temp.como_postgres();

-- Con el formato unificado todos capturan igual, asi que el seed trae 6
-- perfiles default en vez de 24 por almacen.
select is(
  (select count(*)::int from public.perfil_captura where almacen_id is null),
  6,
  'Hay un perfil default por clasificacion: 6 filas, no 24'
);

-- Un almacen sin perfil propio recibe el default. Dar de alta un quinto
-- almacen no requiere ni una fila nueva.
select isnt_empty(
  $$ select * from public.formulario(
       (select id from public.almacen where clave = 'LE'), 'reactivo') $$,
  'Un almacen sin perfil propio cae al default'
);

-- El especifico gana sobre el default.
insert into public.perfil_captura (almacen_id, clasificacion, nombre)
values ((select id from public.almacen where clave = 'LE'), 'componente',
        'Componentes LE con coordenadas');

insert into public.perfil_campo (perfil_id, campo, obligatorio, orden)
select id, 'coord_h', true, 1 from public.perfil_captura
 where almacen_id = (select id from public.almacen where clave = 'LE')
   and clasificacion = 'componente';

select results_eq(
  $$ select campo from public.formulario(
       (select id from public.almacen where clave = 'LE'), 'componente') $$,
  array['coord_h'],
  'El perfil del almacen gana sobre el default'
);

-- El formato unifico a Mueble: "Anaquel 2" es un valor, no una columna.
select is(
  (select count(*)::int from public.campo_capturable
    where campo in ('anaquel','partida','revisado_por')),
  0,
  'anaquel, partida y revisado_por ya no son campos capturables'
);


-- ---------------------------------------------------------------------------
-- Perfil automatico al dar de alta un usuario
-- ---------------------------------------------------------------------------
-- Sin esto, cada cuenta nueva necesita un insert a mano en public.perfil, y el
-- sintoma cuando se olvida es confuso: la persona entra bien y la app se ve
-- incompleta, porque usePerfil usa .single() y ese error se traga en silencio.
select pg_temp.como_postgres();

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data,
  confirmation_token, recovery_token,
  email_change, email_change_token_new, email_change_token_current,
  phone_change, phone_change_token, reauthentication_token
) values (
  '00000000-0000-0000-0000-000000000000',
  '00000000-0000-0000-0000-0000000009f1', 'authenticated', 'authenticated',
  'recien.creado@uaeh.edu.mx', extensions.crypt('x', extensions.gen_salt('bf')),
  now(), now(), now(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  '{"nombre":"Persona Recien Creada"}'::jsonb,
  '', '', '', '', '', '', '', ''
);

select is(
  (select count(*)::int from public.perfil
    where id = '00000000-0000-0000-0000-0000000009f1'),
  1,
  'Dar de alta un usuario en Auth le crea su perfil'
);

-- El mas restrictivo a proposito: que un admin tenga que subirle el rol a mano
-- es molesto una vez; que alguien nazca pudiendo escribir es un problema.
select is(
  (select rol::text from public.perfil
    where id = '00000000-0000-0000-0000-0000000009f1'),
  'consulta',
  'El perfil nace con el rol mas restrictivo'
);

select is(
  (select nombre from public.perfil
    where id = '00000000-0000-0000-0000-0000000009f1'),
  'Persona Recien Creada',
  'El nombre sale de los metadatos del alta'
);

-- ---------------------------------------------------------------------------
-- La vista del listado hereda la RLS
-- ---------------------------------------------------------------------------
-- Esta es la prueba mas importante del archivo. Una vista sin
-- `security_invoker` corre con los privilegios de su dueno (postgres) y NO
-- aplica la RLS de las tablas de abajo: publica el inventario completo a la
-- anon key, que va dentro del binario. Comprobado el 21 de agosto creando las
-- dos variantes: sin el ajuste, anon leia las 164 existencias; con el, choca
-- contra 'permission denied for table existencia'.
--
-- Falla en silencio -la vista funciona igual de bien-, asi que el seguro va
-- aqui y no en la revision de nadie.
select has_view('public', 'existencia_listado', 'La vista del listado existe');

select is(
  (select reloptions::text[] @> array['security_invoker=on']
     from pg_class where oid = 'public.existencia_listado'::regclass),
  true,
  'La vista del listado corre con los privilegios de quien la consulta'
);


-- ---------------------------------------------------------------------------
-- El resumen del menu principal, con el mismo seguro que el listado
-- ---------------------------------------------------------------------------
select has_view('public', 'almacen_resumen', 'La vista del resumen existe');

select is(
  (select reloptions::text[] @> array['security_invoker=on']
     from pg_class where oid = 'public.almacen_resumen'::regclass),
  true,
  'La vista del resumen corre con los privilegios de quien la consulta'
);

-- Los siete `filter` son faciles de escribir mal y el error no se ve: un
-- estado mal escrito devuelve cero, que parece un dato. Esto ancla que el
-- total sea exactamente el inventario vivo.
select pg_temp.como_postgres();

select is(
  -- sum() de bigint devuelve numeric, y count() bigint: sin el cast, is() no
  -- puede resolver el tipo y la prueba truena en vez de comparar.
  (select sum(total)::bigint from public.almacen_resumen),
  (select count(*) from public.existencia where estado <> 'baja'),
  'El total del resumen es el inventario vivo, sin las bajas'
);


-- ---------------------------------------------------------------------------
-- El veredicto de quien depura un renglon
-- ---------------------------------------------------------------------------
-- Son DOS y no tres. La tercera salida de un pendiente —no debe cargarse— no es
-- un veredicto: es `estado = 'descartado'`, un UPDATE normal que no toca el
-- inventario. Meterla aqui invitaria a que `resolver_pendiente` tuviera un
-- camino que no crea ninguna existencia, que es justo lo que esa funcion existe
-- para no permitir.
select set_eq(
  $$ select unnest(enum_range(null::public.veredicto_pendiente))::text $$,
  array['nueva','duplicado'],
  'veredicto_pendiente solo tiene las dos formas de entrar al inventario'
);


-- ---------------------------------------------------------------------------
-- El plan academico: la tabla puente y el catalogo de practicas
-- ---------------------------------------------------------------------------
select pg_temp.como_postgres();

insert into public.programa_educativo (id, nombre) overriding system value
values (900901, 'Programa de prueba A'),
       (900902, 'Programa de prueba B');

-- Una sola fila de asignatura, en dos programas y en dos semestres distintos.
-- Es el caso que justifica que el semestre viva en la relacion: si estuviera en
-- asignatura, esta fila no tendria un valor correcto que poner.
insert into public.asignatura (id, nombre) overriding system value
values (900911, 'Bioquimica de prueba'),
       (900912, 'Microbiologia de prueba');

insert into public.programa_asignatura (programa_educativo_id, asignatura_id, semestre)
values (900901, 900911, 3),
       (900902, 900911, 6),
       (900901, 900912, 2);

insert into public.practica_catalogo (id, asignatura_id, numero, nombre)
overriding system value
values (900921, 900911, 1, 'Identificacion de carbohidratos'),
       (900922, 900912, 1, 'Siembra en placa');

-- La FK compuesta practica_pareja_valida. Sin ella nada impide registrar una
-- practica de Bioquimica bajo un programa que no la lleva.
--
-- registrado_por va explicito en las tres: este archivo corre como postgres, y
-- ahi auth.uid() es NULL. El coalesce del trigger no tiene de donde sacarlo y la
-- columna es NOT NULL, asi que sin esto fallaria por 23502 y no por lo que la
-- prueba quiere medir.
select throws_ok(
  $$ insert into public.practica (programa_educativo_id, asignatura_id, laboratorio_id,
                                  registrado_por)
     values (900902, 900912, (select id from public.laboratorio limit 1),
             (select id from public.perfil where nombre = 'Responsable N4')) $$,
  '23503',
  null,
  'No se registra una practica con una pareja programa-asignatura que no esta en el plan'
);

-- La MAS importante de las siete, y la unica que prueba que algo SIGUE
-- funcionando en vez de que algo falla. MATCH SIMPLE es el default: con
-- asignatura_id nulo la restriccion no verifica nada. Si alguien "arregla" la
-- FK poniendole match full, el registro de practicas sin asignatura se rompe en
-- silencio y esta prueba es lo unico que lo grita.
select lives_ok(
  $$ insert into public.practica (programa_educativo_id, laboratorio_id, registrado_por)
     values (900901, (select id from public.laboratorio limit 1),
             (select id from public.perfil where nombre = 'Responsable N4')) $$,
  'Una practica sin asignatura sigue pudiendo registrarse'
);

-- La llave candidata unique (id, asignatura_id) de practica_catalogo.
select throws_ok(
  $$ insert into public.practica (programa_educativo_id, asignatura_id,
                                  practica_catalogo_id, laboratorio_id, registrado_por)
     values (900901, 900911, 900922, (select id from public.laboratorio limit 1),
             (select id from public.perfil where nombre = 'Responsable N4')) $$,
  '23503',
  null,
  'La practica elegida tiene que ser de la asignatura elegida'
);

select throws_ok(
  $$ insert into public.programa_asignatura (programa_educativo_id, asignatura_id, semestre)
     values (900902, 900912, 0) $$,
  '23514', null,
  'El semestre 0 no existe'
);

select throws_ok(
  $$ insert into public.programa_asignatura (programa_educativo_id, asignatura_id, semestre)
     values (900902, 900912, 13) $$,
  '23514', null,
  'El semestre 13 no existe'
);

-- Sin el indice sobre norm_texto, "Bioquimica" y "Bioquimica" con acento son
-- dos asignaturas distintas, y a las tres semanas hay cuatro.
select throws_ok(
  $$ insert into public.asignatura (nombre) values ('BIOQUÍMICA DE PRUEBA') $$,
  '23505', null,
  'Una asignatura no se duplica por acentos ni por mayusculas'
);

select throws_ok(
  $$ insert into public.practica_catalogo (asignatura_id, numero, nombre)
     values (900911, 1, 'Otra practica numero uno') $$,
  '23505', null,
  'No hay dos practicas con el mismo numero en una asignatura'
);


select * from finish();
rollback;
