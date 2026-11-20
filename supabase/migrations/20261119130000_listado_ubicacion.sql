-- El listado aprende a filtrar y a buscar por ubicacion.
--
-- Para el conteo fisico: "que hay en el Anaquel 4", y dentro de el "que hay en
-- la repisa 2". La etiqueta (`N3 · Anaquel 4 · Repisa 2 · Fila 3`) sirve para
-- leer, pero no para filtrar por partes: "Repisa 2" tambien casa con
-- "Repisa 21". Por eso la vista expone las partes, que ya estaban guardadas en
-- `ubicacion.componentes` justo para esto (ver 20260818120300_inventario.sql).
--
-- `ubicacion_norm` es para el buscador libre, igual que `nombre_norm` y
-- `marca_norm`: minusculas y sin acentos, para que el cliente use `like`.
--
-- Las dos columnas van al final: `create or replace view` solo admite columnas
-- nuevas al final, y recrear la vista arriesga perder `security_invoker` (ver
-- la nota de 20260903120000_practicas.sql; esquema.test.sql lo vigila).
create or replace view public.existencia_listado
with (security_invoker = on) as
select e.id, e.codigo, e.marca, e.cantidad, e.estado, e.almacen_id,
       e.ubicacion_id, e.fecha_caducidad, e.creado_en,
       a.id as articulo_id,
       a.nombre_canonico, a.descripcion, a.clasificacion, a.unidad_base,
       al.clave   as almacen_clave,
       u.etiqueta as ubicacion,
       public.norm_texto(a.nombre_canonico)     as nombre_norm,
       public.norm_texto(coalesce(e.marca, '')) as marca_norm,
       public.metodo_de_control(a.clasificacion) as metodo_control,
       u.componentes                              as ubicacion_componentes,
       public.norm_texto(coalesce(u.etiqueta, '')) as ubicacion_norm
from public.existencia e
join public.articulo a  on a.id  = e.articulo_id
join public.almacen  al on al.id = e.almacen_id
left join public.ubicacion u on u.id = e.ubicacion_id;

grant select on public.existencia_listado to authenticated;
revoke all  on public.existencia_listado from anon;
