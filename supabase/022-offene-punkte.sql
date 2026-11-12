-- =====================================================================
-- Coaching App · Phase 18 · Offene Punkte und Tagesbriefing
-- Im SQL Editor EINMAL ausführen, nach 021-video-ampel.sql.
--
-- Offene Punkte werden nicht doppelt gespeichert, sondern aus den Daten
-- berechnet (so kann nichts auseinanderlaufen):
--   ziele        – „Ziele haben sich geändert“, noch nicht gesehen   (hoch)
--   nachricht    – Kommentar an den Coach, noch nicht gesehen          (mittel)
--   checkin      – Wochenabfrage ohne Antwort/„gesehen“; hoch, wenn die
--                  nächste Woche als schwierig angekündigt ist         (mittel/hoch)
--   video        – Video der Person, noch nicht bewertet (Ampel grau)  (mittel)
--   tagesabfrage – neue Tagesabfragen seit dem letzten „gesehen“,
--                  zusammengefasst zu einem Punkt je Person            (niedrig)
--   reha         – Reha-Schmerz über der Grenze, nur mit Einwilligung,
--                  ohne Wert                                           (hoch)
-- Dringlichkeit 1–3; nach 2 Tagen ohne Reaktion eine Stufe höher.
-- Erledigt durch Antwort, Bewertung oder „gesehen“ (punkt_gesehen).
-- =====================================================================

begin;

-- Merker für „gesehen“
alter table public.checkins add column coach_gesehen_am timestamptz;
alter table public.coach_athlet add column tagesabfrage_gesehen_bis date;
alter table gesundheit.reha_schmerz add column coach_gesehen_am timestamptz;

-- Schwellen fürs Tagesbriefing (stellt der Coach selbst ein)
alter table public.coach_einstellungen
  add column schwelle_energie      smallint not null default 2 check (schwelle_energie between 1 and 5),
  add column schwelle_muskelkater  smallint not null default 4 check (schwelle_muskelkater between 1 and 5),
  add column schwelle_schlaf_h     numeric(3, 1) not null default 6 check (schwelle_schlaf_h between 0 and 12),
  add column tage_ohne_training    smallint not null default 7 check (tage_ohne_training between 1 and 60);
grant insert (schwelle_energie, schwelle_muskelkater, schwelle_schlaf_h, tage_ohne_training) on public.coach_einstellungen to authenticated;
grant update (schwelle_energie, schwelle_muskelkater, schwelle_schlaf_h, tage_ohne_training) on public.coach_einstellungen to authenticated;

-- ---------------------------------------------------------------------
-- Berechnung
-- ---------------------------------------------------------------------
create function intern.offene_punkte_fuer(p_coach uuid)
returns table (art text, athlet_id uuid, name text, bezug_id uuid, titel text, seit timestamptz,
               basis smallint, dringlichkeit smallint)
language sql stable security definer set search_path = '' as $$
  with betreut as (
    select ca.athlet_id, ca.tagesabfrage_gesehen_bis
    from public.coach_athlet ca
    where ca.coach_id = p_coach and ca.status in ('aktiv', 'pausiert')
  ),
  roh as (
    select case n.art when 'ziele_geaendert' then 'ziele' else 'nachricht' end as art,
           n.athlet_id, n.id as bezug_id, left(n.text, 120) as titel, n.erstellt_am as seit,
           (case n.art when 'ziele_geaendert' then 3 else 2 end)::smallint as basis
    from public.kunden_nachrichten n join betreut b on b.athlet_id = n.athlet_id
    where n.gesehen_am is null
    union all
    select 'checkin', c.athlet_id, c.id,
           case when c.ausblick_schwierig then 'Wochenabfrage: nächste Woche schwierig' else 'Wochenabfrage abgegeben' end,
           c.erstellt_am, (case when c.ausblick_schwierig then 3 else 2 end)::smallint
    from public.checkins c join betreut b on b.athlet_id = c.athlet_id
    where c.coach_antwort = '' and c.coach_gesehen_am is null
    union all
    select 'video', a.athlet_id, a.id, coalesce(nullif(a.titel, ''), 'Video'), a.erstellt_am, 2::smallint
    from public.analysen a join betreut b on b.athlet_id = a.athlet_id
    where a.bewertung = 'grau' and a.video_geloescht_am is null and a.loeschen_am > now()
      and a.hochgeladen_von <> p_coach and intern.hat_einwilligung(a.athlet_id, 'videos')
    union all
    select 'tagesabfrage', t.athlet_id, null::uuid,
           'Tagesabfrage: ' || count(*) || case when count(*) = 1 then ' neuer Tag' else ' neue Tage' end,
           min(t.erstellt_am), 1::smallint
    from public.tages_checkins t join betreut b on b.athlet_id = t.athlet_id
    where t.datum > coalesce(b.tagesabfrage_gesehen_bis, '-infinity'::date)
    group by t.athlet_id
    union all
    select 'reha', r.athlet_id, r.id, 'Reha-Übung über der Schmerzgrenze', r.erstellt_am, 3::smallint
    from gesundheit.reha_schmerz r join betreut b on b.athlet_id = r.athlet_id
    where r.coach_gesehen_am is null and r.grenze is not null and r.wert > r.grenze
      and intern.hat_einwilligung(r.athlet_id, 'gesundheitsdaten')
  )
  select r.art, r.athlet_id, intern.name_von(r.athlet_id), r.bezug_id, r.titel, r.seit, r.basis,
         least(3, r.basis + case when r.seit < now() - interval '2 days' then 1 else 0 end)::smallint
  from roh r
  order by 8 desc, r.seit;
$$;
revoke all on function intern.offene_punkte_fuer(uuid) from public, anon, authenticated;

-- Für die App: nur der Coach selbst, optional für eine Person
create function public.offene_punkte(p_athlet uuid default null)
returns table (art text, athlet_id uuid, name text, bezug_id uuid, titel text, seit timestamptz,
               basis smallint, dringlichkeit smallint)
language sql stable security definer set search_path = '' as $$
  select o.* from intern.offene_punkte_fuer((select auth.uid())) o
  where intern.ist_coach() and (p_athlet is null or o.athlet_id = p_athlet);
$$;
revoke all on function public.offene_punkte(uuid) from public, anon;
grant execute on function public.offene_punkte(uuid) to authenticated;

-- „Gesehen“ (Videos werden durch die Bewertung erledigt)
create function public.punkt_gesehen(p_art text, p_bezug uuid, p_athlet uuid)
returns void language plpgsql volatile security definer set search_path = '' as $$
begin
  if not intern.ist_coach() or not intern.betreut(p_athlet) then
    raise exception 'Nicht erlaubt.' using errcode = '42501';
  end if;
  case p_art
    when 'nachricht', 'ziele' then
      update public.kunden_nachrichten set gesehen_am = coalesce(gesehen_am, now())
      where id = p_bezug and athlet_id = p_athlet;
    when 'checkin' then
      update public.checkins set coach_gesehen_am = coalesce(coach_gesehen_am, now())
      where id = p_bezug and athlet_id = p_athlet;
    when 'tagesabfrage' then
      update public.coach_athlet set tagesabfrage_gesehen_bis = intern.heute_berlin()
      where coach_id = (select auth.uid()) and athlet_id = p_athlet;
    when 'reha' then
      update gesundheit.reha_schmerz set coach_gesehen_am = coalesce(coach_gesehen_am, now())
      where id = p_bezug and athlet_id = p_athlet;
    else
      raise exception 'Diese Art wird nicht mit „gesehen“ erledigt.' using errcode = '22023';
  end case;
end;
$$;
revoke all on function public.punkt_gesehen(text, uuid, uuid) from public, anon;
grant execute on function public.punkt_gesehen(text, uuid, uuid) to authenticated;

-- ---------------------------------------------------------------------
-- Morgen-Zusammenfassung: eine Zeile „x offene Punkte, davon y dringend“
-- ---------------------------------------------------------------------
create function intern.offene_punkte_hinweise()
returns integer language plpgsql volatile security definer set search_path = '' as $$
declare
  c uuid;
  n integer;
  d integer;
  anzahl integer := 0;
begin
  for c in select distinct coach_id from public.coach_athlet where status in ('aktiv', 'pausiert') loop
    select count(*), count(*) filter (where o.dringlichkeit = 3) into n, d from intern.offene_punkte_fuer(c) o;
    if n > 0 then
      perform intern.benachrichtigen(c, 'zusammenfassung', null, null,
        n || case when n = 1 then ' offener Punkt' else ' offene Punkte' end ||
        case when d > 0 then ', davon ' || d || ' dringend' else '' end || ' – siehe Tagesbriefing.');
      anzahl := anzahl + 1;
    end if;
  end loop;
  return anzahl;
end;
$$;
revoke all on function intern.offene_punkte_hinweise() from public, anon, authenticated;

create or replace function intern.taegliche_pruefung()
returns text language plpgsql volatile security definer set search_path = '' as $$
declare
  e integer;
  z integer;
  c integer;
  h integer;
  o integer;
begin
  e := intern.evaluationen_pruefen(null, now());
  z := intern.zusammenfassung_erstellen();
  h := intern.reha_hinweise_erstellen();
  o := intern.offene_punkte_hinweise();
  c := intern.checkin_erinnern(now());
  delete from public.benachrichtigungen where erstellt_am < now() - interval '90 days';
  return format('Evaluationen: %s, Zusammenfassungen: %s, Reha-Hinweise: %s, Offene Punkte: %s, Erinnerungen: %s', e, z, h, o, c);
end;
$$;
revoke all on function intern.taegliche_pruefung() from public, anon, authenticated;

commit;

select 'eingerichtet' as ergebnis;
