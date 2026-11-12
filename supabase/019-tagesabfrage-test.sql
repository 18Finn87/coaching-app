-- =====================================================================
-- Coaching App · Phase 15 · Prüfskript tägliche Abfrage
-- Nach 019-tagesabfrage.sql ausführen. Bricht absichtlich ab (Testdaten verschwinden).
-- =====================================================================
do $$
declare
  r   text := E'TESTERGEBNIS Tagesabfrage (alle Testdaten werden zurückgenommen)\n';
  n   int;
  blockiert boolean;
  k   uuid := 'ffffffff-bbbb-4000-8000-00000000000c';
  k2  uuid := 'ffffffff-bbbb-4000-8000-00000000000d';
  a   uuid := 'ffffffff-bbbb-4000-8000-00000000000a';
  b   uuid := 'ffffffff-bbbb-4000-8000-00000000000b';
  t1  uuid;
  ok  constant text := 'OK      ';
  err constant text := 'FEHLER  ';
begin
  insert into auth.users (id, instance_id, aud, role, email, created_at, updated_at) values
    (k,  '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'k@rls-test.invalid', now(), now()),
    (k2, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'k2@rls-test.invalid', now(), now()),
    (a,  '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'a@rls-test.invalid', now(), now()),
    (b,  '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'b@rls-test.invalid', now(), now());
  update public.profile set rolle = 'coach' where id in (k, k2);
  insert into public.coach_athlet (coach_id, athlet_id, status) values (k, a, 'aktiv'), (k, b, 'aktiv');
  insert into public.einwilligungen (athlet_id, art, textversion) values (a, 'nutzung', 'test');
  -- ein Eintrag von gestern (als System angelegt)
  insert into public.tages_checkins (athlet_id, datum, energie, quellen) values (a, intern.heute_berlin() - 1, 2, '{"energie":"manuell"}');

  set local role authenticated;
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  begin
    insert into public.tages_checkins (schlaf_stunden, schlaf_qualitaet, energie, muskelkater, stimmung, quellen)
    values (7.5, 4, 3, 2, 4, '{"schlaf_stunden":"manuell","schlaf_qualitaet":"manuell","energie":"manuell","muskelkater":"manuell","stimmung":"manuell"}')
    returning id into t1;
    blockiert := false;
  exception when others then blockiert := true; r := r || '        (' || sqlerrm || ')' || E'\n'; end;
  r := r || case when not blockiert then ok else err end || 'Athlet trägt die Tagesabfrage ein (7,5 h Schlaf)' || E'\n';
  select count(*) into n from public.tages_checkins where id = t1 and datum = intern.heute_berlin();
  r := r || case when n = 1 then ok else err end || 'Datum ist automatisch heute (Berliner Zeit)' || E'\n';
  begin insert into public.tages_checkins (energie) values (3); blockiert := false; exception when others then blockiert := true; end;
  r := r || case when blockiert then ok else err end || 'Zweiter Eintrag am selben Tag wird abgelehnt' || E'\n';
  update public.tages_checkins set energie = 4, quellen = quellen || '{"energie":"manuell"}' where id = t1; get diagnostics n = row_count;
  r := r || case when n = 1 then ok else err end || 'Am selben Tag änderbar' || E'\n';
  update public.tages_checkins set energie = 5 where datum = intern.heute_berlin() - 1; get diagnostics n = row_count;
  r := r || case when n = 0 then ok else err end || 'Gestern ist nicht mehr änderbar' || E'\n';
  begin update public.tages_checkins set energie = 6 where id = t1; blockiert := false; exception when others then blockiert := true; end;
  r := r || case when blockiert then ok else err end || 'Wert über 5 wird abgelehnt' || E'\n';
  begin update public.tages_checkins set quellen = '{"energie":"fitnessuhr"}' where id = t1; blockiert := false; exception when others then blockiert := true; end;
  r := r || case when blockiert then ok else err end || 'Unbekannte Quelle wird abgelehnt' || E'\n';
  begin update public.tages_checkins set quellen = '{"schlaf_stunden":"apple_health"}' where id = t1; blockiert := false; exception when others then blockiert := true; end;
  r := r || case when not blockiert then ok else err end || 'Quelle „apple_health“ ist vorbereitet' || E'\n';
  begin update public.tages_checkins set schlaf_stunden = null, schlaf_qualitaet = null, energie = null, muskelkater = null, stimmung = null where id = t1; blockiert := false; exception when others then blockiert := true; end;
  r := r || case when blockiert then ok else err end || 'Ganz leerer Eintrag wird abgelehnt' || E'\n';
  begin update public.tages_checkins set datum = datum - 3 where id = t1; blockiert := false; exception when others then blockiert := true; end;
  r := r || case when blockiert then ok else err end || 'Datum lässt sich nicht nachträglich ändern' || E'\n';

  perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);
  begin insert into public.tages_checkins (energie) values (3); blockiert := false; exception when others then blockiert := true; end;
  r := r || case when blockiert then ok else err end || 'Ohne Nutzungs-Einwilligung kein Eintrag' || E'\n';
  select count(*) into n from public.tages_checkins;
  r := r || case when n = 0 then ok else err end || 'Anderer Athlet sieht nichts' || E'\n';

  perform set_config('request.jwt.claims', json_build_object('sub', k, 'role', 'authenticated')::text, true);
  select count(*) into n from public.tages_checkins where athlet_id = a;
  r := r || case when n = 2 then ok else err end || 'Coach sieht beide Tage' || E'\n';
  update public.tages_checkins set energie = 1 where id = t1; get diagnostics n = row_count;
  r := r || case when n = 0 then ok else err end || 'Coach kann nichts ändern' || E'\n';

  perform set_config('request.jwt.claims', json_build_object('sub', k2, 'role', 'authenticated')::text, true);
  select count(*) into n from public.tages_checkins;
  r := r || case when n = 0 then ok else err end || 'Fremder Coach sieht nichts' || E'\n';

  raise exception '%', r;
end $$;
