-- =====================================================================
-- Coaching App · Phase 15 · Tägliche Abfrage (Daily Check-in)
-- Im SQL Editor EINMAL ausführen, nach 018-nachrichten.sql.
--
-- * public.tages_checkins: ein Eintrag pro Person und Tag (Berliner Zeit):
--   Schlaf (Stunden + Qualität 1–5), Energie, Muskelkater, Stimmung (1–5).
-- * "quellen": woher jeder Wert stammt – zum Start nur "manuell", später z. B.
--   "apple_health" oder "whoop". Beispiel: {"schlaf_stunden": "apple_health"}.
-- * Ändern nur am selben Tag. Der Coach liest nur.
-- * Gleiche Einordnung wie der wöchentliche Check-in (keine Gesundheitsdaten
--   im Sinne von Art. 9, Einwilligung „Nutzung“).
-- =====================================================================

begin;

create function intern.heute_berlin()
returns date language sql stable set search_path = '' as $$
  select (now() at time zone 'Europe/Berlin')::date;
$$;
revoke all on function intern.heute_berlin() from public, anon;
grant execute on function intern.heute_berlin() to authenticated;

-- Erlaubte Quellen je Wert
create function intern.quellen_gueltig(q jsonb)
returns boolean language sql immutable set search_path = '' as $$
  select jsonb_typeof(q) = 'object'
     and not exists (
       select 1 from jsonb_each(q) e
       where e.key not in ('schlaf_stunden', 'schlaf_qualitaet', 'energie', 'muskelkater', 'stimmung')
          or jsonb_typeof(e.value) <> 'string'
          or (e.value #>> '{}') not in ('manuell', 'apple_health', 'whoop', 'sonstige')
     );
$$;
revoke all on function intern.quellen_gueltig(jsonb) from public, anon;
grant execute on function intern.quellen_gueltig(jsonb) to authenticated;

create table public.tages_checkins (
  id                uuid primary key default gen_random_uuid(),
  athlet_id         uuid not null default auth.uid() references public.profile (id) on delete cascade,
  datum             date not null default intern.heute_berlin(),
  schlaf_stunden    numeric(3, 1) check (schlaf_stunden between 0 and 24),
  schlaf_qualitaet  smallint check (schlaf_qualitaet between 1 and 5),
  energie           smallint check (energie between 1 and 5),
  muskelkater       smallint check (muskelkater between 1 and 5),
  stimmung          smallint check (stimmung between 1 and 5),
  quellen           jsonb not null default '{}' check (intern.quellen_gueltig(quellen)),
  erstellt_am       timestamptz not null default now(),
  aktualisiert_am   timestamptz not null default now(),
  unique (athlet_id, datum),
  check (num_nonnulls(schlaf_stunden, schlaf_qualitaet, energie, muskelkater, stimmung) > 0)
);
create index tages_checkins_athlet_idx on public.tages_checkins (athlet_id, datum desc);
comment on table public.tages_checkins is
  'Tägliche Abfrage (Skalen 1–5, Schlaf in Stunden). quellen = Herkunft je Wert (manuell, apple_health, whoop, sonstige).';

create trigger tages_checkins_aktualisiert
  before insert or update on public.tages_checkins
  for each row execute function intern.aktualisiert_setzen();

alter table public.tages_checkins enable row level security;
revoke all on public.tages_checkins from public, anon, authenticated;
grant select, delete on public.tages_checkins to authenticated;
grant insert (schlaf_stunden, schlaf_qualitaet, energie, muskelkater, stimmung, quellen) on public.tages_checkins to authenticated;
grant update (schlaf_stunden, schlaf_qualitaet, energie, muskelkater, stimmung, quellen) on public.tages_checkins to authenticated;

create policy tages_lesen on public.tages_checkins for select to authenticated
  using (intern.training_lesbar(athlet_id));
create policy tages_anlegen on public.tages_checkins for insert to authenticated
  with check (intern.training_schreibbar(athlet_id) and datum = intern.heute_berlin());
create policy tages_aendern on public.tages_checkins for update to authenticated
  using (athlet_id = (select auth.uid()) and datum = intern.heute_berlin())
  with check (intern.training_schreibbar(athlet_id) and datum = intern.heute_berlin());
create policy tages_loeschen on public.tages_checkins for delete to authenticated
  using (athlet_id = (select auth.uid()));

commit;

select 'eingerichtet' as ergebnis;
