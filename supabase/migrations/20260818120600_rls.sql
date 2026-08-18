-- Row Level Security.
--
-- Diseno: docs/specs/2026-08-18-depuracion-esquema-formato-unificado-design.md
--
-- El `enable row level security` y el `revoke ... from anon` de cada tabla viven
-- en el archivo que la crea; aqui van solo las politicas.
--
-- Esta es la UNICA seguridad real del sistema. Cuando la app se empaquete para
-- produccion llevara la anon key dentro del binario; esa llave es publica por
-- diseno y cualquiera puede extraerla y hablarle directo a la base. Lo que
-- protege los datos son estas politicas, no el cliente.
--
-- Regla del proyecto: cada politica lleva su prueba.
--
-- Nota de rendimiento: toda llamada a funcion va envuelta en (select ...).
-- Sin eso Postgres la evalua una vez POR FILA en vez de una vez por sentencia.

-- ---------------------------------------------------------------------------
-- El sistema requiere sesion: anon no tiene nada que hacer aqui.
-- ---------------------------------------------------------------------------
revoke all on all tables    in schema public from anon;
revoke all on all functions in schema public from anon;
revoke all on all sequences in schema public from anon;



-- ---------------------------------------------------------------------------
-- Organizacion: todos leen, solo admin escribe
-- ---------------------------------------------------------------------------
create policy almacen_lectura on public.almacen
  for select to authenticated using (true);

create policy almacen_admin on public.almacen
  for all to authenticated
  using       ((select private.es_admin()))
  with check  ((select private.es_admin()));

create policy laboratorio_lectura on public.laboratorio
  for select to authenticated using (true);

create policy laboratorio_admin on public.laboratorio
  for all to authenticated
  using       ((select private.es_admin()))
  with check  ((select private.es_admin()));


-- ---------------------------------------------------------------------------
-- Perfil
-- ---------------------------------------------------------------------------
-- Se leen todos: la app muestra quien registro cada movimiento.
create policy perfil_lectura on public.perfil
  for select to authenticated using (true);

-- Cada quien edita su propio nombre. El rol y el almacen NO: si un responsable
-- pudiera cambiarse el rol a admin, toda la RLS seria decorativa.
--
-- Los valores actuales se leen con los helpers de `private`, no con una
-- subconsulta a perfil: una subconsulta aqui volveria a pasar por esta misma
-- politica y recursaria hasta reventar. Los helpers son security definer y
-- evaden la RLS por construccion.
create policy perfil_propio on public.perfil
  for update to authenticated
  using      (id = (select auth.uid()))
  with check (id = (select auth.uid())
              and rol        = (select private.rol_actual())
              and almacen_id is not distinct from (select private.almacen_actual()));

create policy perfil_admin on public.perfil
  for all to authenticated
  using       ((select private.es_admin()))
  with check  ((select private.es_admin()));


-- ---------------------------------------------------------------------------
-- Ubicacion: leo todo, escribo lo mio
-- ---------------------------------------------------------------------------
create policy ubicacion_lectura on public.ubicacion
  for select to authenticated using (true);

create policy ubicacion_escritura on public.ubicacion
  for all to authenticated
  using      ((select private.es_admin()) or almacen_id = (select private.almacen_actual()))
  with check ((select private.es_admin()) or almacen_id = (select private.almacen_actual()));


-- ---------------------------------------------------------------------------
-- Catalogo: compartido entre almacenes
-- ---------------------------------------------------------------------------
-- Cualquier responsable puede CREAR un articulo (el flujo de la app lo obliga
-- a pasar por buscar_articulo primero), pero nace sin verificar y solo el admin
-- puede editarlo, verificarlo o fusionarlo. Asi nadie se bloquea esperando un
-- correo y el catalogo no se fragmenta sin control.
-- Sin (select ...): Postgres no admite subconsultas en un DEFAULT. El truco de
-- envolver en (select ...) sirve para cachear la funcion en las POLITICAS, que
-- se evaluan por fila; un DEFAULT ya corre una sola vez por insercion.
alter table public.articulo alter column creado_por set default auth.uid();

create policy articulo_lectura on public.articulo
  for select to authenticated using (true);

create policy articulo_alta on public.articulo
  for insert to authenticated
  with check ((select private.puede_escribir())
              and creado_por = (select auth.uid())
              and not verificado);

create policy articulo_admin on public.articulo
  for all to authenticated
  using       ((select private.es_admin()))
  with check  ((select private.es_admin()));

create policy articulo_alias_lectura on public.articulo_alias
  for select to authenticated using (true);

create policy articulo_alias_alta on public.articulo_alias
  for insert to authenticated
  with check ((select private.puede_escribir()));

create policy articulo_alias_admin on public.articulo_alias
  for all to authenticated
  using       ((select private.es_admin()))
  with check  ((select private.es_admin()));

create policy articulo_reactivo_lectura on public.articulo_reactivo
  for select to authenticated using (true);

create policy articulo_reactivo_admin on public.articulo_reactivo
  for all to authenticated
  using       ((select private.es_admin()))
  with check  ((select private.es_admin()));


-- ---------------------------------------------------------------------------
-- Existencia: leo todo, escribo lo mio
-- ---------------------------------------------------------------------------
-- La lectura abierta es lo que habilita el prestamo entre almacenes: N4 puede
-- consultar el stock de N3 antes de ir a pedirlo.
create policy existencia_lectura on public.existencia
  for select to authenticated using (true);

create policy existencia_alta on public.existencia
  for insert to authenticated
  with check ((select private.es_admin()) or almacen_id = (select private.almacen_actual()));

create policy existencia_edicion on public.existencia
  for update to authenticated
  using      ((select private.es_admin()) or almacen_id = (select private.almacen_actual()))
  with check ((select private.es_admin()) or almacen_id = (select private.almacen_actual()));

-- Borrar existencias no es una operacion normal: se dan de baja con un
-- movimiento, que deja rastro. Solo admin.
create policy existencia_borrado on public.existencia
  for delete to authenticated
  using ((select private.es_admin()));


-- ---------------------------------------------------------------------------
-- Movimiento: solo insercion
-- ---------------------------------------------------------------------------
-- No hay politica de update ni de delete, y ademas se revoca el privilegio:
-- sin politica la RLS ya lo negaria, pero dos candados en la puerta de la
-- auditoria no sobran.
revoke update, delete on public.movimiento from authenticated;

create policy movimiento_lectura on public.movimiento
  for select to authenticated using (true);

-- almacen_id lo escribe el trigger BEFORE INSERT leyendolo de la existencia.
-- El WITH CHECK se evalua DESPUES del trigger, sobre la fila final, asi que
-- verifica el valor real y no lo que haya mandado el cliente.
create policy movimiento_alta on public.movimiento
  for insert to authenticated
  with check ((select private.es_admin()) or almacen_id = (select private.almacen_actual()));


-- ---------------------------------------------------------------------------
-- Articulo biologico: mismo trato que articulo_reactivo
-- ---------------------------------------------------------------------------
create policy articulo_biologico_lectura on public.articulo_biologico
  for select to authenticated using (true);

create policy articulo_biologico_alta on public.articulo_biologico
  for insert to authenticated with check ((select private.puede_escribir()));

create policy articulo_biologico_admin on public.articulo_biologico
  for all to authenticated
  using ((select private.es_admin())) with check ((select private.es_admin()));


-- ---------------------------------------------------------------------------
-- Carga: de donde salieron los datos
-- ---------------------------------------------------------------------------
-- Todos ven la procedencia de cualquier renglon; registrar una carga es
-- escribir en un almacen, asi que se rige por la misma regla que existencia.
create policy carga_lectura on public.carga
  for select to authenticated using (true);

create policy carga_escritura on public.carga
  for insert to authenticated
  with check ((select private.puede_escribir())
              and ((select private.es_admin())
                   or almacen_id = (select private.almacen_actual())));


-- ---------------------------------------------------------------------------
-- Catalogos cerrados: todos leen, solo admin escribe
-- ---------------------------------------------------------------------------
-- Cambiar uno afecta a los cuatro almacenes a la vez.
create policy programa_educativo_lectura on public.programa_educativo
  for select to authenticated using (true);
create policy programa_educativo_admin on public.programa_educativo
  for all to authenticated
  using ((select private.es_admin())) with check ((select private.es_admin()));

create policy asignatura_lectura on public.asignatura
  for select to authenticated using (true);
create policy asignatura_admin on public.asignatura
  for all to authenticated
  using ((select private.es_admin())) with check ((select private.es_admin()));

create policy motivo_observacion_lectura on public.motivo_observacion
  for select to authenticated using (true);
create policy motivo_observacion_admin on public.motivo_observacion
  for all to authenticated
  using ((select private.es_admin())) with check ((select private.es_admin()));


-- ---------------------------------------------------------------------------
-- Practica: el almacen_id desnormalizado es el ancla
-- ---------------------------------------------------------------------------
-- Lo escribe el trigger BEFORE INSERT leyendolo del laboratorio. El WITH CHECK
-- se evalua DESPUES del trigger, sobre la fila final, asi que verifica el valor
-- real y no lo que haya mandado el cliente.
create policy practica_lectura on public.practica
  for select to authenticated using (true);

create policy practica_escritura on public.practica
  for insert to authenticated
  with check ((select private.puede_escribir())
              and ((select private.es_admin())
                   or almacen_id = (select private.almacen_actual())));

-- Corregir una practica ya registrada es cosa del admin: es el documento que
-- respalda un consumo.
create policy practica_admin on public.practica
  for all to authenticated
  using ((select private.es_admin())) with check ((select private.es_admin()));


-- ---------------------------------------------------------------------------
-- Practica elemento: mismo patron, anclado a la existencia
-- ---------------------------------------------------------------------------
-- almacen_id lo escribe el trigger desde la existencia, no desde la practica.
-- Eso es lo que impide consumir stock de N4 desde una practica de N3.
create policy practica_elemento_lectura on public.practica_elemento
  for select to authenticated using (true);

create policy practica_elemento_escritura on public.practica_elemento
  for insert to authenticated
  with check ((select private.puede_escribir())
              and ((select private.es_admin())
                   or almacen_id = (select private.almacen_actual())));

create policy practica_elemento_admin on public.practica_elemento
  for all to authenticated
  using ((select private.es_admin())) with check ((select private.es_admin()));


-- ---------------------------------------------------------------------------
-- Practica observacion: la unica sin almacen_id propio
-- ---------------------------------------------------------------------------
-- Son dos columnas; desnormalizar una tercera solo para la RLS seria peor que
-- el exists. practica_id es la primera columna de la llave primaria, asi que
-- la subconsulta resuelve por indice sin necesidad de uno nuevo.
create policy practica_observacion_lectura on public.practica_observacion
  for select to authenticated using (true);

create policy practica_observacion_escritura on public.practica_observacion
  for all to authenticated
  using (exists (select 1 from public.practica p
                  where p.id = practica_id
                    and ((select private.es_admin())
                         or p.almacen_id = (select private.almacen_actual()))))
  with check (exists (select 1 from public.practica p
                       where p.id = practica_id
                         and ((select private.es_admin())
                              or p.almacen_id = (select private.almacen_actual()))));


-- ---------------------------------------------------------------------------
-- Perfiles de captura
-- ---------------------------------------------------------------------------
-- Todos leen: el formulario necesita el perfil para armarse, y si esto no se
-- puede leer, formulario() devuelve vacio y el alta se queda sin campos.
create policy campo_capturable_lectura on public.campo_capturable
  for select to authenticated using (true);
create policy perfil_captura_lectura on public.perfil_captura
  for select to authenticated using (true);
create policy perfil_campo_lectura on public.perfil_campo
  for select to authenticated using (true);

-- Cambiar la forma de un formulario afecta a todo un almacen, o a todos si es
-- el perfil default: solo admin.
create policy campo_capturable_admin on public.campo_capturable
  for all to authenticated
  using ((select private.es_admin())) with check ((select private.es_admin()));
create policy perfil_captura_admin on public.perfil_captura
  for all to authenticated
  using ((select private.es_admin())) with check ((select private.es_admin()));
create policy perfil_campo_admin on public.perfil_campo
  for all to authenticated
  using ((select private.es_admin())) with check ((select private.es_admin()));
