-- Pruebas de estructura: enums, restricciones, triggers y columnas generadas.
-- Se corren con: supabase test db
--
-- Complementa rls.test.sql, que prueba las politicas. Aqui se prueba que el
-- esquema no deje pasar datos imposibles; alla, que no deje pasar a quien no debe.

begin;
create extension if not exists pgtap with schema extensions;

select plan(4);

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

select * from finish();
rollback;
