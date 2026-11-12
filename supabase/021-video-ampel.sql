-- =====================================================================
-- Coaching App · Phase 17 · Ampel für Übungsvideos
-- Im SQL Editor EINMAL ausführen, nach 020-wochenausblick.sql.
--
-- * public.analysen bekommt: bewertung (grau = noch nicht bewertet, gruen,
--   orange, rot), bewertung_kommentar, bewertet_am.
-- * Nur der eigene Coach bewertet (Funktion analyse_bewerten). Orange und Rot
--   heißen „bitte neu aufnehmen“. Die Person bekommt einen Hinweis.
-- * Bewertet wird von Hand – die App erkennt nichts automatisch.
-- =====================================================================

begin;

alter table public.analysen
  add column bewertung           text not null default 'grau' check (bewertung in ('grau', 'gruen', 'orange', 'rot')),
  add column bewertung_kommentar text not null default '' check (char_length(bewertung_kommentar) <= 1000),
  add column bewertet_am         timestamptz;
comment on column public.analysen.bewertung is 'Ampel des Coachs: grau = noch nicht bewertet, gruen = gut, orange = verbesserungsbedürftig, rot = nicht korrekt.';

create function public.analyse_bewerten(p_analyse uuid, p_bewertung text, p_kommentar text)
returns void language plpgsql volatile security definer set search_path = '' as $$
declare
  a uuid;
  k text := left(btrim(coalesce(p_kommentar, '')), 1000);
begin
  select athlet_id into a from public.analysen where id = p_analyse;
  if a is null or not intern.ist_coach() or not intern.betreut(a) then
    raise exception 'Nicht erlaubt.' using errcode = '42501';
  end if;
  if p_bewertung not in ('grau', 'gruen', 'orange', 'rot') then
    raise exception 'Unbekannte Bewertung.' using errcode = '22023';
  end if;
  update public.analysen
  set bewertung = p_bewertung,
      bewertung_kommentar = k,
      bewertet_am = case when p_bewertung = 'grau' then null else now() end
  where id = p_analyse;
  if p_bewertung <> 'grau' then
    perform intern.benachrichtigen(a, 'video_bewertet', a, p_analyse,
      case p_bewertung
        when 'gruen' then 'Dein Coach hat dein Video bewertet: gute Ausführung.'
        when 'orange' then 'Dein Coach hat dein Video bewertet: bitte verbessern und neu aufnehmen.'
        else 'Dein Coach hat dein Video bewertet: so nicht korrekt – bitte neu aufnehmen.'
      end);
  end if;
end;
$$;
revoke all on function public.analyse_bewerten(uuid, text, text) from public, anon;
grant execute on function public.analyse_bewerten(uuid, text, text) to authenticated;

do $$
declare
  c record;
begin
  for c in
    select conname from pg_constraint
    where conrelid = 'public.benachrichtigungen'::regclass and contype = 'c' and pg_get_constraintdef(oid) like '%art%'
  loop
    execute format('alter table public.benachrichtigungen drop constraint %I', c.conname);
  end loop;
end $$;
alter table public.benachrichtigungen
  add constraint benachrichtigungen_art_check
  check (art in ('checkin_neu', 'checkin_antwort', 'checkin_erinnerung', 'evaluation_faellig', 'zusammenfassung',
                 'reha_hinweis', 'nachricht_antwort', 'video_bewertet'));

commit;

select 'eingerichtet' as ergebnis;
