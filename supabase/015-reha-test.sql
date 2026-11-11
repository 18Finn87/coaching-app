-- =====================================================================
-- Coaching App · Phase 12 · Prüfskript Reha
-- Nach 015-reha.sql ausführen. Bricht absichtlich ab (Testdaten verschwinden).
-- =====================================================================
do $$
declare
  r   text := E'TESTERGEBNIS Reha (alle Testdaten werden zurückgenommen)\n';
  n   int;
  t   text;
  blockiert boolean;
  k   uuid := 'ffffffff-8888-4000-8000-00000000000c';
  k2  uuid := 'ffffffff-8888-4000-8000-00000000000d';
  a   uuid := 'ffffffff-8888-4000-8000-00000000000a';
  b   uuid := 'ffffffff-8888-4000-8000-00000000000b';
  ue  uuid;
  pl  uuid;
  v1  uuid;
  v2  uuid;
  pe  uuid;
  pu  uuid;
  te  uuid := gen_random_uuid();
  au  uuid := gen_random_uuid();
  tb  uuid := gen_random_uuid();
  aub uuid := gen_random_uuid();
  ok  constant text := 'OK      ';
  err constant text := 'FEHLER  ';
begin
  insert into auth.users (id, instance_id, aud, role, email, created_at, updated_at) values
    (k,  '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'k@rls-test.invalid', now(), now()),
    (k2, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'k2@rls-test.invalid', now(), now()),
    (a,  '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'a@rls-test.invalid', now(), now()),
    (b,  '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'b@rls-test.invalid', now(), now());
  update public.profile set rolle = 'coach' where id in (k, k2);
  update public.profile set anzeigename = 'Reha-Test' where id = a;
  insert into public.coach_athlet (coach_id, athlet_id, status) values (k, a, 'aktiv'), (k, b, 'aktiv');
  insert into public.einwilligungen (athlet_id, art, textversion) values
    (a, 'nutzung', 'test'), (a, 'gesundheitsdaten', 'test'), (b, 'nutzung', 'test');

  set local role authenticated;
  -- Coach: Reha-Übung mit Schmerzgrenze 3 im Plan
  perform set_config('request.jwt.claims', json_build_object('sub', k, 'role', 'authenticated')::text, true);
  insert into public.uebungen (name, modul, bewegungsmuster, messart) values ('Test-Brücke', 'reha', 'hueftstreckung', 'wdh')
  returning id into ue;
  pl := public.plan_anlegen(a, 'Test-Reha', '');
  select id into v1 from public.planversionen where plan_id = pl;
  insert into public.plan_einheiten (planversion_id, name, reihenfolge) values (v1, 'Reha', 0) returning id into pe;
  begin
    insert into public.plan_uebungen (plan_einheit_id, uebung_id, reihenfolge, schmerzgrenze) values (pe, ue, 0, 3) returning id into pu;
    blockiert := false;
  exception when others then blockiert := true; end;
  r := r || case when not blockiert then ok else err end || 'Coach legt Schmerzgrenze 3 im Plan fest' || E'\n';
  begin update public.plan_uebungen set schmerzgrenze = 11 where id = pu; blockiert := false; exception when others then blockiert := true; end;
  r := r || case when blockiert then ok else err end || 'Grenze über 10 wird abgelehnt' || E'\n';
  insert into public.plan_saetze (plan_uebung_id, satznummer, wdh_min) values (pu, 1, 12);
  perform public.plan_veroeffentlichen(v1);
  v2 := public.plan_neue_version(pl, 'Test');
  select count(*) into n from public.plan_uebungen u join public.plan_einheiten e on e.id = u.plan_einheit_id
  where e.planversion_id = v2 and u.schmerzgrenze = 3;
  r := r || case when n = 1 then ok else err end || 'Neue Planversion übernimmt die Schmerzgrenze' || E'\n';

  -- Athlet A (mit Einwilligung) trainiert und gibt Schmerz 5 an
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  insert into public.trainingseinheiten (id, titel) values (te, 'Reha');
  insert into public.ausgefuehrte_uebungen (id, trainingseinheit_id, uebung_id, plan_uebung_id, uebung_name, messart)
  values (au, te, ue, pu, 'Test-Brücke', 'wdh');
  begin perform public.reha_schmerz_speichern(au, 5, 'zieht im Knie'); blockiert := false;
  exception when others then blockiert := true; r := r || '        (' || sqlerrm || ')' || E'\n'; end;
  r := r || case when not blockiert then ok else err end || 'Athlet speichert Schmerz 5 mit Anmerkung' || E'\n';
  select count(*) into n from public.reha_schmerz_liste(a) where wert = 5 and grenze = 3;
  r := r || case when n = 1 then ok else err end || 'Grenze 3 wurde aus dem Plan übernommen' || E'\n';
  perform public.reha_schmerz_speichern(au, 4, '');
  select count(*) into n from public.reha_schmerz_liste(a);
  r := r || case when n = 1 then ok else err end || 'Ändern legt keinen zweiten Eintrag an' || E'\n';
  begin perform public.reha_schmerz_speichern(au, 12, ''); blockiert := false; exception when others then blockiert := true; end;
  r := r || case when blockiert then ok else err end || 'Schmerz über 10 wird abgelehnt' || E'\n';
  select count(*) into n from gesundheit.protokoll where athlet_id = a and tabelle = 'reha_schmerz';
  r := r || case when n >= 2 then ok else err end || 'Änderungen werden protokolliert (' || n || ')' || E'\n';

  -- Athlet B (ohne Gesundheits-Einwilligung) darf nichts speichern
  perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);
  insert into public.trainingseinheiten (id, titel) values (tb, 'Reha');
  insert into public.ausgefuehrte_uebungen (id, trainingseinheit_id, uebung_id, uebung_name, messart)
  values (aub, tb, ue, 'Test-Brücke', 'wdh');
  begin perform public.reha_schmerz_speichern(aub, 2, ''); blockiert := false; exception when others then blockiert := true; end;
  r := r || case when blockiert then ok else err end || 'Ohne Einwilligung wird nichts gespeichert' || E'\n';
  begin perform public.reha_schmerz_speichern(au, 9, ''); blockiert := false; exception when others then blockiert := true; end;
  select count(*) into n from public.reha_schmerz_liste(a);
  r := r || case when n = 0 then ok else err end || 'B sieht die Werte von A nicht' || E'\n';

  -- Coach K sieht sie, fremder Coach K2 nicht
  perform set_config('request.jwt.claims', json_build_object('sub', k, 'role', 'authenticated')::text, true);
  select count(*) into n from public.reha_schmerz_liste(a) where wert = 4;
  r := r || case when n = 1 then ok else err end || 'Coach sieht den Schmerzverlauf (Wert 4, B hat nichts geändert)' || E'\n';
  begin perform public.reha_schmerz_speichern(au, 0, ''); blockiert := false; exception when others then blockiert := true; end;
  select count(*) into n from public.reha_schmerz_liste(a) where wert = 4;
  r := r || case when n = 1 then ok else err end || 'Coach kann Schmerzwerte nicht ändern' || E'\n';
  perform set_config('request.jwt.claims', json_build_object('sub', k2, 'role', 'authenticated')::text, true);
  select count(*) into n from public.reha_schmerz_liste(a);
  r := r || case when n = 0 then ok else err end || 'Fremder Coach sieht nichts' || E'\n';

  -- Morgen-Hinweis (läuft als System)
  reset role;
  update public.trainingseinheiten set status = 'abgeschlossen', beendet_am = now() where id = te;
  n := intern.reha_hinweise_erstellen();
  select text_kurz into t from public.benachrichtigungen where empfaenger_id = k and art = 'reha_hinweis';
  r := r || case when t like 'Reha-Test: 1 Reha-Übung über der Schmerzgrenze%' then ok else err end
         || 'Coach bekommt einen Hinweis ohne Schmerzwert' || E'\n';
  r := r || case when t not like '%4%' then ok else err end || 'Hinweis enthält keinen Wert' || E'\n';
  n := intern.reha_hinweise_erstellen();
  select count(*) into n from public.benachrichtigungen where empfaenger_id = k and art = 'reha_hinweis';
  r := r || case when n = 1 then ok else err end || 'Derselbe Wert wird nicht zweimal gemeldet' || E'\n';

  -- Konto löschen: Schmerzwerte verschwinden mit
  begin
    delete from auth.users where id = a;
    select count(*) into n from gesundheit.reha_schmerz where athlet_id = a;
    r := r || case when n = 0 then ok else err end || 'Beim Löschen des Kontos verschwinden die Schmerzwerte' || E'\n';
  exception when others then
    r := r || err || 'Konto löschen klappt nicht (' || sqlerrm || ')' || E'\n';
  end;

  raise exception '%', r;
end $$;
