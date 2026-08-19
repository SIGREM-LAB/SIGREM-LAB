-- Perfil automatico al dar de alta un usuario en Auth.
--
-- El problema que resuelve: `public.perfil` es lo que dice el rol y el almacen
-- de cada quien, y hasta ahora se creaba a mano. Una cuenta dada de alta desde
-- el dashboard entraba bien pero dejaba la app a medias, porque `usePerfil()`
-- usa `.single()` y ese error se traga en silencio: la persona ve "Hola, " sin
-- nombre y ningun almacen marcado como suyo, sin ninguna pista de por que.
--
-- El sintoma no se parece a la causa, y por eso conviene que sea imposible.

create or replace function private.perfil_para_usuario_nuevo()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.perfil (id, nombre, almacen_id, rol)
  values (
    new.id,
    -- El nombre puede venir en los metadatos del alta. Si no viene, se usa la
    -- parte local del correo como marcador legible: 'ana.lopez@uaeh.edu.mx'
    -- queda como 'ana.lopez', que un admin reconoce y corrige. Dejarlo vacio
    -- obligaria a adivinar quien es cada renglon.
    coalesce(
      nullif(trim(new.raw_user_meta_data ->> 'nombre'), ''),
      nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''),
      split_part(new.email, '@', 1)
    ),
    -- Sin almacen: se lo asigna el admin cuando decide de quien es la cuenta.
    -- La restriccion perfil_responsable_con_almacen no estorba aqui porque
    -- solo exige almacen cuando el rol es 'responsable'.
    null,
    -- El mas restrictivo a proposito. Que un admin tenga que subir el rol a
    -- mano es una molestia de una vez; que alguien nazca pudiendo escribir en
    -- un almacen es un problema que nadie nota hasta que ya paso.
    'consulta'
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

comment on function private.perfil_para_usuario_nuevo() is
  'Crea el perfil de toda cuenta nueva con el rol mas restrictivo. El admin ajusta rol y almacen despues.';

create trigger usuario_nuevo_crea_perfil
  after insert on auth.users
  for each row execute function private.perfil_para_usuario_nuevo();


-- ---------------------------------------------------------------------------
-- Los que ya existian
-- ---------------------------------------------------------------------------
-- El trigger solo cubre altas futuras. Si alguna cuenta se creo antes de esta
-- migracion y quedo sin perfil, se le crea aqui con el mismo criterio; si no
-- hay ninguna, no hace nada.
insert into public.perfil (id, nombre, almacen_id, rol)
select u.id,
       coalesce(
         nullif(trim(u.raw_user_meta_data ->> 'nombre'), ''),
         nullif(trim(u.raw_user_meta_data ->> 'full_name'), ''),
         split_part(u.email, '@', 1)
       ),
       null,
       'consulta'
  from auth.users u
 where not exists (select 1 from public.perfil p where p.id = u.id)
on conflict (id) do nothing;
