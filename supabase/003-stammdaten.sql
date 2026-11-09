-- =====================================================================
-- Coaching App · Schritt 2.3 · Stammdaten (trainingsrelevant, KEINE Gesundheitsdaten)
-- Im SQL Editor EINMAL ausführen, nach 002-einladungen.sql.
--
-- Die Athletin / der Athlet trägt selbst ein, der Coach liest.
-- Speichern nur mit gültiger Einwilligung zur Nutzung.
-- Erfahrungsstufe und Status der Betreuung legt der Coach in coach_athlet fest.
-- =====================================================================

begin;

create table public.athlet_stammdaten (
  athlet_id          uuid primary key references public.profile (id) on delete cascade,
  geburtsjahr        smallint check (geburtsjahr between 1920 and 2015),
  training_seit      smallint check (training_seit between 1950 and 2100),
  ziele              text[] not null default '{}'
                     check (ziele <@ array['kraft', 'muskelaufbau', 'fettabbau', 'gesundheit',
                                           'sportart', 'beweglichkeit', 'ausdauer', 'reha']::text[]),
  ziel_text          text not null default '' check (char_length(ziel_text) <= 500),
  trainingstage      smallint[] not null default '{}'
                     check (trainingstage <@ array[1, 2, 3, 4, 5, 6, 7]::smallint[]),
  einheit_minuten    smallint check (einheit_minuten between 15 and 240),
  ausstattung        text[] not null default '{}'
                     check (ausstattung <@ array['studio', 'zuhause_basis', 'zuhause_hanteln',
                                                 'draussen', 'kurzhanteln', 'langhantel',
                                                 'kabelzug', 'baender']::text[]),
  aktualisiert_am    timestamptz not null default now()
);
comment on table public.athlet_stammdaten is 'Trainingsrelevante Angaben der Athletin / des Athleten. Keine Gesundheitsdaten.';

create function intern.aktualisiert_setzen()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.aktualisiert_am := now();
  return new;
end;
$$;

create trigger stammdaten_aktualisiert
  before insert or update on public.athlet_stammdaten
  for each row execute function intern.aktualisiert_setzen();

alter table public.athlet_stammdaten enable row level security;
revoke all on public.athlet_stammdaten from anon, authenticated;

grant select on public.athlet_stammdaten to authenticated;
grant insert (athlet_id, geburtsjahr, training_seit, ziele, ziel_text, trainingstage, einheit_minuten, ausstattung)
  on public.athlet_stammdaten to authenticated;
grant update (geburtsjahr, training_seit, ziele, ziel_text, trainingstage, einheit_minuten, ausstattung)
  on public.athlet_stammdaten to authenticated;
grant delete on public.athlet_stammdaten to authenticated;

create policy stammdaten_lesen on public.athlet_stammdaten
  for select to authenticated
  using (athlet_id = (select auth.uid()) or intern.betreut(athlet_id));

create policy stammdaten_anlegen on public.athlet_stammdaten
  for insert to authenticated
  with check (athlet_id = (select auth.uid()) and intern.hat_einwilligung((select auth.uid()), 'nutzung'));

create policy stammdaten_aendern on public.athlet_stammdaten
  for update to authenticated
  using (athlet_id = (select auth.uid()))
  with check (athlet_id = (select auth.uid()) and intern.hat_einwilligung((select auth.uid()), 'nutzung'));

create policy stammdaten_loeschen on public.athlet_stammdaten
  for delete to authenticated
  using (athlet_id = (select auth.uid()));

commit;

select 'eingerichtet' as ergebnis;
