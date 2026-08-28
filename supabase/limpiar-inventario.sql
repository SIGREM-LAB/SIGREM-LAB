-- Limpieza del inventario cargado. Para repetir simulacros de migración.
--
--   psql "$DATABASE_URL" -f supabase/limpiar-inventario.sql
--
-- Borra TODO lo que escribe el cargador y deja la base como recién sembrada:
-- catálogo de artículos, ubicaciones, existencias, movimientos y cargas.
--
-- CONSERVA lo que viene de datos-iniciales.sql y no se vuelve a generar:
-- almacenes, laboratorios, perfiles de usuario, campos capturables, perfiles
-- de captura, programas educativos y motivos de observación.
--
-- Es idempotente: correrlo dos veces no falla ni hace daño.
--
-- ¿Por qué un script y no `supabase db reset`? Porque en remoto no existe el
-- reset, y porque en local el reset también borra los usuarios de prueba y
-- vuelve a correr las migraciones enteras. Esto es quirúrgico y sirve en los
-- dos entornos.


begin;

-- ---------------------------------------------------------------------------
-- Antes
-- ---------------------------------------------------------------------------
select 'antes' as momento,
       (select count(*) from public.articulo)   as articulos,
       (select count(*) from public.existencia) as existencias,
       (select count(*) from public.movimiento) as movimientos,
       (select count(*) from public.carga)      as cargas,
       (select count(*) from public.ubicacion)  as ubicaciones;

-- ---------------------------------------------------------------------------
-- El orden lo imponen las llaves foráneas
-- ---------------------------------------------------------------------------
-- practica_elemento y movimiento apuntan a existencia; existencia apunta a
-- articulo, ubicacion y carga. Borrar al revés falla con violación de FK.
--
-- Las prácticas se borran también: no las escribe el cargador, pero si alguien
-- registró una durante las pruebas, su practica_elemento impediría borrar la
-- existencia de la que consumió.

delete from public.practica_elemento;
delete from public.practica_observacion;
delete from public.practica;

-- `movimiento` es de solo inserción por diseño: la app no puede borrar de aquí
-- ni siquiera siendo admin (revoke update, delete ... from authenticated en
-- rls.sql). Este script corre como postgres, que sí puede. Es exactamente por
-- eso que es un script aparte y no una función expuesta.
delete from public.movimiento;

delete from public.existencia;
delete from public.carga;
delete from public.ubicacion;

-- articulo_alias, articulo_reactivo y articulo_biologico caen solos: los tres
-- declaran `on delete cascade` contra articulo.
delete from public.articulo;

-- ---------------------------------------------------------------------------
-- Los contadores de folio
-- ---------------------------------------------------------------------------
-- Sin esto, la siguiente carga arranca en N3-00165 en vez de N3-00001 y los
-- códigos de dos simulacros no se pueden comparar. `folio_almacen` es una
-- tabla, no una secuencia, así que se limpia con un delete normal.
delete from private.folio_almacen;
delete from private.folio_practica;

-- ---------------------------------------------------------------------------
-- Después
-- ---------------------------------------------------------------------------
select 'después' as momento,
       (select count(*) from public.articulo)   as articulos,
       (select count(*) from public.existencia) as existencias,
       (select count(*) from public.movimiento) as movimientos,
       (select count(*) from public.carga)      as cargas,
       (select count(*) from public.ubicacion)  as ubicaciones;

-- Lo que NO se tocó, para poder confirmarlo de un vistazo.
select 'conservado' as que,
       (select count(*) from public.almacen)          as almacenes,
       (select count(*) from public.laboratorio)      as laboratorios,
       (select count(*) from public.perfil)           as perfiles,
       (select count(*) from public.campo_capturable) as campos,
       (select count(*) from public.perfil_campo)     as perfil_campo;

commit;
