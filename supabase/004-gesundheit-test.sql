-- =====================================================================
-- Coaching App · Schritt 2.4 · Prüfskript Gesundheitsbereich
-- Nach 004-gesundheit.sql ausführen. Bricht absichtlich ab (Testdaten verschwinden).
-- =====================================================================
do $$
declare
  r  text := E'TESTERGEBNIS Gesundheitsbereich (alle Testdaten werden zurückgenommen)\n';
  n  int;
  blockiert boolean;
  k  uuid := '44444444-0000-4000-8000-00000000000c';
  a  uuid := '44444444-0000-4000-8000-00000000000a';  -- mit beiden Einwilligungen
  b  uuid := '44444444-0000-4000-8000-00000000000b';  -- nur Nutzung, keine Gesundheitsdaten
  f  uuid := '44444444-0000-4000-8000-00000000000f';  -- fremd, nicht betreut
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
  insert into public.einwilligungen (athlet_id, art, textversion) values
    (a, 'nutzung', 'test'), (a, 'gesundheitsdaten', 'test'),
    (b, 'nutzung', 'test'),
    (f, 'nutzung', 'test'), (f, 'gesundheitsdaten', 'test');

  set local role authenticated;

  ---------------- Athletin A ----------------
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  begin insert into gesundheit.anamnese (fragenversion, antworten) values ('test', '{"f1":{"wert":"nein"}}'); blockiert := false; exception when others then blockiert := true; end;
  r := r || case when not blockiert then ok else err end || 'A kann ihre Anamnese speichern' || E'\n';
  begin insert into gesundheit.anamnese (fragenversion, antworten) values ('test', '{"f1":{"wert":"ja"}}'); blockiert := false; exception when others then blockiert := true; end;
  select max(version) into n from gesundheit.anamnese where athlet_id = a;
  r := r || case when not blockiert and n = 2 then ok else err end || 'Zweites Speichern ergibt Version 2 (alte bleibt erhalten)' || E'\n';
  begin insert into gesundheit.anamnese (fragenversion, antworten, version) values ('test', '{}', 99); blockiert := false; exception when others then blockiert := true; end;
  r := r || case when blockiert then ok else err end || 'A kann die Versionsnummer nicht selbst setzen' || E'\n';
  begin update gesundheit.anamnese set antworten = '{}' where athlet_id = a; blockiert := false; exception when others then blockiert := true; end;
  r := r || case when blockiert then ok else err end || 'Gespeicherte Anamnese-Versionen sind unveränderlich' || E'\n';
  begin insert into gesundheit.anamnese (fragenversion, antworten) values ('test', '"kein Objekt"'); blockiert := false; exception when others then blockiert := true; end;
  r := r || case when blockiert then ok else err end || 'Ungültiges Antwortformat wird abgelehnt' || E'\n';
  begin insert into gesundheit.beschwerden (koerperregion, beschreibung, seit) values ('knie', 'zieht beim Treppensteigen', '2026-10-01'); blockiert := false; exception when others then blockiert := true; end;
  r := r || case when not blockiert then ok else err end || 'A kann eine Beschwerde eintragen' || E'\n';
  update gesundheit.beschwerden set bis = '2026-11-01' where athlet_id = a; get diagnostics n = row_count;
  r := r || case when n = 1 then ok else err end || 'A kann ihre Beschwerde abschließen' || E'\n';
  begin insert into gesundheit.beschwerden (koerperregion) values ('milz'); blockiert := false; exception when others then blockiert := true; end;
  r := r || case when blockiert then ok else err end || 'Unbekannte Körperregion wird abgelehnt' || E'\n';
  select count(*) into n from gesundheit.protokoll where athlet_id = a;
  r := r || case when n = 4 then ok else err end || 'Protokoll hat ' || n || ' Einträge (soll 4: 2× Anamnese, Beschwerde angelegt + geändert)' || E'\n';
  begin insert into gesundheit.protokoll (athlet_id, aktion, tabelle) values (a, 'gefälscht', 'x'); blockiert := false; exception when others then blockiert := true; end;
  r := r || case when blockiert then ok else err end || 'Niemand kann das Protokoll von Hand fälschen' || E'\n';
  begin delete from gesundheit.protokoll where athlet_id = a; get diagnostics n = row_count; exception when others then n := 0; end;
  r := r || case when n = 0 then ok else err end || 'Niemand kann Protokolleinträge löschen' || E'\n';

  ---------------- Athlet B (ohne Einwilligung Gesundheitsdaten) ----------------
  perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);
  begin insert into gesundheit.anamnese (fragenversion, antworten) values ('test', '{}'); blockiert := false; exception when others then blockiert := true; end;
  r := r || case when blockiert then ok else err end || 'Ohne Einwilligung kann B keine Anamnese speichern' || E'\n';
  begin insert into gesundheit.beschwerden (koerperregion) values ('knie'); blockiert := false; exception when others then blockiert := true; end;
  r := r || case when blockiert then ok else err end || 'Ohne Einwilligung kann B keine Beschwerde speichern' || E'\n';

  ---------------- Fremde Person F ----------------
  perform set_config('request.jwt.claims', json_build_object('sub', f, 'role', 'authenticated')::text, true);
  select count(*) into n from gesundheit.anamnese;
  r := r || case when n = 0 then ok else err end || 'F sieht keine fremde Anamnese' || E'\n';
  select count(*) into n from gesundheit.beschwerden;
  r := r || case when n = 0 then ok else err end || 'F sieht keine fremden Beschwerden' || E'\n';
  select count(*) into n from gesundheit.protokoll;
  r := r || case when n = 0 then ok else err end || 'F sieht kein fremdes Protokoll' || E'\n';
  delete from gesundheit.anamnese where athlet_id = a; get diagnostics n = row_count;
  r := r || case when n = 0 then ok else err end || 'F kann die Anamnese von A nicht löschen' || E'\n';

  ---------------- Coach K ----------------
  perform set_config('request.jwt.claims', json_build_object('sub', k, 'role', 'authenticated')::text, true);
  select count(*) into n from gesundheit.anamnese where athlet_id = a;
  r := r || case when n = 2 then ok else err end || 'K sieht beide Anamnese-Versionen von A (' || n || ')' || E'\n';
  select count(*) into n from gesundheit.beschwerden where athlet_id = a;
  r := r || case when n = 1 then ok else err end || 'K sieht die Beschwerde von A' || E'\n';
  select count(*) into n from gesundheit.protokoll where athlet_id = a;
  r := r || case when n = 4 then ok else err end || 'K sieht das Protokoll von A' || E'\n';
  select count(*) into n from gesundheit.anamnese where athlet_id = b;
  r := r || case when n = 0 then ok else err end || 'K sieht bei B (ohne Einwilligung) nichts' || E'\n';
  begin insert into gesundheit.anamnese (fragenversion, antworten) values ('test', '{}'); blockiert := false; exception when others then blockiert := true; end;
  r := r || case when blockiert then ok else err end || 'K kann keine Anamnese eintragen' || E'\n';
  update gesundheit.beschwerden set beschreibung = 'vom Coach' where athlet_id = a; get diagnostics n = row_count;
  r := r || case when n = 0 then ok else err end || 'K kann Beschwerden von A nicht ändern' || E'\n';
  delete from gesundheit.anamnese where athlet_id = a; get diagnostics n = row_count;
  r := r || case when n = 0 then ok else err end || 'K kann die Anamnese von A nicht löschen' || E'\n';

  ---------------- A widerruft die Einwilligung ----------------
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  update public.einwilligungen set widerrufen_am = now() where athlet_id = a and art = 'gesundheitsdaten';
  select count(*) into n from gesundheit.anamnese where athlet_id = a;
  r := r || case when n = 2 then ok else err end || 'Nach Widerruf sieht A ihre eigenen Angaben weiter' || E'\n';
  begin insert into gesundheit.anamnese (fragenversion, antworten) values ('test', '{}'); blockiert := false; exception when others then blockiert := true; end;
  r := r || case when blockiert then ok else err end || 'Nach Widerruf kann A nichts Neues eintragen' || E'\n';

  perform set_config('request.jwt.claims', json_build_object('sub', k, 'role', 'authenticated')::text, true);
  select count(*) into n from gesundheit.anamnese where athlet_id = a;
  r := r || case when n = 0 then ok else err end || 'Nach Widerruf sieht K die Anamnese von A nicht mehr' || E'\n';
  select count(*) into n from gesundheit.beschwerden where athlet_id = a;
  r := r || case when n = 0 then ok else err end || 'Nach Widerruf sieht K die Beschwerden von A nicht mehr' || E'\n';

  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  delete from gesundheit.anamnese where athlet_id = a; get diagnostics n = row_count;
  r := r || case when n = 2 then ok else err end || 'A kann ihre Anamnese auch nach Widerruf löschen' || E'\n';

  ---------------- Ohne Anmeldung ----------------
  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  set local role anon;
  begin select count(*) into n from gesundheit.anamnese; blockiert := false; exception when others then blockiert := true; end;
  r := r || case when blockiert then ok else err end || 'Ohne Anmeldung kein Zugriff auf den Gesundheitsbereich' || E'\n';

  ---------------- Konto löschen räumt alles ab ----------------
  reset role;
  delete from auth.users where id = a;
  select count(*) into n from gesundheit.beschwerden where athlet_id = a;
  r := r || case when n = 0 then ok else err end || 'Beim Löschen des Kontos verschwinden auch die Beschwerden' || E'\n';
  select count(*) into n from gesundheit.protokoll where athlet_id = a;
  r := r || case when n = 0 then ok else err end || 'Beim Löschen des Kontos verschwindet auch das Protokoll' || E'\n';

  raise exception '%', r;
end $$;
