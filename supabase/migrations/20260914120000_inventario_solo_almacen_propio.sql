-- El responsable ya no ve el inventario de los otros almacenes.
--
-- Hasta ahora la lectura de `existencia` (y de lo que cuelga: `movimiento`,
-- `carga_pendiente`) era `using (true)` para authenticated: era lo que
-- habilitaba el prestamo entre bodegas. Decision administrativa nueva: cada
-- responsable trabaja solo el suyo. Admin y consulta siguen viendo la Unidad
-- entera — no tienen almacen asignado, y `almacen_actual()` nulo es
-- precisamente esa senal, la misma que ya usa `ConAlmacenPropio` del otro lado.
--
-- Esconder la ruta en el cliente no protege nada: la anon key viaja dentro del
-- binario. Lo que cierra el inventario ajeno es esta politica.

drop policy existencia_lectura on public.existencia;

create policy existencia_lectura on public.existencia
  for select to authenticated
  using (
    (select private.almacen_actual()) is null
    or almacen_id = (select private.almacen_actual())
  );

drop policy movimiento_lectura on public.movimiento;

create policy movimiento_lectura on public.movimiento
  for select to authenticated
  using (
    (select private.almacen_actual()) is null
    or almacen_id = (select private.almacen_actual())
  );

drop policy carga_pendiente_lectura on public.carga_pendiente;

create policy carga_pendiente_lectura on public.carga_pendiente
  for select to authenticated
  using (
    (select private.almacen_actual()) is null
    or almacen_id = (select private.almacen_actual())
  );
