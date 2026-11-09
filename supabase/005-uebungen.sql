-- =====================================================================
-- Coaching App · Schritt 3.1 · Übungsbibliothek
-- Im SQL Editor EINMAL ausführen, nach 004b-gesundheit-zugriff.sql.
--
-- Jede Übung gehört dem Coach, der sie angelegt hat. Athletinnen und Athleten
-- dürfen die Übungen ihres Coaches lesen (für ihren Plan), aber nichts ändern.
-- Übungen werden nie gelöscht, nur archiviert – sonst würde alte
-- Trainingshistorie ins Leere zeigen.
-- "modul" bereitet spätere Bereiche vor (Ausdauer, Intervalle, Reha …).
-- =====================================================================

begin;

create table public.uebungen (
  id               uuid primary key default gen_random_uuid(),
  coach_id         uuid not null default auth.uid() references public.profile (id) on delete cascade,
  name             text not null check (char_length(name) between 1 and 80 and name = btrim(name)),
  modul            text not null default 'kraft'
                   check (modul in ('kraft', 'ausdauer', 'intervall', 'reha', 'athletik', 'mobilitaet', 'biomechanik')),
  bewegungsmuster  text not null default 'sonstiges'
                   check (bewegungsmuster in ('kniebeuge', 'hueftstreckung', 'ausfallschritt',
                                              'druecken_horizontal', 'druecken_vertikal',
                                              'ziehen_horizontal', 'ziehen_vertikal',
                                              'rumpf', 'tragen', 'isolation', 'sonstiges')),
  muskelgruppen    text[] not null default '{}'
                   check (muskelgruppen <@ array['brust', 'ruecken_oben', 'latissimus', 'schultern',
                                                 'bizeps', 'trizeps', 'unterarme', 'bauch',
                                                 'unterer_ruecken', 'gesaess', 'quadrizeps',
                                                 'beinbeuger', 'adduktoren', 'waden']::text[]),
  ausstattung      text[] not null default '{}'
                   check (ausstattung <@ array['langhantel', 'kurzhantel', 'kettlebell', 'maschine',
                                               'kabelzug', 'koerpergewicht', 'baender', 'sonstiges']::text[]),
  einseitig        boolean not null default false,
  messart          text not null default 'wdh_last'
                   check (messart in ('wdh_last', 'wdh', 'zeit', 'zeit_last', 'distanz', 'distanz_last')),
  e1rm_geeignet    boolean not null default false,
  beschreibung     text not null default '' check (char_length(beschreibung) <= 2000),
  video_link       text check (video_link is null or (video_link ~ '^https://' and char_length(video_link) <= 500)),
  archiviert       boolean not null default false,
  erstellt_am      timestamptz not null default now(),
  aktualisiert_am  timestamptz not null default now()
);
create unique index uebungen_name_eindeutig on public.uebungen (coach_id, lower(name));
comment on table public.uebungen is 'Übungsbibliothek des Coaches. Nie löschen, nur archivieren.';

create trigger uebungen_aktualisiert
  before insert or update on public.uebungen
  for each row execute function intern.aktualisiert_setzen();

alter table public.uebungen enable row level security;
revoke all on public.uebungen from anon, authenticated;

grant select on public.uebungen to authenticated;
grant insert (name, modul, bewegungsmuster, muskelgruppen, ausstattung, einseitig, messart,
              e1rm_geeignet, beschreibung, video_link)
  on public.uebungen to authenticated;
grant update (name, modul, bewegungsmuster, muskelgruppen, ausstattung, einseitig, messart,
              e1rm_geeignet, beschreibung, video_link, archiviert)
  on public.uebungen to authenticated;

create policy uebungen_lesen on public.uebungen
  for select to authenticated
  using (coach_id = (select auth.uid()) or intern.ist_mein_coach(coach_id));

create policy uebungen_anlegen on public.uebungen
  for insert to authenticated
  with check (coach_id = (select auth.uid()) and intern.ist_coach());

create policy uebungen_aendern on public.uebungen
  for update to authenticated
  using (coach_id = (select auth.uid()) and intern.ist_coach())
  with check (coach_id = (select auth.uid()));

commit;

select 'eingerichtet' as ergebnis;
