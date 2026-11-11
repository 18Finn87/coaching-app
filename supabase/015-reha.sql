-- =====================================================================
-- Coaching App · Phase 12 · Reha
-- Im SQL Editor EINMAL ausführen, nach 014-athletik.sql.
--
-- * plan_uebungen.schmerzgrenze (0–10): Grenze des Coachs pro Plan-Übung,
--   wird in neue Planversionen mitkopiert. Keine Gesundheitsangabe.
-- * gesundheit.reha_schmerz: Schmerz 0–10 pro ausgeführter Übung (einmal
--   pro Übung), freiwillig mit Anmerkung. Geschützter Bereich, nur mit
--   Einwilligung „gesundheitsdaten“, jede Änderung wird protokolliert.
--   Die Grenze wird beim Speichern aus dem Plan übernommen (Historie bleibt).
-- * Zugriff nur über security-invoker-Funktionen (Schema nicht in der API).
-- * Morgen-Zusammenfassung: ein Hinweis pro Person, wenn ein Wert über der
--   Grenze lag – ohne den Wert selbst (Glocke enthält keine Gesundheitsinhalte).
-- * Die App ändert keinen Plan und stellt keine Diagnose.
-- =====================================================================

begin;

-- ---------------------------------------------------------------------
-- Schmerzgrenze pro Plan-Übung
-- ---------------------------------------------------------------------
alter table public.plan_uebungen
  add column schmerzgrenze smallint check (schmerzgrenze between 0 and 10);
comment on column public.plan_uebungen.schmerzgrenze is
  'Schmerzgrenze des Coachs (0–10). Werte darüber markiert die App – sie ändert nichts.';
grant insert (schmerzgrenze) on public.plan_uebungen to authenticated;
grant update (schmerzgrenze) on public.plan_uebungen to authenticated;

-- Neue Version kopiert jetzt auch die Schmerzgrenze
create or replace function public.plan_neue_version(p_plan uuid, p_aenderungsgrund text default '')
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
      insert into public.plan_uebungen (plan_einheit_id, uebung_id, reihenfolge, gruppe, hinweis, schmerzgrenze)
      values (neu_e, u.uebung_id, u.reihenfolge, u.gruppe, u.hinweis, u.schmerzgrenze) returning id into neu_u;
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

-- ---------------------------------------------------------------------
-- Schmerz pro ausgeführter Übung (geschützter Bereich)
-- ---------------------------------------------------------------------
create table gesundheit.reha_schmerz (
  id                      uuid primary key default gen_random_uuid(),
  ausgefuehrte_uebung_id  uuid not null unique references public.ausgefuehrte_uebungen (id) on delete cascade,
  athlet_id               uuid not null default auth.uid() references public.profile (id) on delete cascade,
  wert                    smallint not null check (wert between 0 and 10),
  grenze                  smallint check (grenze between 0 and 10),
  notiz                   text not null default '' check (char_length(notiz) <= 500),
  gemeldet_am             timestamptz,
  erstellt_am             timestamptz not null default now(),
  aktualisiert_am         timestamptz not null default now()
);
create index reha_schmerz_athlet_idx on gesundheit.reha_schmerz (athlet_id);
comment on table gesundheit.reha_schmerz is
  'Schmerzangabe 0–10 pro ausgeführter Übung. Grenze = Schmerzgrenze aus dem Plan zum Zeitpunkt der Angabe.';

create trigger reha_schmerz_aktualisiert
  before insert or update on gesundheit.reha_schmerz
  for each row execute function intern.aktualisiert_setzen();
create trigger reha_schmerz_protokoll
  after insert or update or delete on gesundheit.reha_schmerz
  for each row execute function intern.gesundheit_protokollieren();

alter table gesundheit.reha_schmerz enable row level security;
revoke all on gesundheit.reha_schmerz from public, anon, authenticated;
grant select, delete on gesundheit.reha_schmerz to authenticated;
grant insert (ausgefuehrte_uebung_id, wert, grenze, notiz) on gesundheit.reha_schmerz to authenticated;
grant update (wert, grenze, notiz) on gesundheit.reha_schmerz to authenticated;

create policy rs_lesen on gesundheit.reha_schmerz for select to authenticated
  using (intern.darf_gesundheit_lesen(athlet_id));
create policy rs_anlegen on gesundheit.reha_schmerz for insert to authenticated
  with check (athlet_id = (select auth.uid())
              and intern.hat_einwilligung((select auth.uid()), 'gesundheitsdaten')
              and exists (select 1 from public.ausgefuehrte_uebungen au
                          join public.trainingseinheiten t on t.id = au.trainingseinheit_id
                          where au.id = ausgefuehrte_uebung_id and t.athlet_id = (select auth.uid())));
create policy rs_aendern on gesundheit.reha_schmerz for update to authenticated
  using (athlet_id = (select auth.uid()))
  with check (athlet_id = (select auth.uid())
              and intern.hat_einwilligung((select auth.uid()), 'gesundheitsdaten'));
create policy rs_loeschen on gesundheit.reha_schmerz for delete to authenticated
  using (athlet_id = (select auth.uid()));

-- Zugriff der App (security invoker: die Regeln oben gelten unverändert)
create function public.reha_schmerz_speichern(p_uebung uuid, p_wert integer, p_notiz text)
returns void language plpgsql volatile security invoker set search_path = '' as $$
declare
  v_grenze smallint;
begin
  -- Grenze aus dem Plan (falls die Übung aus einem Plan kommt)
  select pu.schmerzgrenze into v_grenze
  from public.ausgefuehrte_uebungen au
  join public.plan_uebungen pu on pu.id = au.plan_uebung_id
  where au.id = p_uebung;

  update gesundheit.reha_schmerz
  set wert = p_wert, grenze = v_grenze, notiz = coalesce(left(p_notiz, 500), '')
  where ausgefuehrte_uebung_id = p_uebung;
  if not found then
    insert into gesundheit.reha_schmerz (ausgefuehrte_uebung_id, wert, grenze, notiz)
    values (p_uebung, p_wert, v_grenze, coalesce(left(p_notiz, 500), ''));
  end if;
end;
$$;

create function public.reha_schmerz_loeschen(p_uebung uuid)
returns integer language plpgsql volatile security invoker set search_path = '' as $$
declare
  anzahl integer;
begin
  delete from gesundheit.reha_schmerz where ausgefuehrte_uebung_id = p_uebung;
  get diagnostics anzahl = row_count;
  return anzahl;
end;
$$;

create function public.reha_schmerz_liste(p_athlet uuid)
returns table (ausgefuehrte_uebung_id uuid, uebung_id uuid, uebung_name text, datum timestamptz,
               wert smallint, grenze smallint, notiz text)
language sql stable security invoker set search_path = '' as $$
  select r.ausgefuehrte_uebung_id, au.uebung_id, au.uebung_name, t.gestartet_am, r.wert, r.grenze, r.notiz
  from gesundheit.reha_schmerz r
  join public.ausgefuehrte_uebungen au on au.id = r.ausgefuehrte_uebung_id
  join public.trainingseinheiten t on t.id = au.trainingseinheit_id
  where r.athlet_id = p_athlet
  order by t.gestartet_am;
$$;

revoke all on function public.reha_schmerz_speichern(uuid, integer, text) from public, anon;
revoke all on function public.reha_schmerz_loeschen(uuid) from public, anon;
revoke all on function public.reha_schmerz_liste(uuid) from public, anon;
grant execute on function public.reha_schmerz_speichern(uuid, integer, text) to authenticated;
grant execute on function public.reha_schmerz_loeschen(uuid) to authenticated;
grant execute on function public.reha_schmerz_liste(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- Morgen-Zusammenfassung: Hinweis bei Schmerz über der Grenze
-- ---------------------------------------------------------------------
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
                 'reha_hinweis'));

-- Ein Hinweis pro Coach und Person mit neuen Werten über der Grenze (nur mit Einwilligung).
-- Der Hinweis nennt keinen Wert, nur dass der Coach in den Schmerzverlauf schauen sollte.
create function intern.reha_hinweise_erstellen()
returns integer language plpgsql volatile security definer set search_path = '' as $$
declare
  z record;
  anzahl integer := 0;
begin
  for z in
    select ca.coach_id, r.athlet_id, count(*) as k
    from gesundheit.reha_schmerz r
    join public.coach_athlet ca on ca.athlet_id = r.athlet_id and ca.status in ('aktiv', 'pausiert')
    join public.ausgefuehrte_uebungen au on au.id = r.ausgefuehrte_uebung_id
    join public.trainingseinheiten t on t.id = au.trainingseinheit_id and t.status = 'abgeschlossen'
    where r.gemeldet_am is null and r.grenze is not null and r.wert > r.grenze
      and intern.hat_einwilligung(r.athlet_id, 'gesundheitsdaten')
    group by ca.coach_id, r.athlet_id
  loop
    perform intern.benachrichtigen(z.coach_id, 'reha_hinweis', z.athlet_id, null,
      intern.name_von(z.athlet_id) || ': ' ||
      case when z.k = 1 then '1 Reha-Übung' else z.k || ' Reha-Übungen' end ||
      ' über der Schmerzgrenze – bitte Schmerzverlauf ansehen.');
    anzahl := anzahl + 1;
  end loop;
  update gesundheit.reha_schmerz r set gemeldet_am = now()
  from public.ausgefuehrte_uebungen au
  join public.trainingseinheiten t on t.id = au.trainingseinheit_id and t.status = 'abgeschlossen'
  where au.id = r.ausgefuehrte_uebung_id and r.gemeldet_am is null;
  return anzahl;
end;
$$;
revoke all on function intern.reha_hinweise_erstellen() from public, anon, authenticated;

create or replace function intern.taegliche_pruefung()
returns text language plpgsql volatile security definer set search_path = '' as $$
declare
  e integer;
  z integer;
  c integer;
  h integer;
begin
  e := intern.evaluationen_pruefen(null, now());
  z := intern.zusammenfassung_erstellen();
  h := intern.reha_hinweise_erstellen();
  c := intern.checkin_erinnern(now());
  -- Alte Hinweise aufräumen
  delete from public.benachrichtigungen where erstellt_am < now() - interval '90 days';
  return format('Evaluationen: %s, Zusammenfassungen: %s, Reha-Hinweise: %s, Erinnerungen: %s', e, z, h, c);
end;
$$;
revoke all on function intern.taegliche_pruefung() from public, anon, authenticated;

commit;

select 'eingerichtet' as ergebnis;
