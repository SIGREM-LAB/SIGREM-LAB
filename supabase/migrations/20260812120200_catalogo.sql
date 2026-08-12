-- Catalogo: que cosa es. Se siembra con las 2,314 filas de la hoja
-- `Descripciones` (el catalogo oficial UCL) y crece por busqueda difusa.

-- ---------------------------------------------------------------------------
-- Articulo
-- ---------------------------------------------------------------------------
-- Granularidad: sustancia + estado fisico + grado/pureza.
--   "Zinc en polvo 95%" y "Zinc en polvo 93%" son DOS articulos (la pureza
--   cambia la sustancia).
--   Tres frascos de acido succinico de SIGMA, MEYER y RP son UN articulo con
--   tres existencias (la marca vive en existencia).
create table public.articulo (
  id              bigint generated always as identity primary key,
  nombre_canonico text        not null,
  descripcion     text,
  clasificacion   public.clasificacion_articulo not null,

  -- La unidad vive SOLO aqui. Tenerla tambien en existencia invita a que la
  -- misma sustancia se registre en g en un almacen y en kg en otro, y a partir
  -- de ahi ningun total agregado es confiable. Si el mismo articulo se mide en
  -- dos unidades distintas, son dos articulos.
  unidad_base     text        not null,

  -- Los articulos creados por un responsable nacen sin verificar: se usan de
  -- inmediato pero caen en la cola de curacion del admin.
  verificado      boolean     not null default false,
  creado_por      uuid        references public.perfil (id),
  creado_en       timestamptz not null default now()
);

create index articulo_creado_por_idx   on public.articulo (creado_por);
create index articulo_clasificacion_idx on public.articulo (clasificacion);

-- Cola de curacion: solo los no verificados, que son pocos.
create index articulo_sin_verificar_idx on public.articulo (creado_en)
  where not verificado;

create index articulo_nombre_trgm_idx on public.articulo
  using gin (public.norm_texto(nombre_canonico) extensions.gin_trgm_ops);


-- ---------------------------------------------------------------------------
-- Alias
-- ---------------------------------------------------------------------------
-- Cada texto con el que alguien ha nombrado un articulo. El catalogo aprende:
-- entre mas se usa, mejor sugiere. Es la MISMA maquinaria que necesita el ETL
-- para deduplicar las ~5,500 filas de los Excel, y es lo que permite re-correr
-- la migracion sin perder el trabajo humano de decidir que es que.
create table public.articulo_alias (
  id          bigint generated always as identity primary key,
  articulo_id bigint not null references public.articulo (id) on delete cascade,
  texto       text   not null,
  origen      public.origen_alias not null default 'busqueda',
  creado_en   timestamptz not null default now(),
  unique (articulo_id, texto)
);

create index articulo_alias_articulo_id_idx on public.articulo_alias (articulo_id);
create index articulo_alias_texto_trgm_idx  on public.articulo_alias
  using gin (public.norm_texto(texto) extensions.gin_trgm_ops);


-- ---------------------------------------------------------------------------
-- Detalle de reactivos (NOM-005-STPS)
-- ---------------------------------------------------------------------------
-- Extension 1:1 de articulo. Se conservan todos los campos normativos aunque
-- v1 no regenere el formato oficial: recapturarlos despues seria carisimo.
create table public.articulo_reactivo (
  articulo_id             bigint primary key
                          references public.articulo (id) on delete cascade,
  estado_fisico           public.estado_fisico,
  color_almacenamiento    text,
  uso_principal           text,
  requiere_hoja_seguridad boolean,
  caracteristica_fisica   text,
  caracteristica_quimica  text,
  clasificacion_ghs       text,

  -- Rombo NFPA. En el Excel vienen como texto ('Grado 3: Riesgo serio');
  -- el ETL los normaliza a 0-4.
  riesgo_salud            smallint check (riesgo_salud          between 0 and 4),
  riesgo_inflamabilidad   smallint check (riesgo_inflamabilidad between 0 and 4),
  riesgo_reactividad      smallint check (riesgo_reactividad    between 0 and 4),
  peligro_especial        text
);


-- ---------------------------------------------------------------------------
-- Busqueda difusa: buscar-antes-de-crear
-- ---------------------------------------------------------------------------
-- El alta de un articulo pasa obligatoriamente por aqui. Devuelve candidatos
-- ordenados por similitud, buscando tanto en el nombre canonico como en los
-- alias, y quedandose con la mejor coincidencia de cada articulo.
create or replace function public.buscar_articulo(
  termino text,
  umbral  real default 0.3,
  maximo  int  default 10
)
returns table (
  articulo_id     bigint,
  nombre_canonico text,
  clasificacion   public.clasificacion_articulo,
  unidad_base     text,
  verificado      boolean,
  similitud       real,
  coincidio_por   text
)
language sql
stable
set search_path = ''
as $$
  with t as (select public.norm_texto(termino) as q)
  select distinct on (c.articulo_id)
         c.articulo_id, c.nombre_canonico, c.clasificacion,
         c.unidad_base, c.verificado, c.similitud, c.coincidio_por
  from (
    select a.id, a.nombre_canonico, a.clasificacion, a.unidad_base, a.verificado,
           extensions.similarity(public.norm_texto(a.nombre_canonico), t.q) as similitud,
           'nombre' as coincidio_por,
           a.id as articulo_id
    from public.articulo a, t
    where extensions.similarity(public.norm_texto(a.nombre_canonico), t.q) >= umbral

    union all

    select a.id, a.nombre_canonico, a.clasificacion, a.unidad_base, a.verificado,
           extensions.similarity(public.norm_texto(al.texto), t.q) as similitud,
           'alias' as coincidio_por,
           a.id as articulo_id
    from public.articulo_alias al
    join public.articulo a on a.id = al.articulo_id, t
    where extensions.similarity(public.norm_texto(al.texto), t.q) >= umbral
  ) c
  order by c.articulo_id, c.similitud desc
  limit maximo
$$;

comment on function public.buscar_articulo(text, real, int) is
  'Buscar-antes-de-crear. Alimenta el "?Te refieres a alguno de estos?" del alta.';


-- ---------------------------------------------------------------------------
-- Fusion de duplicados
-- ---------------------------------------------------------------------------
-- Cuando el admin detecta que dos articulos son el mismo: reapunta las
-- existencias, conserva el nombre viejo como alias y borra el duplicado.
-- Asi el catalogo se degrada despacio y se limpia solo.
create or replace function public.fusionar_articulo(origen bigint, destino bigint)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not (select private.es_admin()) then
    raise exception 'Solo un administrador puede fusionar articulos';
  end if;

  if origen = destino then
    raise exception 'No se puede fusionar un articulo consigo mismo';
  end if;

  -- El nombre del que se va sobrevive como alias, para que futuras busquedas
  -- por ese texto sigan encontrando el articulo correcto.
  insert into public.articulo_alias (articulo_id, texto, origen)
  select destino, nombre_canonico, 'fusion' from public.articulo where id = origen
  on conflict (articulo_id, texto) do nothing;

  update public.articulo_alias set articulo_id = destino where articulo_id = origen;
  update public.existencia      set articulo_id = destino where articulo_id = origen;

  delete from public.articulo where id = origen;
end;
$$;

revoke execute on function public.fusionar_articulo(bigint, bigint) from anon;
