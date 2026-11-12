-- =====================================================================
-- Coaching App · Phase 16 · Wöchentliche Abfrage: Rückblick und Ausblick
-- Im SQL Editor EINMAL ausführen, nach 019-tagesabfrage.sql.
--
-- * public.checkins bekommt: Bewertung der Woche (1–5), „Was lief gut?“,
--   „Was war schwer?“, Ausblick „nächste Woche schwierig?“ mit Gründen
--   (Prüfungen, Schichtdienst, Reise, Sonstiges) und Text.
-- * „Krankheit“ ist eine Gesundheitsangabe: eigene Tabelle im geschützten
--   Bereich gesundheit.checkin_krankheit, nur mit Einwilligung, protokolliert.
-- * Die App passt keinen Plan an – der Coach sieht den Hinweis und entscheidet.
-- =====================================================================

begin;

alter table public.checkins
  add column woche_bewertung    smallint check (woche_bewertung between 1 and 5),
  add column gut                text not null default '' check (char_length(gut) <= 1000),
  add column schwer             text not null default '' check (char_length(schwer) <= 1000),
  add column ausblick_schwierig boolean,
  add column ausblick_gruende   text[] not null default '{}'
    check (ausblick_gruende <@ array['pruefungen', 'schichtdienst', 'reise', 'sonstiges']::text[]),
  add column ausblick_text      text not null default '' check (char_length(ausblick_text) <= 500);
comment on column public.checkins.ausblick_schwierig is 'Wird die kommende Woche schwierig? (Gründe ohne Krankheit – die liegt geschützt in gesundheit.checkin_krankheit)';

grant insert (woche_bewertung, gut, schwer, ausblick_schwierig, ausblick_gruende, ausblick_text) on public.checkins to authenticated;
grant update (woche_bewertung, gut, schwer, ausblick_schwierig, ausblick_gruende, ausblick_text) on public.checkins to authenticated;

-- ---------------------------------------------------------------------
-- Krankheit als Grund (geschützter Bereich)
-- ---------------------------------------------------------------------
create table gesundheit.checkin_krankheit (
  id           uuid primary key default gen_random_uuid(),
  checkin_id   uuid not null unique references public.checkins (id) on delete cascade,
  athlet_id    uuid not null default auth.uid() references public.profile (id) on delete cascade,
  erstellt_am  timestamptz not null default now()
);
comment on table gesundheit.checkin_krankheit is 'Ausblick: nächste Woche schwierig wegen Krankheit (nur ob, keine Einzelheiten).';

create trigger checkin_krankheit_protokoll
  after insert or update or delete on gesundheit.checkin_krankheit
  for each row execute function intern.gesundheit_protokollieren();

alter table gesundheit.checkin_krankheit enable row level security;
revoke all on gesundheit.checkin_krankheit from public, anon, authenticated;
grant select, delete on gesundheit.checkin_krankheit to authenticated;
grant insert (checkin_id) on gesundheit.checkin_krankheit to authenticated;

create policy ck_lesen on gesundheit.checkin_krankheit for select to authenticated
  using (intern.darf_gesundheit_lesen(athlet_id));
create policy ck_anlegen on gesundheit.checkin_krankheit for insert to authenticated
  with check (athlet_id = (select auth.uid())
              and intern.hat_einwilligung((select auth.uid()), 'gesundheitsdaten')
              and exists (select 1 from public.checkins c
                          where c.id = checkin_id and c.athlet_id = (select auth.uid())));
create policy ck_loeschen on gesundheit.checkin_krankheit for delete to authenticated
  using (athlet_id = (select auth.uid()));

create function public.checkin_krankheit_setzen(p_checkin uuid, p_krank boolean)
returns void language plpgsql volatile security invoker set search_path = '' as $$
begin
  if p_krank then
    insert into gesundheit.checkin_krankheit (checkin_id) values (p_checkin) on conflict (checkin_id) do nothing;
  else
    delete from gesundheit.checkin_krankheit where checkin_id = p_checkin;
  end if;
end;
$$;

create function public.checkin_krankheit_liste(p_athlet uuid)
returns table (checkin_id uuid)
language sql stable security invoker set search_path = '' as $$
  select k.checkin_id from gesundheit.checkin_krankheit k where k.athlet_id = p_athlet;
$$;

revoke all on function public.checkin_krankheit_setzen(uuid, boolean) from public, anon;
revoke all on function public.checkin_krankheit_liste(uuid) from public, anon;
grant execute on function public.checkin_krankheit_setzen(uuid, boolean) to authenticated;
grant execute on function public.checkin_krankheit_liste(uuid) to authenticated;

commit;

select 'eingerichtet' as ergebnis;
