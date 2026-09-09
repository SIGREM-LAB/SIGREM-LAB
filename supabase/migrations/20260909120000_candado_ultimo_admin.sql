-- Candado del ultimo administrador.
--
-- El problema: la politica `perfil_admin` deja a un admin escribir cualquier
-- renglon de perfil, el suyo incluido. Desde la pantalla de usuarios un admin
-- puede bajarse el rol a 'consulta' con dos clics. Si era el ultimo, ya nadie
-- puede administrar usuarios ni volver a subir el rol de nadie —para eso hace
-- falta ser admin— y el sistema queda sin salida: se arregla desde el
-- dashboard de Supabase o con SQL a mano, nunca desde la app.
--
-- Es un error de un solo clic con consecuencia irreversible desde dentro. La
-- clase de cosa que conviene que sea imposible, no que este documentada.
--
-- Por que trigger y no `check` ni `with check`: los dos miran UN renglon y
-- aqui la pregunta es cuantos admins quedan en la tabla. Un `with check` con
-- subconsulta a perfil ademas recursaria por su propia politica, que es lo
-- mismo que ya evitan los helpers de `private`.

create or replace function private.exigir_admin_sobreviviente()
returns trigger
language plpgsql
-- `security definer` por dos razones. Una: cuenta admins sin pasar por la RLS
-- de perfil, asi que no recursa. Dos: este trigger tambien se dispara cuando
-- auth.users borra en cascada, y ese borrado lo hace `supabase_auth_admin`, un
-- rol que no tiene ni usage sobre el esquema `private`.
security definer
set search_path = ''
as $$
begin
  if exists (
    select 1 from public.perfil where rol = 'admin' and id <> old.id
  ) then
    return case when tg_op = 'DELETE' then old else new end;
  end if;

  raise exception
    'El sistema se quedaria sin administradores'
    using hint = 'Sube a admin a alguien mas antes de quitarte el rol o de borrar esta cuenta';
end;
$$;

comment on function private.exigir_admin_sobreviviente() is
  'Impide que desaparezca el ultimo perfil con rol admin, sea por cambio de rol o por borrado.';

-- Dos triggers y una sola funcion. La clausula `when` deja fuera de la
-- evaluacion todo update que no toque el rol, que son casi todos: cambiar el
-- nombre o el almacen de alguien no cuesta una consulta de mas.
create trigger perfil_conserva_un_admin_al_actualizar
  before update on public.perfil
  for each row
  when (old.rol = 'admin' and new.rol is distinct from 'admin')
  execute function private.exigir_admin_sobreviviente();

create trigger perfil_conserva_un_admin_al_borrar
  before delete on public.perfil
  for each row
  when (old.rol = 'admin')
  execute function private.exigir_admin_sobreviviente();
