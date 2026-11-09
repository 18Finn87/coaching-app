-- =====================================================================
-- Coaching App · Schritt 2.4 · Prüfskript für die Zugangs-Funktionen
-- Nach 004b-gesundheit-zugriff.sql ausführen. Bricht absichtlich ab.
-- =====================================================================
do $$
declare
  r  text := E'TESTERGEBNIS Zugangs-Funktionen Gesundheit (alle Testdaten werden zurückgenommen)\n';
  n  int;
  bid uuid;
  blockiert boolean;
  k  uuid := '55555555-0000-4000-8000-00000000000c';
  a  uuid := '55555555-0000-4000-8000-00000000000a';
  f  uuid := '55555555-0000-4000-8000-00000000000f';
  ok  constant text := 'OK      ';
  err constant text := 'FEHLER  ';
begin
  insert into auth.users (id, instance_id, aud, role, email, created_at, updated_at) values
    (k, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'k@rls-test.invalid', now(), now()),
    (a, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'a@rls-test.invalid', now(), now()),
    (f, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'f@rls-test.invalid', now(), now());
  update public.profile set rolle = 'coach' where id = k;
  insert into public.coach_athlet (coach_id, athlet_id, status) values (k, a, 'aktiv');
  insert into public.einwilligungen (athlet_id, art, textversion) values
    (a, 'nutzung', 'test'), (a, 'gesundheitsdaten', 'test'), (f, 'nutzung', 'test'), (f, 'gesundheitsdaten', 'test');

  set local role authenticated;

  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  select public.anamnese_speichern('test', '{"x":1}') into n;
  r := r || case when n = 1 then ok else err end || 'A speichert Anamnese über die Funktion (Version ' || n || ')' || E'\n';
  select public.anamnese_speichern('test', '{"x":2}') into n;
  r := r || case when n = 2 then ok else err end || 'Zweites Speichern ergibt Version 2' || E'\n';
  select count(*) into n from public.anamnese_liste(a);
  r := r || case when n = 2 then ok else err end || 'A sieht beide Versionen' || E'\n';
  select public.beschwerde_speichern(null, 'schulter', 'zwickt', '2026-10-01', null) into bid;
  r := r || case when bid is not null then ok else err end || 'A legt eine Beschwerde an' || E'\n';
  select public.beschwerde_speichern(bid, 'schulter', 'zwickt kaum noch', '2026-10-01', '2026-11-05') into bid;
  select count(*) into n from public.beschwerden_liste(a) where bis = '2026-11-05';
  r := r || case when n = 1 then ok else err end || 'A ändert die Beschwerde' || E'\n';
  select count(*) into n from public.gesundheit_protokoll(a);
  r := r || case when n = 4 then ok else err end || 'Protokoll über die Funktion lesbar (' || n || ' Einträge)' || E'\n';

  perform set_config('request.jwt.claims', json_build_object('sub', f, 'role', 'authenticated')::text, true);
  select count(*) into n from public.anamnese_liste(a);
  r := r || case when n = 0 then ok else err end || 'F sieht über die Funktion nichts von A' || E'\n';
  select count(*) into n from public.gesundheit_protokoll(a);
  r := r || case when n = 0 then ok else err end || 'F sieht das Protokoll von A nicht' || E'\n';
  begin perform public.beschwerde_speichern(bid, 'knie', 'gehackt', null, null); blockiert := false; exception when others then blockiert := true; end;
  r := r || case when blockiert then ok else err end || 'F kann die Beschwerde von A nicht ändern' || E'\n';
  select public.beschwerde_loeschen(bid) into n;
  r := r || case when n = 0 then ok else err end || 'F kann die Beschwerde von A nicht löschen' || E'\n';

  perform set_config('request.jwt.claims', json_build_object('sub', k, 'role', 'authenticated')::text, true);
  select count(*) into n from public.anamnese_liste(a);
  r := r || case when n = 2 then ok else err end || 'K sieht die Anamnese von A über die Funktion' || E'\n';
  select count(*) into n from public.beschwerden_liste(a);
  r := r || case when n = 1 then ok else err end || 'K sieht die Beschwerde von A' || E'\n';
  begin perform public.anamnese_speichern('test', '{}'); blockiert := false; exception when others then blockiert := true; end;
  r := r || case when blockiert then ok else err end || 'K kann keine Anamnese speichern' || E'\n';
  select public.anamnese_loeschen() into n;
  r := r || case when n = 0 then ok else err end || 'K kann mit „löschen“ nur eigene (keine) Anamnese löschen' || E'\n';

  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  select public.anamnese_loeschen() into n;
  r := r || case when n = 2 then ok else err end || 'A löscht ihre gesamte Anamnese (' || n || ' Versionen)' || E'\n';

  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  set local role anon;
  begin perform public.anamnese_liste(a); blockiert := false; exception when others then blockiert := true; end;
  r := r || case when blockiert then ok else err end || 'Ohne Anmeldung keine Funktion nutzbar' || E'\n';

  raise exception '%', r;
end $$;
