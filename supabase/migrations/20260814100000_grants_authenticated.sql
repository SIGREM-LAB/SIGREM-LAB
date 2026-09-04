-- Privilegios de tabla para authenticated.
--
-- ORDEN: este archivo va ANTES del baseline a proposito, y ahi se queda.
-- Su trabajo real es el `alter default privileges`, que solo alcanza a las
-- tablas creadas DESPUES. Movido al final rompe tres pruebas de permisos: su
-- `grant ... on all tables` le devolveria a authenticated el UPDATE completo
-- sobre existencia, movimiento y carga_pendiente, borrando los grants por
-- columnas que rls.sql y carga_pendiente.sql dejaron puestos. Es la misma
-- trampa que avisa el comentario de 20260826120000_carga_pendiente.sql.
--
-- La marca de tiempo es POSTERIOR a todo el baseline a proposito. Nacio como
-- 20260814100000, que la colocaba antes de 20260818120000_base.sql, y entonces
-- su ultima linea —el revoke sobre public.movimiento— corria cuando esa tabla
-- todavia no existia: `supabase db reset` moria con 42P01. Se pudo renombrar
-- porque el archivo nunca se habia commiteado y el CLI no esta vinculado a
-- ningun remoto, asi que no habia historial de migraciones fuera de esta
-- maquina. Si algun dia se aplica a un remoto, este nombre ya no se toca.
--
-- Las migraciones anteriores enable-aron RLS y escribieron las politicas, pero
-- nunca otorgaron los privilegios de tabla. Se daban por hechos los que
-- Supabase concedia por defecto a anon y authenticated sobre public; la imagen
-- actual de Postgres ya no los aplica, asi que `authenticated` quedaba con
-- REFERENCES, TRIGGER y TRUNCATE y nada mas. Resultado: `permission denied for
-- table existencia` en cuanto alguien con sesion abierta lee algo.
--
-- Que rls.sql revoque update y delete sobre movimiento a authenticated no tiene
-- sentido si authenticated nunca los tuvo: confirma que el esquema asumia estos
-- grants. Esta migracion los hace explicitos en vez de heredarlos.
--
-- Los dos niveles son independientes y hacen falta los dos:
--   privilegio de tabla -> puedes tocar la tabla
--   politica de RLS     -> que filas de esa tabla
-- El privilegio no afloja la seguridad; sin politica que te habilite la fila,
-- sigues sin verla.

grant select, insert, update, delete
  on all tables in schema public to authenticated;

-- Para las tablas que creen las migraciones futuras, y solo las que cree el rol
-- que corre las migraciones. Evita que el proximo `create table` repita este
-- mismo fallo en silencio.
alter default privileges in schema public
  grant select, insert, update, delete on tables to authenticated;

-- Sin grants sobre secuencias a proposito: todos los id son
-- `generated always as identity` y esas secuencias no requieren usage para
-- insertar. Si algun dia entra una columna serial, ahi se otorga.

-- ---------------------------------------------------------------------------
-- anon sigue sin nada
-- ---------------------------------------------------------------------------
-- El sistema requiere sesion. Se repite el revoke de rls.sql porque `on all
-- tables` alcanza tambien las tablas creadas despues de aquella migracion.
revoke all on all tables    in schema public from anon;
revoke all on all functions in schema public from anon;
revoke all on all sequences in schema public from anon;

alter default privileges in schema public
  revoke all on tables from anon;

-- ---------------------------------------------------------------------------
-- Por que aqui NO se revoca nada sobre movimiento
-- ---------------------------------------------------------------------------
-- Este archivo llevaba un `revoke update, delete on public.movimiento`. Con la
-- marca de tiempo que tiene, esa tabla todavia no existe y el reset moria con
-- 42P01. Y no hace falta: el `grant ... on all tables` de arriba es un no-op
-- —no hay ni una tabla creada todavia— asi que no hay nada que reaplicar. El
-- revoke de verdad vive en rls.sql, que corre despues y manda.
