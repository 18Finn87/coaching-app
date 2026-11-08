-- =====================================================================
-- Coaching App · Schritt 2.1 · Einladen und Einladung annehmen
-- Im Supabase SQL Editor des Projekts "coaching-app" EINMAL ausführen,
-- nach 001-fundament.sql.
--
-- Ablauf:
--   1. Der Coach trägt in der App Name + E-Mail ein. Der Server-Baustein
--      "einladen" legt eine Zeile in "einladungen" an und lässt Supabase eine
--      Einladungs-Mail schicken. Dabei entsteht das Konto der Person.
--   2. Beim Entstehen des Kontos verknüpft die Datenbank es automatisch mit
--      dem Coach (Status "eingeladen") und übernimmt den Namen.
--   3. Bei der ersten Anmeldung ruft die App einladung_annehmen() auf:
--      Status wird "aktiv", die Einladung gilt als angenommen.
-- =====================================================================

begin;

-- Name, den der Coach beim Einladen einträgt (optional)
alter table public.einladungen
  add column name text
  check (name is null or (char_length(name) between 1 and 80 and name = btrim(name)));

grant insert (email, gueltig_bis, name) on public.einladungen to authenticated;

-- Neues Konto: Profil anlegen und offene Einladungen verknüpfen
create or replace function intern.profil_anlegen()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  einladungsname text;
begin
  select e.name into einladungsname
  from public.einladungen e
  where e.email = lower(new.email) and e.angenommen_am is null
    and e.gueltig_bis > now() and e.name is not null
  order by e.erstellt_am desc
  limit 1;

  insert into public.profile (id, anzeigename)
  values (
    new.id,
    coalesce(einladungsname, left(btrim(split_part(coalesce(new.email, ''), '@', 1)), 80))
  )
  on conflict (id) do nothing;

  insert into public.coach_athlet (coach_id, athlet_id, status)
  select distinct e.coach_id, new.id, 'eingeladen'::public.beziehung_status
  from public.einladungen e
  where e.email = lower(new.email) and e.angenommen_am is null and e.gueltig_bis > now()
  on conflict (coach_id, athlet_id) do nothing;

  return new;
end;
$$;

-- Erste Anmeldung: Einladung annehmen (die App ruft das nach jeder Anmeldung auf)
create function public.einladung_annehmen()
returns integer language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  mail text;
  anzahl integer;
begin
  if uid is null then
    return 0;
  end if;
  select lower(email) into mail from auth.users where id = uid;

  update public.einladungen
  set angenommen_am = now(), angenommen_von = uid
  where email = mail and angenommen_am is null;

  update public.coach_athlet
  set status = 'aktiv'
  where athlet_id = uid and status = 'eingeladen';
  get diagnostics anzahl = row_count;

  return anzahl;
end;
$$;

revoke all on function public.einladung_annehmen() from public, anon;
grant execute on function public.einladung_annehmen() to authenticated;

commit;
