-- =====================================================================
-- Coaching App · Phase 4 · Training durchführen
-- Im SQL Editor EINMAL ausführen, nach 006-plaene.sql.
--
-- trainingseinheiten     – eine Einheit (nach Plan oder frei)
-- ausgefuehrte_uebungen  – Übungen der Einheit (mit Namens-Kopie)
-- ausgefuehrte_saetze    – tatsächliche Leistung + KOPIE der Vorgabe
-- training_korrekturen   – Änderungen an abgeschlossenen Einheiten
--
-- Wichtig:
--   * Die Kennungen (id) erzeugt das Handy. So kann die App ohne Internet
--     weiterarbeiten und später alles genau einmal hochladen ("upsert").
--   * Jede Satz-Zeile enthält eine Kopie der damaligen Vorgabe. Spätere
--     Planänderungen verändern die Historie nie.
--   * Eintragen darf nur die Person selbst (mit Einwilligung zur Nutzung).
--     Der Coach liest bei laufender Betreuung, ändert aber nichts.
--   * RIR ist eine Selbsteinschätzung.
-- =====================================================================

begin;

create table public.trainingseinheiten (
  id               uuid primary key,
  athlet_id        uuid not null default auth.uid() references public.profile (id) on delete cascade,
  planversion_id   uuid references public.planversionen (id),
  plan_einheit_id  uuid references public.plan_einheiten (id),
  titel            text not null check (char_length(titel) between 1 and 100),
  status           text not null default 'laeuft' check (status in ('laeuft', 'abgeschlossen', 'abgebrochen')),
  gestartet_am     timestamptz not null default now(),
  beendet_am       timestamptz,
  session_rpe      smallint check (session_rpe between 1 and 10),
  notiz            text not null default '' check (char_length(notiz) <= 2000),
  aktualisiert_am  timestamptz not null default now(),
  check (beendet_am is null or beendet_am >= gestartet_am)
);
create index trainingseinheiten_athlet_idx on public.trainingseinheiten (athlet_id, gestartet_am desc);
comment on column public.trainingseinheiten.session_rpe is 'Subjektive Anstrengung der ganzen Einheit (1–10).';

create table public.ausgefuehrte_uebungen (
  id                  uuid primary key,
  trainingseinheit_id uuid not null references public.trainingseinheiten (id) on delete cascade,
  uebung_id           uuid not null references public.uebungen (id),
  plan_uebung_id      uuid references public.plan_uebungen (id),
  reihenfolge         smallint not null default 0,
  uebung_name         text not null check (char_length(uebung_name) between 1 and 80),
  messart             text not null default 'wdh_last',
  ersetzt             boolean not null default false,
  notiz               text not null default '' check (char_length(notiz) <= 1000)
);
create index ausgefuehrte_uebungen_einheit_idx on public.ausgefuehrte_uebungen (trainingseinheit_id);
comment on column public.ausgefuehrte_uebungen.ersetzt is 'true = statt der geplanten Übung wurde diese gemacht.';

create table public.ausgefuehrte_saetze (
  id                     uuid primary key,
  ausgefuehrte_uebung_id uuid not null references public.ausgefuehrte_uebungen (id) on delete cascade,
  plan_satz_id           uuid references public.plan_saetze (id),
  satznummer             smallint not null check (satznummer between 1 and 50),
  satztyp                text not null default 'arbeit',
  vorgabe                jsonb not null default '{}'
                         check (jsonb_typeof(vorgabe) = 'object' and octet_length(vorgabe::text) <= 4000),
  wdh                    smallint check (wdh between 0 and 200),
  last_kg                numeric(6, 2) check (last_kg between 0 and 1000),
  rir                    numeric(3, 1) check (rir between 0 and 10),
  dauer_sek              integer check (dauer_sek between 0 and 86400),
  distanz_m              integer check (distanz_m between 0 and 100000),
  erledigt               boolean not null default false,
  aktualisiert_am        timestamptz not null default now()
);
create index ausgefuehrte_saetze_uebung_idx on public.ausgefuehrte_saetze (ausgefuehrte_uebung_id);
comment on column public.ausgefuehrte_saetze.vorgabe is 'Kopie der Planvorgabe zum Zeitpunkt des Trainings.';
comment on column public.ausgefuehrte_saetze.rir is 'Wiederholungen in Reserve – Selbsteinschätzung.';

create table public.training_korrekturen (
  id          bigint generated always as identity primary key,
  athlet_id   uuid not null references public.profile (id) on delete cascade,
  tabelle     text not null,
  zeile       uuid not null,
  aktion      text not null,
  alt         jsonb,
  neu         jsonb,
  wer         uuid,
  zeitpunkt   timestamptz not null default now()
);
create index training_korrekturen_athlet_idx on public.training_korrekturen (athlet_id, zeitpunkt desc);

-- ---------------------------------------------------------------------
-- Hilfsfunktionen
-- ---------------------------------------------------------------------
create function intern.einheit_athlet(p_einheit uuid)
returns uuid language sql stable security definer set search_path = '' as $$
  select athlet_id from public.trainingseinheiten where id = p_einheit;
$$;

create function intern.einheit_von_uebung(p_aus_uebung uuid)
returns uuid language sql stable security definer set search_path = '' as $$
  select trainingseinheit_id from public.ausgefuehrte_uebungen where id = p_aus_uebung;
$$;

create function intern.einheit_status(p_einheit uuid)
returns text language sql stable security definer set search_path = '' as $$
  select status from public.trainingseinheiten where id = p_einheit;
$$;

create function intern.uebung_sichtbar(p_uebung uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.uebungen u
    where u.id = p_uebung and (u.coach_id = (select auth.uid()) or intern.ist_mein_coach(u.coach_id))
  );
$$;

-- Lesen: die Person selbst oder ihr Coach bei laufender Betreuung
create function intern.training_lesbar(p_athlet uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select p_athlet = (select auth.uid()) or intern.betreut(p_athlet);
$$;

-- Schreiben: nur die Person selbst, mit Einwilligung zur Nutzung
create function intern.training_schreibbar(p_athlet uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select p_athlet = (select auth.uid()) and intern.hat_einwilligung((select auth.uid()), 'nutzung');
$$;

do $$
declare
  f text;
begin
  foreach f in array array[
    'intern.einheit_athlet(uuid)', 'intern.einheit_von_uebung(uuid)', 'intern.einheit_status(uuid)',
    'intern.uebung_sichtbar(uuid)', 'intern.training_lesbar(uuid)', 'intern.training_schreibbar(uuid)'
  ] loop
    execute format('revoke all on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
end $$;

-- ---------------------------------------------------------------------
-- Automatik: Zeitstempel und Korrekturprotokoll
-- ---------------------------------------------------------------------
create trigger trainingseinheiten_aktualisiert
  before insert or update on public.trainingseinheiten
  for each row execute function intern.aktualisiert_setzen();

create trigger ausgefuehrte_saetze_aktualisiert
  before insert or update on public.ausgefuehrte_saetze
  for each row execute function intern.aktualisiert_setzen();

-- Änderungen an einer ABGESCHLOSSENEN Einheit werden protokolliert
create function intern.training_korrektur()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  einheit uuid;
  athlet uuid;
  alt_daten jsonb;
  neu_daten jsonb;
begin
  if tg_table_name = 'trainingseinheiten' then
    einheit := coalesce(new.id, old.id);
    -- Erst ab dem Zeitpunkt, an dem die Einheit schon abgeschlossen war
    if tg_op = 'UPDATE' and old.status <> 'abgeschlossen' then
      return null;
    end if;
  elsif tg_table_name = 'ausgefuehrte_uebungen' then
    einheit := case when tg_op = 'DELETE' then old.trainingseinheit_id else new.trainingseinheit_id end;
  else
    einheit := intern.einheit_von_uebung(
      case when tg_op = 'DELETE' then old.ausgefuehrte_uebung_id else new.ausgefuehrte_uebung_id end);
  end if;

  if einheit is null or coalesce(intern.einheit_status(einheit), '') <> 'abgeschlossen' then
    return null;
  end if;
  athlet := intern.einheit_athlet(einheit);
  if athlet is null then
    return null;
  end if;

  alt_daten := case when tg_op = 'INSERT' then null else to_jsonb(old) - 'aktualisiert_am' end;
  neu_daten := case when tg_op = 'DELETE' then null else to_jsonb(new) - 'aktualisiert_am' end;
  if alt_daten is not distinct from neu_daten then
    return null;  -- nichts wirklich geändert (z. B. erneutes Hochladen)
  end if;

  insert into public.training_korrekturen (athlet_id, tabelle, zeile, aktion, alt, neu, wer)
  values (athlet, tg_table_name, coalesce((neu_daten ->> 'id')::uuid, (alt_daten ->> 'id')::uuid),
          lower(tg_op), alt_daten, neu_daten, auth.uid());
  return null;
end;
$$;
revoke all on function intern.training_korrektur() from public, anon, authenticated;

create trigger trainingseinheiten_korrektur
  after update on public.trainingseinheiten
  for each row execute function intern.training_korrektur();
create trigger ausgefuehrte_uebungen_korrektur
  after insert or update or delete on public.ausgefuehrte_uebungen
  for each row execute function intern.training_korrektur();
create trigger ausgefuehrte_saetze_korrektur
  after insert or update or delete on public.ausgefuehrte_saetze
  for each row execute function intern.training_korrektur();

-- ---------------------------------------------------------------------
-- Zugriffsregeln
-- ---------------------------------------------------------------------
alter table public.trainingseinheiten    enable row level security;
alter table public.ausgefuehrte_uebungen enable row level security;
alter table public.ausgefuehrte_saetze   enable row level security;
alter table public.training_korrekturen  enable row level security;

revoke all on public.trainingseinheiten, public.ausgefuehrte_uebungen, public.ausgefuehrte_saetze,
              public.training_korrekturen from anon, authenticated;

-- Für "upsert" vom Handy werden alle Spalten zum Schreiben freigegeben;
-- die Regeln unten stellen sicher, dass nur eigene Daten betroffen sind.
grant select, delete on public.trainingseinheiten to authenticated;
grant insert (id, athlet_id, planversion_id, plan_einheit_id, titel, status, gestartet_am, beendet_am, session_rpe, notiz)
  on public.trainingseinheiten to authenticated;
grant update (id, athlet_id, planversion_id, plan_einheit_id, titel, status, gestartet_am, beendet_am, session_rpe, notiz)
  on public.trainingseinheiten to authenticated;

grant select, delete on public.ausgefuehrte_uebungen to authenticated;
grant insert (id, trainingseinheit_id, uebung_id, plan_uebung_id, reihenfolge, uebung_name, messart, ersetzt, notiz)
  on public.ausgefuehrte_uebungen to authenticated;
grant update (id, trainingseinheit_id, uebung_id, plan_uebung_id, reihenfolge, uebung_name, messart, ersetzt, notiz)
  on public.ausgefuehrte_uebungen to authenticated;

grant select, delete on public.ausgefuehrte_saetze to authenticated;
grant insert (id, ausgefuehrte_uebung_id, plan_satz_id, satznummer, satztyp, vorgabe, wdh, last_kg, rir, dauer_sek, distanz_m, erledigt)
  on public.ausgefuehrte_saetze to authenticated;
grant update (id, ausgefuehrte_uebung_id, plan_satz_id, satznummer, satztyp, vorgabe, wdh, last_kg, rir, dauer_sek, distanz_m, erledigt)
  on public.ausgefuehrte_saetze to authenticated;

grant select on public.training_korrekturen to authenticated;

-- trainingseinheiten
create policy einheiten_t_lesen on public.trainingseinheiten for select to authenticated
  using (intern.training_lesbar(athlet_id));
create policy einheiten_t_anlegen on public.trainingseinheiten for insert to authenticated
  with check (intern.training_schreibbar(athlet_id)
              and (planversion_id is null or intern.version_lesbar(planversion_id)));
create policy einheiten_t_aendern on public.trainingseinheiten for update to authenticated
  using (athlet_id = (select auth.uid()))
  with check (intern.training_schreibbar(athlet_id)
              and (planversion_id is null or intern.version_lesbar(planversion_id)));
-- Löschen nur, solange die Einheit nicht abgeschlossen ist
create policy einheiten_t_loeschen on public.trainingseinheiten for delete to authenticated
  using (athlet_id = (select auth.uid()) and status <> 'abgeschlossen');

-- ausgefuehrte_uebungen
create policy aus_uebungen_lesen on public.ausgefuehrte_uebungen for select to authenticated
  using (intern.training_lesbar(intern.einheit_athlet(trainingseinheit_id)));
create policy aus_uebungen_anlegen on public.ausgefuehrte_uebungen for insert to authenticated
  with check (intern.training_schreibbar(intern.einheit_athlet(trainingseinheit_id))
              and intern.uebung_sichtbar(uebung_id));
create policy aus_uebungen_aendern on public.ausgefuehrte_uebungen for update to authenticated
  using (intern.einheit_athlet(trainingseinheit_id) = (select auth.uid()))
  with check (intern.training_schreibbar(intern.einheit_athlet(trainingseinheit_id))
              and intern.uebung_sichtbar(uebung_id));
create policy aus_uebungen_loeschen on public.ausgefuehrte_uebungen for delete to authenticated
  using (intern.einheit_athlet(trainingseinheit_id) = (select auth.uid()));

-- ausgefuehrte_saetze
create policy aus_saetze_lesen on public.ausgefuehrte_saetze for select to authenticated
  using (intern.training_lesbar(intern.einheit_athlet(intern.einheit_von_uebung(ausgefuehrte_uebung_id))));
create policy aus_saetze_anlegen on public.ausgefuehrte_saetze for insert to authenticated
  with check (intern.training_schreibbar(intern.einheit_athlet(intern.einheit_von_uebung(ausgefuehrte_uebung_id))));
create policy aus_saetze_aendern on public.ausgefuehrte_saetze for update to authenticated
  using (intern.einheit_athlet(intern.einheit_von_uebung(ausgefuehrte_uebung_id)) = (select auth.uid()))
  with check (intern.training_schreibbar(intern.einheit_athlet(intern.einheit_von_uebung(ausgefuehrte_uebung_id))));
create policy aus_saetze_loeschen on public.ausgefuehrte_saetze for delete to authenticated
  using (intern.einheit_athlet(intern.einheit_von_uebung(ausgefuehrte_uebung_id)) = (select auth.uid()));

-- training_korrekturen: nur lesen
create policy korrekturen_lesen on public.training_korrekturen for select to authenticated
  using (intern.training_lesbar(athlet_id));

commit;

select 'eingerichtet' as ergebnis;
