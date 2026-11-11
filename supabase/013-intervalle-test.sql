-- =====================================================================
-- Coaching App · Phase 10 · Prüfskript Intervalle
-- Nach 013-intervalle.sql ausführen. Bricht absichtlich ab (Testdaten verschwinden).
-- Prüft: Messart, Intervall-Block als Runden, Kopie in neue Planversion.
-- =====================================================================
do $$
declare
  r   text := E'TESTERGEBNIS Intervalle (alle Testdaten werden zurückgenommen)\n';
  n   int;
  blockiert boolean;
  k   uuid := 'ffffffff-6666-4000-8000-00000000000c';
  a   uuid := 'ffffffff-6666-4000-8000-00000000000a';
  ue  uuid;
  pl  uuid;
  v1  uuid;
  v2  uuid;
  pe  uuid;
  pu  uuid;
  i   int;
  ok  constant text := 'OK      ';
  err constant text := 'FEHLER  ';
begin
  select count(*) into n from public.uebungen u join public.profile p on p.id = u.coach_id
  where p.rolle = 'coach' and u.modul = 'intervall' and u.messart = 'intervall';
  r := r || case when n >= 5 then ok else err end || 'Startbestand Intervalle vorhanden (' || n || ')' || E'\n';

  insert into auth.users (id, instance_id, aud, role, email, created_at, updated_at) values
    (k, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'k@rls-test.invalid', now(), now()),
    (a, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'a@rls-test.invalid', now(), now());
  update public.profile set rolle = 'coach' where id = k;
  insert into public.coach_athlet (coach_id, athlet_id, status) values (k, a, 'aktiv');

  set local role authenticated;
  perform set_config('request.jwt.claims', json_build_object('sub', k, 'role', 'authenticated')::text, true);
  begin
    insert into public.uebungen (name, modul, bewegungsmuster, messart) values ('Test-400er', 'intervall', 'laufen', 'intervall')
    returning id into ue;
    blockiert := false;
  exception when others then blockiert := true; end;
  r := r || case when not blockiert then ok else err end || 'K legt eine Intervall-Übung an' || E'\n';

  pl := public.plan_anlegen(a, 'Test-Intervallplan', '');
  select id into v1 from public.planversionen where plan_id = pl;
  insert into public.plan_einheiten (planversion_id, name, reihenfolge) values (v1, 'Bahn', 0) returning id into pe;
  insert into public.plan_uebungen (plan_einheit_id, uebung_id, reihenfolge) values (pe, ue, 0) returning id into pu;
  -- 2 Serien × 3 Runden à 400 m, 90 s Pause, 3 min Serienpause
  for i in 1..6 loop
    insert into public.plan_saetze (plan_uebung_id, satznummer, distanz_m, pause_sek, zusatz)
    values (pu, i, 400, case when i = 3 then 180 when i = 6 then null else 90 end,
            case when i in (3, 6) then '{"serienende": true}'::jsonb else '{}'::jsonb end);
  end loop;
  select count(*) into n from public.plan_saetze where plan_uebung_id = pu;
  r := r || case when n = 6 then ok else err end || 'Block 2 × 3 × 400 m als 6 Runden gespeichert' || E'\n';

  perform public.plan_veroeffentlichen(v1);
  v2 := public.plan_neue_version(pl, 'Test');
  select count(*) into n from public.plan_saetze s
  join public.plan_uebungen u on u.id = s.plan_uebung_id
  join public.plan_einheiten e on e.id = u.plan_einheit_id
  where e.planversion_id = v2 and s.distanz_m = 400 and (s.pause_sek = 180) = (s.zusatz ->> 'serienende' = 'true');
  r := r || case when n >= 1 then ok else err end || 'Neue Planversion übernimmt Runden, Pausen und Serienende' || E'\n';
  select count(*) into n from public.plan_saetze s
  join public.plan_uebungen u on u.id = s.plan_uebung_id
  join public.plan_einheiten e on e.id = u.plan_einheit_id
  where e.planversion_id = v2;
  r := r || case when n = 6 then ok else err end || 'Alle 6 Runden in der neuen Version (' || n || ')' || E'\n';

  raise exception '%', r;
end $$;
