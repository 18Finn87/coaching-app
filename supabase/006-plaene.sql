-- =====================================================================
-- Coaching App · Schritte 3.2–3.4 · Trainingspläne mit Versionen
-- Im SQL Editor EINMAL ausführen, nach 005b-uebungen-startbestand.sql.
--
-- Aufbau:  Plan → Versionen → Trainingstage → Übungen → Sätze (Vorgabe)
--
-- Grundregeln:
--   * Bearbeiten kann der Coach nur einen ENTWURF.
--   * Veröffentlichen geht nur über plan_veroeffentlichen(): Die bisher
--     gültige Version wird "abgelöst", bleibt aber vollständig erhalten.
--   * Eine veröffentlichte oder abgelöste Version lässt die Datenbank nicht
--     mehr ändern. Änderungen = neue Version über plan_neue_version().
--   * Die Athletin / der Athlet sieht nur veröffentlichte und abgelöste
--     Versionen (nie Entwürfe) und kann nichts ändern.
--   * Nach beendeter Betreuung sieht der Coach den Plan nicht mehr.
-- =====================================================================

begin;

-- ---------------------------------------------------------------------
-- Tabellen
-- ---------------------------------------------------------------------
create table public.plaene (
  id           uuid primary key default gen_random_uuid(),
  coach_id     uuid not null default auth.uid() references public.profile (id) on delete cascade,
  athlet_id    uuid not null references public.profile (id) on delete cascade,
  titel        text not null check (char_length(titel) between 1 and 100 and titel = btrim(titel)),
  ziel         text not null default '' check (char_length(ziel) <= 1000),
  status       text not null default 'aktiv' check (status in ('aktiv', 'archiviert')),
  erstellt_am  timestamptz not null default now()
);
create index plaene_athlet_idx on public.plaene (athlet_id);

create table public.planversionen (
  id                  uuid primary key default gen_random_uuid(),
  plan_id             uuid not null references public.plaene (id) on delete cascade,
  versionsnummer      integer not null,
  status              text not null default 'entwurf'
                      check (status in ('entwurf', 'veroeffentlicht', 'abgeloest')),
  gueltig_ab          date,
  aenderungsgrund     text not null default '' check (char_length(aenderungsgrund) <= 1000),
  erstellt_am         timestamptz not null default now(),
  veroeffentlicht_am  timestamptz,
  unique (plan_id, versionsnummer)
);
create unique index planversionen_ein_entwurf on public.planversionen (plan_id) where status = 'entwurf';
create unique index planversionen_eine_gueltige on public.planversionen (plan_id) where status = 'veroeffentlicht';

create table public.plan_einheiten (
  id              uuid primary key default gen_random_uuid(),
  planversion_id  uuid not null references public.planversionen (id) on delete cascade,
  name            text not null check (char_length(name) between 1 and 80 and name = btrim(name)),
  reihenfolge     smallint not null default 0,
  notiz           text not null default '' check (char_length(notiz) <= 1000)
);
create index plan_einheiten_version_idx on public.plan_einheiten (planversion_id);

create table public.plan_uebungen (
  id               uuid primary key default gen_random_uuid(),
  plan_einheit_id  uuid not null references public.plan_einheiten (id) on delete cascade,
  uebung_id        uuid not null references public.uebungen (id),
  reihenfolge      smallint not null default 0,
  gruppe           text check (gruppe is null or gruppe ~ '^[A-Z]$'),
  hinweis          text not null default '' check (char_length(hinweis) <= 500)
);
create index plan_uebungen_einheit_idx on public.plan_uebungen (plan_einheit_id);

create table public.plan_saetze (
  id              uuid primary key default gen_random_uuid(),
  plan_uebung_id  uuid not null references public.plan_uebungen (id) on delete cascade,
  satznummer      smallint not null check (satznummer between 1 and 50),
  satztyp         text not null default 'arbeit'
                  check (satztyp in ('aufwaermen', 'arbeit', 'backoff', 'drop', 'amrap')),
  wdh_min         smallint check (wdh_min between 1 and 100),
  wdh_max         smallint check (wdh_max between 1 and 100),
  last_kg         numeric(6, 2) check (last_kg between 0 and 1000),
  last_prozent    numeric(5, 2) check (last_prozent between 1 and 120),
  rir_ziel        numeric(3, 1) check (rir_ziel between 0 and 10),
  tempo           text check (tempo is null or tempo ~ '^[0-9X]{4}$'),
  pause_sek       smallint check (pause_sek between 0 and 1800),
  dauer_sek       integer check (dauer_sek between 1 and 86400),
  distanz_m       integer check (distanz_m between 1 and 100000),
  zusatz          jsonb not null default '{}'
                  check (jsonb_typeof(zusatz) = 'object' and octet_length(zusatz::text) <= 4000),
  check (wdh_min is null or wdh_max is null or wdh_min <= wdh_max)
);
create index plan_saetze_uebung_idx on public.plan_saetze (plan_uebung_id);
comment on table public.plan_saetze is 'Vorgabe pro Satz. "zusatz" für spätere Module (Herzfrequenzzone, Pace …).';

-- ---------------------------------------------------------------------
-- Hilfsfunktionen für die Zugriffsregeln
-- ---------------------------------------------------------------------
create function intern.plan_gehoert_mir(p_plan uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.plaene p
    where p.id = p_plan and p.coach_id = (select auth.uid()) and intern.betreut(p.athlet_id)
  ) and intern.ist_coach();
$$;

create function intern.plan_hat_veroeffentlichung(p_plan uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.planversionen where plan_id = p_plan and status <> 'entwurf');
$$;

create function intern.version_lesbar(p_version uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.planversionen v join public.plaene p on p.id = v.plan_id
    where v.id = p_version
      and ((p.coach_id = (select auth.uid()) and intern.betreut(p.athlet_id))
           or (p.athlet_id = (select auth.uid()) and v.status <> 'entwurf'))
  );
$$;

create function intern.version_bearbeitbar(p_version uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.planversionen v join public.plaene p on p.id = v.plan_id
    where v.id = p_version and v.status = 'entwurf'
      and p.coach_id = (select auth.uid()) and intern.betreut(p.athlet_id)
  ) and intern.ist_coach();
$$;

create function intern.version_von_einheit(p_einheit uuid)
returns uuid language sql stable security definer set search_path = '' as $$
  select planversion_id from public.plan_einheiten where id = p_einheit;
$$;

create function intern.version_von_planuebung(p_planuebung uuid)
returns uuid language sql stable security definer set search_path = '' as $$
  select e.planversion_id
  from public.plan_uebungen u join public.plan_einheiten e on e.id = u.plan_einheit_id
  where u.id = p_planuebung;
$$;

create function intern.uebung_gehoert_mir(p_uebung uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.uebungen where id = p_uebung and coach_id = (select auth.uid()));
$$;

do $$
declare
  f text;
begin
  foreach f in array array[
    'intern.plan_gehoert_mir(uuid)', 'intern.plan_hat_veroeffentlichung(uuid)',
    'intern.version_lesbar(uuid)', 'intern.version_bearbeitbar(uuid)',
    'intern.version_von_einheit(uuid)', 'intern.version_von_planuebung(uuid)',
    'intern.uebung_gehoert_mir(uuid)'
  ] loop
    execute format('revoke all on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
end $$;

-- ---------------------------------------------------------------------
-- Automatik: Versionsnummer
-- ---------------------------------------------------------------------
create function intern.versionsnummer_setzen()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  perform pg_advisory_xact_lock(hashtext('planversion:' || new.plan_id::text));
  select coalesce(max(versionsnummer), 0) + 1 into new.versionsnummer
  from public.planversionen where plan_id = new.plan_id;
  new.status := 'entwurf';
  new.veroeffentlicht_am := null;
  new.erstellt_am := now();
  return new;
end;
$$;
revoke all on function intern.versionsnummer_setzen() from public, anon, authenticated;

create trigger versionsnummer_setzen
  before insert on public.planversionen
  for each row execute function intern.versionsnummer_setzen();

-- ---------------------------------------------------------------------
-- Zugriffsregeln
-- ---------------------------------------------------------------------
alter table public.plaene         enable row level security;
alter table public.planversionen  enable row level security;
alter table public.plan_einheiten enable row level security;
alter table public.plan_uebungen  enable row level security;
alter table public.plan_saetze    enable row level security;

revoke all on public.plaene, public.planversionen, public.plan_einheiten, public.plan_uebungen, public.plan_saetze
  from anon, authenticated;

-- plaene
grant select, delete on public.plaene to authenticated;
grant insert (athlet_id, titel, ziel) on public.plaene to authenticated;
grant update (titel, ziel, status) on public.plaene to authenticated;

create policy plaene_lesen on public.plaene for select to authenticated
  using ((coach_id = (select auth.uid()) and intern.betreut(athlet_id))
         or (athlet_id = (select auth.uid()) and intern.plan_hat_veroeffentlichung(id)));
create policy plaene_anlegen on public.plaene for insert to authenticated
  with check (coach_id = (select auth.uid()) and intern.ist_coach() and intern.betreut(athlet_id));
create policy plaene_aendern on public.plaene for update to authenticated
  using (intern.plan_gehoert_mir(id)) with check (coach_id = (select auth.uid()));
-- Löschen nur, solange nie etwas veröffentlicht wurde
create policy plaene_loeschen on public.plaene for delete to authenticated
  using (intern.plan_gehoert_mir(id) and not intern.plan_hat_veroeffentlichung(id));

-- planversionen (Status ändert nur plan_veroeffentlichen)
grant select, delete on public.planversionen to authenticated;
grant insert (plan_id, gueltig_ab, aenderungsgrund) on public.planversionen to authenticated;
grant update (gueltig_ab, aenderungsgrund) on public.planversionen to authenticated;

create policy versionen_lesen on public.planversionen for select to authenticated
  using (intern.version_lesbar(id));
create policy versionen_anlegen on public.planversionen for insert to authenticated
  with check (intern.plan_gehoert_mir(plan_id));
create policy versionen_aendern on public.planversionen for update to authenticated
  using (intern.version_bearbeitbar(id)) with check (intern.version_bearbeitbar(id));
create policy versionen_loeschen on public.planversionen for delete to authenticated
  using (intern.version_bearbeitbar(id));

-- plan_einheiten
grant select, delete on public.plan_einheiten to authenticated;
grant insert (planversion_id, name, reihenfolge, notiz) on public.plan_einheiten to authenticated;
grant update (name, reihenfolge, notiz) on public.plan_einheiten to authenticated;

create policy einheiten_lesen on public.plan_einheiten for select to authenticated
  using (intern.version_lesbar(planversion_id));
create policy einheiten_anlegen on public.plan_einheiten for insert to authenticated
  with check (intern.version_bearbeitbar(planversion_id));
create policy einheiten_aendern on public.plan_einheiten for update to authenticated
  using (intern.version_bearbeitbar(planversion_id)) with check (intern.version_bearbeitbar(planversion_id));
create policy einheiten_loeschen on public.plan_einheiten for delete to authenticated
  using (intern.version_bearbeitbar(planversion_id));

-- plan_uebungen
grant select, delete on public.plan_uebungen to authenticated;
grant insert (plan_einheit_id, uebung_id, reihenfolge, gruppe, hinweis) on public.plan_uebungen to authenticated;
grant update (uebung_id, reihenfolge, gruppe, hinweis) on public.plan_uebungen to authenticated;

create policy planuebungen_lesen on public.plan_uebungen for select to authenticated
  using (intern.version_lesbar(intern.version_von_einheit(plan_einheit_id)));
create policy planuebungen_anlegen on public.plan_uebungen for insert to authenticated
  with check (intern.version_bearbeitbar(intern.version_von_einheit(plan_einheit_id))
              and intern.uebung_gehoert_mir(uebung_id));
create policy planuebungen_aendern on public.plan_uebungen for update to authenticated
  using (intern.version_bearbeitbar(intern.version_von_einheit(plan_einheit_id)))
  with check (intern.version_bearbeitbar(intern.version_von_einheit(plan_einheit_id))
              and intern.uebung_gehoert_mir(uebung_id));
create policy planuebungen_loeschen on public.plan_uebungen for delete to authenticated
  using (intern.version_bearbeitbar(intern.version_von_einheit(plan_einheit_id)));

-- plan_saetze
grant select, delete on public.plan_saetze to authenticated;
grant insert (plan_uebung_id, satznummer, satztyp, wdh_min, wdh_max, last_kg, last_prozent, rir_ziel,
              tempo, pause_sek, dauer_sek, distanz_m, zusatz) on public.plan_saetze to authenticated;
grant update (satznummer, satztyp, wdh_min, wdh_max, last_kg, last_prozent, rir_ziel,
              tempo, pause_sek, dauer_sek, distanz_m, zusatz) on public.plan_saetze to authenticated;

create policy saetze_lesen on public.plan_saetze for select to authenticated
  using (intern.version_lesbar(intern.version_von_planuebung(plan_uebung_id)));
create policy saetze_anlegen on public.plan_saetze for insert to authenticated
  with check (intern.version_bearbeitbar(intern.version_von_planuebung(plan_uebung_id)));
create policy saetze_aendern on public.plan_saetze for update to authenticated
  using (intern.version_bearbeitbar(intern.version_von_planuebung(plan_uebung_id)))
  with check (intern.version_bearbeitbar(intern.version_von_planuebung(plan_uebung_id)));
create policy saetze_loeschen on public.plan_saetze for delete to authenticated
  using (intern.version_bearbeitbar(intern.version_von_planuebung(plan_uebung_id)));

-- ---------------------------------------------------------------------
-- Funktionen für die App
-- ---------------------------------------------------------------------

-- Neuen Plan mit leerem Entwurf (Version 1) anlegen
create function public.plan_anlegen(p_athlet uuid, p_titel text, p_ziel text)
returns uuid language plpgsql volatile security invoker set search_path = '' as $$
declare
  neu uuid;
begin
  insert into public.plaene (athlet_id, titel, ziel)
  values (p_athlet, btrim(p_titel), coalesce(btrim(p_ziel), ''))
  returning id into neu;
  insert into public.planversionen (plan_id) values (neu);
  return neu;
end;
$$;

-- Neue Version als Entwurf: kopiert die gültige (sonst die neueste) Version vollständig
-- Läuft mit erweiterten Rechten (die Prüfregeln sehen die gerade entstehende
-- Version sonst noch nicht) – deshalb prüft sie selbst, ob der Plan dem Coach gehört.
create function public.plan_neue_version(p_plan uuid, p_aenderungsgrund text default '')
returns uuid language plpgsql volatile security definer set search_path = '' as $$
declare
  quelle uuid;
  neu uuid;
  e record;
  u record;
  neu_e uuid;
  neu_u uuid;
begin
  if not intern.plan_gehoert_mir(p_plan) then
    raise exception 'Dieser Plan gehört dir nicht.' using errcode = '42501';
  end if;
  if exists (select 1 from public.planversionen where plan_id = p_plan and status = 'entwurf') then
    raise exception 'Es gibt für diesen Plan schon einen Entwurf.' using errcode = 'P0001';
  end if;

  select id into quelle from public.planversionen
  where plan_id = p_plan and status = 'veroeffentlicht';
  if quelle is null then
    select id into quelle from public.planversionen
    where plan_id = p_plan order by versionsnummer desc limit 1;
  end if;

  insert into public.planversionen (plan_id, aenderungsgrund)
  values (p_plan, coalesce(btrim(p_aenderungsgrund), ''))
  returning id into neu;

  for e in select * from public.plan_einheiten where planversion_id = quelle order by reihenfolge loop
    insert into public.plan_einheiten (planversion_id, name, reihenfolge, notiz)
    values (neu, e.name, e.reihenfolge, e.notiz) returning id into neu_e;
    for u in select * from public.plan_uebungen where plan_einheit_id = e.id order by reihenfolge loop
      insert into public.plan_uebungen (plan_einheit_id, uebung_id, reihenfolge, gruppe, hinweis)
      values (neu_e, u.uebung_id, u.reihenfolge, u.gruppe, u.hinweis) returning id into neu_u;
      insert into public.plan_saetze (plan_uebung_id, satznummer, satztyp, wdh_min, wdh_max, last_kg,
                                      last_prozent, rir_ziel, tempo, pause_sek, dauer_sek, distanz_m, zusatz)
      select neu_u, satznummer, satztyp, wdh_min, wdh_max, last_kg,
             last_prozent, rir_ziel, tempo, pause_sek, dauer_sek, distanz_m, zusatz
      from public.plan_saetze where plan_uebung_id = u.id;
    end loop;
  end loop;

  return neu;
end;
$$;

-- Entwurf veröffentlichen; die bisher gültige Version wird abgelöst
create function public.plan_veroeffentlichen(p_version uuid)
returns void language plpgsql volatile security definer set search_path = '' as $$
declare
  v_plan uuid;
begin
  if not intern.version_bearbeitbar(p_version) then
    raise exception 'Diese Version kann nicht veröffentlicht werden.' using errcode = 'P0001';
  end if;
  select plan_id into v_plan from public.planversionen where id = p_version;

  if not exists (select 1 from public.plan_einheiten where planversion_id = p_version) then
    raise exception 'Der Plan hat noch keinen Trainingstag.' using errcode = 'P0001';
  end if;
  if exists (
    select 1 from public.plan_einheiten e
    where e.planversion_id = p_version
      and not exists (select 1 from public.plan_uebungen u where u.plan_einheit_id = e.id)
  ) then
    raise exception 'Mindestens ein Trainingstag hat noch keine Übung.' using errcode = 'P0001';
  end if;
  if exists (
    select 1 from public.plan_uebungen u join public.plan_einheiten e on e.id = u.plan_einheit_id
    where e.planversion_id = p_version
      and not exists (select 1 from public.plan_saetze s where s.plan_uebung_id = u.id)
  ) then
    raise exception 'Mindestens eine Übung hat noch keinen Satz.' using errcode = 'P0001';
  end if;

  update public.planversionen set status = 'abgeloest'
  where plan_id = v_plan and status = 'veroeffentlicht';

  update public.planversionen
  set status = 'veroeffentlicht', veroeffentlicht_am = now(), gueltig_ab = coalesce(gueltig_ab, current_date)
  where id = p_version;
end;
$$;

revoke all on function public.plan_anlegen(uuid, text, text) from public, anon;
revoke all on function public.plan_neue_version(uuid, text) from public, anon;
revoke all on function public.plan_veroeffentlichen(uuid) from public, anon;
grant execute on function public.plan_anlegen(uuid, text, text) to authenticated;
grant execute on function public.plan_neue_version(uuid, text) to authenticated;
grant execute on function public.plan_veroeffentlichen(uuid) to authenticated;

commit;

select 'eingerichtet' as ergebnis;
