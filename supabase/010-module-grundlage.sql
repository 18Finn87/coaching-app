-- =====================================================================
-- Coaching App · Phase 7 · Grundlage für weitere Module
-- Im SQL Editor EINMAL ausführen, nach 009-coaching.sql.
--
-- * Übungen: neue Bewegungsmuster und Ausstattung für Ausdauer, Athletik,
--   Mobilität; "seiten_getrennt" = links und rechts getrennt eintragen
-- * Ausgeführte Sätze: "seite" (links/rechts) und ein freies Zusatzfeld
--   für spätere Werte (z. B. Puls)
-- Bestehende Daten bleiben unverändert.
-- =====================================================================

begin;

-- Alte Auswahl-Regeln für Muster und Ausstattung ersetzen
do $$
declare
  c record;
begin
  for c in
    select conname from pg_constraint
    where conrelid = 'public.uebungen'::regclass and contype = 'c'
      and (pg_get_constraintdef(oid) like '%bewegungsmuster%' or pg_get_constraintdef(oid) like '%ausstattung%')
  loop
    execute format('alter table public.uebungen drop constraint %I', c.conname);
  end loop;
end $$;

alter table public.uebungen
  add constraint uebungen_bewegungsmuster_check
  check (bewegungsmuster in ('kniebeuge', 'hueftstreckung', 'ausfallschritt',
                             'druecken_horizontal', 'druecken_vertikal',
                             'ziehen_horizontal', 'ziehen_vertikal',
                             'rumpf', 'tragen', 'isolation',
                             -- Ausdauer
                             'laufen', 'gehen', 'radfahren', 'rudern', 'schwimmen', 'ausdauer_sonstiges',
                             -- Athletik
                             'sprinten', 'springen', 'werfen', 'richtungswechsel',
                             -- Mobilität
                             'dehnen', 'mobilisieren', 'halten',
                             'sonstiges')),
  add constraint uebungen_ausstattung_check
  check (ausstattung <@ array['langhantel', 'kurzhantel', 'kettlebell', 'maschine',
                              'kabelzug', 'koerpergewicht', 'baender',
                              'ausdauergeraet', 'medizinball', 'box', 'matte', 'faszienrolle',
                              'sonstiges']::text[]);

alter table public.uebungen
  add column seiten_getrennt boolean not null default false;
comment on column public.uebungen.seiten_getrennt is 'true = im Training links und rechts getrennt eintragen.';

grant insert (seiten_getrennt) on public.uebungen to authenticated;
grant update (seiten_getrennt) on public.uebungen to authenticated;

-- Ausgeführte Sätze: Seite und Zusatzwerte
alter table public.ausgefuehrte_saetze
  add column seite text check (seite in ('links', 'rechts')),
  add column zusatz jsonb not null default '{}'
    check (jsonb_typeof(zusatz) = 'object' and octet_length(zusatz::text) <= 4000);
comment on column public.ausgefuehrte_saetze.seite is 'Bei Übungen mit getrennten Seiten: links oder rechts. Sonst leer.';
comment on column public.ausgefuehrte_saetze.zusatz is 'Weitere gemessene Werte späterer Module (z. B. Puls).';

grant insert (seite, zusatz) on public.ausgefuehrte_saetze to authenticated;
grant update (seite, zusatz) on public.ausgefuehrte_saetze to authenticated;

commit;

select 'eingerichtet' as ergebnis;
