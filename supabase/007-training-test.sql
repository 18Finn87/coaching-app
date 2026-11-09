-- =====================================================================
-- Coaching App · Phase 4 · Prüfskript Training
-- Nach 007-training.sql ausführen. Bricht absichtlich ab (Testdaten verschwinden).
-- =====================================================================
do $$
declare
  r   text := E'TESTERGEBNIS Training (alle Testdaten werden zurückgenommen)\n';
  n   int;
  blockiert boolean;
  k   uuid := '99999999-0000-4000-8000-00000000000c';
  a   uuid := '99999999-0000-4000-8000-00000000000a';
  b   uuid := '99999999-0000-4000-8000-00000000000b';
  f   uuid := '99999999-0000-4000-8000-00000000000f';
  ue  uuid := '99999999-0000-4000-8000-0000000000e1';
  plan uuid := '99999999-0000-4000-8000-0000000000a1';
  v1  uuid;
  ventwurf uuid;
  pe  uuid; pu uuid; ps uuid;
  t1  uuid := '99999999-0000-4000-8000-0000000000b1';
  au1 uuid := '99999999-0000-4000-8000-0000000000c1';
  s1  uuid := '99999999-0000-4000-8000-0000000000d1';
  ok  constant text := 'OK      ';
  err constant text := 'FEHLER  ';
begin
  insert into auth.users (id, instance_id, aud, role, email, created_at, updated_at) values
    (k, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'k@rls-test.invalid', now(), now()),
    (a, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'a@rls-test.invalid', now(), now()),
    (b, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'b@rls-test.invalid', now(), now()),
    (f, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'f@rls-test.invalid', now(), now());
  update public.profile set rolle = 'coach' where id = k;
  insert into public.coach_athlet (coach_id, athlet_id, status) values (k, a, 'aktiv'), (k, b, 'aktiv');
  insert into public.einwilligungen (athlet_id, art, textversion) values (a, 'nutzung', 'test'), (f, 'nutzung', 'test');
  insert into public.uebungen (id, coach_id, name) values (ue, k, 'Test-Kniebeuge');
  -- veröffentlichter Plan für A (als Admin angelegt)
  insert into public.plaene (id, coach_id, athlet_id, titel) values (plan, k, a, 'Testplan');
  insert into public.planversionen (plan_id) values (plan) returning id into v1;
  update public.planversionen set status = 'veroeffentlicht', veroeffentlicht_am = now() where id = v1;
  insert into public.plan_einheiten (planversion_id, name) values (v1, 'Tag A') returning id into pe;
  insert into public.plan_uebungen (plan_einheit_id, uebung_id) values (pe, ue) returning id into pu;
  insert into public.plan_saetze (plan_uebung_id, satznummer, wdh_min, wdh_max, last_kg) values (pu, 1, 6, 8, 60) returning id into ps;
  insert into public.planversionen (plan_id) values (plan) returning id into ventwurf;  -- Entwurf V2

  set local role authenticated;

  ---------------- Athletin A trainiert ----------------
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  begin
    insert into public.trainingseinheiten (id, planversion_id, plan_einheit_id, titel) values (t1, v1, pe, 'Tag A');
    insert into public.ausgefuehrte_uebungen (id, trainingseinheit_id, uebung_id, plan_uebung_id, uebung_name)
      values (au1, t1, ue, pu, 'Test-Kniebeuge');
    insert into public.ausgefuehrte_saetze (id, ausgefuehrte_uebung_id, plan_satz_id, satznummer, vorgabe, wdh, last_kg, rir, erledigt)
      values (s1, au1, ps, 1, '{"wdh_min":6,"wdh_max":8,"last_kg":60}', 8, 60, 2, true);
    blockiert := false;
  exception when others then blockiert := true; end;
  r := r || case when not blockiert then ok else err end || 'A startet eine Einheit nach Plan und trägt einen Satz ein' || E'\n';

  begin
    insert into public.ausgefuehrte_saetze (id, ausgefuehrte_uebung_id, satznummer, wdh, last_kg, erledigt)
    values (s1, au1, 1, 7, 60, true)
    on conflict (id) do update set wdh = excluded.wdh, last_kg = excluded.last_kg, erledigt = excluded.erledigt;
    blockiert := false;
  exception when others then blockiert := true; end;
  select count(*) into n from public.ausgefuehrte_saetze where id = s1 and wdh = 7;
  r := r || case when not blockiert and n = 1 then ok else err end || 'Erneutes Hochladen (upsert) ändert den Satz, statt ihn zu verdoppeln' || E'\n';

  begin insert into public.trainingseinheiten (id, athlet_id, titel) values (gen_random_uuid(), b, 'fremd'); blockiert := false; exception when others then blockiert := true; end;
  r := r || case when blockiert then ok else err end || 'A kann kein Training im Namen von B anlegen' || E'\n';
  begin insert into public.trainingseinheiten (id, planversion_id, titel) values (gen_random_uuid(), ventwurf, 'Entwurf'); blockiert := false; exception when others then blockiert := true; end;
  r := r || case when blockiert then ok else err end || 'A kann nicht nach einem unveröffentlichten Entwurf trainieren' || E'\n';
  begin insert into public.trainingseinheiten (id, titel) values (gen_random_uuid(), 'Freies Training'); blockiert := false; exception when others then blockiert := true; end;
  r := r || case when not blockiert then ok else err end || 'A kann ein freies Training ohne Plan anlegen' || E'\n';

  ---------------- Athlet B ohne Einwilligung ----------------
  perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);
  begin insert into public.trainingseinheiten (id, titel) values (gen_random_uuid(), 'B'); blockiert := false; exception when others then blockiert := true; end;
  r := r || case when blockiert then ok else err end || 'Ohne Einwilligung zur Nutzung kann B kein Training speichern' || E'\n';

  ---------------- Fremde Person F ----------------
  perform set_config('request.jwt.claims', json_build_object('sub', f, 'role', 'authenticated')::text, true);
  select count(*) into n from public.ausgefuehrte_saetze;
  r := r || case when n = 0 then ok else err end || 'F sieht keine fremden Trainingsdaten' || E'\n';
  update public.ausgefuehrte_saetze set wdh = 99 where id = s1; get diagnostics n = row_count;
  r := r || case when n = 0 then ok else err end || 'F kann Sätze von A nicht ändern' || E'\n';
  begin
    insert into public.ausgefuehrte_saetze (id, ausgefuehrte_uebung_id, satznummer, wdh) values (s1, au1, 1, 99)
    on conflict (id) do update set wdh = excluded.wdh;
    blockiert := false;
  exception when others then blockiert := true; end;
  r := r || case when blockiert then ok else err end || 'F kann Sätze von A auch per Hochladen nicht überschreiben' || E'\n';

  ---------------- Coach K ----------------
  perform set_config('request.jwt.claims', json_build_object('sub', k, 'role', 'authenticated')::text, true);
  select count(*) into n from public.ausgefuehrte_saetze where id = s1;
  r := r || case when n = 1 then ok else err end || 'K sieht das Training von A' || E'\n';
  update public.ausgefuehrte_saetze set wdh = 12 where id = s1; get diagnostics n = row_count;
  r := r || case when n = 0 then ok else err end || 'K kann die Leistung von A nicht ändern' || E'\n';
  begin insert into public.trainingseinheiten (id, athlet_id, titel) values (gen_random_uuid(), a, 'vom Coach'); blockiert := false; exception when others then blockiert := true; end;
  r := r || case when blockiert then ok else err end || 'K kann kein Training für A eintragen' || E'\n';

  ---------------- Abschließen und Korrekturen ----------------
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  update public.trainingseinheiten set status = 'abgeschlossen', beendet_am = now(), session_rpe = 7 where id = t1;
  select count(*) into n from public.training_korrekturen where athlet_id = a;
  r := r || case when n = 0 then ok else err end || 'Abschließen selbst ist keine Korrektur' || E'\n';
  update public.ausgefuehrte_saetze set wdh = 8 where id = s1;
  select count(*) into n from public.training_korrekturen where athlet_id = a;
  r := r || case when n = 1 then ok else err end || 'Spätere Änderung wird protokolliert (' || n || ')' || E'\n';
  update public.ausgefuehrte_saetze set wdh = 8 where id = s1;
  select count(*) into n from public.training_korrekturen where athlet_id = a;
  r := r || case when n = 1 then ok else err end || 'Unverändertes Hochladen erzeugt keinen Eintrag' || E'\n';
  delete from public.trainingseinheiten where id = t1; get diagnostics n = row_count;
  r := r || case when n = 0 then ok else err end || 'Abgeschlossene Einheiten können nicht gelöscht werden' || E'\n';
  select count(*) into n from public.ausgefuehrte_saetze where id = s1 and (vorgabe ->> 'last_kg')::numeric = 60;
  r := r || case when n = 1 then ok else err end || 'Die Vorgabe ist im Satz als Kopie gespeichert' || E'\n';

  perform set_config('request.jwt.claims', json_build_object('sub', k, 'role', 'authenticated')::text, true);
  select count(*) into n from public.training_korrekturen where athlet_id = a;
  r := r || case when n = 1 then ok else err end || 'K sieht die Korrektur' || E'\n';
  update public.coach_athlet set status = 'beendet' where athlet_id = a;
  select count(*) into n from public.trainingseinheiten where athlet_id = a;
  r := r || case when n = 0 then ok else err end || 'Nach beendeter Betreuung sieht K kein Training mehr' || E'\n';

  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  set local role anon;
  begin select count(*) into n from public.trainingseinheiten; blockiert := false; exception when others then blockiert := true; end;
  r := r || case when blockiert then ok else err end || 'Ohne Anmeldung kein Zugriff auf Training' || E'\n';

  raise exception '%', r;
end $$;
