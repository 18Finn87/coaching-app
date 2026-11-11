-- =====================================================================
-- Coaching App · Phase 10 · Intervalle
-- Im SQL Editor EINMAL ausführen, nach 012-ausdauer.sql.
--
-- Ein Intervall-Block besteht aus Runden. Jede Runde ist ein Plansatz mit
-- Belastung (Zeit ODER Strecke) und Pause – dafür gibt es die Spalten schon.
-- Neu: Messart "intervall" und ein Startbestand.
-- =====================================================================

begin;

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
  check (messart in ('wdh_last', 'wdh', 'zeit', 'zeit_last', 'distanz', 'distanz_last', 'umfang', 'ausdauer', 'intervall'));

with liste (name, muster, geraet, text) as (
  values
  ('Lauf-Intervalle', 'laufen', array[]::text[],
   'Z. B. 6 × 400 m mit 90 s Trabpause. Bei Strecken-Intervallen misst der Timer die Zeit je Runde.'),
  ('Sprints', 'sprinten', array[]::text[],
   'Kurze, maximale Sprints (z. B. 8 × 30 m) mit vollständiger Erholung.'),
  ('Rad-Intervalle', 'radfahren', array['ausdauergeraet'],
   'Z. B. 5 × 3 min zügig, 2 min locker. Strecke laut Anzeige freiwillig.'),
  ('Ruder-Intervalle', 'rudern', array['ausdauergeraet'],
   'Z. B. 4 × 500 m mit 2 min Pause. Zeit je Runde vom Display übernehmen oder den Timer nutzen.'),
  ('Tabata (20 s / 10 s)', 'ausdauer_sonstiges', array[]::text[],
   '8 Runden: 20 s maximal, 10 s Pause. Übung frei wählbar, z. B. Burpees oder Rad.')
)
insert into public.uebungen (coach_id, name, modul, bewegungsmuster, ausstattung, messart, beschreibung)
select p.id, l.name, 'intervall', l.muster, l.geraet, 'intervall', l.text
from liste l cross join public.profile p
where p.rolle = 'coach'
on conflict do nothing;

commit;

select count(*) as intervalluebungen from public.uebungen where modul = 'intervall';
