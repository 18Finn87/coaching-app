-- =====================================================================
-- Coaching App · Schritt 1.4 · Prüfskript für die Zugriffsregeln
-- Erst NACH 001-fundament.sql im Supabase SQL Editor ausführen.
--
-- Legt Test-Konten an (Coach K, zweiter Coach K2, Athletin A, Athlet B,
-- fremde Person F), prüft, wer was sehen und ändern darf, und bricht am
-- Ende ABSICHTLICH ab: Das Ergebnis erscheint als Fehlermeldung, und alle
-- Testdaten werden dadurch automatisch wieder entfernt.
--
-- Erwartung: jede Zeile beginnt mit "OK". Steht irgendwo "FEHLER", bitte melden.
-- =====================================================================
do $$
declare
  r  text := E'TESTERGEBNIS (alle Testdaten werden zurückgenommen)\n';
  n  int;
  blockiert boolean;
  k  uuid := '11111111-0000-4000-8000-00000000000c';  -- Coach K
  k2 uuid := '11111111-0000-4000-8000-00000000000d';  -- zweiter Coach K2
  a  uuid := '11111111-0000-4000-8000-00000000000a';  -- Athletin A (betreut von K)
  b  uuid := '11111111-0000-4000-8000-00000000000b';  -- Athlet B (betreut von K2)
  f  uuid := '11111111-0000-4000-8000-00000000000f';  -- fremde Person (niemandem zugeordnet)
  ok  constant text := 'OK      ';
  err constant text := 'FEHLER  ';
begin
  ---------------- Testdaten (als Admin, ohne Zugriffsschutz) ----------------
  insert into auth.users (id, instance_id, aud, role, email, created_at, updated_at) values
    (k,  '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'k@rls-test.invalid',  now(), now()),
    (k2, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'k2@rls-test.invalid', now(), now()),
    (a,  '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'a@rls-test.invalid',  now(), now()),
    (b,  '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'b@rls-test.invalid',  now(), now()),
    (f,  '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'f@rls-test.invalid',  now(), now());

  select count(*) into n from public.profile where id in (k, k2, a, b, f) and rolle = 'athlet';
  r := r || case when n = 5 then ok else err end || 'Neue Konten bekommen automatisch ein Profil mit Rolle athlet (' || n || ' von 5)' || E'\n';

  update public.profile set rolle = 'coach' where id in (k, k2);
  insert into public.coach_athlet (coach_id, athlet_id, status) values (k, a, 'aktiv'), (k2, b, 'aktiv');
  insert into public.einladungen (coach_id, email) values (k, 'neu@rls-test.invalid'), (k2, 'x@rls-test.invalid');
  insert into public.einwilligungen (athlet_id, art, textversion) values (a, 'nutzung', 'test-1'), (b, 'nutzung', 'test-1');

  set local role authenticated;

  ---------------- Athletin A ----------------
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);

  select count(*) into n from public.profile;
  r := r || case when n = 2 then ok else err end || 'A sieht ' || n || ' Profile (soll 2: sich selbst und ihren Coach)' || E'\n';
  select count(*) into n from public.profile where id in (b, k2, f);
  r := r || case when n = 0 then ok else err end || 'A sieht keine fremden Profile' || E'\n';
  update public.profile set anzeigename = 'Anna' where id = a; get diagnostics n = row_count;
  r := r || case when n = 1 then ok else err end || 'A kann ihren eigenen Namen ändern' || E'\n';
  begin update public.profile set rolle = 'coach' where id = a; blockiert := false; exception when others then blockiert := true; end;
  r := r || case when blockiert then ok else err end || 'A kann sich nicht selbst zum Coach machen' || E'\n';
  update public.profile set anzeigename = 'gehackt' where id = k; get diagnostics n = row_count;
  r := r || case when n = 0 then ok else err end || 'A kann den Namen ihres Coaches nicht ändern' || E'\n';

  select count(*) into n from public.coach_athlet;
  r := r || case when n = 1 then ok else err end || 'A sieht ' || n || ' Betreuung(en) (soll 1: ihre eigene)' || E'\n';
  begin insert into public.coach_athlet (coach_id, athlet_id) values (k2, a); blockiert := false; exception when others then blockiert := true; end;
  r := r || case when blockiert then ok else err end || 'A kann sich nicht selbst einem Coach zuordnen' || E'\n';
  -- Abgelehnt wird hier nicht mit Fehlermeldung, sondern still: 0 Zeilen geändert
  begin update public.coach_athlet set erfahrungsstufe = 'sehr_erfahren' where athlet_id = a; get diagnostics n = row_count; exception when others then n := 0; end;
  r := r || case when n = 0 then ok else err end || 'A kann ihre Erfahrungsstufe nicht selbst ändern (' || n || ' Zeilen geändert, soll 0)' || E'\n';

  select count(*) into n from public.einladungen;
  r := r || case when n = 0 then ok else err end || 'A sieht ' || n || ' Einladungen (soll 0)' || E'\n';
  begin insert into public.einladungen (email) values ('spam@rls-test.invalid'); blockiert := false; exception when others then blockiert := true; end;
  r := r || case when blockiert then ok else err end || 'A kann niemanden einladen' || E'\n';

  select count(*) into n from public.einwilligungen;
  r := r || case when n = 1 then ok else err end || 'A sieht ' || n || ' Einwilligung(en) (soll 1: ihre eigene)' || E'\n';
  begin insert into public.einwilligungen (art, textversion) values ('gesundheitsdaten', 'test-1'); blockiert := false; exception when others then blockiert := true; end;
  r := r || case when not blockiert then ok else err end || 'A kann die Einwilligung für Gesundheitsdaten erteilen' || E'\n';
  begin insert into public.einwilligungen (athlet_id, art, textversion) values (b, 'gesundheitsdaten', 'test-1'); blockiert := false; exception when others then blockiert := true; end;
  r := r || case when blockiert then ok else err end || 'A kann keine Einwilligung im Namen von B erteilen' || E'\n';
  update public.einwilligungen set widerrufen_am = now() where athlet_id = a and art = 'gesundheitsdaten'; get diagnostics n = row_count;
  r := r || case when n = 1 then ok else err end || 'A kann ihre Einwilligung widerrufen' || E'\n';
  begin update public.einwilligungen set widerrufen_am = null where athlet_id = a and art = 'gesundheitsdaten'; blockiert := false; exception when others then blockiert := true; end;
  r := r || case when blockiert then ok else err end || 'Ein Widerruf kann nicht rückgängig gemacht werden' || E'\n';
  begin insert into public.einwilligungen (art, textversion, erteilt_am) values ('gesundheitsdaten', 'test-2', '2020-01-01'); blockiert := false; exception when others then blockiert := true; end;
  r := r || case when blockiert then ok else err end || 'A kann eine Einwilligung nicht rückdatieren' || E'\n';
  begin delete from public.einwilligungen where athlet_id = a; blockiert := false; exception when others then blockiert := true; end;
  r := r || case when blockiert then ok else err end || 'A kann Einwilligungen nicht löschen (Nachweis bleibt erhalten)' || E'\n';

  ---------------- Fremde Person F (niemandem zugeordnet) ----------------
  perform set_config('request.jwt.claims', json_build_object('sub', f, 'role', 'authenticated')::text, true);

  select count(*) into n from public.profile;
  r := r || case when n = 1 then ok else err end || 'F sieht ' || n || ' Profil(e) (soll 1: nur sich selbst)' || E'\n';
  select count(*) into n from public.coach_athlet;
  r := r || case when n = 0 then ok else err end || 'F sieht ' || n || ' Betreuungen (soll 0)' || E'\n';
  select count(*) into n from public.einwilligungen;
  r := r || case when n = 0 then ok else err end || 'F sieht ' || n || ' fremde Einwilligungen (soll 0)' || E'\n';
  select count(*) into n from public.einladungen;
  r := r || case when n = 0 then ok else err end || 'F sieht ' || n || ' Einladungen (soll 0)' || E'\n';

  ---------------- Coach K ----------------
  perform set_config('request.jwt.claims', json_build_object('sub', k, 'role', 'authenticated')::text, true);

  select count(*) into n from public.profile;
  r := r || case when n = 2 then ok else err end || 'K sieht ' || n || ' Profile (soll 2: sich selbst und Athletin A)' || E'\n';
  select count(*) into n from public.profile where id in (b, k2, f);
  r := r || case when n = 0 then ok else err end || 'K sieht keine Personen, die er nicht betreut' || E'\n';
  select count(*) into n from public.coach_athlet;
  r := r || case when n = 1 then ok else err end || 'K sieht ' || n || ' Betreuung(en) (soll 1)' || E'\n';
  update public.coach_athlet set erfahrungsstufe = 'fortgeschritten' where athlet_id = a; get diagnostics n = row_count;
  r := r || case when n = 1 then ok else err end || 'K kann die Erfahrungsstufe von A ändern' || E'\n';
  update public.coach_athlet set status = 'beendet' where athlet_id = b; get diagnostics n = row_count;
  r := r || case when n = 0 then ok else err end || 'K kann die Betreuung von B (anderer Coach) nicht ändern' || E'\n';
  begin insert into public.coach_athlet (coach_id, athlet_id) values (k, k2); blockiert := false; exception when others then blockiert := true; end;
  r := r || case when blockiert then ok else err end || 'K kann keinen anderen Coach als Athleten eintragen' || E'\n';
  begin insert into public.coach_athlet (coach_id, athlet_id) values (k2, f); blockiert := false; exception when others then blockiert := true; end;
  r := r || case when blockiert then ok else err end || 'K kann keine Betreuung im Namen eines anderen Coaches anlegen' || E'\n';

  select count(*) into n from public.einwilligungen;
  r := r || case when n = 2 then ok else err end || 'K sieht ' || n || ' Einwilligungen (soll 2: die von A, auch die widerrufene)' || E'\n';
  select count(*) into n from public.einwilligungen where athlet_id = b;
  r := r || case when n = 0 then ok else err end || 'K sieht keine Einwilligungen von B' || E'\n';
  begin insert into public.einwilligungen (athlet_id, art, textversion) values (a, 'gesundheitsdaten', 'test-1'); blockiert := false; exception when others then blockiert := true; end;
  r := r || case when blockiert then ok else err end || 'K kann keine Einwilligung im Namen von A erteilen' || E'\n';
  update public.einwilligungen set widerrufen_am = now() where athlet_id = a and widerrufen_am is null; get diagnostics n = row_count;
  r := r || case when n = 0 then ok else err end || 'K kann keine Einwilligung von A widerrufen' || E'\n';

  select count(*) into n from public.einladungen;
  r := r || case when n = 1 then ok else err end || 'K sieht ' || n || ' Einladung(en) (soll 1: nur seine eigene)' || E'\n';
  begin insert into public.einladungen (email) values ('neu2@rls-test.invalid'); blockiert := false; exception when others then blockiert := true; end;
  r := r || case when not blockiert then ok else err end || 'K kann jemanden einladen' || E'\n';
  begin insert into public.einladungen (coach_id, email) values (k2, 'falsch@rls-test.invalid'); blockiert := false; exception when others then blockiert := true; end;
  r := r || case when blockiert then ok else err end || 'K kann keine Einladung im Namen von K2 anlegen' || E'\n';
  delete from public.einladungen where coach_id = k2; get diagnostics n = row_count;
  r := r || case when n = 0 then ok else err end || 'K kann Einladungen von K2 nicht löschen' || E'\n';

  ---------------- Coach K beendet die Betreuung von A ----------------
  update public.coach_athlet set status = 'beendet' where athlet_id = a;
  select count(*) into n from public.profile where id = a;
  r := r || case when n = 0 then ok else err end || 'Nach Ende der Betreuung sieht K das Profil von A nicht mehr' || E'\n';
  select count(*) into n from public.einwilligungen where athlet_id = a;
  r := r || case when n = 0 then ok else err end || 'Nach Ende der Betreuung sieht K die Einwilligungen von A nicht mehr' || E'\n';

  ---------------- Nicht angemeldet (anon) ----------------
  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  set local role anon;
  begin select count(*) into n from public.profile; blockiert := false; exception when others then blockiert := true; end;
  r := r || case when blockiert then ok else err end || 'Ohne Anmeldung kein Zugriff auf Profile' || E'\n';
  begin select count(*) into n from public.einwilligungen; blockiert := false; exception when others then blockiert := true; end;
  r := r || case when blockiert then ok else err end || 'Ohne Anmeldung kein Zugriff auf Einwilligungen' || E'\n';

  raise exception '%', r;
end $$;
