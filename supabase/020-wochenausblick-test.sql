-- =====================================================================
-- Coaching App · Phase 16 · Prüfskript Rück- und Ausblick
-- Nach 020-wochenausblick.sql ausführen. Bricht absichtlich ab (Testdaten verschwinden).
-- =====================================================================
do $$
declare
  r   text := E'TESTERGEBNIS Wochen-Ausblick (alle Testdaten werden zurückgenommen)\n';
  n   int;
  blockiert boolean;
  k   uuid := 'ffffffff-cccc-4000-8000-00000000000c';
  k2  uuid := 'ffffffff-cccc-4000-8000-00000000000d';
  a   uuid := 'ffffffff-cccc-4000-8000-00000000000a';
  b   uuid := 'ffffffff-cccc-4000-8000-00000000000b';
  ca  uuid;
  cb  uuid;
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
  insert into public.einwilligungen (athlet_id, art, textversion) values
    (a, 'nutzung', 'test'), (a, 'gesundheitsdaten', 'test'), (b, 'nutzung', 'test');

  set local role authenticated;
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  begin
    insert into public.checkins (schlaf, stress, energie, muskelkater, motivation, woche_bewertung, gut, schwer,
                                 ausblick_schwierig, ausblick_gruende, ausblick_text)
    values (4, 3, 3, 2, 4, 4, 'Alle Einheiten geschafft', 'Wenig Schlaf', true, array['pruefungen', 'reise'], 'Klausuren Mo–Mi')
    returning id into ca;
    blockiert := false;
  exception when others then blockiert := true; r := r || '        (' || sqlerrm || ')' || E'\n'; end;
  r := r || case when not blockiert then ok else err end || 'Check-in mit Rückblick und Ausblick (Prüfungen, Reise)' || E'\n';
  begin update public.checkins set ausblick_gruende = array['krankheit'] where id = ca; blockiert := false; exception when others then blockiert := true; end;
  r := r || case when blockiert then ok else err end || '„Krankheit“ geht nicht in den normalen Check-in' || E'\n';
  begin update public.checkins set woche_bewertung = 7 where id = ca; blockiert := false; exception when others then blockiert := true; end;
  r := r || case when blockiert then ok else err end || 'Bewertung über 5 wird abgelehnt' || E'\n';
  begin perform public.checkin_krankheit_setzen(ca, true); blockiert := false;
  exception when others then blockiert := true; r := r || '        (' || sqlerrm || ')' || E'\n'; end;
  r := r || case when not blockiert then ok else err end || 'Krankheit geschützt gespeichert (mit Einwilligung)' || E'\n';
  perform public.checkin_krankheit_setzen(ca, true);
  select count(*) into n from public.checkin_krankheit_liste(a);
  r := r || case when n = 1 then ok else err end || 'Doppelt setzen ergibt nur einen Eintrag' || E'\n';
  select count(*) into n from gesundheit.protokoll where athlet_id = a and tabelle = 'checkin_krankheit';
  r := r || case when n >= 1 then ok else err end || 'Wird protokolliert' || E'\n';

  -- B ohne Gesundheits-Einwilligung
  perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);
  insert into public.checkins (schlaf, stress, energie, muskelkater, motivation, ausblick_schwierig) values (3, 3, 3, 3, 3, true) returning id into cb;
  begin perform public.checkin_krankheit_setzen(cb, true); blockiert := false; exception when others then blockiert := true; end;
  r := r || case when blockiert then ok else err end || 'Ohne Gesundheits-Einwilligung keine Krankheit' || E'\n';
  begin perform public.checkin_krankheit_setzen(ca, true); blockiert := false; exception when others then blockiert := true; end;
  select count(*) into n from public.checkin_krankheit_liste(a);
  r := r || case when n = 0 then ok else err end || 'B sieht die Krankheit von A nicht' || E'\n';

  -- Coach
  perform set_config('request.jwt.claims', json_build_object('sub', k, 'role', 'authenticated')::text, true);
  select count(*) into n from public.checkins where athlet_id = a and ausblick_schwierig and 'pruefungen' = any (ausblick_gruende) and gut <> '';
  r := r || case when n = 1 then ok else err end || 'Coach sieht Rück- und Ausblick' || E'\n';
  select count(*) into n from public.checkin_krankheit_liste(a);
  r := r || case when n = 1 then ok else err end || 'Coach sieht „Krankheit“ (Einwilligung liegt vor)' || E'\n';
  update public.checkins set ausblick_schwierig = false where id = ca; get diagnostics n = row_count;
  r := r || case when n = 0 then ok else err end || 'Coach kann den Ausblick nicht ändern' || E'\n';
  perform set_config('request.jwt.claims', json_build_object('sub', k2, 'role', 'authenticated')::text, true);
  select count(*) into n from public.checkin_krankheit_liste(a);
  r := r || case when n = 0 then ok else err end || 'Fremder Coach sieht nichts' || E'\n';

  -- A nimmt Krankheit zurück
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  perform public.checkin_krankheit_setzen(ca, false);
  select count(*) into n from public.checkin_krankheit_liste(a);
  r := r || case when n = 0 then ok else err end || 'Krankheit lässt sich wieder entfernen' || E'\n';

  raise exception '%', r;
end $$;
