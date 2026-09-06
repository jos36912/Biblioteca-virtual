-- ============================================================
-- Auditoría de seguridad (beta.17): tres correcciones.
--
--  S1 (MEDIA-ALTA)  certifications_public perdió el filtro
--      WHERE c.visibility = 'public' que security-hardening.sql
--      había añadido: update-media-visibility.sql, tech-certifications.sql
--      y multisite.sql recrearon la vista sin él. La vista corre con
--      privilegios del propietario, así que ese WHERE es la ÚNICA
--      barrera ante anon: hoy no hay certs recruiter/private, pero si
--      se crea una, se filtraría al público. Se restaura el filtro.
--
--  S2 (MEDIA)  get_media_asset está grant execute a anon/authenticated
--      y devuelve object_key (la ruta real en R2). Verificado en vivo:
--      con la anon key se obtiene el object_key sin pasar por el Media
--      Gateway (saltándose rate limit y download=1). Se revoca de anon
--      y authenticated y se concede SOLO a service_role: el gateway
--      (contexto de servidor) la invoca con la service role key.
--
--  S3 (BAJA)  access_sessions vencidas nunca se purgan; max_uses
--      cuenta sesiones HISTÓRICAS, así que un token con tope se agota
--      definitivamente. Al validar, se borran primero las sesiones
--      vencidas del token (libera huecos). La RPC se recrea idéntica
--      salvo por esa purga.
--
--  Idempotente: ejecutar en SQL Editor de Supabase.
--  Orden recomendado de despliegue: 1) supabase secrets set
--  SUPABASE_SERVICE_ROLE_KEY + functions deploy media-gateway,
--  2) ejecutar este SQL (ventana mínima de indisponibilidad).
-- ============================================================

-- ============================================================
-- S1: certifications_public con filtro de visibilidad explícito.
-- drop + create (CREATE OR REPLACE no permite cambiar el orden o
-- conjunto de columnas en el medio). Mismas columnas que multisite.sql.
-- ============================================================
drop view if exists certifications_public;
create view certifications_public as
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
left join media_assets m on m.id = c.media_asset_id
where c.visibility = 'public';

grant select on certifications_public to anon, authenticated;

-- ============================================================
-- S2: get_media_asset solo servidor (service_role).
-- El frontend y sync-content.py usan vistas/gateway, no el RPC.
-- ============================================================
revoke execute on function public.get_media_asset(bigint, text) from public, anon, authenticated;
grant execute on function public.get_media_asset(bigint, text) to service_role;

-- ============================================================
-- S3: validate_recruiter_token purga sesiones vencidas del token
-- antes de contar usos (max_uses). Resto del cuerpo idéntico.
-- ============================================================
create or replace function validate_recruiter_token(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_hash text;
  v_token recruiter_tokens%rowtype;
  v_session_token text := encode(gen_random_bytes(32), 'hex');
  v_session_expires timestamptz;
  v_used int;
  v_headers jsonb := nullif(current_setting('request.headers', true), '')::jsonb;
begin
  -- Los tokens se entregan en hex de 32 bytes; el admin los guarda como
  -- SHA-256 de los bytes, así que aquí decodificamos el hex antes de hashear.
  if p_token !~ '^[0-9a-fA-F]{64}$' then
    return jsonb_build_object('ok', false, 'error', 'invalid');
  end if;
  v_hash := encode(digest(decode(p_token, 'hex'), 'sha256'), 'hex');

  select * into v_token
  from recruiter_tokens
  where token_hash = v_hash
    and revoked_at is null
    and (expires_at is null or expires_at > now())
  limit 1;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'invalid');
  end if;

  -- Purga sesiones vencidas de este token: libera huecos de max_uses
  -- y evita que el límite se agote con sesiones históricas expiradas.
  delete from access_sessions
  where token_id = v_token.id and session_expires <= now();

  if v_token.max_uses is not null then
    select count(*) into v_used from access_sessions where token_id = v_token.id;
    if v_used >= v_token.max_uses then
      return jsonb_build_object('ok', false, 'error', 'max_uses');
    end if;
  end if;

  v_session_expires := now() + interval '24 hours';
  if v_token.expires_at is not null and v_token.expires_at < v_session_expires then
    v_session_expires := v_token.expires_at;
  end if;

  update recruiter_tokens set last_used_at = now() where id = v_token.id;

  insert into access_sessions (token_id, session_token_hash, session_expires, ip_hash, user_agent_hash)
  values (
    v_token.id,
    encode(digest(decode(v_session_token, 'hex'), 'sha256'), 'hex'),
    v_session_expires,
    encode(digest(coalesce(v_headers ->> 'x-forwarded-for', ''), 'sha256'), 'hex'),
    encode(digest(coalesce(v_headers ->> 'user-agent', ''), 'sha256'), 'hex')
  );

  return jsonb_build_object(
    'ok', true,
    'session_token', v_session_token,
    'session_expires', to_char(v_session_expires at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
    'scope', v_token.scope
  );
end;
$$;

grant execute on function validate_recruiter_token(text) to anon, authenticated;