-- =====================================================================
-- Coaching App · Phase 5 · Prüfskript Einstellungen und Maximaltests
-- Nach 008-analyse.sql ausführen. Bricht absichtlich ab (Testdaten verschwinden).
-- =====================================================================
do $$
declare
  r   text := E'TESTERGEBNIS Analyse (alle Testdaten werden zurückgenommen)\n';
  n   int;
  blockiert boolean;
  k   uuid := 'aaaaaaaa-1111-4000-8000-00000000000c';
  k2  uuid := 'aaaaaaaa-1111-4000-8000-00000000000d';
  a   uuid := 'aaaaaaaa-1111-4000-8000-00000000000a';
  f   uuid := 'aaaaaaaa-1111-4000-8000-00000000000f';
  ue  uuid := 'aaaaaaaa-1111-4000-8000-0000000000e1';
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
  insert into public.einwilligungen (athlet_id, art, textversion) values (a, 'nutzung', 'test'), (f, 'nutzung', 'test');
  insert into public.uebungen (id, coach_id, name, e1rm_geeignet) values (ue, k, 'Test-Kniebeuge', true);

  set local role authenticated;

  ---------------- Coach K ----------------
  perform set_config('request.jwt.claims', json_build_object('sub', k, 'role', 'authenticated')::text, true);
  begin insert into public.coach_einstellungen (e1rm_formel) values ('brzycki'); blockiert := false; exception when others then blockiert := true; end;
  r := r || case when not blockiert then ok else err end || 'K wählt die 1RM-Formel' || E'\n';
  begin update public.coach_einstellungen set e1rm_formel = 'zauberformel' where coach_id = k; blockiert := false; exception when others then blockiert := true; end;
  r := r || case when blockiert then ok else err end || 'Unbekannte Formel wird abgelehnt' || E'\n';
  begin insert into public.maxtests (athlet_id, uebung_id, last_kg) values (a, ue, 100); blockiert := false; exception when others then blockiert := true; end;
  r := r || case when not blockiert then ok else err end || 'K trägt einen Maximaltest für A ein' || E'\n';

  ---------------- Athletin A ----------------
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  select count(*) into n from public.coach_einstellungen where coach_id = k;
  r := r || case when n = 1 then ok else err end || 'A sieht die Formel ihres Coaches' || E'\n';
  update public.coach_einstellungen set e1rm_formel = 'epley' where coach_id = k; get diagnostics n = row_count;
  r := r || case when n = 0 then ok else err end || 'A kann die Formel nicht ändern' || E'\n';
  begin insert into public.maxtests (athlet_id, uebung_id, last_kg, wdh) values (a, ue, 90, 3); blockiert := false; exception when others then blockiert := true; end;
  r := r || case when not blockiert then ok else err end || 'A trägt selbst einen 3RM-Test ein' || E'\n';
  select count(*) into n from public.maxtests where athlet_id = a;
  r := r || case when n = 2 then ok else err end || 'A sieht beide Tests (' || n || ')' || E'\n';
  delete from public.maxtests where athlet_id = a and erfasst_von = k; get diagnostics n = row_count;
  r := r || case when n = 0 then ok else err end || 'A kann den Test des Coaches nicht löschen' || E'\n';

  ---------------- Fremde ----------------
  perform set_config('request.jwt.claims', json_build_object('sub', f, 'role', 'authenticated')::text, true);
  select count(*) into n from public.maxtests;
  r := r || case when n = 0 then ok else err end || 'F sieht keine Tests' || E'\n';
  begin insert into public.maxtests (athlet_id, uebung_id, last_kg) values (a, ue, 200); blockiert := false; exception when others then blockiert := true; end;
  r := r || case when blockiert then ok else err end || 'F kann für A keinen Test eintragen' || E'\n';

  perform set_config('request.jwt.claims', json_build_object('sub', k2, 'role', 'authenticated')::text, true);
  select count(*) into n from public.coach_einstellungen where coach_id = k;
  r := r || case when n = 0 then ok else err end || 'Anderer Coach sieht die Einstellungen von K nicht' || E'\n';
  begin insert into public.maxtests (athlet_id, uebung_id, last_kg) values (a, ue, 150); blockiert := false; exception when others then blockiert := true; end;
  r := r || case when blockiert then ok else err end || 'Anderer Coach kann für A keinen Test eintragen' || E'\n';

  ---------------- Coach K löscht seinen Test ----------------
  perform set_config('request.jwt.claims', json_build_object('sub', k, 'role', 'authenticated')::text, true);
  delete from public.maxtests where athlet_id = a and erfasst_von = k; get diagnostics n = row_count;
  r := r || case when n = 1 then ok else err end || 'K kann seinen eigenen Eintrag löschen' || E'\n';

  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  set local role anon;
  begin select count(*) into n from public.maxtests; blockiert := false; exception when others then blockiert := true; end;
  r := r || case when blockiert then ok else err end || 'Ohne Anmeldung kein Zugriff' || E'\n';

  raise exception '%', r;
end $$;
