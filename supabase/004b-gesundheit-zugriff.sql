-- =====================================================================
-- Coaching App · Schritt 2.4 · Zugang der App zum Gesundheitsbereich
-- Nach 004-gesundheit.sql ausführen.
--
-- Das Schema "gesundheit" wird NICHT über die allgemeine Daten-Schnittstelle
-- freigegeben. Die App erreicht es nur über diese Funktionen.
-- Alle laufen mit den Rechten der anrufenden Person ("security invoker"):
-- Die Zugriffsregeln (RLS) der Tabellen gelten also unverändert.
-- =====================================================================

begin;

-- Anamnese: alle Versionen einer Person (neueste zuerst)
create function public.anamnese_liste(p_athlet uuid)
returns table (id uuid, version integer, fragenversion text, antworten jsonb, erstellt_am timestamptz)
language sql stable security invoker set search_path = '' as $$
  select a.id, a.version, a.fragenversion, a.antworten, a.erstellt_am
  from gesundheit.anamnese a
  where a.athlet_id = p_athlet
  order by a.version desc;
$$;

-- Anamnese speichern: legt eine neue Version an und gibt ihre Nummer zurück
create function public.anamnese_speichern(p_fragenversion text, p_antworten jsonb)
returns integer
language sql volatile security invoker set search_path = '' as $$
  insert into gesundheit.anamnese (fragenversion, antworten)
  values (p_fragenversion, p_antworten)
  returning version;
$$;

-- Eigene Anamnese vollständig löschen (alle Versionen)
create function public.anamnese_loeschen()
returns integer
language plpgsql volatile security invoker set search_path = '' as $$
declare
  anzahl integer;
begin
  delete from gesundheit.anamnese where athlet_id = (select auth.uid());
  get diagnostics anzahl = row_count;
  return anzahl;
end;
$$;

-- Beschwerden einer Person
create function public.beschwerden_liste(p_athlet uuid)
returns table (id uuid, koerperregion text, beschreibung text, seit date, bis date, aktualisiert_am timestamptz)
language sql stable security invoker set search_path = '' as $$
  select b.id, b.koerperregion, b.beschreibung, b.seit, b.bis, b.aktualisiert_am
  from gesundheit.beschwerden b
  where b.athlet_id = p_athlet
  order by (b.bis is null) desc, coalesce(b.seit, b.erstellt_am::date) desc;
$$;

-- Beschwerde anlegen (p_id leer) oder ändern
create function public.beschwerde_speichern(
  p_id uuid, p_koerperregion text, p_beschreibung text, p_seit date, p_bis date
)
returns uuid
language plpgsql volatile security invoker set search_path = '' as $$
declare
  ergebnis uuid;
begin
  if p_id is null then
    insert into gesundheit.beschwerden (koerperregion, beschreibung, seit, bis)
    values (p_koerperregion, coalesce(p_beschreibung, ''), p_seit, p_bis)
    returning id into ergebnis;
  else
    update gesundheit.beschwerden
    set koerperregion = p_koerperregion, beschreibung = coalesce(p_beschreibung, ''),
        seit = p_seit, bis = p_bis
    where id = p_id
    returning id into ergebnis;
    if ergebnis is null then
      raise exception 'Beschwerde nicht gefunden oder nicht erlaubt';
    end if;
  end if;
  return ergebnis;
end;
$$;

create function public.beschwerde_loeschen(p_id uuid)
returns integer
language plpgsql volatile security invoker set search_path = '' as $$
declare
  anzahl integer;
begin
  delete from gesundheit.beschwerden where id = p_id;
  get diagnostics anzahl = row_count;
  return anzahl;
end;
$$;

-- Änderungsprotokoll einer Person
create function public.gesundheit_protokoll(p_athlet uuid)
returns table (zeitpunkt timestamptz, aktion text, tabelle text, durch_selbst boolean)
language sql stable security invoker set search_path = '' as $$
  select p.zeitpunkt, p.aktion, p.tabelle, p.wer = p.athlet_id
  from gesundheit.protokoll p
  where p.athlet_id = p_athlet
  order by p.zeitpunkt desc
  limit 200;
$$;

do $$
declare
  f text;
begin
  foreach f in array array[
    'public.anamnese_liste(uuid)',
    'public.anamnese_speichern(text, jsonb)',
    'public.anamnese_loeschen()',
    'public.beschwerden_liste(uuid)',
    'public.beschwerde_speichern(uuid, text, text, date, date)',
    'public.beschwerde_loeschen(uuid)',
    'public.gesundheit_protokoll(uuid)'
  ] loop
    execute format('revoke all on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
end $$;

commit;

select 'eingerichtet' as ergebnis;
