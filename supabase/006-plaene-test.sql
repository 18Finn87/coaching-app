-- =====================================================================
-- Coaching App · Schritte 3.2–3.4 · Prüfskript Trainingspläne
-- Nach 006-plaene.sql ausführen. Bricht absichtlich ab (Testdaten verschwinden).
-- =====================================================================
do $$
declare
  r   text := E'TESTERGEBNIS Trainingspläne (alle Testdaten werden zurückgenommen)\n';
  n   int;
  t   text;
  blockiert boolean;
  k   uuid := '77777777-0000-4000-8000-00000000000c';
  k2  uuid := '77777777-0000-4000-8000-00000000000d';
  a   uuid := '77777777-0000-4000-8000-00000000000a';
  b   uuid := '77777777-0000-4000-8000-00000000000b';
  f   uuid := '77777777-0000-4000-8000-00000000000f';
  ue  uuid := '77777777-0000-4000-8000-0000000000e1';
  ue2 uuid := '77777777-0000-4000-8000-0000000000e2';
  plan uuid;
  v1 uuid; v2 uuid; e1 uuid; pu1 uuid; s1 uuid; e2 uuid;
  ok  constant text := 'OK      ';
  err constant text := 'FEHLER  ';
begin
  insert into auth.users (id, instance_id, aud, role, email, created_at, updated_at) values
    (k,  '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'k@rls-test.invalid',  now(), now()),
    (k2, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'k2@rls-test.invalid', now(), now()),
    (a,  '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'a@rls-test.invalid',  now(), now()),
    (b,  '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'b@rls-test.invalid',  now(), now()),
    (f,  '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'f@rls-test.invalid',  now(), now());
  update public.profile set rolle = 'coach' where id in (k, k2);
  insert into public.coach_athlet (coach_id, athlet_id, status) values (k, a, 'aktiv'), (k2, b, 'aktiv');
  insert into public.uebungen (id, coach_id, name) values (ue, k, 'Test-Kniebeuge'), (ue2, k2, 'Übung von K2');

  set local role authenticated;

  ---------------- Coach K legt einen Plan an ----------------
  perform set_config('request.jwt.claims', json_build_object('sub', k, 'role', 'authenticated')::text, true);
  select public.plan_anlegen(a, 'Grundlagen', 'Kraft aufbauen') into plan;
  select count(*) into n from public.planversionen where plan_id = plan and versionsnummer = 1 and status = 'entwurf';
  r := r || case when n = 1 then ok else err end || 'K legt einen Plan für A an – Version 1 ist ein Entwurf' || E'\n';
  select id into v1 from public.planversionen where plan_id = plan;
  begin perform public.plan_anlegen(b, 'Fremd', ''); blockiert := false; exception when others then blockiert := true; end;
  r := r || case when blockiert then ok else err end || 'K kann keinen Plan für fremde Athleten anlegen' || E'\n';

  begin perform public.plan_veroeffentlichen(v1); blockiert := false; exception when others then blockiert := true; end;
  r := r || case when blockiert then ok else err end || 'Leerer Plan kann nicht veröffentlicht werden' || E'\n';

  insert into public.plan_einheiten (planversion_id, name, reihenfolge) values (v1, 'Tag A', 1) returning id into e1;
  insert into public.plan_uebungen (plan_einheit_id, uebung_id, reihenfolge) values (e1, ue, 1) returning id into pu1;
  begin insert into public.plan_uebungen (plan_einheit_id, uebung_id) values (e1, ue2); blockiert := false; exception when others then blockiert := true; end;
  r := r || case when blockiert then ok else err end || 'K kann keine Übungen anderer Coaches einplanen' || E'\n';

  begin perform public.plan_veroeffentlichen(v1); blockiert := false; exception when others then blockiert := true; end;
  r := r || case when blockiert then ok else err end || 'Übung ohne Satz: Veröffentlichen wird abgelehnt' || E'\n';

  insert into public.plan_saetze (plan_uebung_id, satznummer, wdh_min, wdh_max, last_kg, rir_ziel, pause_sek)
  values (pu1, 1, 6, 8, 60, 2, 120) returning id into s1;
  begin insert into public.plan_saetze (plan_uebung_id, satznummer, wdh_min, wdh_max) values (pu1, 2, 10, 5); blockiert := false; exception when others then blockiert := true; end;
  r := r || case when blockiert then ok else err end || 'Unsinnige Vorgabe (10 bis 5 Wdh.) wird abgelehnt' || E'\n';
  begin update public.planversionen set status = 'veroeffentlicht' where id = v1; blockiert := false; exception when others then blockiert := true; end;
  r := r || case when blockiert then ok else err end || 'Status kann nicht direkt geändert werden (nur über Veröffentlichen)' || E'\n';

  ---------------- A sieht den Entwurf nicht ----------------
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  select count(*) into n from public.plaene;
  r := r || case when n = 0 then ok else err end || 'A sieht einen reinen Entwurf nicht' || E'\n';
  select count(*) into n from public.plan_saetze;
  r := r || case when n = 0 then ok else err end || 'A sieht keine Entwurfs-Sätze' || E'\n';

  ---------------- K veröffentlicht ----------------
  perform set_config('request.jwt.claims', json_build_object('sub', k, 'role', 'authenticated')::text, true);
  begin perform public.plan_veroeffentlichen(v1); blockiert := false; exception when others then blockiert := true; end;
  r := r || case when not blockiert then ok else err end || 'K veröffentlicht Version 1' || E'\n';
  update public.plan_saetze set last_kg = 999 where id = s1; get diagnostics n = row_count;
  r := r || case when n = 0 then ok else err end || 'Veröffentlichte Sätze sind unveränderlich' || E'\n';
  begin insert into public.plan_einheiten (planversion_id, name) values (v1, 'Tag B'); blockiert := false; exception when others then blockiert := true; end;
  r := r || case when blockiert then ok else err end || 'In eine veröffentlichte Version kann nichts eingefügt werden' || E'\n';
  delete from public.plan_einheiten where id = e1; get diagnostics n = row_count;
  r := r || case when n = 0 then ok else err end || 'Aus einer veröffentlichten Version kann nichts gelöscht werden' || E'\n';
  delete from public.plaene where id = plan; get diagnostics n = row_count;
  r := r || case when n = 0 then ok else err end || 'Ein veröffentlichter Plan kann nicht gelöscht werden' || E'\n';

  ---------------- A sieht Version 1 ----------------
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  select count(*) into n from public.plan_saetze where id = s1;
  r := r || case when n = 1 then ok else err end || 'A sieht den veröffentlichten Plan bis zum Satz' || E'\n';
  select count(*) into n from public.uebungen where id = ue;
  r := r || case when n = 1 then ok else err end || 'A sieht die eingeplante Übung' || E'\n';
  update public.plan_saetze set last_kg = 10 where id = s1; get diagnostics n = row_count;
  r := r || case when n = 0 then ok else err end || 'A kann den Plan nicht ändern' || E'\n';
  begin perform public.plan_neue_version(plan); blockiert := false; exception when others then blockiert := true; end;
  r := r || case when blockiert then ok else err end || 'A kann keine neue Version anlegen' || E'\n';

  ---------------- K erstellt Version 2 ----------------
  perform set_config('request.jwt.claims', json_build_object('sub', k, 'role', 'authenticated')::text, true);
  select public.plan_neue_version(plan, 'Mehr Gewicht') into v2;
  select count(*) into n from public.plan_saetze s
    join public.plan_uebungen u on u.id = s.plan_uebung_id
    join public.plan_einheiten e on e.id = u.plan_einheit_id
  where e.planversion_id = v2;
  r := r || case when n = 1 then ok else err end || 'Version 2 übernimmt Tage, Übungen und Sätze vollständig' || E'\n';
  begin perform public.plan_neue_version(plan); blockiert := false; exception when others then blockiert := true; end;
  r := r || case when blockiert then ok else err end || 'Es kann nur einen Entwurf gleichzeitig geben' || E'\n';
  update public.plan_saetze s set last_kg = 65
  from public.plan_uebungen u, public.plan_einheiten e
  where u.id = s.plan_uebung_id and e.id = u.plan_einheit_id and e.planversion_id = v2;
  get diagnostics n = row_count;
  r := r || case when n = 1 then ok else err end || 'K kann den Entwurf von Version 2 ändern' || E'\n';
  select last_kg::text into t from public.plan_saetze where id = s1;
  r := r || case when t = '60.00' then ok else err end || 'Version 1 bleibt unverändert (' || t || ' kg)' || E'\n';
  insert into public.plan_einheiten (planversion_id, name, reihenfolge) values (v2, 'Tag B', 2) returning id into e2;
  insert into public.plan_uebungen (plan_einheit_id, uebung_id) values (e2, ue);
  insert into public.plan_saetze (plan_uebung_id, satznummer, wdh_min)
    select id, 1, 10 from public.plan_uebungen where plan_einheit_id = e2;

  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  select count(*) into n from public.planversionen where plan_id = plan;
  r := r || case when n = 1 then ok else err end || 'A sieht den Entwurf von Version 2 noch nicht' || E'\n';

  perform set_config('request.jwt.claims', json_build_object('sub', k, 'role', 'authenticated')::text, true);
  perform public.plan_veroeffentlichen(v2);
  select status into t from public.planversionen where id = v1;
  r := r || case when t = 'abgeloest' then ok else err end || 'Nach Veröffentlichen von Version 2 ist Version 1 abgelöst' || E'\n';
  select count(*) into n from public.planversionen where plan_id = plan and status = 'veroeffentlicht';
  r := r || case when n = 1 then ok else err end || 'Es gibt genau eine gültige Version' || E'\n';

  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  select count(*) into n from public.planversionen where plan_id = plan;
  r := r || case when n = 2 then ok else err end || 'A sieht beide Versionen (alte bleibt als Verlauf)' || E'\n';

  ---------------- Andere ----------------
  perform set_config('request.jwt.claims', json_build_object('sub', k2, 'role', 'authenticated')::text, true);
  select count(*) into n from public.plaene where id = plan;
  r := r || case when n = 0 then ok else err end || 'Anderer Coach sieht den Plan nicht' || E'\n';
  perform set_config('request.jwt.claims', json_build_object('sub', f, 'role', 'authenticated')::text, true);
  select count(*) into n from public.plan_saetze;
  r := r || case when n = 0 then ok else err end || 'Fremde Person sieht nichts' || E'\n';

  ---------------- Betreuung beendet ----------------
  perform set_config('request.jwt.claims', json_build_object('sub', k, 'role', 'authenticated')::text, true);
  update public.coach_athlet set status = 'beendet' where athlet_id = a;
  select count(*) into n from public.plaene where id = plan;
  r := r || case when n = 0 then ok else err end || 'Nach beendeter Betreuung sieht K den Plan nicht mehr' || E'\n';
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  select count(*) into n from public.plaene where id = plan;
  r := r || case when n = 1 then ok else err end || 'A behält ihren Plan auch nach beendeter Betreuung' || E'\n';

  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  set local role anon;
  begin select count(*) into n from public.plaene; blockiert := false; exception when others then blockiert := true; end;
  r := r || case when blockiert then ok else err end || 'Ohne Anmeldung kein Zugriff auf Pläne' || E'\n';

  raise exception '%', r;
end $$;
