-- =====================================================================
-- Coaching App · Schritt 2.4 · Geschützter Gesundheitsbereich
-- Im SQL Editor EINMAL ausführen, nach 003-stammdaten.sql.
-- Danach 004b-gesundheit-zugriff.sql: Die App erreicht das Schema nur über
-- diese Funktionen; "gesundheit" wird NICHT in der Data API freigegeben.
--
-- Eigenes Schema "gesundheit" (getrennt von den Trainingsdaten):
--   anamnese     – Erstanamnese, jede Aktualisierung ist eine neue Version
--   beschwerden  – aktuelle / frühere Beschwerden mit Zeitraum
--   protokoll    – wer hat wann etwas angelegt, geändert oder gelöscht
--                  (ohne Inhalte, damit keine Gesundheitsdaten doppelt liegen)
--
-- Regeln:
--   * Eintragen nur durch die Person selbst und nur mit gültiger Einwilligung
--     "gesundheitsdaten".
--   * Lesen: die Person selbst immer; der Coach nur bei laufender Betreuung
--     UND gültiger Einwilligung. Nach Widerruf sieht der Coach nichts mehr.
--   * Löschen eigener Angaben ist immer möglich.
--   * Der Coach schreibt hier nichts. Die App stellt keine Diagnosen.
-- =====================================================================

begin;

create schema gesundheit;
revoke all on schema gesundheit from public, anon;
grant usage on schema gesundheit to authenticated;

-- Darf die angemeldete Person die Gesundheitsdaten von p_athlet lesen?
create function intern.darf_gesundheit_lesen(p_athlet uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select p_athlet = (select auth.uid())
      or (intern.betreut(p_athlet) and intern.hat_einwilligung(p_athlet, 'gesundheitsdaten'));
$$;
revoke all on function intern.darf_gesundheit_lesen(uuid) from public, anon;
grant execute on function intern.darf_gesundheit_lesen(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- Tabellen
-- ---------------------------------------------------------------------
create table gesundheit.anamnese (
  id             uuid primary key default gen_random_uuid(),
  athlet_id      uuid not null default auth.uid() references public.profile (id) on delete cascade,
  version        integer not null,
  fragenversion  text not null check (char_length(fragenversion) between 1 and 40),
  antworten      jsonb not null
                 check (jsonb_typeof(antworten) = 'object' and octet_length(antworten::text) <= 20000),
  erstellt_am    timestamptz not null default now(),
  erstellt_von   uuid default auth.uid(),
  unique (athlet_id, version)
);
comment on table gesundheit.anamnese is 'Erstanamnese. Jede Aktualisierung ist eine neue Version; alte bleiben erhalten.';

create table gesundheit.beschwerden (
  id               uuid primary key default gen_random_uuid(),
  athlet_id        uuid not null default auth.uid() references public.profile (id) on delete cascade,
  koerperregion    text not null
                   check (koerperregion in ('nacken', 'schulter', 'ellbogen', 'hand', 'oberer_ruecken',
                                            'unterer_ruecken', 'huefte', 'knie', 'sprunggelenk', 'fuss',
                                            'sonstiges')),
  beschreibung     text not null default '' check (char_length(beschreibung) <= 1000),
  seit             date,
  bis              date,
  erstellt_am      timestamptz not null default now(),
  aktualisiert_am  timestamptz not null default now(),
  check (bis is null or seit is null or bis >= seit)
);
create index beschwerden_athlet_idx on gesundheit.beschwerden (athlet_id);

create table gesundheit.protokoll (
  id         bigint generated always as identity primary key,
  zeitpunkt  timestamptz not null default now(),
  athlet_id  uuid not null references public.profile (id) on delete cascade,
  wer        uuid,
  aktion     text not null,
  tabelle    text not null,
  zeile      uuid
);
create index protokoll_athlet_idx on gesundheit.protokoll (athlet_id, zeitpunkt desc);
comment on table gesundheit.protokoll is 'Änderungsprotokoll für Gesundheitsdaten. Enthält keine Inhalte.';

-- ---------------------------------------------------------------------
-- Automatik
-- ---------------------------------------------------------------------
create function intern.anamnese_version()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  -- Gleichzeitiges Speichern derselben Person nacheinander abarbeiten
  perform pg_advisory_xact_lock(hashtext('anamnese:' || new.athlet_id::text));
  select coalesce(max(version), 0) + 1 into new.version
  from gesundheit.anamnese where athlet_id = new.athlet_id;
  new.erstellt_am := now();
  new.erstellt_von := auth.uid();
  return new;
end;
$$;
revoke all on function intern.anamnese_version() from public, anon, authenticated;

create trigger anamnese_version
  before insert on gesundheit.anamnese
  for each row execute function intern.anamnese_version();

create trigger beschwerden_aktualisiert
  before insert or update on gesundheit.beschwerden
  for each row execute function intern.aktualisiert_setzen();

create function intern.gesundheit_protokollieren()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  athlet uuid := case when tg_op = 'DELETE' then old.athlet_id else new.athlet_id end;
  zeile uuid := case when tg_op = 'DELETE' then old.id else new.id end;
begin
  -- Wird gerade das ganze Konto gelöscht, gibt es nichts mehr zu protokollieren
  if exists (select 1 from public.profile where id = athlet) then
    insert into gesundheit.protokoll (athlet_id, wer, aktion, tabelle, zeile)
    values (athlet, auth.uid(), lower(tg_op), tg_table_name, zeile);
  end if;
  return null;
end;
$$;
revoke all on function intern.gesundheit_protokollieren() from public, anon, authenticated;

create trigger anamnese_protokoll
  after insert or update or delete on gesundheit.anamnese
  for each row execute function intern.gesundheit_protokollieren();

create trigger beschwerden_protokoll
  after insert or update or delete on gesundheit.beschwerden
  for each row execute function intern.gesundheit_protokollieren();

-- ---------------------------------------------------------------------
-- Zugriffsregeln
-- ---------------------------------------------------------------------
alter table gesundheit.anamnese    enable row level security;
alter table gesundheit.beschwerden enable row level security;
alter table gesundheit.protokoll   enable row level security;

revoke all on all tables in schema gesundheit from public, anon, authenticated;

grant select, delete on gesundheit.anamnese to authenticated;
grant insert (fragenversion, antworten) on gesundheit.anamnese to authenticated;

grant select, delete on gesundheit.beschwerden to authenticated;
grant insert (koerperregion, beschreibung, seit, bis) on gesundheit.beschwerden to authenticated;
grant update (koerperregion, beschreibung, seit, bis) on gesundheit.beschwerden to authenticated;

grant select on gesundheit.protokoll to authenticated;

create policy anamnese_lesen on gesundheit.anamnese
  for select to authenticated using (intern.darf_gesundheit_lesen(athlet_id));
create policy anamnese_anlegen on gesundheit.anamnese
  for insert to authenticated
  with check (athlet_id = (select auth.uid())
              and intern.hat_einwilligung((select auth.uid()), 'gesundheitsdaten'));
create policy anamnese_loeschen on gesundheit.anamnese
  for delete to authenticated using (athlet_id = (select auth.uid()));

create policy beschwerden_lesen on gesundheit.beschwerden
  for select to authenticated using (intern.darf_gesundheit_lesen(athlet_id));
create policy beschwerden_anlegen on gesundheit.beschwerden
  for insert to authenticated
  with check (athlet_id = (select auth.uid())
              and intern.hat_einwilligung((select auth.uid()), 'gesundheitsdaten'));
create policy beschwerden_aendern on gesundheit.beschwerden
  for update to authenticated
  using (athlet_id = (select auth.uid()))
  with check (athlet_id = (select auth.uid())
              and intern.hat_einwilligung((select auth.uid()), 'gesundheitsdaten'));
create policy beschwerden_loeschen on gesundheit.beschwerden
  for delete to authenticated using (athlet_id = (select auth.uid()));

create policy protokoll_lesen on gesundheit.protokoll
  for select to authenticated using (intern.darf_gesundheit_lesen(athlet_id));

commit;

select 'eingerichtet' as ergebnis;
