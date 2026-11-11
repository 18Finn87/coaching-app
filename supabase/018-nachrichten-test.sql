-- =====================================================================
-- Coaching App · Phase 14 · Prüfskript Nachrichten
-- Nach 018-nachrichten.sql ausführen. Bricht absichtlich ab (Testdaten verschwinden).
-- =====================================================================
do $$
declare
  r   text := E'TESTERGEBNIS Nachrichten (alle Testdaten werden zurückgenommen)\n';
  n   int;
  blockiert boolean;
  k   uuid := 'ffffffff-aaaa-4000-8000-00000000000c';
  k2  uuid := 'ffffffff-aaaa-4000-8000-00000000000d';
  a   uuid := 'ffffffff-aaaa-4000-8000-00000000000a';
  b   uuid := 'ffffffff-aaaa-4000-8000-00000000000b';
  m1  uuid;
  m2  uuid;
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

  set local role authenticated;
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  begin
    insert into public.kunden_nachrichten (art, text) values ('kommentar', 'Knie zwickt bei Ausfallschritten') returning id into m1;
    insert into public.kunden_nachrichten (art, text) values ('ziele_geaendert', 'Will jetzt einen Halbmarathon laufen') returning id into m2;
    blockiert := false;
  exception when others then blockiert := true; r := r || '        (' || sqlerrm || ')' || E'\n'; end;
  r := r || case when not blockiert then ok else err end || 'Athlet schreibt Kommentar und Zieländerung' || E'\n';
  begin insert into public.kunden_nachrichten (art, text) values ('kommentar', '   '); blockiert := false; exception when others then blockiert := true; end;
  r := r || case when blockiert then ok else err end || 'Leere Nachricht wird abgelehnt' || E'\n';
  begin insert into public.kunden_nachrichten (art, text) values ('sonstwas', 'x'); blockiert := false; exception when others then blockiert := true; end;
  r := r || case when blockiert then ok else err end || 'Unbekannte Art wird abgelehnt' || E'\n';
  begin
    update public.kunden_nachrichten set coach_antwort = 'selbst' where id = m1;
    blockiert := false;
  exception when others then blockiert := true; end;
  r := r || case when blockiert then ok else err end || 'Athlet kann sich nicht selbst antworten' || E'\n';
  begin perform public.nachricht_beantworten(m1, 'Hallo'); blockiert := false; exception when others then blockiert := true; end;
  r := r || case when blockiert then ok else err end || 'Athlet kann die Coach-Antwort-Funktion nicht nutzen' || E'\n';

  -- B ohne Einwilligung
  perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);
  begin insert into public.kunden_nachrichten (art, text) values ('kommentar', 'Hallo'); blockiert := false; exception when others then blockiert := true; end;
  r := r || case when blockiert then ok else err end || 'Ohne Nutzungs-Einwilligung keine Nachricht' || E'\n';
  select count(*) into n from public.kunden_nachrichten;
  r := r || case when n = 0 then ok else err end || 'Anderer Athlet sieht fremde Nachrichten nicht' || E'\n';

  -- Coach
  perform set_config('request.jwt.claims', json_build_object('sub', k, 'role', 'authenticated')::text, true);
  select count(*) into n from public.kunden_nachrichten where athlet_id = a;
  r := r || case when n = 2 then ok else err end || 'Coach sieht beide Nachrichten' || E'\n';
  perform public.nachricht_beantworten(m1, 'Dann tauschen wir die Übung. Danke!');
  perform public.nachricht_beantworten(m2, '');
  select count(*) into n from public.kunden_nachrichten where id = m1 and coach_antwort <> '' and coach_antwort_am is not null and gesehen_am is not null;
  r := r || case when n = 1 then ok else err end || 'Antwort gespeichert (und als gesehen markiert)' || E'\n';
  select count(*) into n from public.kunden_nachrichten where id = m2 and coach_antwort = '' and gesehen_am is not null;
  r := r || case when n = 1 then ok else err end || '„Gesehen“ ohne Antwort möglich' || E'\n';
  begin delete from public.kunden_nachrichten where id = m1; get diagnostics n = row_count; end;
  r := r || case when n = 0 then ok else err end || 'Coach kann Nachrichten nicht löschen' || E'\n';

  perform set_config('request.jwt.claims', json_build_object('sub', k2, 'role', 'authenticated')::text, true);
  select count(*) into n from public.kunden_nachrichten;
  r := r || case when n = 0 then ok else err end || 'Fremder Coach sieht nichts' || E'\n';
  begin perform public.nachricht_beantworten(m1, 'fremd'); blockiert := false; exception when others then blockiert := true; end;
  r := r || case when blockiert then ok else err end || 'Fremder Coach kann nicht antworten' || E'\n';

  -- Hinweis an die Person
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  select count(*) into n from public.benachrichtigungen where empfaenger_id = a and art = 'nachricht_antwort';
  r := r || case when n = 1 then ok else err end || 'Person bekommt genau einen Hinweis auf die Antwort' || E'\n';
  delete from public.kunden_nachrichten where id = m1; get diagnostics n = row_count;
  r := r || case when n = 0 then ok else err end || 'Beantwortete Nachricht kann nicht mehr zurückgezogen werden' || E'\n';
  delete from public.kunden_nachrichten where id = m2; get diagnostics n = row_count;
  r := r || case when n = 1 then ok else err end || 'Unbeantwortete Nachricht kann zurückgezogen werden' || E'\n';

  raise exception '%', r;
end $$;
