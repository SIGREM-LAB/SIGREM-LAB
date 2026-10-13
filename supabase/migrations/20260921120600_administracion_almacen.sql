-- Administracion de almacenes y laboratorios: que el responsable mande en lo
-- suyo.
--
-- Diseno: docs/specs/2026-09-21-modulo-administracion-design.md, D2 y D3.
--
-- El laboratorio es dato LOCAL del almacen, igual que la ubicacion: quien lo
-- surte sabe que laboratorios atiende. Que agregar uno tenga que pasar por el
-- admin convierte una anotacion de dos segundos en un ticket. Y la ficha NOM la
-- confirma quien trabaja ahi, que es exactamente lo que daba por hecho el
-- comentario de 20260917120000_almacen_icsa.sql cuando dejo las tres columnas
-- de ICSA en nulo «hasta que el responsable las confirme».

-- ---------------------------------------------------------------------------
-- Laboratorio
-- ---------------------------------------------------------------------------
-- Es la forma exacta de ubicacion_escritura (rls.sql:80). NO necesita un
-- puede_escribir() encima, y no es un descuido: desde
-- 20260909130000_almacen_solo_responsable.sql, tener almacen y ser responsable
-- son lo mismo, asi que almacen_actual() le devuelve NULL a un consulta y el
-- segundo disyuntivo nunca es cierto para el.
drop policy laboratorio_admin on public.laboratorio;

create policy laboratorio_escritura on public.laboratorio
  for all to authenticated
  using       ((select private.es_admin())
               or almacen_id = (select private.almacen_actual()))
  with check  ((select private.es_admin())
               or almacen_id = (select private.almacen_actual()));

comment on policy laboratorio_escritura on public.laboratorio is
  'Admin en todos; responsable en el suyo. El USING frena mover uno ajeno, el WITH CHECK frena crearlo fuera.';


-- ---------------------------------------------------------------------------
-- Almacen: la ficha NOM de quien trabaja ahi
-- ---------------------------------------------------------------------------
-- almacen_admin se queda: el admin sigue editando la ficha de cualquiera. Esta
-- politica es permisiva y se suma con OR, no la sustituye.
create policy almacen_ficha_propia on public.almacen
  for update to authenticated
  using       (id = (select private.almacen_actual()))
  with check  (id = (select private.almacen_actual()));

comment on policy almacen_ficha_propia on public.almacen is
  'El responsable confirma las constantes NOM de su propio almacen. Que columnas puede tocar lo decide el grant de abajo, no esta politica.';

-- Y aqui es donde «la clave no se edita» deja de ser convencion de la interfaz.
-- La RLS decide QUE FILAS; el privilegio decide QUE COLUMNAS, y son dos niveles
-- independientes (20260814100000_grants_authenticated.sql lo explica). Sin este
-- revoke, esconder el campo en la pantalla no impide nada: basta un PATCH a
-- PostgREST para renombrar un almacen y romper el ETL, el exportador y la
-- semilla, que casan por clave.
--
-- `activo` queda fuera por lo mismo que no aparece en la pantalla: lo lee un
-- solo sitio —a que usuario se le puede asignar el almacen— asi que un control
-- rotulado «Activo» prometeria cerrar el almacen y lo unico que haria es
-- esconderlo de un select.
revoke update on public.almacen from authenticated;
grant  update (nombre, uso_principal, zona_riesgo, personas_expuestas)
  on public.almacen to authenticated;
