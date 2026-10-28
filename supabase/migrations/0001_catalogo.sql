-- Catálogo, perfiles y permisos base

create type rol_usuario as enum ('admin', 'kam', 'socio');
create type espacio as enum ('TMICC', 'UFS', 'CAMPANAS');
create type marca as enum ('TMICC', 'UFS');

create table territorios (
  id serial primary key,
  nombre text unique not null
);

create table perfiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid unique references auth.users (id) on delete set null,
  email text unique not null,
  nombre text unique not null,
  rol rol_usuario not null,
  activo boolean not null default true,
  constraint perfiles_interno_pro_agency
    check (rol = 'socio' or lower(email) like '%@pro.agency')
);

create table concesiones (
  id int primary key,
  razon_social text not null,
  nombre_comercial text,
  kam_id uuid references perfiles (id),
  territorio_id int references territorios (id),
  activa boolean not null default true,
  actualizado_en timestamptz not null default now()
);

create table permisos_extra (
  id uuid primary key default gen_random_uuid(),
  perfil_id uuid not null references perfiles (id) on delete cascade,
  concesion_id int references concesiones (id) on delete cascade,
  espacio espacio,
  caduca date,
  constraint permisos_extra_uno_solo
    check ((concesion_id is null) <> (espacio is null))
);

create index on concesiones (kam_id);
create index on permisos_extra (perfil_id);

-- Funciones de permisos
create function mi_perfil() returns perfiles
language sql stable security definer set search_path = public as $$
  select * from public.perfiles
  where user_id = auth.uid() and activo
  limit 1
$$;

create function es_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select rol = 'admin' from public.mi_perfil()), false)
$$;

create function es_interno() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select rol in ('admin', 'kam') from public.mi_perfil()), false)
$$;

create function puede_editar_concesion(p_concesion int, p_espacio espacio)
returns boolean
language sql stable security definer set search_path = public as $$
  select
    public.es_admin()
    or exists (
      select 1 from public.concesiones c
      where c.id = p_concesion and c.kam_id = (select id from public.mi_perfil())
    )
    or exists (
      select 1 from public.permisos_extra x
      where x.perfil_id = (select id from public.mi_perfil())
        and (x.concesion_id = p_concesion or x.espacio = p_espacio)
        and (x.caduca is null or x.caduca >= current_date)
    )
$$;

revoke all on function mi_perfil(), es_admin(), es_interno(), puede_editar_concesion(int, espacio) from public, anon;
grant execute on function mi_perfil(), es_admin(), es_interno(), puede_editar_concesion(int, espacio)
  to authenticated, service_role;

-- Vinculación de perfil: solo con email confirmado (evita suplantar admin@pro.agency)
create function vincular_perfil() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.email_confirmed_at is not null then
    update public.perfiles set user_id = new.id
    where lower(email) = lower(new.email) and user_id is null;
  end if;
  return new;
end
$$;

create trigger vincular_perfil_al_crear_usuario
after insert or update of email_confirmed_at on auth.users
for each row execute function vincular_perfil();

-- Invitaciones tardías: perfil creado cuando el usuario ya existe y está confirmado
create function vincular_usuario_existente() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.user_id is null then
    select u.id into new.user_id from auth.users u
    where lower(u.email) = lower(new.email) and u.email_confirmed_at is not null
    limit 1;
  end if;
  return new;
end
$$;

create trigger vincular_usuario_existente_al_crear_perfil
before insert on perfiles
for each row execute function vincular_usuario_existente();

revoke execute on function vincular_perfil(), vincular_usuario_existente() from public, anon, authenticated;

-- RLS
alter table territorios enable row level security;
alter table perfiles enable row level security;
alter table concesiones enable row level security;
alter table permisos_extra enable row level security;

create policy territorios_select on territorios for select using (es_interno());
create policy territorios_insert on territorios for insert with check (es_admin());
create policy territorios_update on territorios for update using (es_admin()) with check (es_admin());
create policy territorios_delete on territorios for delete using (es_admin());

create policy perfiles_select on perfiles for select using (es_interno());
create policy perfiles_insert on perfiles for insert with check (es_admin());
create policy perfiles_update on perfiles for update using (es_admin()) with check (es_admin());
create policy perfiles_delete on perfiles for delete using (es_admin());

create policy concesiones_select on concesiones for select using (es_interno());
create policy concesiones_insert on concesiones for insert with check (es_admin());
create policy concesiones_update on concesiones for update using (es_admin()) with check (es_admin());
create policy concesiones_delete on concesiones for delete using (es_admin());

create policy permisos_extra_admin on permisos_extra for all
  using (es_admin()) with check (es_admin());
create policy permisos_extra_propios on permisos_extra for select
  using (perfil_id = (select id from mi_perfil()));
