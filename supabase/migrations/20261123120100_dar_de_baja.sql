-- Dar de baja una existencia y poder reactivarla.
--
-- El esquema ya tenia las dos mitades sueltas: `estado_existencia` y
-- `tipo_movimiento` traen `baja` desde el 18 de agosto, y todas las consultas
-- (inventario, practicas, resumen, reposicion, caducidades, formato NOM)
-- esconden lo que esta en `baja`. Lo que faltaba es que algo lo pusiera ahi:
-- un movimiento de tipo `baja` le restaba el saldo y el trigger lo dejaba en
-- `agotado`, porque `estado_calculado` solo conserva `baja` si ya lo estaba.
--
-- Decisiones (sesion del 23 de noviembre de 2026):
--   - La baja es un MOVIMIENTO de tipo `baja`, no un cambio de estado suelto:
--     asi queda quien, cuando y por que, y los reportes ven salir el saldo.
--   - Siempre es el frasco completo. Sacar una parte ya tiene nombre: consumo
--     o merma.
--   - Un frasco vacio tambien se da de baja, con un movimiento de cero.
--   - Se puede deshacer, y lo puede hacer el mismo responsable del almacen,
--     no solo el admin: con un movimiento de tipo `reactivacion`.
--
-- Quien puede: no hay politica nueva. Las dos operaciones son un INSERT en
-- `movimiento`, y `movimiento_alta` ya exige `puede_escribir()` y el almacen
-- propio (o admin). Por eso no se hizo un RPC: seria una segunda puerta con
-- la misma regla, que habria que mantener igual a la primera.


-- ---------------------------------------------------------------------------
-- Movimientos de cero, solo para baja y reactivacion
-- ---------------------------------------------------------------------------
-- La regla sigue valiendo para todo lo demas: un consumo de cero no es nada.
alter table public.movimiento
  drop constraint movimiento_cantidad_no_cero;

alter table public.movimiento
  add constraint movimiento_cantidad_no_cero
  check (cantidad <> 0 or tipo in ('baja', 'reactivacion'));


-- ---------------------------------------------------------------------------
-- El trigger decide la cantidad de una baja y de una reactivacion
-- ---------------------------------------------------------------------------
-- En esos dos tipos la cantidad NO la decide el cliente, igual que
-- `almacen_id` o `cantidad_antes`: la baja es todo lo que hay, leido bajo el
-- `for update`, y la reactivacion devuelve lo que se llevo la ultima baja.
-- Si el cliente la decidiera, un saldo leido hace un minuto dejaria una baja
-- a medias, o una reactivacion podria inventar existencia.
--
-- Y sobre algo dado de baja no se registra nada mas: un consumo o una entrada
-- en un frasco que ya no esta en el almacen es un error de dedo, y el mensaje
-- dice como salir de ahi.
create or replace function private.aplicar_movimiento()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  saldo   numeric(14,4);
  minimo  numeric(14,4);
  alm     bigint;
  edo     public.estado_existencia;
  nuevo   numeric(14,4);
  devolver numeric(14,4);
begin
  -- `for update` bloquea la fila: sin esto, dos movimientos simultaneos leen
  -- el mismo saldo y uno de los dos se pierde.
  select cantidad, cantidad_minima, almacen_id, estado
    into saldo, minimo, alm, edo
    from public.existencia
   where id = new.existencia_id
     for update;

  if not found then
    raise exception 'La existencia % no existe', new.existencia_id;
  end if;

  if new.tipo = 'baja' then
    if edo = 'baja' then
      raise exception 'Esta existencia ya está dada de baja';
    end if;
    new.cantidad := -saldo;

  elsif new.tipo = 'reactivacion' then
    if edo <> 'baja' then
      raise exception 'Esta existencia no está dada de baja: no hay nada que reactivar';
    end if;
    -- Por id y no por fecha: `ocurrido_en` admite fechas pasadas, el id no.
    -- Sin baja registrada (un estado puesto a mano o desde el ETL) no hay
    -- nada que devolver, y vuelve con el saldo que tenga.
    select -m.cantidad
      into devolver
      from public.movimiento m
     where m.existencia_id = new.existencia_id
       and m.tipo = 'baja'
     order by m.id desc
     limit 1;
    new.cantidad := coalesce(devolver, 0);

  elsif edo = 'baja' then
    raise exception
      'Esta existencia está dada de baja: reactívala antes de registrarle movimientos';
  end if;

  nuevo := saldo + new.cantidad;

  if nuevo < 0 then
    raise exception
      'El movimiento dejaria la existencia % en %; la cantidad no puede ser negativa',
      new.existencia_id, nuevo;
  end if;

  -- Los campos que el cliente NO decide.
  new.almacen_id       := alm;
  new.cantidad_antes   := saldo;
  new.cantidad_despues := nuevo;
  new.usuario_id       := coalesce(new.usuario_id, (select auth.uid()));

  update public.existencia
     set cantidad = nuevo,
         -- `estado_calculado` conserva un estado puesto a mano, y `baja` es
         -- uno de ellos: al reactivar se le pasa `disponible` para que
         -- recalcule desde cero en vez de devolver `baja` otra vez.
         estado   = case new.tipo
                      when 'baja' then 'baja'::public.estado_existencia
                      when 'reactivacion'
                        then private.estado_calculado(nuevo, minimo, 'disponible')
                      else private.estado_calculado(nuevo, minimo, edo)
                    end
   where id = new.existencia_id;

  return new;
end;
$$;
