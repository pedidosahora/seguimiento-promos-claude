-- Promociones, seguimiento por concesión y reglas de edición

create type estado_promocion as enum ('borrador', 'publicada', 'cerrada', 'archivada');
create type estado_seguimiento as enum ('no_entra', 'pendiente', 'acepta', 'rechaza', 'activa');
create type estado_envio as enum ('enviado', 'pending', 'no_hay');
create type revision_cupos as enum ('ninguna', 'semanal', 'quincenal');

create table promociones (
  id uuid primary key default gen_random_uuid(),
  tag text unique not null,
  espacio espacio not null,
  marca marca not null,
  mecanica text,
  objetivo text,
  canal text,
  fecha_inicio date,
  fecha_fin date,
  estado estado_promocion not null default 'borrador',
  umbral_cupos numeric(3, 2) not null default 0.80
    check (umbral_cupos > 0 and umbral_cupos <= 1),
  revision_cupos revision_cupos not null default 'ninguna',
  actualizado_en timestamptz not null default now(),
  constraint promociones_marca_tmicc check (espacio <> 'TMICC' or marca = 'TMICC'),
  constraint promociones_marca_ufs check (espacio <> 'UFS' or marca = 'UFS'),
  constraint promociones_publicable check (
    estado = 'borrador'
    or (mecanica is not null and fecha_inicio is not null and fecha_fin is not null
        and fecha_fin >= fecha_inicio)
  )
);

create table seguimiento (
  id uuid primary key default gen_random_uuid(),
  promocion_id uuid not null references promociones (id) on delete cascade,
  concesion_id int not null references concesiones (id),
  estado estado_seguimiento not null default 'pendiente',
  fecha_aceptacion timestamptz,
  fecha_activacion timestamptz,
  cupos int check (cupos >= 0),
  usos int check (usos >= 0),
  gsv numeric(12, 2) check (gsv >= 0),
  fecha_dato date,
  sms estado_envio not null default 'pending',
  email estado_envio not null default 'pending',
  actualizado_en timestamptz not null default now(),
  unique (promocion_id, concesion_id)
);

create table comentarios (
  id uuid primary key default gen_random_uuid(),
  seguimiento_id uuid not null references seguimiento (id) on delete cascade,
  autor_id uuid references perfiles (id) default (public.mi_perfil()).id,
  texto text not null check (length(texto) > 0),
  creado_en timestamptz not null default now()
);

create index on seguimiento (concesion_id);
create index on comentarios (seguimiento_id);

-- Normalización del tag
create function promociones_normalizar() returns trigger
language plpgsql set search_path = public as $$
begin
  new.tag := upper(trim(new.tag));
  return new;
end
$$;

create trigger promociones_normalizar
before insert or update on promociones
for each row execute function promociones_normalizar();

-- Seguimiento: solo concesiones activas (salvo importación de histórico)
create function seg_solo_activas() returns trigger
language plpgsql set search_path = public as $$
begin
  if coalesce(current_setting('app.origen', true), '') <> 'importacion_historico'
     and not exists (
       select 1 from public.concesiones c where c.id = new.concesion_id and c.activa
     ) then
    raise exception 'La concesión % no está activa', new.concesion_id;
  end if;
  return new;
end
$$;

create trigger seg_solo_activas
before insert on seguimiento
for each row execute function seg_solo_activas();

-- Reglas de edición. Los triggers BEFORE UPDATE se ejecutan por orden alfabético:
-- seg_bloqueo, seg_fechas, seg_tocado.
create function seg_bloqueo() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_promo public.promociones;
begin
  if public.es_admin() then
    return new;
  end if;

  select * into v_promo from public.promociones where id = new.promocion_id;
  if v_promo.id is null
     or v_promo.estado <> 'publicada'
     or not public.puede_editar_concesion(new.concesion_id, v_promo.espacio) then
    raise exception 'Sin permiso para editar esta fila';
  end if;

  if new.usos is distinct from old.usos
     or new.gsv is distinct from old.gsv
     or new.fecha_dato is distinct from old.fecha_dato then
    raise exception 'Usos y GSV solo los modifica administración';
  end if;
  return new;
end
$$;

create function seg_fechas() returns trigger
language plpgsql set search_path = public as $$
begin
  if new.estado = 'acepta' and new.fecha_aceptacion is null then
    new.fecha_aceptacion := now();
  end if;
  if new.estado = 'activa' and new.fecha_activacion is null then
    new.fecha_activacion := now();
  end if;
  return new;
end
$$;

create function seg_tocado() returns trigger
language plpgsql set search_path = public as $$
begin
  new.actualizado_en := now();
  return new;
end
$$;

create trigger seg_bloqueo before update on seguimiento
for each row execute function seg_bloqueo();
create trigger seg_fechas before update on seguimiento
for each row execute function seg_fechas();
create trigger seg_tocado before update on seguimiento
for each row execute function seg_tocado();

revoke execute on function seg_bloqueo(), seg_fechas(), seg_tocado(),
  seg_solo_activas(), promociones_normalizar() from public, anon, authenticated;

-- RLS
alter table promociones enable row level security;
alter table seguimiento enable row level security;
alter table comentarios enable row level security;

create policy promociones_select on promociones for select
  using (es_interno() and (es_admin() or estado <> 'borrador'));
create policy promociones_insert on promociones for insert with check (es_admin());
create policy promociones_update on promociones for update
  using (es_admin()) with check (es_admin());
create policy promociones_delete on promociones for delete using (es_admin());

create policy seguimiento_select on seguimiento for select using (es_interno());
create policy seguimiento_insert on seguimiento for insert with check (es_admin());
create policy seguimiento_update on seguimiento for update
  using (es_interno()) with check (es_interno());
create policy seguimiento_delete on seguimiento for delete using (es_admin());

create policy comentarios_select on comentarios for select using (es_interno());
create policy comentarios_insert on comentarios for insert
  with check (
    es_interno()
    and autor_id = (select id from mi_perfil())
    and exists (
      select 1
      from seguimiento s
      join promociones p on p.id = s.promocion_id
      where s.id = seguimiento_id
        and puede_editar_concesion(s.concesion_id, p.espacio)
    )
  );
