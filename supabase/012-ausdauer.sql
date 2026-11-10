-- =====================================================================
-- Coaching App · Phase 9 · Ausdauer
-- Im SQL Editor EINMAL ausführen, nach 011-mobilitaet.sql.
--
-- * Messart "ausdauer": Zeit und Strecke gemeinsam (Pace rechnet die App)
-- * Ausgeführte Sätze: Ø-Puls (freiwillig) und Anstrengung 1–10
-- * athlet_ausdauer: Maximal-/Schwellenpuls pro Person, daraus schätzt die
--   App die Pulszonen (Schätzung, kein gemessener Wert)
-- * Intensitäts-Vorgabe (Zone, Pace, km/h, Watt, Anstrengung) liegt im
--   vorhandenen Zusatzfeld der Plansätze – neue Planversionen kopieren es mit.
-- * Startbestand: 7 Ausdauerübungen für jeden Coach
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
  check (messart in ('wdh_last', 'wdh', 'zeit', 'zeit_last', 'distanz', 'distanz_last', 'umfang', 'ausdauer'));

alter table public.ausgefuehrte_saetze
  add column puls_schnitt smallint check (puls_schnitt between 30 and 250),
  add column anstrengung smallint check (anstrengung between 1 and 10);
comment on column public.ausgefuehrte_saetze.puls_schnitt is 'Durchschnittlicher Puls (freiwillig).';
comment on column public.ausgefuehrte_saetze.anstrengung is 'Subjektive Anstrengung dieses Abschnitts (1–10).';
grant insert (puls_schnitt, anstrengung) on public.ausgefuehrte_saetze to authenticated;
grant update (puls_schnitt, anstrengung) on public.ausgefuehrte_saetze to authenticated;

-- Pulswerte pro Person (für die geschätzten Zonen)
create table public.athlet_ausdauer (
  athlet_id        uuid primary key references public.profile (id) on delete cascade,
  hf_max           smallint check (hf_max between 100 and 230),
  hf_schwelle      smallint check (hf_schwelle between 80 and 220),
  aktualisiert_am  timestamptz not null default now(),
  check (hf_max is null or hf_schwelle is null or hf_schwelle < hf_max)
);
comment on table public.athlet_ausdauer is 'Maximal- und Schwellenpuls. Die Zonen daraus sind eine Schätzung.';

create trigger athlet_ausdauer_aktualisiert
  before insert or update on public.athlet_ausdauer
  for each row execute function intern.aktualisiert_setzen();

alter table public.athlet_ausdauer enable row level security;
revoke all on public.athlet_ausdauer from anon, authenticated;
grant select, delete on public.athlet_ausdauer to authenticated;
grant insert (athlet_id, hf_max, hf_schwelle) on public.athlet_ausdauer to authenticated;
grant update (hf_max, hf_schwelle) on public.athlet_ausdauer to authenticated;

-- Lesen: die Person und ihr Coach. Eintragen: die Person selbst oder ihr Coach.
create policy ausdauer_lesen on public.athlet_ausdauer for select to authenticated
  using (intern.training_lesbar(athlet_id));
create policy ausdauer_anlegen on public.athlet_ausdauer for insert to authenticated
  with check (intern.training_schreibbar(athlet_id) or (intern.ist_coach() and intern.betreut(athlet_id)));
create policy ausdauer_aendern on public.athlet_ausdauer for update to authenticated
  using (athlet_id = (select auth.uid()) or (intern.ist_coach() and intern.betreut(athlet_id)))
  with check (intern.training_schreibbar(athlet_id) or (intern.ist_coach() and intern.betreut(athlet_id)));
create policy ausdauer_loeschen on public.athlet_ausdauer for delete to authenticated
  using (athlet_id = (select auth.uid()) or (intern.ist_coach() and intern.betreut(athlet_id)));

-- Startbestand Ausdauer
with liste (name, muster, geraet, text) as (
  values
  ('Lauf', 'laufen', array[]::text[], 'Locker bis zügig, je nach Vorgabe. Pace rechnet die App aus Zeit und Strecke.'),
  ('Zügiges Gehen', 'gehen', array[]::text[], 'Schnelles Gehen, gut für lockere Einheiten und Regeneration.'),
  ('Radfahren', 'radfahren', array[]::text[], 'Draußen oder auf dem Rad-Ergometer.'),
  ('Rudern (Ergometer)', 'rudern', array['ausdauergeraet'], 'Rudergerät. Strecke in Metern laut Anzeige.'),
  ('Schwimmen', 'schwimmen', array[]::text[], 'Strecke in Metern, z. B. Bahnen × Beckenlänge.'),
  ('Crosstrainer', 'ausdauer_sonstiges', array['ausdauergeraet'], 'Strecke laut Anzeige, falls vorhanden.'),
  ('Seilspringen', 'ausdauer_sonstiges', array['sonstiges'], 'Nach Zeit, Strecke leer lassen.')
)
insert into public.uebungen (coach_id, name, modul, bewegungsmuster, ausstattung, messart, beschreibung)
select p.id, l.name, 'ausdauer', l.muster, l.geraet, 'ausdauer', l.text
from liste l cross join public.profile p
where p.rolle = 'coach'
on conflict do nothing;

commit;

select count(*) as ausdaueruebungen from public.uebungen where modul = 'ausdauer';
