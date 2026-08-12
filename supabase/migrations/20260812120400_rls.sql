-- Row Level Security.
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

alter table public.almacen           enable row level security;
alter table public.laboratorio       enable row level security;
alter table public.perfil            enable row level security;
alter table public.ubicacion         enable row level security;
alter table public.articulo          enable row level security;
alter table public.articulo_alias    enable row level security;
alter table public.articulo_reactivo enable row level security;
alter table public.existencia        enable row level security;
alter table public.movimiento        enable row level security;


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
