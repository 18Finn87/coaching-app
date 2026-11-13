-- =====================================================================
-- Coaching App · Phase 20 · Eigene Übungen der Kunden und Übungsvorschläge
-- Im SQL Editor EINMAL ausführen, nach 023-koerper-fragebogen.sql.
--
-- Kunden dürfen eigene Übungen anlegen. Diese gehören weiter zur Sammlung
-- ihres Coachs (coach_id), sind aber nur für die Person selbst und den Coach
-- sichtbar (privat_fuer). Der Coach kann sie für alle freigeben
-- (privat_fuer = null); danach ändert nur noch der Coach sie.
-- Kunden können eine Übung dem Coach vorschlagen (kunden_nachrichten,
-- art = 'uebung_vorschlag'); in den Plan kommt sie nur, wenn der Coach das tut.
-- =====================================================================

begin;

alter table public.uebungen
  add column privat_fuer uuid references public.profile (id) on delete cascade;
comment on column public.uebungen.privat_fuer is
  'Eigene Übung einer Kundin/eines Kunden: nur für diese Person und den Coach sichtbar. Leer = für alle Kunden des Coachs.';

-- Namen eindeutig je Sammlung des Coachs bzw. je Person
drop index public.uebungen_name_eindeutig;
create unique index uebungen_name_eindeutig on public.uebungen
  (coach_id, coalesce(privat_fuer, '00000000-0000-0000-0000-000000000000'::uuid), lower(name));

-- Bei eigenen Übungen trägt die Datenbank den Coach selbst ein
create function intern.uebung_coach_setzen()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.privat_fuer is not null and new.privat_fuer = (select auth.uid()) then
    if tg_op = 'INSERT' then
      select ca.coach_id into new.coach_id
      from public.coach_athlet ca
      where ca.athlet_id = new.privat_fuer and ca.status <> 'beendet'
      order by ca.coach_id
      limit 1;
    else
      new.coach_id := old.coach_id;
    end if;
  end if;
  return new;
end;
$$;
revoke all on function intern.uebung_coach_setzen() from public, anon, authenticated;
create trigger uebungen_coach_setzen
  before insert or update on public.uebungen
  for each row execute function intern.uebung_coach_setzen();

grant insert (privat_fuer) on public.uebungen to authenticated;
grant update (privat_fuer) on public.uebungen to authenticated;

drop policy uebungen_lesen on public.uebungen;
drop policy uebungen_anlegen on public.uebungen;
drop policy uebungen_aendern on public.uebungen;

create policy uebungen_lesen on public.uebungen
  for select to authenticated
  using (coach_id = (select auth.uid())
         or (intern.ist_mein_coach(coach_id) and (privat_fuer is null or privat_fuer = (select auth.uid()))));

create policy uebungen_anlegen on public.uebungen
  for insert to authenticated
  with check ((coach_id = (select auth.uid()) and intern.ist_coach() and privat_fuer is null)
              or (privat_fuer = (select auth.uid()) and intern.ist_mein_coach(coach_id)
                  and intern.training_schreibbar((select auth.uid()))));

create policy uebungen_aendern on public.uebungen
  for update to authenticated
  using ((coach_id = (select auth.uid()) and intern.ist_coach())
         or privat_fuer = (select auth.uid()))
  with check ((coach_id = (select auth.uid()) and intern.ist_coach())
              or (privat_fuer = (select auth.uid()) and intern.ist_mein_coach(coach_id)
                  and intern.training_schreibbar((select auth.uid()))));

-- Im Training dürfen nur sichtbare Übungen stehen (gleiche Regel wie Lesen)
create or replace function intern.uebung_sichtbar(p_uebung uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.uebungen u
    where u.id = p_uebung
      and (u.coach_id = (select auth.uid())
           or (intern.ist_mein_coach(u.coach_id) and (u.privat_fuer is null or u.privat_fuer = (select auth.uid()))))
  );
$$;

-- ---------------------------------------------------------------------
-- Übungsvorschlag an den Coach
-- ---------------------------------------------------------------------
alter table public.kunden_nachrichten
  add column uebung_id uuid references public.uebungen (id) on delete set null;

do $$
declare
  c record;
begin
  for c in
    select conname from pg_constraint
    where conrelid = 'public.kunden_nachrichten'::regclass and contype = 'c' and pg_get_constraintdef(oid) like '%art%'
  loop
    execute format('alter table public.kunden_nachrichten drop constraint %I', c.conname);
  end loop;
end $$;
alter table public.kunden_nachrichten
  add constraint kunden_nachrichten_art_check
  check (art in ('kommentar', 'ziele_geaendert', 'uebung_vorschlag'));

grant insert (uebung_id) on public.kunden_nachrichten to authenticated;

drop policy nachrichten_anlegen on public.kunden_nachrichten;
create policy nachrichten_anlegen on public.kunden_nachrichten for insert to authenticated
  with check (athlet_id = (select auth.uid()) and intern.training_schreibbar(athlet_id)
              and ((art = 'uebung_vorschlag') = (uebung_id is not null))
              and (uebung_id is null or intern.uebung_sichtbar(uebung_id)));

commit;

select 'eingerichtet' as ergebnis;
