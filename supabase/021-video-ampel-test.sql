-- =====================================================================
-- Coaching App · Phase 17 · Prüfskript Video-Ampel
-- Nach 021-video-ampel.sql ausführen. Bricht absichtlich ab (Testdaten verschwinden).
-- =====================================================================
do $$
declare
  r   text := E'TESTERGEBNIS Video-Ampel (alle Testdaten werden zurückgenommen)\n';
  n   int;
  t   text;
  blockiert boolean;
  k   uuid := 'ffffffff-dddd-4000-8000-00000000000c';
  k2  uuid := 'ffffffff-dddd-4000-8000-00000000000d';
  a   uuid := 'ffffffff-dddd-4000-8000-00000000000a';
  an  uuid := gen_random_uuid();
  ok  constant text := 'OK      ';
  err constant text := 'FEHLER  ';
begin
  insert into auth.users (id, instance_id, aud, role, email, created_at, updated_at) values
    (k,  '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'k@rls-test.invalid', now(), now()),
    (k2, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'k2@rls-test.invalid', now(), now()),
    (a,  '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'a@rls-test.invalid', now(), now());
  update public.profile set rolle = 'coach' where id in (k, k2);
  insert into public.coach_athlet (coach_id, athlet_id, status) values (k, a, 'aktiv');
  insert into public.einwilligungen (athlet_id, art, textversion) values (a, 'nutzung', 'test'), (a, 'videos', 'test');

  set local role authenticated;
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  insert into public.analysen (id, athlet_id, pfad, mime, groesse_bytes) values (an, a, a::text || '/' || an::text || '.mp4', 'video/mp4', 1000);
  select bewertung into t from public.analysen where id = an;
  r := r || case when t = 'grau' then ok else err end || 'Neues Video ist „grau“ (noch nicht bewertet)' || E'\n';
  begin update public.analysen set bewertung = 'gruen' where id = an; blockiert := false; exception when others then blockiert := true; end;
  r := r || case when blockiert then ok else err end || 'Athlet kann sich nicht selbst bewerten' || E'\n';
  begin perform public.analyse_bewerten(an, 'gruen', ''); blockiert := false; exception when others then blockiert := true; end;
  r := r || case when blockiert then ok else err end || 'Athlet kann die Bewerten-Funktion nicht nutzen' || E'\n';

  perform set_config('request.jwt.claims', json_build_object('sub', k2, 'role', 'authenticated')::text, true);
  begin perform public.analyse_bewerten(an, 'rot', 'fremd'); blockiert := false; exception when others then blockiert := true; end;
  r := r || case when blockiert then ok else err end || 'Fremder Coach kann nicht bewerten' || E'\n';

  perform set_config('request.jwt.claims', json_build_object('sub', k, 'role', 'authenticated')::text, true);
  perform public.analyse_bewerten(an, 'orange', 'Knie stabiler halten, bitte nochmal von der Seite');
  select count(*) into n from public.analysen where id = an and bewertung = 'orange' and bewertung_kommentar like 'Knie%' and bewertet_am is not null;
  r := r || case when n = 1 then ok else err end || 'Coach bewertet Orange mit Kommentar' || E'\n';
  begin perform public.analyse_bewerten(an, 'lila', ''); blockiert := false; exception when others then blockiert := true; end;
  r := r || case when blockiert then ok else err end || 'Unbekannte Farbe wird abgelehnt' || E'\n';
  perform public.analyse_bewerten(an, 'grau', '');
  select count(*) into n from public.analysen where id = an and bewertung = 'grau' and bewertet_am is null;
  r := r || case when n = 1 then ok else err end || 'Bewertung lässt sich zurücknehmen (grau)' || E'\n';
  perform public.analyse_bewerten(an, 'gruen', 'Sauber!');

  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  select count(*) into n from public.analysen where id = an and bewertung = 'gruen' and bewertung_kommentar = 'Sauber!';
  r := r || case when n = 1 then ok else err end || 'Athlet sieht Grün mit Kommentar' || E'\n';
  select count(*) into n from public.benachrichtigungen where empfaenger_id = a and art = 'video_bewertet';
  r := r || case when n = 2 then ok else err end || 'Athlet bekommt je Bewertung einen Hinweis, nicht bei „grau“ (' || n || ')' || E'\n';

  raise exception '%', r;
end $$;
