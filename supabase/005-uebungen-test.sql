-- =====================================================================
-- Coaching App · Schritt 3.1 · Prüfskript Übungsbibliothek
-- Nach 005-uebungen.sql ausführen. Bricht absichtlich ab (Testdaten verschwinden).
-- =====================================================================
do $$
declare
  r  text := E'TESTERGEBNIS Übungsbibliothek (alle Testdaten werden zurückgenommen)\n';
  n  int;
  blockiert boolean;
  k  uuid := '66666666-0000-4000-8000-00000000000c';
  k2 uuid := '66666666-0000-4000-8000-00000000000d';
  a  uuid := '66666666-0000-4000-8000-00000000000a';
  f  uuid := '66666666-0000-4000-8000-00000000000f';
  ok  constant text := 'OK      ';
  err constant text := 'FEHLER  ';
begin
  insert into auth.users (id, instance_id, aud, role, email, created_at, updated_at) values
    (k,  '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'k@rls-test.invalid',  now(), now()),
    (k2, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'k2@rls-test.invalid', now(), now()),
    (a,  '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'a@rls-test.invalid',  now(), now()),
    (f,  '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'f@rls-test.invalid',  now(), now());
  update public.profile set rolle = 'coach' where id in (k, k2);
  insert into public.coach_athlet (coach_id, athlet_id, status) values (k, a, 'aktiv');
  insert into public.uebungen (coach_id, name) values (k2, 'Übung von K2');

  set local role authenticated;

  ---------------- Coach K ----------------
  perform set_config('request.jwt.claims', json_build_object('sub', k, 'role', 'authenticated')::text, true);
  begin insert into public.uebungen (name, bewegungsmuster, muskelgruppen, ausstattung, e1rm_geeignet)
        values ('Test-Kniebeuge', 'kniebeuge', array['quadrizeps'], array['langhantel'], true);
        blockiert := false; exception when others then blockiert := true; end;
  r := r || case when not blockiert then ok else err end || 'K kann eine Übung anlegen' || E'\n';
  begin insert into public.uebungen (name) values ('test-kniebeuge'); blockiert := false; exception when others then blockiert := true; end;
  r := r || case when blockiert then ok else err end || 'Doppelter Name (Groß/Klein egal) wird abgelehnt' || E'\n';
  begin insert into public.uebungen (name, bewegungsmuster) values ('Unsinn', 'fliegen'); blockiert := false; exception when others then blockiert := true; end;
  r := r || case when blockiert then ok else err end || 'Unbekanntes Bewegungsmuster wird abgelehnt' || E'\n';
  begin insert into public.uebungen (name, video_link) values ('Mit Link', 'javascript:alert(1)'); blockiert := false; exception when others then blockiert := true; end;
  r := r || case when blockiert then ok else err end || 'Nur sichere Video-Links (https) erlaubt' || E'\n';
  update public.uebungen set archiviert = true where name = 'Test-Kniebeuge'; get diagnostics n = row_count;
  r := r || case when n = 1 then ok else err end || 'K kann eine Übung archivieren' || E'\n';
  begin delete from public.uebungen where name = 'Test-Kniebeuge'; blockiert := false; exception when others then blockiert := true; end;
  r := r || case when blockiert then ok else err end || 'Übungen können nicht gelöscht werden (nur archiviert)' || E'\n';
  select count(*) into n from public.uebungen where coach_id = k2;
  r := r || case when n = 0 then ok else err end || 'K sieht die Übungen anderer Coaches nicht' || E'\n';
  update public.uebungen set name = 'gehackt' where coach_id = k2; get diagnostics n = row_count;
  r := r || case when n = 0 then ok else err end || 'K kann Übungen anderer Coaches nicht ändern' || E'\n';

  ---------------- Athletin A ----------------
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  select count(*) into n from public.uebungen where coach_id = k;
  r := r || case when n = 1 then ok else err end || 'A sieht die Übungen ihres Coaches' || E'\n';
  begin insert into public.uebungen (name) values ('Von A'); blockiert := false; exception when others then blockiert := true; end;
  r := r || case when blockiert then ok else err end || 'A kann keine Übungen anlegen' || E'\n';
  update public.uebungen set beschreibung = 'gehackt' where coach_id = k; get diagnostics n = row_count;
  r := r || case when n = 0 then ok else err end || 'A kann Übungen nicht ändern' || E'\n';

  ---------------- Fremde Person F ----------------
  perform set_config('request.jwt.claims', json_build_object('sub', f, 'role', 'authenticated')::text, true);
  select count(*) into n from public.uebungen where coach_id in (k, k2);
  r := r || case when n = 0 then ok else err end || 'F sieht keine Übungen' || E'\n';

  ---------------- Ohne Anmeldung ----------------
  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  set local role anon;
  begin select count(*) into n from public.uebungen; blockiert := false; exception when others then blockiert := true; end;
  r := r || case when blockiert then ok else err end || 'Ohne Anmeldung kein Zugriff auf Übungen' || E'\n';

  raise exception '%', r;
end $$;
