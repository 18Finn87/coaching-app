-- =====================================================================
-- Coaching App · Phase 14 · Nachrichten an den Coach und Zieländerungen
-- Im SQL Editor EINMAL ausführen, nach 017-sicherheit.sql.
--
-- * public.kunden_nachrichten: Kommentar an den Coach oder „Meine Ziele haben
--   sich geändert“. Der Coach antwortet oder markiert „gesehen“.
-- * Antwort des Coaches → Hinweis an die Person (Glocke), wie beim Check-in.
-- * Die App ändert nichts am Plan.
-- =====================================================================

begin;

create table public.kunden_nachrichten (
  id                uuid primary key default gen_random_uuid(),
  athlet_id         uuid not null default auth.uid() references public.profile (id) on delete cascade,
  art               text not null check (art in ('kommentar', 'ziele_geaendert')),
  text              text not null check (char_length(btrim(text)) between 1 and 2000),
  erstellt_am       timestamptz not null default now(),
  coach_antwort     text not null default '' check (char_length(coach_antwort) <= 2000),
  coach_antwort_am  timestamptz,
  gesehen_am        timestamptz
);
create index kunden_nachrichten_athlet_idx on public.kunden_nachrichten (athlet_id, erstellt_am desc);
comment on table public.kunden_nachrichten is
  'Nachricht an den Coach (kommentar) oder Hinweis „Ziele haben sich geändert“. Offen, bis der Coach antwortet oder „gesehen“ markiert.';

alter table public.kunden_nachrichten enable row level security;
revoke all on public.kunden_nachrichten from public, anon, authenticated;
grant select on public.kunden_nachrichten to authenticated;
grant insert (art, text) on public.kunden_nachrichten to authenticated;
grant delete on public.kunden_nachrichten to authenticated;

create policy nachrichten_lesen on public.kunden_nachrichten for select to authenticated
  using (intern.training_lesbar(athlet_id));
create policy nachrichten_anlegen on public.kunden_nachrichten for insert to authenticated
  with check (athlet_id = (select auth.uid()) and intern.training_schreibbar(athlet_id));
-- Die Person kann eine eigene Nachricht zurückziehen, solange keine Antwort da ist
create policy nachrichten_loeschen on public.kunden_nachrichten for delete to authenticated
  using (athlet_id = (select auth.uid()) and coach_antwort = '');

-- Coach: antworten (leer = nur „gesehen“)
create function public.nachricht_beantworten(p_nachricht uuid, p_antwort text)
returns void language plpgsql volatile security definer set search_path = '' as $$
declare
  a uuid;
  t text := left(btrim(coalesce(p_antwort, '')), 2000);
begin
  select athlet_id into a from public.kunden_nachrichten where id = p_nachricht;
  if a is null or not intern.ist_coach() or not intern.betreut(a) then
    raise exception 'Nicht erlaubt.' using errcode = '42501';
  end if;
  update public.kunden_nachrichten
  set coach_antwort = case when t = '' then coach_antwort else t end,
      coach_antwort_am = case when t = '' then coach_antwort_am else now() end,
      gesehen_am = coalesce(gesehen_am, now())
  where id = p_nachricht;
  if t <> '' then
    perform intern.benachrichtigen(a, 'nachricht_antwort', a, p_nachricht, 'Dein Coach hat dir geantwortet.');
  end if;
end;
$$;
revoke all on function public.nachricht_beantworten(uuid, text) from public, anon;
grant execute on function public.nachricht_beantworten(uuid, text) to authenticated;

-- Neue Hinweisart für die Glocke
do $$
declare
  c record;
begin
  for c in
    select conname from pg_constraint
    where conrelid = 'public.benachrichtigungen'::regclass and contype = 'c' and pg_get_constraintdef(oid) like '%art%'
  loop
    execute format('alter table public.benachrichtigungen drop constraint %I', c.conname);
  end loop;
end $$;
alter table public.benachrichtigungen
  add constraint benachrichtigungen_art_check
  check (art in ('checkin_neu', 'checkin_antwort', 'checkin_erinnerung', 'evaluation_faellig', 'zusammenfassung',
                 'reha_hinweis', 'nachricht_antwort'));

commit;

select 'eingerichtet' as ergebnis;
