-- Pruebas de estructura: enums, restricciones, triggers y columnas generadas.
-- Se corren con: supabase test db
--
-- Complementa rls.test.sql, que prueba las politicas. Aqui se prueba que el
-- esquema no deje pasar datos imposibles; alla, que no deje pasar a quien no debe.

begin;
create extension if not exists pgtap with schema extensions;

select plan(15);

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
select is(
  (select count(*)::int from public.buscar_articulo('Matraz Volumétrico', 0.3, 10)),
  2,
  'buscar_articulo ignora acentos y mayusculas, y devuelve un renglon por articulo'
);

select * from finish();
rollback;
