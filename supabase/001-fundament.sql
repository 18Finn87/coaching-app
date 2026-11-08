-- =====================================================================
-- Coaching App · Schritt 1.4 · Fundament der Datenbank
-- Im Supabase SQL Editor des Projekts "coaching-app" EINMAL ausführen.
--
-- Legt an:
--   profile          – eine Zeile pro angemeldeter Person (Rolle coach/athlet)
--   coach_athlet     – wer betreut wen (inkl. Erfahrungsstufe)
--   einladungen      – offene Einladungen des Coaches
--   einwilligungen   – DSGVO-Einwilligungen (nur erteilen und widerrufen, nie löschen)
-- Dazu Zugriffsregeln (RLS) für jede Tabelle und Hilfsfunktionen im
-- nicht öffentlichen Schema "intern".
--
-- Zum Schluss bekommt das bisher einzige Konto (dein Konto) die Rolle "coach".
-- Läuft alles in einem Block: Bei einem Fehler wird nichts gespeichert.
-- =====================================================================

begin;

-- ---------------------------------------------------------------------
-- Nicht öffentliches Schema für Hilfsfunktionen (nicht über die API erreichbar)
-- ---------------------------------------------------------------------
create schema if not exists intern;
revoke all on schema intern from public, anon;
grant usage on schema intern to authenticated;

-- ---------------------------------------------------------------------
-- Auswahllisten
-- ---------------------------------------------------------------------
create type public.rolle as enum ('coach', 'athlet');
create type public.beziehung_status as enum ('eingeladen', 'aktiv', 'pausiert', 'beendet');
create type public.erfahrungsstufe as enum ('anfaenger', 'fortgeschritten', 'sehr_erfahren');
create type public.einwilligung_art as enum ('nutzung', 'gesundheitsdaten');

-- ---------------------------------------------------------------------
-- Tabellen
-- ---------------------------------------------------------------------
create table public.profile (
  id           uuid primary key references auth.users (id) on delete cascade,
  rolle        public.rolle not null default 'athlet',
  anzeigename  text not null default ''
               check (char_length(anzeigename) <= 80 and anzeigename = btrim(anzeigename)),
  erstellt_am  timestamptz not null default now()
);
comment on table public.profile is 'Eine Zeile pro angemeldeter Person. Rolle wird nur vom Admin gesetzt.';

create table public.coach_athlet (
  id               uuid primary key default gen_random_uuid(),
  coach_id         uuid not null references public.profile (id) on delete restrict,
  athlet_id        uuid not null references public.profile (id) on delete cascade,
  status           public.beziehung_status not null default 'eingeladen',
  erfahrungsstufe  public.erfahrungsstufe not null default 'anfaenger',
  start_am         date not null default current_date,
  erstellt_am      timestamptz not null default now(),
  unique (coach_id, athlet_id),
  check (coach_id <> athlet_id)
);
create index coach_athlet_athlet_idx on public.coach_athlet (athlet_id);
comment on table public.coach_athlet is 'Wer betreut wen. Bei Status "beendet" endet der Zugriff des Coaches.';

create table public.einladungen (
  id              uuid primary key default gen_random_uuid(),
  coach_id        uuid not null default auth.uid() references public.profile (id) on delete cascade,
  email           text not null
                  check (email = lower(btrim(email))
                         and char_length(email) <= 254
                         and email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  erstellt_am     timestamptz not null default now(),
  gueltig_bis     timestamptz not null default now() + interval '14 days',
  angenommen_am   timestamptz,
  angenommen_von  uuid references public.profile (id) on delete set null
);
create unique index einladungen_offen_eindeutig
  on public.einladungen (coach_id, email) where angenommen_am is null;

create table public.einwilligungen (
  id             uuid primary key default gen_random_uuid(),
  athlet_id      uuid not null default auth.uid() references public.profile (id) on delete cascade,
  art            public.einwilligung_art not null,
  textversion    text not null check (char_length(textversion) between 1 and 40),
  erteilt_am     timestamptz not null default now(),
  widerrufen_am  timestamptz,
  check (widerrufen_am is null or widerrufen_am >= erteilt_am)
);
create unique index einwilligungen_aktiv_eindeutig
  on public.einwilligungen (athlet_id, art) where widerrufen_am is null;
comment on table public.einwilligungen is 'DSGVO-Einwilligungen. Werden nie gelöscht, nur widerrufen (Nachweispflicht).';

-- ---------------------------------------------------------------------
-- Hilfsfunktionen für die Zugriffsregeln
-- (security definer: dürfen intern nachsehen, ohne sich selbst im Kreis zu prüfen)
-- ---------------------------------------------------------------------
create function intern.ist_coach()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.profile
    where id = (select auth.uid()) and rolle = 'coach'
  );
$$;

create function intern.betreut(p_athlet uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.coach_athlet
    where coach_id = (select auth.uid()) and athlet_id = p_athlet and status <> 'beendet'
  );
$$;

create function intern.ist_mein_coach(p_coach uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.coach_athlet
    where athlet_id = (select auth.uid()) and coach_id = p_coach and status <> 'beendet'
  );
$$;

-- Für spätere Schritte (Gesundheitsdaten nur mit gültiger Einwilligung)
create function intern.hat_einwilligung(p_athlet uuid, p_art public.einwilligung_art)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.einwilligungen
    where athlet_id = p_athlet and art = p_art and widerrufen_am is null
  );
$$;

revoke all on function intern.ist_coach() from public, anon;
revoke all on function intern.betreut(uuid) from public, anon;
revoke all on function intern.ist_mein_coach(uuid) from public, anon;
revoke all on function intern.hat_einwilligung(uuid, public.einwilligung_art) from public, anon;
grant execute on function intern.ist_coach() to authenticated;
grant execute on function intern.betreut(uuid) to authenticated;
grant execute on function intern.ist_mein_coach(uuid) to authenticated;
grant execute on function intern.hat_einwilligung(uuid, public.einwilligung_art) to authenticated;

-- ---------------------------------------------------------------------
-- Automatik: neues Konto → Profil mit Rolle "athlet"
-- ---------------------------------------------------------------------
create function intern.profil_anlegen()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profile (id, anzeigename)
  values (new.id, left(btrim(split_part(coalesce(new.email, ''), '@', 1)), 80))
  on conflict (id) do nothing;
  return new;
end;
$$;
revoke all on function intern.profil_anlegen() from public, anon, authenticated;

create trigger profil_anlegen
  after insert on auth.users
  for each row execute function intern.profil_anlegen();

-- ---------------------------------------------------------------------
-- Automatik: Betreuung nur von Coach zu Athlet
-- ---------------------------------------------------------------------
create function intern.coach_athlet_pruefen()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if not exists (select 1 from public.profile where id = new.coach_id and rolle = 'coach') then
    raise exception 'Betreuung nur durch ein Konto mit Rolle coach möglich';
  end if;
  if not exists (select 1 from public.profile where id = new.athlet_id and rolle = 'athlet') then
    raise exception 'Betreut werden können nur Konten mit Rolle athlet';
  end if;
  return new;
end;
$$;
revoke all on function intern.coach_athlet_pruefen() from public, anon, authenticated;

create trigger coach_athlet_pruefen
  before insert or update of coach_id, athlet_id on public.coach_athlet
  for each row execute function intern.coach_athlet_pruefen();

-- ---------------------------------------------------------------------
-- Automatik: Einwilligungen – Zeitpunkt setzt die Datenbank, Widerruf ist endgültig
-- ---------------------------------------------------------------------
create function intern.einwilligung_schuetzen()
returns trigger language plpgsql set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    new.erteilt_am := now();
    new.widerrufen_am := null;
    return new;
  end if;
  -- UPDATE: nur Widerruf erlaubt, und nur einmal
  if old.widerrufen_am is not null then
    raise exception 'Diese Einwilligung ist bereits widerrufen';
  end if;
  if new.widerrufen_am is null then
    raise exception 'Eine Einwilligung kann nur widerrufen werden';
  end if;
  if new.athlet_id <> old.athlet_id or new.art <> old.art
     or new.textversion <> old.textversion or new.erteilt_am <> old.erteilt_am then
    raise exception 'Eine Einwilligung kann nicht verändert werden';
  end if;
  new.widerrufen_am := now();
  return new;
end;
$$;

create trigger einwilligung_schuetzen
  before insert or update on public.einwilligungen
  for each row execute function intern.einwilligung_schuetzen();

-- ---------------------------------------------------------------------
-- Zugriffsregeln (RLS)
-- ---------------------------------------------------------------------
alter table public.profile        enable row level security;
alter table public.coach_athlet   enable row level security;
alter table public.einladungen    enable row level security;
alter table public.einwilligungen enable row level security;

-- Grundsatz: erst alles wegnehmen, dann gezielt erlauben
revoke all on public.profile, public.coach_athlet, public.einladungen, public.einwilligungen
  from anon, authenticated;

-- profile: sich selbst, betreute Athleten, eigenen Coach sehen; nur eigenen Namen ändern
grant select on public.profile to authenticated;
grant update (anzeigename) on public.profile to authenticated;

create policy profile_lesen on public.profile
  for select to authenticated
  using (id = (select auth.uid()) or intern.betreut(id) or intern.ist_mein_coach(id));

create policy profile_eigenen_namen_aendern on public.profile
  for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- coach_athlet: beide Seiten sehen die Betreuung; nur der Coach legt an und ändert
grant select on public.coach_athlet to authenticated;
grant insert (coach_id, athlet_id, status, erfahrungsstufe, start_am) on public.coach_athlet to authenticated;
grant update (status, erfahrungsstufe, start_am) on public.coach_athlet to authenticated;

create policy coach_athlet_lesen on public.coach_athlet
  for select to authenticated
  using (coach_id = (select auth.uid()) or athlet_id = (select auth.uid()));

create policy coach_athlet_anlegen on public.coach_athlet
  for insert to authenticated
  with check (coach_id = (select auth.uid()) and intern.ist_coach());

create policy coach_athlet_aendern on public.coach_athlet
  for update to authenticated
  using (coach_id = (select auth.uid()) and intern.ist_coach())
  with check (coach_id = (select auth.uid()));

-- einladungen: nur der Coach, nur seine eigenen
grant select, delete on public.einladungen to authenticated;
grant insert (email, gueltig_bis) on public.einladungen to authenticated;
grant update (gueltig_bis) on public.einladungen to authenticated;

create policy einladungen_coach on public.einladungen
  for all to authenticated
  using (coach_id = (select auth.uid()) and intern.ist_coach())
  with check (coach_id = (select auth.uid()) and intern.ist_coach());

-- einwilligungen: Athlet erteilt und widerruft selbst; Coach darf nur lesen
grant select on public.einwilligungen to authenticated;
grant insert (athlet_id, art, textversion) on public.einwilligungen to authenticated;
grant update (widerrufen_am) on public.einwilligungen to authenticated;

create policy einwilligungen_lesen on public.einwilligungen
  for select to authenticated
  using (athlet_id = (select auth.uid()) or intern.betreut(athlet_id));

create policy einwilligungen_erteilen on public.einwilligungen
  for insert to authenticated
  with check (athlet_id = (select auth.uid()));

create policy einwilligungen_widerrufen on public.einwilligungen
  for update to authenticated
  using (athlet_id = (select auth.uid()))
  with check (athlet_id = (select auth.uid()));

-- ---------------------------------------------------------------------
-- Bestehende Konten nachtragen und dein Konto zum Coach machen
-- ---------------------------------------------------------------------
insert into public.profile (id, anzeigename)
select id, left(btrim(split_part(coalesce(email, ''), '@', 1)), 80)
from auth.users
on conflict (id) do nothing;

do $$
declare
  anzahl int;
begin
  select count(*) into anzahl from auth.users;
  if anzahl <> 1 then
    raise exception 'Erwartet war genau 1 Konto (deins), gefunden: %. Es wurde nichts gespeichert.', anzahl;
  end if;
  update public.profile set rolle = 'coach'
  where id = (select id from auth.users limit 1);
end $$;

commit;

-- Kontrolle: Hier sollte genau eine Zeile mit rolle = coach erscheinen.
select p.rolle, p.anzeigename, p.erstellt_am
from public.profile p;
