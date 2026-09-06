-- ============================================================
-- FASE 1 (milestone 0.10.0): sitios multiperfil por "context".
--
-- Modelo: cada fila lleva un context = 'tech' | 'trayectoria' | 'ambos'.
-- profile/contact dejan de ser single-row (check id = 1) y pasan a tener
-- una fila por sitio (id 1 = tech, id 2 = trayectoria). Las tablas de
-- listas (experience, education, projects, skills, certifications)
-- ganan la columna context con default 'ambos'.
--
-- IMPORTANTE: el context es PRESENTACIÓN, no frontera de seguridad.
-- RLS sigue filtrando por visibility ('public'/'recruiter'/'private');
-- cada sitio filtra por context del lado del cliente.
--
-- Aplica sobre schema.sql + security-hardening.sql. Idempotente.
-- ============================================================

do $$ begin
  create type content_context as enum ('tech', 'trayectoria', 'ambos');
exception when duplicate_object then null;
end $$;

-- Columna context en todas las tablas de contenido.
alter table profile add column if not exists context content_context not null default 'ambos';
alter table contact add column if not exists context content_context not null default 'ambos';
alter table experience add column if not exists context content_context not null default 'ambos';
alter table education add column if not exists context content_context not null default 'ambos';
alter table projects add column if not exists context content_context not null default 'ambos';
alter table skills add column if not exists context content_context not null default 'ambos';
alter table certifications add column if not exists context content_context not null default 'ambos';

-- Quita la restricción single-row (id = 1) de profile y contact.
do $$
declare
  c record;
begin
  for c in select conname from pg_constraint
    where conrelid = 'profile'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) like '%id = 1%'
  loop
    execute format('alter table profile drop constraint %I', c.conname);
  end loop;
end $$;

do $$
declare
  c record;
begin
  for c in select conname from pg_constraint
    where conrelid = 'contact'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) like '%id = 1%'
  loop
    execute format('alter table contact drop constraint %I', c.conname);
  end loop;
end $$;

-- Sin default para evitar colisiones de id al insertar nuevas filas por sitio.
alter table profile alter column id drop default;
alter table contact alter column id drop default;

-- La fila existente (id 1) pertenece al sitio tech.
update profile set context = 'tech' where id = 1;
update contact set context = 'tech' where id = 1;

-- Fila de trayectoria (placeholder; se edita desde admin en F3).
insert into profile (id, context, name, role, tagline, photo, location, summary, highlights) values (
  2, 'trayectoria',
  'Tu Nombre',
  'Tu rol profesional',
  'Frase de tu recorrido: en qué te especializas y qué aportas.',
  '',
  '',
  array[
    'Párrafo sobre tu trayectoria: formación, sectores y evolución.',
    'Segundo párrafo opcional: logros acumulados y visión profesional.'
  ],
  array[
    'Hito profesional 1',
    'Hito profesional 2',
    'Hito profesional 3'
  ]
) on conflict (id) do nothing;

insert into contact (id, context, email, github, linkedin, website, message) values (
  2, 'trayectoria',
  'tucorreo@ejemplo.com',
  '',
  '',
  '',
  'Texto invitando a contactarte por colaboraciones profesionales.'
) on conflict (id) do nothing;

-- Las filas existentes de listas quedan 'ambos' (default): visibles en ambos sitios.
create index if not exists idx_experience_context on experience(context);
create index if not exists idx_education_context on education(context);
create index if not exists idx_projects_context on projects(context);
create index if not exists idx_skills_context on skills(context);
create index if not exists idx_certifications_context on certifications(context);

-- ============================================================
-- Vistas públicas: ahora exponen context para que cada sitio filtre.
-- RLS sin cambios: anon sigue viendo solo filas 'public'.
-- ============================================================

create or replace view profile_public as
select
  id,
  context,
  case when name_visibility = 'public' then name else null end as name,
  case when role_visibility = 'public' then role else null end as role,
  case when tagline_visibility = 'public' then tagline else null end as tagline,
  case when photo_visibility = 'public' then photo else null end as photo,
  case when location_visibility = 'public' then location else null end as location,
  case when summary_visibility = 'public' then summary else '{}' end as summary,
  case when highlights_visibility = 'public' then highlights else '{}' end as highlights
from profile;

create or replace view contact_public as
select
  id,
  context,
  case when email_visibility = 'public' then email else null end as email,
  case when github_visibility = 'public' then github else null end as github,
  case when linkedin_visibility = 'public' then linkedin else null end as linkedin,
  case when website_visibility = 'public' then website else null end as website,
  case when message_visibility = 'public' then message else null end as message
from contact;

create or replace view certifications_public as
select
  c.id,
  c.context,
  c.title,
  c.issuer,
  c.date,
  c.description,
  null::text as credential_id,
  c.visibility,
  c.media_asset_id,
  m.type as media_type,
  m.name as media_name,
  m.visibility as media_visibility,
  c.tech
from certifications c
left join media_assets m on m.id = c.media_asset_id;

grant select on profile_public to anon, authenticated;
grant select on contact_public to anon, authenticated;
grant select on certifications_public to anon, authenticated;

-- ============================================================
-- get_recruiter_content: profile/contact ahora se devuelven como
-- ARRAYS (una fila por sitio) y todas las listas incluyen context.
-- El front-end resuelve la fila del contexto activo; el context no
-- interviene en la seguridad (sigue siendo visibility).
-- ============================================================

create or replace function get_recruiter_content(p_session_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session access_sessions%rowtype;
  v_token recruiter_tokens%rowtype;
begin
  if p_session_token !~ '^[0-9a-fA-F]{64}$' then
    return jsonb_build_object('ok', false, 'error', 'expired');
  end if;

  select * into v_session
  from access_sessions
  where session_token_hash = encode(digest(decode(p_session_token, 'hex'), 'sha256'), 'hex')
    and session_expires > now()
  limit 1;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'expired');
  end if;

  select * into v_token from recruiter_tokens where id = v_session.token_id;
  if not found or v_token.revoked_at is not null then
    return jsonb_build_object('ok', false, 'error', 'revoked');
  end if;

  return jsonb_build_object(
    'ok', true,
    'scope', v_token.scope,
    'experience', (select coalesce(jsonb_agg(to_jsonb(x) order by x.id), '[]'::jsonb) from (
        select id, context, role, company, period, summary, tech, visibility
        from experience where visibility in ('public', 'recruiter')) x),
    'education', (select coalesce(jsonb_agg(to_jsonb(x) order by x.id), '[]'::jsonb) from (
        select id, context, degree, institution, period, notes, visibility
        from education where visibility in ('public', 'recruiter')) x),
    'projects', (select coalesce(jsonb_agg(to_jsonb(x) order by x.id), '[]'::jsonb) from (
        select id, context, title, description, tech, repo, demo, visibility
        from projects where visibility in ('public', 'recruiter')) x),
    'skills', (select coalesce(jsonb_agg(to_jsonb(x) order by x.id), '[]'::jsonb) from (
        select id, context, category, items, visibility
        from skills where visibility in ('public', 'recruiter')) x),
    'certifications', (select coalesce(jsonb_agg(to_jsonb(x) order by x.id), '[]'::jsonb) from (
        select c.id, c.context, c.title, c.issuer, c.date, c.description, c.credential_id, c.tech, c.visibility, c.media_asset_id,
               m.type as media_type, m.name as media_name, m.visibility as media_visibility
        from certifications c
        left join media_assets m on m.id = c.media_asset_id
        where c.visibility in ('public', 'recruiter')) x),
    'profile', (select coalesce(jsonb_agg(to_jsonb(x) order by x.id), '[]'::jsonb) from (
        select id, context,
          case when name_visibility in ('public', 'recruiter') then name else null end as name,
          case when role_visibility in ('public', 'recruiter') then role else null end as role,
          case when tagline_visibility in ('public', 'recruiter') then tagline else null end as tagline,
          case when photo_visibility in ('public', 'recruiter') then photo else null end as photo,
          case when location_visibility in ('public', 'recruiter') then location else null end as location,
          case when summary_visibility in ('public', 'recruiter') then summary else '{}' end as summary,
          case when highlights_visibility in ('public', 'recruiter') then highlights else '{}' end as highlights
        from profile) x),
    'contact', (select coalesce(jsonb_agg(to_jsonb(x) order by x.id), '[]'::jsonb) from (
        select id, context,
          case when email_visibility in ('public', 'recruiter') then email else null end as email,
          case when github_visibility in ('public', 'recruiter') then github else null end as github,
          case when linkedin_visibility in ('public', 'recruiter') then linkedin else null end as linkedin,
          case when website_visibility in ('public', 'recruiter') then website else null end as website,
          case when message_visibility in ('public', 'recruiter') then message else null end as message
        from contact) x)
  );
end;
$$;

grant execute on function get_recruiter_content(text) to anon, authenticated;