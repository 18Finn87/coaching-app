-- =====================================================================
-- Coaching App · Phase 6 · Prüfskript Check-ins, Glocke, Evaluationen
-- Nach 009-coaching.sql ausführen. Bricht absichtlich ab (Testdaten verschwinden).
-- =====================================================================
do $$
declare
  r   text := E'TESTERGEBNIS Coaching (alle Testdaten werden zurückgenommen)\n';
  n   int;
  t   text;
  blockiert boolean;
  k   uuid := 'bbbbbbbb-2222-4000-8000-00000000000c';
  k2  uuid := 'bbbbbbbb-2222-4000-8000-00000000000d';
  a   uuid := 'bbbbbbbb-2222-4000-8000-00000000000a';
  b   uuid := 'bbbbbbbb-2222-4000-8000-00000000000b';
  c   uuid := 'bbbbbbbb-2222-4000-8000-0000000000c1';
  f   uuid := 'bbbbbbbb-2222-4000-8000-00000000000f';
  p1  uuid := 'bbbbbbbb-2222-4000-8000-0000000000a1';
  p2  uuid := 'bbbbbbbb-2222-4000-8000-0000000000a2';
  p3  uuid := 'bbbbbbbb-2222-4000-8000-0000000000a3';
  v1  uuid; v2 uuid; v3 uuid;
  ci  uuid;
  ev  uuid;
  i   int;
  stand_vorher text;
  stand_nachher text;
  ok  constant text := 'OK      ';
  err constant text := 'FEHLER  ';
begin
  insert into auth.users (id, instance_id, aud, role, email, created_at, updated_at) values
    (k,  '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'k@rls-test.invalid',  now(), now()),
    (k2, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'k2@rls-test.invalid', now(), now()),
    (a,  '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'a@rls-test.invalid',  now(), now()),
    (b,  '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'b@rls-test.invalid',  now(), now()),
    (c,  '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'c@rls-test.invalid',  now(), now()),
    (f,  '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'f@rls-test.invalid',  now(), now());
  update public.profile set rolle = 'coach' where id in (k, k2);
  update public.profile set anzeigename = 'Anna' where id = a;
  update public.profile set anzeigename = 'Ben' where id = b;
  update public.profile set anzeigename = 'Cara' where id = c;
  insert into public.coach_athlet (coach_id, athlet_id, status) values (k, a, 'aktiv'), (k, b, 'aktiv'), (k, c, 'aktiv');
  insert into public.einwilligungen (athlet_id, art, textversion) values
    (a, 'nutzung', 'test'), (a, 'gesundheitsdaten', 'test'), (b, 'nutzung', 'test'), (c, 'nutzung', 'test'), (f, 'nutzung', 'test');

  set local role authenticated;

  ---------------- 6.1 Check-in ----------------
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  insert into public.checkins (schlaf, stress, energie, muskelkater, motivation, notiz)
  values (4, 2, 4, 3, 5, 'Knie zwickt etwas') returning id into ci;
  r := r || case when ci is not null then ok else err end || 'A gibt ihren Check-in ab' || E'\n';
  begin insert into public.checkins (schlaf, stress, energie, muskelkater, motivation) values (3, 3, 3, 3, 3); blockiert := false; exception when others then blockiert := true; end;
  r := r || case when blockiert then ok else err end || 'Zweiter Check-in in derselben Woche wird abgelehnt' || E'\n';
  begin update public.checkins set schlaf = 6 where id = ci; blockiert := false; exception when others then blockiert := true; end;
  r := r || case when blockiert then ok else err end || 'Wert außerhalb 1–5 wird abgelehnt' || E'\n';
  begin update public.checkins set coach_antwort = 'selbst' where id = ci; blockiert := false; exception when others then blockiert := true; end;
  r := r || case when blockiert then ok else err end || 'A kann keine Coach-Antwort schreiben' || E'\n';
  perform public.checkin_gesundheit_speichern(ci, true, 'knie', 3, 'beim Treppensteigen');
  select count(*) into n from public.checkin_gesundheit_liste(a);
  r := r || case when n = 1 then ok else err end || 'A speichert den Gesundheitsteil (getrennt)' || E'\n';

  perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);
  insert into public.checkins (schlaf, stress, energie, muskelkater, motivation) values (3, 3, 3, 3, 3) returning id into ev;
  begin perform public.checkin_gesundheit_speichern(ev, false, null, null, ''); blockiert := false; exception when others then blockiert := true; end;
  r := r || case when blockiert then ok else err end || 'B ohne Einwilligung kann keinen Gesundheitsteil speichern' || E'\n';
  begin perform public.checkin_gesundheit_speichern(ci, false, null, null, ''); blockiert := false; exception when others then blockiert := true; end;
  select count(*) into n from public.checkin_gesundheit_liste(a);
  r := r || case when n = 0 then ok else err end || 'B sieht den Gesundheitsteil von A nicht' || E'\n';
  ev := null;

  perform set_config('request.jwt.claims', json_build_object('sub', k, 'role', 'authenticated')::text, true);
  select count(*) into n from public.checkins where athlet_id in (a, b);
  r := r || case when n = 2 then ok else err end || 'K sieht die Check-ins seiner Athleten (' || n || ')' || E'\n';
  select count(*) into n from public.checkin_gesundheit_liste(a);
  r := r || case when n = 1 then ok else err end || 'K sieht den Gesundheitsteil von A (Einwilligung erteilt)' || E'\n';
  select count(*), max(text_kurz) into n, t from public.benachrichtigungen where empfaenger_id = k and art = 'checkin_neu';
  r := r || case when n = 2 then ok else err end || 'K bekommt pro Check-in einen Hinweis (' || n || ')' || E'\n';
  select count(*) into n from public.benachrichtigungen
  where empfaenger_id = k and (text_kurz ilike '%knie%' or text_kurz ilike '%zwickt%' or text_kurz ilike '%treppe%');
  r := r || case when n = 0 then ok else err end || 'Hinweise enthalten keine Inhalte des Check-ins' || E'\n';
  perform public.checkin_antworten(ci, 'Danke! Wir passen die Kniebeuge an.');
  update public.checkins set schlaf = 1 where id = ci; get diagnostics n = row_count;
  r := r || case when n = 0 then ok else err end || 'K kann die Werte von A nicht ändern' || E'\n';

  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  select count(*) into n from public.checkins where id = ci and coach_antwort like 'Danke%' and schlaf = 4;
  r := r || case when n = 1 then ok else err end || 'A sieht die Antwort, ihre Werte sind unverändert' || E'\n';
  select count(*) into n from public.benachrichtigungen where empfaenger_id = a and art = 'checkin_antwort';
  r := r || case when n = 1 then ok else err end || 'A bekommt einen Hinweis auf die Antwort' || E'\n';
  select count(*) into n from public.benachrichtigungen where empfaenger_id = k;
  r := r || case when n = 0 then ok else err end || 'A sieht keine Hinweise des Coaches' || E'\n';
  update public.benachrichtigungen set gelesen_am = now() where empfaenger_id = a; get diagnostics n = row_count;
  r := r || case when n = 1 then ok else err end || 'A kann ihren Hinweis als gelesen markieren' || E'\n';
  -- Einwilligung widerrufen → Coach sieht den Gesundheitsteil nicht mehr
  update public.einwilligungen set widerrufen_am = now() where athlet_id = a and art = 'gesundheitsdaten';

  perform set_config('request.jwt.claims', json_build_object('sub', k, 'role', 'authenticated')::text, true);
  select count(*) into n from public.checkin_gesundheit_liste(a);
  r := r || case when n = 0 then ok else err end || 'Nach Widerruf sieht K den Gesundheitsteil nicht mehr' || E'\n';
  select count(*) into n from public.checkins where id = ci;
  r := r || case when n = 1 then ok else err end || 'Den allgemeinen Check-in sieht K weiterhin' || E'\n';

  perform set_config('request.jwt.claims', json_build_object('sub', f, 'role', 'authenticated')::text, true);
  select count(*) into n from public.checkins;
  r := r || case when n = 0 then ok else err end || 'Fremde Person F sieht keine Check-ins' || E'\n';
  begin perform public.checkin_antworten(ci, 'hallo'); blockiert := false; exception when others then blockiert := true; end;
  r := r || case when blockiert then ok else err end || 'F kann nicht antworten' || E'\n';
  perform set_config('request.jwt.claims', json_build_object('sub', k2, 'role', 'authenticated')::text, true);
  select count(*) into n from public.checkins;
  r := r || case when n = 0 then ok else err end || 'Anderer Coach sieht keine Check-ins' || E'\n';
  begin perform public.checkin_antworten(ci, 'hallo'); blockiert := false; exception when others then blockiert := true; end;
  r := r || case when blockiert then ok else err end || 'Anderer Coach kann nicht antworten' || E'\n';

  ---------------- 6.2 Tageszusammenfassung ----------------
  reset role;
  for i in 1..3 loop
    insert into public.trainingseinheiten (id, athlet_id, titel, status, gestartet_am, beendet_am)
    values (gen_random_uuid(), case when i < 3 then a else b end, 'Test', 'abgeschlossen', now() - interval '3 hours', now() - interval '2 hours');
  end loop;
  select count(*) into n from public.benachrichtigungen where empfaenger_id = k and art not in ('checkin_neu');
  r := r || case when n = 0 then ok else err end || '3 Einheiten erzeugen keine Einzelmeldung' || E'\n';
  perform intern.zusammenfassung_erstellen();
  select count(*), max(text_kurz) into n, t from public.benachrichtigungen where empfaenger_id = k and art = 'zusammenfassung';
  r := r || case when n = 1 and t like '3 neue Einheiten seit gestern: Anna (2), Ben%' then ok else err end
         || '3 Einheiten → 1 Zusammenfassung: „' || coalesce(t, '-') || '“' || E'\n';
  perform intern.zusammenfassung_erstellen();
  select count(*) into n from public.benachrichtigungen where empfaenger_id = k and art = 'zusammenfassung';
  r := r || case when n = 1 then ok else err end || 'Keine doppelte Meldung derselben Einheiten' || E'\n';

  ---------------- 6.3 Evaluationsregeln ----------------
  set local role authenticated;
  perform set_config('request.jwt.claims', json_build_object('sub', k, 'role', 'authenticated')::text, true);
  begin insert into public.evaluationsregeln (erfahrungsstufe, nach_wochen, nach_einheiten) values ('fortgeschritten', 5, 12); blockiert := false; exception when others then blockiert := true; end;
  r := r || case when not blockiert then ok else err end || 'K stellt die Regel für Fortgeschrittene ein' || E'\n';
  begin insert into public.evaluationsregeln (erfahrungsstufe, nach_wochen, nach_einheiten) values ('anfaenger', 8, 30); blockiert := false; exception when others then blockiert := true; end;
  r := r || case when blockiert then ok else err end || 'Anfänger-Regel (4 Wochen / 10 Einheiten) bleibt fest' || E'\n';
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  begin insert into public.evaluationsregeln (erfahrungsstufe, nach_wochen, nach_einheiten) values ('sehr_erfahren', 1, 1); blockiert := false; exception when others then blockiert := true; end;
  r := r || case when blockiert then ok else err end || 'Athletin kann keine Regeln anlegen' || E'\n';

  ---------------- 6.3 Fälligkeit ----------------
  reset role;
  -- P1: Anna (Anfängerin), seit 3 Wochen, 10 Einheiten → fällig wegen Einheiten
  -- P2: Ben (Anfänger), seit 4 Wochen + 1 Tag, 6 Einheiten → fällig wegen Wochen
  -- P3: Cara (Anfängerin), seit 2 Wochen, 5 Einheiten → noch nicht fällig
  insert into public.plaene (id, coach_id, athlet_id, titel) values
    (p1, k, a, 'Plan Anna'), (p2, k, b, 'Plan Ben'), (p3, k, c, 'Plan Cara');
  insert into public.planversionen (plan_id) values (p1) returning id into v1;
  insert into public.planversionen (plan_id) values (p2) returning id into v2;
  insert into public.planversionen (plan_id) values (p3) returning id into v3;
  update public.planversionen set status = 'veroeffentlicht', veroeffentlicht_am = now() - interval '21 days',
         gueltig_ab = (now() - interval '21 days')::date where id = v1;
  update public.planversionen set status = 'veroeffentlicht', veroeffentlicht_am = now() - interval '29 days',
         gueltig_ab = (now() - interval '29 days')::date where id = v2;
  update public.planversionen set status = 'veroeffentlicht', veroeffentlicht_am = now() - interval '14 days',
         gueltig_ab = (now() - interval '14 days')::date where id = v3;
  for i in 1..10 loop
    insert into public.trainingseinheiten (id, athlet_id, planversion_id, titel, status, gestartet_am, beendet_am)
    values (gen_random_uuid(), a, v1, 'T', 'abgeschlossen', now() - make_interval(days => 21 - i * 2), now() - make_interval(days => 21 - i * 2) + interval '1 hour');
  end loop;
  for i in 1..6 loop
    insert into public.trainingseinheiten (id, athlet_id, planversion_id, titel, status, gestartet_am, beendet_am)
    values (gen_random_uuid(), b, v2, 'T', 'abgeschlossen', now() - make_interval(days => 28 - i * 4), now() - make_interval(days => 28 - i * 4) + interval '1 hour');
  end loop;
  for i in 1..5 loop
    insert into public.trainingseinheiten (id, athlet_id, planversion_id, titel, status, gestartet_am, beendet_am)
    values (gen_random_uuid(), c, v3, 'T', 'abgeschlossen', now() - make_interval(days => 14 - i * 2), now() - make_interval(days => 14 - i * 2) + interval '1 hour');
  end loop;

  select string_agg(id::text || status || versionsnummer || coalesce(veroeffentlicht_am::text, ''), ',' order by id)
  into stand_vorher from public.planversionen where plan_id in (p1, p2, p3);

  n := intern.evaluationen_pruefen(null, now());
  r := r || case when n = 2 then ok else err end || 'Tägliche Prüfung findet 2 fällige Evaluationen (' || n || ')' || E'\n';
  select count(*) into n from public.evaluationen where plan_id = p1 and ausloeser = 'einheiten';
  r := r || case when n = 1 then ok else err end || 'Anfängerin: 10 Einheiten in 3 Wochen → fällig (Einheiten)' || E'\n';
  select count(*) into n from public.evaluationen where plan_id = p2 and ausloeser = 'wochen';
  r := r || case when n = 1 then ok else err end || 'Anfänger: 4 Wochen mit 6 Einheiten → fällig (Wochen)' || E'\n';
  select count(*) into n from public.evaluationen where plan_id = p3;
  r := r || case when n = 0 then ok else err end || '2 Wochen mit 5 Einheiten → noch nicht fällig' || E'\n';
  n := intern.evaluationen_pruefen(null, now());
  select count(*) into i from public.evaluationen where plan_id in (p1, p2, p3);
  r := r || case when n = 0 and i = 2 then ok else err end || 'Zweite Prüfung legt keine doppelten Evaluationen an' || E'\n';
  select count(*) into n from public.benachrichtigungen where empfaenger_id = k and art = 'evaluation_faellig';
  r := r || case when n = 2 then ok else err end || 'K bekommt je Evaluation einen Hinweis (' || n || ')' || E'\n';
  select string_agg(id::text || status || versionsnummer || coalesce(veroeffentlicht_am::text, ''), ',' order by id)
  into stand_nachher from public.planversionen where plan_id in (p1, p2, p3);
  select count(*) into n from public.planversionen where plan_id in (p1, p2, p3);
  r := r || case when stand_vorher = stand_nachher and n = 3 then ok else err end || 'Kein Plan wurde verändert' || E'\n';

  ---------------- 6.4 Evaluation durchführen ----------------
  select id into ev from public.evaluationen where plan_id = p1;
  set local role authenticated;
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  select count(*) into n from public.evaluationen;
  r := r || case when n = 0 then ok else err end || 'Athletin sieht keine Evaluationen' || E'\n';
  perform set_config('request.jwt.claims', json_build_object('sub', k2, 'role', 'authenticated')::text, true);
  select count(*) into n from public.evaluationen;
  r := r || case when n = 0 then ok else err end || 'Anderer Coach sieht keine Evaluationen' || E'\n';

  perform set_config('request.jwt.claims', json_build_object('sub', k, 'role', 'authenticated')::text, true);
  select count(*) into n from public.evaluationen;
  r := r || case when n = 2 then ok else err end || 'K sieht seine fälligen Evaluationen' || E'\n';
  begin update public.evaluationen set status = 'erledigt' where id = ev; blockiert := false; exception when others then blockiert := true; end;
  r := r || case when blockiert then ok else err end || 'Abschließen ohne Entscheidung wird abgelehnt' || E'\n';
  update public.evaluationen set status = 'erledigt', entscheidung = 'anpassen', coach_notiz = 'Kniebeuge leichter'
  where id = ev;
  select count(*) into n from public.evaluationen where id = ev and erledigt_am is not null;
  r := r || case when n = 1 then ok else err end || 'K schließt mit „anpassen“ ab (Zeitpunkt gespeichert)' || E'\n';
  select count(*) into n from public.planversionen where plan_id = p1;
  r := r || case when n = 1 then ok else err end || '„Anpassen“ legt keine neue Planversion an' || E'\n';
  begin update public.evaluationen set entscheidung = 'beibehalten' where id = ev; blockiert := false; exception when others then blockiert := true; end;
  r := r || case when blockiert then ok else err end || 'Abgeschlossene Evaluation bleibt unverändert' || E'\n';
  update public.evaluationen set coach_notiz = 'Kniebeuge leichter, Knie beobachten' where id = ev; get diagnostics n = row_count;
  r := r || case when n = 1 then ok else err end || 'Notiz bleibt nachträglich änderbar' || E'\n';
  n := public.evaluationen_jetzt_pruefen();
  r := r || case when n = 0 then ok else err end || 'Nach der Evaluation beginnt die Zählung neu (nicht sofort wieder fällig)' || E'\n';
  update public.evaluationen set status = 'verschoben', verschoben_bis = current_date + 7 where plan_id = p2 and status = 'faellig';
  get diagnostics n = row_count;
  r := r || case when n = 1 then ok else err end || 'K kann eine Evaluation um eine Woche verschieben' || E'\n';

  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  begin n := public.evaluationen_jetzt_pruefen(); blockiert := (n <> 0); exception when others then blockiert := true; end;
  r := r || case when not blockiert then ok else err end || 'Athletin kann keine Prüfung auslösen (0 Ergebnisse)' || E'\n';

  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  set local role anon;
  begin select count(*) into n from public.checkins; blockiert := false; exception when others then blockiert := true; end;
  r := r || case when blockiert then ok else err end || 'Ohne Anmeldung kein Zugriff' || E'\n';

  raise exception '%', r;
end $$;
