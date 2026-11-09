-- =====================================================================
-- Coaching App · Schritt 2.3 · Prüfskript Stammdaten und Betreuung
-- Nach 003-stammdaten.sql ausführen. Bricht absichtlich ab (Testdaten verschwinden).
-- =====================================================================
do $$
declare
  r  text := E'TESTERGEBNIS Stammdaten (alle Testdaten werden zurückgenommen)\n';
  n  int;
  t  text;
  blockiert boolean;
  k  uuid := '33333333-0000-4000-8000-00000000000c';
  a  uuid := '33333333-0000-4000-8000-00000000000a';
  b  uuid := '33333333-0000-4000-8000-00000000000b';  -- ohne Einwilligung
  f  uuid := '33333333-0000-4000-8000-00000000000f';
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

  set local role authenticated;

  ---------------- Athletin A (mit Einwilligung) ----------------
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  begin
    insert into public.athlet_stammdaten (athlet_id, geburtsjahr, ziele, trainingstage, ausstattung)
    values (a, 1998, array['kraft', 'gesundheit'], array[1, 4]::smallint[], array['studio']);
    blockiert := false;
  exception when others then blockiert := true; end;
  r := r || case when not blockiert then ok else err end || 'A kann ihre Stammdaten speichern' || E'\n';
  update public.athlet_stammdaten set einheit_minuten = 60 where athlet_id = a; get diagnostics n = row_count;
  r := r || case when n = 1 then ok else err end || 'A kann ihre Stammdaten ändern' || E'\n';
  begin insert into public.athlet_stammdaten (athlet_id, ziele) values (a, array['unsinn']); blockiert := false; exception when others then blockiert := true; end;
  r := r || case when blockiert then ok else err end || 'Unbekannte Ziele werden abgelehnt' || E'\n';
  begin insert into public.athlet_stammdaten (athlet_id) values (f); blockiert := false; exception when others then blockiert := true; end;
  r := r || case when blockiert then ok else err end || 'A kann keine Stammdaten für andere anlegen' || E'\n';
  begin update public.coach_athlet set erfahrungsstufe = 'sehr_erfahren' where athlet_id = a; get diagnostics n = row_count; exception when others then n := 0; end;
  r := r || case when n = 0 then ok else err end || 'A kann ihre Erfahrungsstufe nicht ändern' || E'\n';

  ---------------- Athlet B (ohne Einwilligung) ----------------
  perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);
  begin insert into public.athlet_stammdaten (athlet_id, geburtsjahr) values (b, 1990); blockiert := false; exception when others then blockiert := true; end;
  r := r || case when blockiert then ok else err end || 'Ohne Einwilligung zur Nutzung kann B nichts speichern' || E'\n';

  ---------------- Fremde Person F ----------------
  perform set_config('request.jwt.claims', json_build_object('sub', f, 'role', 'authenticated')::text, true);
  select count(*) into n from public.athlet_stammdaten;
  r := r || case when n = 0 then ok else err end || 'F sieht keine fremden Stammdaten' || E'\n';
  update public.athlet_stammdaten set ziel_text = 'gehackt' where athlet_id = a; get diagnostics n = row_count;
  r := r || case when n = 0 then ok else err end || 'F kann Stammdaten von A nicht ändern' || E'\n';
  delete from public.athlet_stammdaten where athlet_id = a; get diagnostics n = row_count;
  r := r || case when n = 0 then ok else err end || 'F kann Stammdaten von A nicht löschen' || E'\n';

  ---------------- Coach K ----------------
  perform set_config('request.jwt.claims', json_build_object('sub', k, 'role', 'authenticated')::text, true);
  select count(*) into n from public.athlet_stammdaten where athlet_id = a;
  r := r || case when n = 1 then ok else err end || 'K sieht die Stammdaten von A' || E'\n';
  update public.athlet_stammdaten set ziel_text = 'vom Coach' where athlet_id = a; get diagnostics n = row_count;
  r := r || case when n = 0 then ok else err end || 'K kann die Stammdaten von A nicht ändern (nur lesen)' || E'\n';
  update public.coach_athlet set erfahrungsstufe = 'fortgeschritten' where athlet_id = a; get diagnostics n = row_count;
  r := r || case when n = 1 then ok else err end || 'K kann die Erfahrungsstufe von A ändern' || E'\n';
  update public.coach_athlet set status = 'pausiert' where athlet_id = a; get diagnostics n = row_count;
  r := r || case when n = 1 then ok else err end || 'K kann die Betreuung pausieren' || E'\n';
  select count(*) into n from public.athlet_stammdaten where athlet_id = a;
  r := r || case when n = 1 then ok else err end || 'Bei pausierter Betreuung sieht K die Stammdaten weiter' || E'\n';
  update public.coach_athlet set status = 'beendet' where athlet_id = a;
  select count(*) into n from public.athlet_stammdaten where athlet_id = a;
  r := r || case when n = 0 then ok else err end || 'Nach beendeter Betreuung sieht K die Stammdaten nicht mehr' || E'\n';

  ---------------- A sieht ihre Stufe ----------------
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  select erfahrungsstufe::text into t from public.coach_athlet where athlet_id = a;
  r := r || case when t = 'fortgeschritten' then ok else err end || 'A sieht die vom Coach gesetzte Stufe (' || coalesce(t, '-') || ')' || E'\n';
  delete from public.athlet_stammdaten where athlet_id = a; get diagnostics n = row_count;
  r := r || case when n = 1 then ok else err end || 'A kann ihre Stammdaten löschen' || E'\n';

  ---------------- Ohne Anmeldung ----------------
  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  set local role anon;
  begin select count(*) into n from public.athlet_stammdaten; blockiert := false; exception when others then blockiert := true; end;
  r := r || case when blockiert then ok else err end || 'Ohne Anmeldung kein Zugriff auf Stammdaten' || E'\n';

  raise exception '%', r;
end $$;
