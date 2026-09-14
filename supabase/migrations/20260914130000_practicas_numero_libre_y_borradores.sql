-- Practicas: el numero se captura a mano y cada quien puede tener varios
-- borradores a la vez.
--
-- Dos cambios que pide la pantalla de registro:
--
--   1. El numero de practica deja de ser una fila del catalogo. Se escribe en
--      un campo de texto libre, asi que la sesion guarda el texto y no una FK.
--      `practica_catalogo` sigue existiendo para el panel academico: lo que
--      desaparece es el uso del catalogo al registrar.
--
--   2. Cada persona puede tener varias capturas a medias simultaneas. La PK de
--      `practica_borrador` deja de ser `usuario_id` y pasa a ser un `id`
--      propio, con `usuario_id` como dueno. La RLS no cambia: ya filtra por
--      dueno, y eso es cierto con una fila o con diez.
--
-- Nada de esto es destructivo: el catalogo no se borra, los borradores que ya
-- existan conservan su contenido -solo ganan id y, con el, su propio renglon-,
-- y el numero de las practicas viejas se rellena desde el catalogo que tenian.

-- ---------------------------------------------------------------------------
-- El numero de practica, texto libre
-- ---------------------------------------------------------------------------
-- Anulable como asignatura_id: la base admite una practica sin numero, pero la
-- pantalla lo exige. No se pone NOT NULL ni check a proposito: las practicas
-- registradas antes de esta migracion no tienen numero, y negarlo en la base
-- obligaria a inventarles uno.
alter table public.practica
  add column numero_practica text;

comment on column public.practica.numero_practica is
  'El numero de practica que se escribio al registrar. Texto libre: no es una FK ni se valida contra practica_catalogo.';

-- Lo que ya existe conserva su numero: salia de la fila del catalogo. Se copia
-- como texto para que el detalle de las practicas viejas siga diciendo algo.
update public.practica p
   set numero_practica = c.numero::text
  from public.practica_catalogo c
 where c.id = p.practica_catalogo_id
   and p.numero_practica is null;


-- ---------------------------------------------------------------------------
-- Varios borradores por persona
-- ---------------------------------------------------------------------------
-- El comentario de la tabla dejo de ser cierto en cuanto la pantalla permite
-- mas de una captura: se reescribe aqui para que nadie lea el viejo.
comment on table public.practica_borrador is
  'Las capturas a medio hacer de cada persona. Puede haber varias a la vez; la RLS las limita a su dueno.';

alter table public.practica_borrador
  drop constraint practica_borrador_pkey;

-- `generated always as identity` rellena sola las filas que ya existan: ninguna
-- se pierde, cada una pasa a ser un borrador con su propio id.
alter table public.practica_borrador
  add column id bigint generated always as identity;

alter table public.practica_borrador
  add primary key (id);

-- `usuario_id` dejo de ser la PK, pero sigue siendo la columna de la RLS y del
-- `on delete cascade`. Sin indice, cada consulta del dueno es un seq scan.
create index practica_borrador_usuario_idx
  on public.practica_borrador (usuario_id);


-- ---------------------------------------------------------------------------
-- registrar_practica: de practica_catalogo_id a numero_practica
-- ---------------------------------------------------------------------------
-- Cambia el tipo de un argumento y `create or replace` no admite eso: hay que
-- soltar la firma vieja. El drop va antes para no dejar dos versiones que
-- PostgREST podria confundir.
drop function public.registrar_practica(
  bigint, bigint, bigint, bigint, date, jsonb, text);

create function public.registrar_practica(
  p_programa          bigint,
  p_laboratorio       bigint,
  p_asignatura        bigint,
  p_numero_practica   text,
  p_fecha             date,
  p_elementos         jsonb,
  p_observaciones     text default null
) returns text
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_practica bigint;
  v_folio    text;
  v_elemento jsonb;
  v_metodo   public.metodo_control;
  v_id       bigint;
  v_motivo   text;
begin
  if p_elementos is null
     or jsonb_typeof(p_elementos) <> 'array'
     or jsonb_array_length(p_elementos) = 0 then
    raise exception 'Una practica necesita al menos un producto';
  end if;

  -- folio, almacen_id y registrado_por los pone practica_asigna_folio. Se
  -- omiten a proposito: las tres son NOT NULL, y en Postgres los constraints se
  -- comprueban DESPUES de los triggers BEFORE ROW, asi que omitirlas es
  -- correcto y ademas es la unica forma de que el cliente no las falsee.
  --
  -- El numero va vacio a NULL: un campo en blanco no es un numero, y dejar ''
  -- haria que dos practicas sin numero parecieran la misma cosa.
  insert into public.practica (programa_educativo_id, laboratorio_id, asignatura_id,
                               numero_practica, fecha, observaciones)
  values (p_programa, p_laboratorio, p_asignatura,
          nullif(btrim(coalesce(p_numero_practica, '')), ''),
          coalesce(p_fecha, current_date), p_observaciones)
  returning id, folio into v_practica, v_folio;

  for v_elemento in select * from jsonb_array_elements(p_elementos)
  loop
    -- El metodo lo decide la base leyendo QUE ES la cosa. Lo que mande el
    -- cliente en el json se ignora: es el hueco que cerro la migracion del 3.
    select public.metodo_de_control(a.clasificacion)
      into v_metodo
      from public.existencia e
      join public.articulo  a on a.id = e.articulo_id
     where e.id = (v_elemento->>'existencia_id')::bigint;

    if v_metodo is null then
      raise exception 'La existencia % no existe', v_elemento->>'existencia_id';
    end if;

    -- Los `case` son lo que hace que un peso_inicial mandado sobre un equipo se
    -- descarte ANTES de llegar al check, en vez de reventar contra
    -- practica_elemento_campos_por_metodo con un mensaje que nadie entiende.
    insert into public.practica_elemento (
      practica_id, existencia_id, metodo_control,
      peso_inicial, peso_final,
      cantidad_entregada, cantidad_devuelta, cantidad_danada,
      estado_salida, estado_devolucion,
      observaciones)
    values (
      v_practica,
      (v_elemento->>'existencia_id')::bigint,
      v_metodo,
      case when v_metodo = 'peso' then (v_elemento->>'peso_inicial')::numeric end,
      case when v_metodo = 'peso' then (v_elemento->>'peso_final')::numeric end,
      case when v_metodo = 'cantidad' then (v_elemento->>'cantidad_entregada')::numeric end,
      case when v_metodo = 'cantidad' then (v_elemento->>'cantidad_devuelta')::numeric end,
      case when v_metodo = 'cantidad' then (v_elemento->>'cantidad_danada')::numeric end,
      case when v_metodo = 'prestamo'
           then (v_elemento->>'estado_salida')::public.funcionamiento_equipo end,
      case when v_metodo = 'prestamo'
           then (v_elemento->>'estado_devolucion')::public.funcionamiento_equipo end,
      nullif(btrim(coalesce(v_elemento->>'observaciones', '')), ''))
    returning id into v_id;

    for v_motivo in
      select jsonb_array_elements_text(coalesce(v_elemento->'motivos', '[]'::jsonb))
    loop
      insert into public.practica_elemento_observacion (practica_elemento_id, motivo)
      values (v_id, v_motivo)
      on conflict do nothing;
    end loop;
  end loop;

  return v_folio;
end;
$$;

comment on function public.registrar_practica(bigint, bigint, bigint, text, date, jsonb, text) is
  'Registra una practica completa en una transaccion y devuelve su folio. El numero de practica se guarda como texto libre y el metodo de control lo deriva de la clasificacion del articulo: lo que mande el cliente se ignora.';

revoke all on function public.registrar_practica(
  bigint, bigint, bigint, text, date, jsonb, text) from public, anon;
grant execute on function public.registrar_practica(
  bigint, bigint, bigint, text, date, jsonb, text) to authenticated;
