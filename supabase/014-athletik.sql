-- =====================================================================
-- Coaching App · Phase 11 · Athletik (Leistungstests)
-- Im SQL Editor EINMAL ausführen, nach 013-intervalle.sql.
--
-- * Messart "test": jeder Satz ist ein Versuch, das Ergebnis steht in
--   ausgefuehrte_saetze.messwert (gibt es seit Phase 8)
-- * Übung: "einheit" (s, cm, m, …) und "wertung" (bester Versuch oder
--   Durchschnitt); "kleiner_besser" gibt es schon (z. B. Sprintzeit)
-- * Startbestand: 14 Leistungstests für jeden Coach
--   (vorhandene Namen werden nicht doppelt angelegt)
-- * Keine neue Tabelle: Versuche sind normale Sätze, deshalb gelten RLS,
--   Export und Konto löschen wie bisher.
-- =====================================================================

begin;

-- Messart erweitern
do $$
declare
  c record;
begin
  for c in
    select conname from pg_constraint
    where conrelid = 'public.uebungen'::regclass and contype = 'c' and pg_get_constraintdef(oid) like '%messart%'
  loop
    execute format('alter table public.uebungen drop constraint %I', c.conname);
  end loop;
end $$;

alter table public.uebungen
  add constraint uebungen_messart_check
  check (messart in ('wdh_last', 'wdh', 'zeit', 'zeit_last', 'distanz', 'distanz_last', 'umfang', 'ausdauer', 'intervall', 'test'));

alter table public.uebungen
  add column einheit text check (einheit in ('s', 'cm', 'm', 'kg', 'wdh', 'stufe', 'punkte')),
  add column wertung text not null default 'bester' check (wertung in ('bester', 'schnitt'));
comment on column public.uebungen.einheit is 'Einheit des Testergebnisses (nur Messart test).';
comment on column public.uebungen.wertung is 'Welcher Wert eines Testtags zählt: bester Versuch oder Durchschnitt aller Versuche.';
grant insert (einheit, wertung) on public.uebungen to authenticated;
grant update (einheit, wertung) on public.uebungen to authenticated;

-- ---------------------------------------------------------------------
-- Startbestand Leistungstests
-- ---------------------------------------------------------------------
with liste (name, muster, geraet, einheit, kleiner, text) as (
  values
  -- Sprints (Sekunden, kleiner ist besser)
  ('Test: Sprint 5 m', 'sprinten', array[]::text[], 's', true,
   'Start aus dem Stand, vordere Fußspitze an der Linie, kein Ausholschritt. Zeit bis 5 m. Gleicher Start, Untergrund und Messweg bei jedem Test.'),
  ('Test: Sprint 10 m', 'sprinten', array[]::text[], 's', true,
   'Start aus dem Stand, vordere Fußspitze an der Linie, kein Ausholschritt. Zeit bis 10 m. Gleicher Start, Untergrund und Messweg bei jedem Test.'),
  ('Test: Sprint 20 m', 'sprinten', array[]::text[], 's', true,
   'Start aus dem Stand, vordere Fußspitze an der Linie, kein Ausholschritt. Zeit bis 20 m. Gleicher Start, Untergrund und Messweg bei jedem Test.'),
  ('Test: Sprint 30 m', 'sprinten', array[]::text[], 's', true,
   'Start aus dem Stand, vordere Fußspitze an der Linie, kein Ausholschritt. Zeit bis 30 m. Gleicher Start, Untergrund und Messweg bei jedem Test.'),
  -- Sprünge
  ('Test: Standweitsprung', 'springen', array[]::text[], 'cm', false,
   'Beidbeinig von der Linie abspringen, Armschwung erlaubt. Gemessen wird bis zur Ferse, die der Linie am nächsten ist. Landung muss gehalten werden.'),
  ('Test: Counter-Movement-Jump', 'springen', array[]::text[], 'cm', false,
   'Hände an der Hüfte, schnelle Ausholbewegung nach unten, dann maximal hoch. Sprunghöhe mit Kontaktmatte oder App. Immer dasselbe Messgerät nutzen.'),
  ('Test: Squat Jump', 'springen', array[]::text[], 'cm', false,
   'Hände an der Hüfte, 2 Sekunden in der halben Hocke halten, ohne Ausholen nach oben springen. Sprunghöhe mit Kontaktmatte oder App.'),
  ('Test: Dreisprung aus dem Stand', 'springen', array[]::text[], 'm', false,
   'Beidbeinig abspringen, dann rechts–links (oder links–rechts) springen und beidbeinig landen. Gemessen bis zur hintersten Ferse.'),
  -- Richtungswechsel (Sekunden, kleiner ist besser)
  ('Test: Pendellauf 5-10-5', 'richtungswechsel', array[]::text[], 's', true,
   'Start in der Mitte, 5 m zur einen Seite, 10 m zur anderen, 5 m zurück durch die Mitte. Linie jeweils mit der Hand berühren. Startseite notieren.'),
  ('Test: T-Test', 'richtungswechsel', array[]::text[], 's', true,
   '10 m nach vorn, 5 m seitlich nach links, 10 m nach rechts, 5 m zurück zur Mitte, dann rückwärts zum Start. Hütchen jeweils berühren.'),
  ('Test: Illinois-Test', 'richtungswechsel', array[]::text[], 's', true,
   'Start liegend, 10 m Bahn mit vier Slalom-Hütchen in der Mitte. Feste Laufstrecke nach Aufbauskizze. Gleicher Aufbau bei jedem Test.'),
  -- Wurf und Ausdauer-Tests
  ('Test: Medizinball-Wurf', 'werfen', array['medizinball'], 'm', false,
   'Im Sitzen mit dem Rücken an der Wand, Ball beidhändig von der Brust stoßen. Immer dasselbe Ballgewicht (in der Notiz vermerken). Gemessen bis zum ersten Aufprall.'),
  ('Test: Yo-Yo Intermittent Recovery 1', 'laufen', array[]::text[], 'm', false,
   '2 × 20 m Pendellauf nach Signalton, danach 10 s aktive Pause. Gewertet wird die gesamte Strecke bis zum zweiten verpassten Signal.'),
  ('Test: Cooper-Test', 'laufen', array[]::text[], 'm', false,
   '12 Minuten so weit wie möglich laufen, am besten auf der Bahn. Gewertet wird die Strecke in Metern.')
)
insert into public.uebungen (coach_id, name, modul, bewegungsmuster, ausstattung, messart, einheit, wertung, kleiner_besser, beschreibung)
select p.id, l.name, 'athletik', l.muster, l.geraet, 'test', l.einheit, 'bester', l.kleiner, l.text
from liste l
cross join public.profile p
where p.rolle = 'coach'
on conflict do nothing;

commit;

select count(*) as leistungstests from public.uebungen where messart = 'test';
