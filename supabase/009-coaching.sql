-- =====================================================================
-- Coaching App · Phase 6 · Coaching und Evaluation
-- Im SQL Editor EINMAL ausführen, nach 008-analyse.sql.
--
-- checkins                       – wöchentlicher Check-in (ohne Gesundheitsteil)
-- gesundheit.checkin_gesundheit  – Schmerzen/Beschwerden der Woche (geschützt,
--                                  nur mit Einwilligung "gesundheitsdaten")
-- benachrichtigungen             – Glocke in der App (ohne Gesundheitsinhalte)
-- evaluationsregeln              – wann eine Evaluation fällig wird
--                                  (Anfänger fest 4 Wochen / 10 Einheiten)
-- evaluationen                   – fällige und erledigte Evaluationen
--
-- Einmal täglich (pg_cron, ca. 6–7 Uhr): Evaluationen prüfen,
-- Tageszusammenfassung der Einheiten, sonntags Check-in-Erinnerung.
-- Die App ÄNDERT NIE einen Plan. Keine Nachricht pro einzelner Einheit.
-- =====================================================================

begin;

-- Montag der laufenden Woche (deutsche Zeit)
create function intern.wochenbeginn(p_zeit timestamptz default now())
returns date language sql stable set search_path = '' as $$
  select (date_trunc('week', p_zeit at time zone 'Europe/Berlin'))::date;
$$;
revoke all on function intern.wochenbeginn(timestamptz) from public, anon;
grant execute on function intern.wochenbeginn(timestamptz) to authenticated;

-- ---------------------------------------------------------------------
-- Benachrichtigungen (Glocke)
-- ---------------------------------------------------------------------
create table public.benachrichtigungen (
  id             uuid primary key default gen_random_uuid(),
  empfaenger_id  uuid not null references public.profile (id) on delete cascade,
  art            text not null check (art in ('checkin_neu', 'checkin_antwort', 'checkin_erinnerung',
                                              'evaluation_faellig', 'zusammenfassung')),
  athlet_id      uuid references public.profile (id) on delete cascade,
  bezug_id       uuid,
  text_kurz      text not null check (char_length(text_kurz) between 1 and 200),
  erstellt_am    timestamptz not null default now(),
  gelesen_am     timestamptz
);
create index benachrichtigungen_empfaenger_idx on public.benachrichtigungen (empfaenger_id, erstellt_am desc);
comment on table public.benachrichtigungen is 'Glocke in der App. Enthält nie Gesundheitsinhalte, nur kurze Hinweise.';

create function intern.benachrichtigen(p_empfaenger uuid, p_art text, p_athlet uuid, p_bezug uuid, p_text text)
returns void language sql volatile security definer set search_path = '' as $$
  insert into public.benachrichtigungen (empfaenger_id, art, athlet_id, bezug_id, text_kurz)
  values (p_empfaenger, p_art, p_athlet, p_bezug, left(p_text, 200));
$$;
revoke all on function intern.benachrichtigen(uuid, text, uuid, uuid, text) from public, anon, authenticated;

create function intern.name_von(p_person uuid)
returns text language sql stable security definer set search_path = '' as $$
  select coalesce(nullif(anzeigename, ''), 'Ohne Namen') from public.profile where id = p_person;
$$;
revoke all on function intern.name_von(uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- Check-ins
-- ---------------------------------------------------------------------
create table public.checkins (
  id                uuid primary key default gen_random_uuid(),
  athlet_id         uuid not null default auth.uid() references public.profile (id) on delete cascade,
  woche             date not null default intern.wochenbeginn(),
  schlaf            smallint not null check (schlaf between 1 and 5),
  stress            smallint not null check (stress between 1 and 5),
  energie           smallint not null check (energie between 1 and 5),
  muskelkater       smallint not null check (muskelkater between 1 and 5),
  motivation        smallint not null check (motivation between 1 and 5),
  notiz             text not null default '' check (char_length(notiz) <= 1000),
  coach_antwort     text not null default '' check (char_length(coach_antwort) <= 2000),
  coach_antwort_am  timestamptz,
  erstellt_am       timestamptz not null default now(),
  aktualisiert_am   timestamptz not null default now(),
  unique (athlet_id, woche),
  check (extract(isodow from woche) = 1)
);
comment on table public.checkins is 'Wöchentlicher Check-in. Skalen 1–5. Gesundheitsteil liegt getrennt in gesundheit.checkin_gesundheit.';

create trigger checkins_aktualisiert
  before insert or update on public.checkins
  for each row execute function intern.aktualisiert_setzen();

create function intern.checkin_melden()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  c uuid;
begin
  for c in
    select coach_id from public.coach_athlet where athlet_id = new.athlet_id and status in ('aktiv', 'pausiert')
  loop
    perform intern.benachrichtigen(c, 'checkin_neu', new.athlet_id, new.id,
                                   'Neuer Check-in von ' || intern.name_von(new.athlet_id));
  end loop;
  return null;
end;
$$;
revoke all on function intern.checkin_melden() from public, anon, authenticated;

create trigger checkin_melden
  after insert on public.checkins
  for each row execute function intern.checkin_melden();

alter table public.checkins enable row level security;
revoke all on public.checkins from anon, authenticated;
grant select, delete on public.checkins to authenticated;
grant insert (schlaf, stress, energie, muskelkater, motivation, notiz) on public.checkins to authenticated;
grant update (schlaf, stress, energie, muskelkater, motivation, notiz) on public.checkins to authenticated;

create policy checkins_lesen on public.checkins for select to authenticated
  using (intern.training_lesbar(athlet_id));
create policy checkins_anlegen on public.checkins for insert to authenticated
  with check (intern.training_schreibbar(athlet_id) and woche = intern.wochenbeginn());
-- Ändern nur in der laufenden Woche
create policy checkins_aendern on public.checkins for update to authenticated
  using (athlet_id = (select auth.uid()) and woche = intern.wochenbeginn())
  with check (intern.training_schreibbar(athlet_id) and woche = intern.wochenbeginn());
create policy checkins_loeschen on public.checkins for delete to authenticated
  using (athlet_id = (select auth.uid()));

-- Antwort des Coaches (nur dieses Feld; die Werte der Person bleiben unberührt)
create function public.checkin_antworten(p_checkin uuid, p_antwort text)
returns void language plpgsql volatile security definer set search_path = '' as $$
declare
  a uuid;
  t text := btrim(coalesce(p_antwort, ''));
begin
  select athlet_id into a from public.checkins where id = p_checkin;
  if a is null or not intern.ist_coach() or not intern.betreut(a) then
    raise exception 'Nicht erlaubt.' using errcode = '42501';
  end if;
  update public.checkins
  set coach_antwort = t, coach_antwort_am = case when t = '' then null else now() end
  where id = p_checkin;
  if t <> '' then
    perform intern.benachrichtigen(a, 'checkin_antwort', a, p_checkin, 'Dein Coach hat auf deinen Check-in geantwortet.');
  end if;
end;
$$;
revoke all on function public.checkin_antworten(uuid, text) from public, anon;
grant execute on function public.checkin_antworten(uuid, text) to authenticated;

-- ---------------------------------------------------------------------
-- Gesundheitsteil des Check-ins (geschützter Bereich)
-- ---------------------------------------------------------------------
create table gesundheit.checkin_gesundheit (
  id                 uuid primary key default gen_random_uuid(),
  checkin_id         uuid not null unique references public.checkins (id) on delete cascade,
  athlet_id          uuid not null default auth.uid() references public.profile (id) on delete cascade,
  schmerz_vorhanden  boolean not null,
  koerperregion      text check (koerperregion in ('nacken', 'schulter', 'ellbogen', 'hand', 'oberer_ruecken',
                                                   'unterer_ruecken', 'huefte', 'knie', 'sprunggelenk', 'fuss',
                                                   'sonstiges')),
  skala_0_10         smallint check (skala_0_10 between 0 and 10),
  notiz              text not null default '' check (char_length(notiz) <= 1000),
  erstellt_am        timestamptz not null default now(),
  aktualisiert_am    timestamptz not null default now(),
  check (schmerz_vorhanden or (koerperregion is null and skala_0_10 is null))
);

create trigger checkin_gesundheit_aktualisiert
  before insert or update on gesundheit.checkin_gesundheit
  for each row execute function intern.aktualisiert_setzen();
create trigger checkin_gesundheit_protokoll
  after insert or update or delete on gesundheit.checkin_gesundheit
  for each row execute function intern.gesundheit_protokollieren();

alter table gesundheit.checkin_gesundheit enable row level security;
revoke all on gesundheit.checkin_gesundheit from public, anon, authenticated;
grant select, delete on gesundheit.checkin_gesundheit to authenticated;
grant insert (checkin_id, schmerz_vorhanden, koerperregion, skala_0_10, notiz) on gesundheit.checkin_gesundheit to authenticated;
grant update (schmerz_vorhanden, koerperregion, skala_0_10, notiz) on gesundheit.checkin_gesundheit to authenticated;

create policy cg_lesen on gesundheit.checkin_gesundheit for select to authenticated
  using (intern.darf_gesundheit_lesen(athlet_id));
create policy cg_anlegen on gesundheit.checkin_gesundheit for insert to authenticated
  with check (athlet_id = (select auth.uid())
              and intern.hat_einwilligung((select auth.uid()), 'gesundheitsdaten')
              and exists (select 1 from public.checkins c
                          where c.id = checkin_id and c.athlet_id = (select auth.uid())));
create policy cg_aendern on gesundheit.checkin_gesundheit for update to authenticated
  using (athlet_id = (select auth.uid()))
  with check (athlet_id = (select auth.uid())
              and intern.hat_einwilligung((select auth.uid()), 'gesundheitsdaten'));
create policy cg_loeschen on gesundheit.checkin_gesundheit for delete to authenticated
  using (athlet_id = (select auth.uid()));

-- Zugriff der App (security invoker: die Regeln oben gelten unverändert)
create function public.checkin_gesundheit_liste(p_athlet uuid)
returns table (checkin_id uuid, schmerz_vorhanden boolean, koerperregion text, skala_0_10 smallint, notiz text)
language sql stable security invoker set search_path = '' as $$
  select g.checkin_id, g.schmerz_vorhanden, g.koerperregion, g.skala_0_10, g.notiz
  from gesundheit.checkin_gesundheit g
  where g.athlet_id = p_athlet;
$$;

create function public.checkin_gesundheit_speichern(
  p_checkin uuid, p_schmerz boolean, p_region text, p_skala integer, p_notiz text
)
returns void language plpgsql volatile security invoker set search_path = '' as $$
begin
  update gesundheit.checkin_gesundheit
  set schmerz_vorhanden = p_schmerz,
      koerperregion = case when p_schmerz then p_region end,
      skala_0_10 = case when p_schmerz then p_skala end,
      notiz = coalesce(p_notiz, '')
  where checkin_id = p_checkin;
  if not found then
    insert into gesundheit.checkin_gesundheit (checkin_id, schmerz_vorhanden, koerperregion, skala_0_10, notiz)
    values (p_checkin, p_schmerz, case when p_schmerz then p_region end,
            case when p_schmerz then p_skala end, coalesce(p_notiz, ''));
  end if;
end;
$$;

create function public.checkin_gesundheit_loeschen(p_checkin uuid)
returns integer language plpgsql volatile security invoker set search_path = '' as $$
declare
  anzahl integer;
begin
  delete from gesundheit.checkin_gesundheit where checkin_id = p_checkin;
  get diagnostics anzahl = row_count;
  return anzahl;
end;
$$;

do $$
declare
  f text;
begin
  foreach f in array array[
    'public.checkin_gesundheit_liste(uuid)',
    'public.checkin_gesundheit_speichern(uuid, boolean, text, integer, text)',
    'public.checkin_gesundheit_loeschen(uuid)'
  ] loop
    execute format('revoke all on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
end $$;

-- Benachrichtigungen: jede Person sieht nur ihre eigenen
alter table public.benachrichtigungen enable row level security;
revoke all on public.benachrichtigungen from anon, authenticated;
grant select, delete on public.benachrichtigungen to authenticated;
grant update (gelesen_am) on public.benachrichtigungen to authenticated;

create policy benachrichtigungen_lesen on public.benachrichtigungen for select to authenticated
  using (empfaenger_id = (select auth.uid()));
create policy benachrichtigungen_gelesen on public.benachrichtigungen for update to authenticated
  using (empfaenger_id = (select auth.uid())) with check (empfaenger_id = (select auth.uid()));
create policy benachrichtigungen_loeschen on public.benachrichtigungen for delete to authenticated
  using (empfaenger_id = (select auth.uid()));

-- ---------------------------------------------------------------------
-- Evaluationsregeln (Anfänger fest: 4 Wochen / 10 Einheiten)
-- ---------------------------------------------------------------------
create table public.evaluationsregeln (
  coach_id         uuid not null default auth.uid() references public.profile (id) on delete cascade,
  erfahrungsstufe  public.erfahrungsstufe not null check (erfahrungsstufe <> 'anfaenger'),
  nach_wochen      smallint not null check (nach_wochen between 1 and 52),
  nach_einheiten   smallint not null check (nach_einheiten between 1 and 200),
  aktualisiert_am  timestamptz not null default now(),
  primary key (coach_id, erfahrungsstufe)
);
comment on table public.evaluationsregeln is 'Eigene Werte für Fortgeschrittene/Sehr Erfahrene. Anfänger sind fest (4 Wochen / 10 Einheiten).';

create trigger evaluationsregeln_aktualisiert
  before insert or update on public.evaluationsregeln
  for each row execute function intern.aktualisiert_setzen();

alter table public.evaluationsregeln enable row level security;
revoke all on public.evaluationsregeln from anon, authenticated;
grant select on public.evaluationsregeln to authenticated;
grant insert (erfahrungsstufe, nach_wochen, nach_einheiten) on public.evaluationsregeln to authenticated;
grant update (nach_wochen, nach_einheiten) on public.evaluationsregeln to authenticated;

create policy regeln_lesen on public.evaluationsregeln for select to authenticated
  using (coach_id = (select auth.uid()));
create policy regeln_anlegen on public.evaluationsregeln for insert to authenticated
  with check (coach_id = (select auth.uid()) and intern.ist_coach());
create policy regeln_aendern on public.evaluationsregeln for update to authenticated
  using (coach_id = (select auth.uid())) with check (coach_id = (select auth.uid()));

-- Gültige Regel für eine Stufe (mit Standardwerten)
create function intern.evaluationsregel(p_coach uuid, p_stufe public.erfahrungsstufe)
returns table (wochen integer, einheiten integer)
language sql stable security definer set search_path = '' as $$
  select
    case when p_stufe = 'anfaenger' then 4
         else coalesce(r.nach_wochen, case when p_stufe = 'fortgeschritten' then 6 else 8 end) end,
    case when p_stufe = 'anfaenger' then 10
         else coalesce(r.nach_einheiten, case when p_stufe = 'fortgeschritten' then 16 else 20 end) end
  from (select 1) x
  left join public.evaluationsregeln r
    on r.coach_id = p_coach and r.erfahrungsstufe = p_stufe and p_stufe <> 'anfaenger';
$$;
revoke all on function intern.evaluationsregel(uuid, public.erfahrungsstufe) from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- Evaluationen
-- ---------------------------------------------------------------------
create table public.evaluationen (
  id                     uuid primary key default gen_random_uuid(),
  coach_id               uuid not null references public.profile (id) on delete cascade,
  athlet_id              uuid not null references public.profile (id) on delete cascade,
  plan_id                uuid not null references public.plaene (id) on delete cascade,
  planversion_id         uuid not null references public.planversionen (id) on delete cascade,
  zeitraum_von           timestamptz not null,
  faellig_seit           timestamptz not null,
  ausloeser              text not null check (ausloeser in ('wochen', 'einheiten')),
  regel_wochen           smallint not null,
  regel_einheiten        smallint not null,
  status                 text not null default 'faellig' check (status in ('faellig', 'verschoben', 'erledigt')),
  verschoben_bis         date,
  entscheidung           text check (entscheidung in ('beibehalten', 'anpassen')),
  coach_notiz            text not null default '' check (char_length(coach_notiz) <= 4000),
  erstellt_am            timestamptz not null default now(),
  erledigt_am            timestamptz,
  check (status <> 'erledigt' or entscheidung is not null),
  check (status <> 'verschoben' or verschoben_bis is not null)
);
create unique index evaluationen_eine_offene on public.evaluationen (plan_id) where status <> 'erledigt';
create index evaluationen_coach_idx on public.evaluationen (coach_id, status);
comment on table public.evaluationen is 'Erinnerung + Notiz. Eine Entscheidung ändert NIE automatisch einen Plan.';

create function intern.evaluation_schuetzen()
returns trigger language plpgsql set search_path = '' as $$
begin
  if old.status = 'erledigt' then
    if (to_jsonb(new) - 'coach_notiz') is distinct from (to_jsonb(old) - 'coach_notiz') then
      raise exception 'Eine abgeschlossene Evaluation bleibt unverändert (nur die Notiz ist änderbar).'
        using errcode = 'P0001';
    end if;
    return new;
  end if;
  if new.status = 'erledigt' then
    new.erledigt_am := now();
    new.verschoben_bis := null;
  elsif new.status = 'faellig' then
    new.verschoben_bis := null;
    new.entscheidung := null;
  end if;
  return new;
end;
$$;
revoke all on function intern.evaluation_schuetzen() from public, anon, authenticated;

create trigger evaluation_schuetzen
  before update on public.evaluationen
  for each row execute function intern.evaluation_schuetzen();

alter table public.evaluationen enable row level security;
revoke all on public.evaluationen from anon, authenticated;
grant select on public.evaluationen to authenticated;
grant update (status, verschoben_bis, entscheidung, coach_notiz) on public.evaluationen to authenticated;

-- Nur der Coach (Athleten sehen Evaluationen nicht)
create policy evaluationen_lesen on public.evaluationen for select to authenticated
  using (coach_id = (select auth.uid()) and intern.betreut(athlet_id));
create policy evaluationen_aendern on public.evaluationen for update to authenticated
  using (coach_id = (select auth.uid()) and intern.betreut(athlet_id))
  with check (coach_id = (select auth.uid()));

-- Prüft, welche Evaluationen fällig sind. Legt höchstens EINE offene pro Plan an.
-- Ändert keinen Plan. p_coach = null → alle Coaches (tägliche Prüfung).
create function intern.evaluationen_pruefen(p_coach uuid default null, p_jetzt timestamptz default now())
returns integer language plpgsql volatile security definer set search_path = '' as $$
declare
  v record;
  e record;
  regel record;
  basis timestamptz;
  n_datum timestamptz;
  w_datum timestamptz;
  faellig timestamptz;
  ausl text;
  neu integer := 0;
  eid uuid;
begin
  -- Verschobene, deren Termin erreicht ist, sind wieder fällig
  for e in
    update public.evaluationen ev set status = 'faellig'
    where ev.status = 'verschoben' and ev.verschoben_bis <= (p_jetzt at time zone 'Europe/Berlin')::date
      and (p_coach is null or ev.coach_id = p_coach)
    returning ev.id, ev.coach_id, ev.athlet_id
  loop
    perform intern.benachrichtigen(e.coach_id, 'evaluation_faellig', e.athlet_id, e.id,
                                   'Evaluation wieder fällig: ' || intern.name_von(e.athlet_id));
  end loop;

  for v in
    select pv.id as version_id, pv.plan_id, p.coach_id, p.athlet_id, p.titel, ca.erfahrungsstufe,
           greatest(coalesce(pv.veroeffentlicht_am, pv.erstellt_am),
                    coalesce(pv.gueltig_ab::timestamp at time zone 'Europe/Berlin', '-infinity')) as v_start
    from public.planversionen pv
    join public.plaene p on p.id = pv.plan_id
    join public.coach_athlet ca on ca.coach_id = p.coach_id and ca.athlet_id = p.athlet_id and ca.status = 'aktiv'
    where pv.status = 'veroeffentlicht' and p.status = 'aktiv'
      and (p_coach is null or p.coach_id = p_coach)
      and not exists (select 1 from public.evaluationen x where x.plan_id = pv.plan_id and x.status <> 'erledigt')
  loop
    select * into regel from intern.evaluationsregel(v.coach_id, v.erfahrungsstufe);
    basis := greatest(v.v_start,
                      coalesce((select max(x.erledigt_am) from public.evaluationen x
                                where x.plan_id = v.plan_id and x.status = 'erledigt'), '-infinity'));

    -- Zeitpunkt der n-ten Einheit seit Beginn (nur Einheiten dieses Plans)
    select t.gestartet_am into n_datum
    from public.trainingseinheiten t
    join public.planversionen tv on tv.id = t.planversion_id
    where tv.plan_id = v.plan_id and t.athlet_id = v.athlet_id and t.status = 'abgeschlossen'
      and t.gestartet_am >= basis and t.gestartet_am <= p_jetzt
    order by t.gestartet_am
    offset regel.einheiten - 1 limit 1;

    w_datum := basis + make_interval(weeks => regel.wochen);

    -- Was zuerst eintritt
    if n_datum is not null and n_datum <= w_datum then
      faellig := n_datum; ausl := 'einheiten';
    elsif w_datum <= p_jetzt then
      faellig := w_datum; ausl := 'wochen';
    else
      continue;
    end if;

    insert into public.evaluationen (coach_id, athlet_id, plan_id, planversion_id, zeitraum_von, faellig_seit,
                                     ausloeser, regel_wochen, regel_einheiten)
    values (v.coach_id, v.athlet_id, v.plan_id, v.version_id, basis, faellig, ausl, regel.wochen, regel.einheiten)
    on conflict (plan_id) where status <> 'erledigt' do nothing
    returning id into eid;

    if eid is not null then
      neu := neu + 1;
      perform intern.benachrichtigen(v.coach_id, 'evaluation_faellig', v.athlet_id, eid,
                                     'Evaluation fällig: ' || intern.name_von(v.athlet_id) || ' – ' || v.titel);
    end if;
    eid := null;
  end loop;
  return neu;
end;
$$;
revoke all on function intern.evaluationen_pruefen(uuid, timestamptz) from public, anon, authenticated;

-- Der Coach kann die Prüfung für sich sofort auslösen (z. B. beim Öffnen der Übersicht)
create function public.evaluationen_jetzt_pruefen()
returns integer language plpgsql volatile security definer set search_path = '' as $$
begin
  if not intern.ist_coach() then
    return 0;
  end if;
  return intern.evaluationen_pruefen((select auth.uid()), now());
end;
$$;
revoke all on function public.evaluationen_jetzt_pruefen() from public, anon;
grant execute on function public.evaluationen_jetzt_pruefen() to authenticated;

-- ---------------------------------------------------------------------
-- Tageszusammenfassung statt Einzelmeldungen
-- ---------------------------------------------------------------------
create table intern.einheit_gemeldet (
  coach_id     uuid not null references public.profile (id) on delete cascade,
  einheit_id   uuid not null references public.trainingseinheiten (id) on delete cascade,
  gemeldet_am  timestamptz not null default now(),
  primary key (coach_id, einheit_id)
);
alter table intern.einheit_gemeldet enable row level security;  -- nur interne Funktionen greifen zu
revoke all on intern.einheit_gemeldet from public, anon, authenticated;

-- Bisherige Einheiten gelten als gemeldet
insert into intern.einheit_gemeldet (coach_id, einheit_id)
select ca.coach_id, t.id
from public.trainingseinheiten t
join public.coach_athlet ca on ca.athlet_id = t.athlet_id
where t.status = 'abgeschlossen'
on conflict do nothing;

create function intern.zusammenfassung_erstellen()
returns integer language plpgsql volatile security definer set search_path = '' as $$
declare
  c uuid;
  gesamt integer;
  liste text;
  anzahl integer := 0;
begin
  for c in select distinct coach_id from public.coach_athlet where status in ('aktiv', 'pausiert') loop
    with neu as (
      select t.id, t.athlet_id
      from public.trainingseinheiten t
      join public.coach_athlet ca on ca.athlet_id = t.athlet_id and ca.coach_id = c and ca.status in ('aktiv', 'pausiert')
      where t.status = 'abgeschlossen'
        and not exists (select 1 from intern.einheit_gemeldet g where g.coach_id = c and g.einheit_id = t.id)
    ),
    gemeldet as (
      insert into intern.einheit_gemeldet (coach_id, einheit_id) select c, id from neu
      on conflict do nothing returning einheit_id
    ),
    je_person as (
      select n.athlet_id, count(*) as k from neu n group by n.athlet_id
    )
    select (select count(*) from gemeldet),
           string_agg(intern.name_von(j.athlet_id) || case when j.k > 1 then ' (' || j.k || ')' else '' end,
                      ', ' order by j.k desc)
    into gesamt, liste
    from je_person j;

    if gesamt > 0 then
      perform intern.benachrichtigen(c, 'zusammenfassung', null, null,
        gesamt || case when gesamt = 1 then ' neue Einheit' else ' neue Einheiten' end || ' seit gestern: ' || liste);
      anzahl := anzahl + 1;
    end if;
  end loop;
  return anzahl;
end;
$$;
revoke all on function intern.zusammenfassung_erstellen() from public, anon, authenticated;

-- Sonntags: Erinnerung an den Check-in der Woche (höchstens einmal pro Woche)
create function intern.checkin_erinnern(p_jetzt timestamptz default now())
returns integer language plpgsql volatile security definer set search_path = '' as $$
declare
  a uuid;
  w_beginn date := intern.wochenbeginn(p_jetzt);
  anzahl integer := 0;
begin
  if extract(isodow from (p_jetzt at time zone 'Europe/Berlin')) <> 7 then
    return 0;
  end if;
  for a in
    select distinct ca.athlet_id from public.coach_athlet ca
    where ca.status = 'aktiv'
      and intern.hat_einwilligung(ca.athlet_id, 'nutzung')
      and not exists (select 1 from public.checkins x where x.athlet_id = ca.athlet_id and x.woche = w_beginn)
      and not exists (select 1 from public.benachrichtigungen b
                      where b.empfaenger_id = ca.athlet_id and b.art = 'checkin_erinnerung'
                        and b.erstellt_am >= w_beginn::timestamp at time zone 'Europe/Berlin')
  loop
    perform intern.benachrichtigen(a, 'checkin_erinnerung', a, null, 'Zeit für deinen Check-in dieser Woche.');
    anzahl := anzahl + 1;
  end loop;
  return anzahl;
end;
$$;
revoke all on function intern.checkin_erinnern(timestamptz) from public, anon, authenticated;

create function intern.taegliche_pruefung()
returns text language plpgsql volatile security definer set search_path = '' as $$
declare
  e integer;
  z integer;
  c integer;
begin
  e := intern.evaluationen_pruefen(null, now());
  z := intern.zusammenfassung_erstellen();
  c := intern.checkin_erinnern(now());
  -- Alte Hinweise aufräumen
  delete from public.benachrichtigungen where erstellt_am < now() - interval '90 days';
  return format('Evaluationen: %s, Zusammenfassungen: %s, Erinnerungen: %s', e, z, c);
end;
$$;
revoke all on function intern.taegliche_pruefung() from public, anon, authenticated;

commit;

-- ---------------------------------------------------------------------
-- Tägliche Prüfung einplanen (05:00 UTC = 6 Uhr Winter / 7 Uhr Sommer)
-- ---------------------------------------------------------------------
create extension if not exists pg_cron with schema pg_catalog;
select cron.schedule('coaching-taeglich', '0 5 * * *', $$select intern.taegliche_pruefung()$$);

select 'eingerichtet' as ergebnis;
