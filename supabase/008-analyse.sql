-- =====================================================================
-- Coaching App · Phase 5 · Fortschrittsanalyse
-- Im SQL Editor EINMAL ausführen, nach 007-training.sql.
--
-- coach_einstellungen – welche Formel für das GESCHÄTZTE 1RM gilt
--                       (die Schätzung selbst wird in der App berechnet;
--                        gespeichert wird nur die echte Leistung)
-- maxtests            – echte, getestete Maximalwerte (getrennt von Schätzungen)
-- =====================================================================

begin;

create table public.coach_einstellungen (
  coach_id         uuid primary key default auth.uid() references public.profile (id) on delete cascade,
  e1rm_formel      text not null default 'epley' check (e1rm_formel in ('epley', 'brzycki')),
  e1rm_max_wdh     smallint not null default 10 check (e1rm_max_wdh between 3 and 15),
  aktualisiert_am  timestamptz not null default now()
);
comment on table public.coach_einstellungen is 'Einstellungen des Coaches, z. B. die Formel für das geschätzte 1RM.';

create trigger coach_einstellungen_aktualisiert
  before insert or update on public.coach_einstellungen
  for each row execute function intern.aktualisiert_setzen();

create table public.maxtests (
  id           uuid primary key default gen_random_uuid(),
  athlet_id    uuid not null references public.profile (id) on delete cascade,
  uebung_id    uuid not null references public.uebungen (id),
  datum        date not null default current_date,
  last_kg      numeric(6, 2) not null check (last_kg between 0 and 1000),
  wdh          smallint not null default 1 check (wdh between 1 and 10),
  notiz        text not null default '' check (char_length(notiz) <= 500),
  erfasst_von  uuid default auth.uid(),
  erstellt_am  timestamptz not null default now()
);
create index maxtests_athlet_idx on public.maxtests (athlet_id, uebung_id, datum);
comment on column public.maxtests.wdh is '1 = echtes 1RM; 2–10 = getestetes Wiederholungsmaximum (z. B. 3RM).';

alter table public.coach_einstellungen enable row level security;
alter table public.maxtests            enable row level security;
revoke all on public.coach_einstellungen, public.maxtests from anon, authenticated;

-- Einstellungen: Coach pflegt seine; seine Athleten dürfen sie lesen (für die Anzeige)
grant select on public.coach_einstellungen to authenticated;
grant insert (e1rm_formel, e1rm_max_wdh) on public.coach_einstellungen to authenticated;
grant update (e1rm_formel, e1rm_max_wdh) on public.coach_einstellungen to authenticated;

create policy einstellungen_lesen on public.coach_einstellungen for select to authenticated
  using (coach_id = (select auth.uid()) or intern.ist_mein_coach(coach_id));
create policy einstellungen_anlegen on public.coach_einstellungen for insert to authenticated
  with check (coach_id = (select auth.uid()) and intern.ist_coach());
create policy einstellungen_aendern on public.coach_einstellungen for update to authenticated
  using (coach_id = (select auth.uid())) with check (coach_id = (select auth.uid()));

-- Maximaltests: eintragen darf die Person selbst (mit Einwilligung) oder ihr Coach;
-- löschen darf, wer eingetragen hat
grant select, delete on public.maxtests to authenticated;
grant insert (athlet_id, uebung_id, datum, last_kg, wdh, notiz) on public.maxtests to authenticated;

create policy maxtests_lesen on public.maxtests for select to authenticated
  using (intern.training_lesbar(athlet_id));
create policy maxtests_anlegen on public.maxtests for insert to authenticated
  with check (intern.uebung_sichtbar(uebung_id)
              and (intern.training_schreibbar(athlet_id) or (intern.ist_coach() and intern.betreut(athlet_id))));
create policy maxtests_loeschen on public.maxtests for delete to authenticated
  using (erfasst_von = (select auth.uid()) and intern.training_lesbar(athlet_id));

commit;

select 'eingerichtet' as ergebnis;
