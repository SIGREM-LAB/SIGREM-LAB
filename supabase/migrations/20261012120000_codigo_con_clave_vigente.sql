-- Los codigos de existencia con la clave vigente de su almacen.
--
-- El trigger `existencia_asigna_codigo` arma el codigo como
-- `clave || '-' || consecutivo`. La carga inicial se hizo cuando las claves
-- eran `N3` y `N4`; despues se renombraron a `UCL-N3` y `UCL-N4`, asi que lo
-- cargado dice `N3-00717` y lo que se da de alta ahora sale `UCL-N3-01507`.
-- Con las etiquetas QR eso son dos formatos pegados en los mismos anaqueles.
--
-- Se rehace cada codigo con la clave actual y los mismos cinco digitos. El
-- consecutivo no cambia: sigue siendo el de `private.folio_almacen`, y por eso
-- no puede chocar con un codigo existente.
--
-- Va escrito contra la clave vigente y no contra 'UCL-': en una base local
-- recien sembrada (claves `N3`, `N4`) no toca un renglon.
--
-- Se hace hoy porque todavia no se ha impreso ninguna etiqueta. Despues de
-- imprimirlas, renombrar un almacen dejaria todas sus etiquetas viejas
-- apuntando a un codigo que ya no existe.

update public.existencia e
   set codigo = a.clave || '-' || right(e.codigo, 5)
  from public.almacen a
 where a.id = e.almacen_id
   and e.codigo ~ '-\d{5}$'
   and e.codigo <> a.clave || '-' || right(e.codigo, 5);
