-- =====================================================================
-- Coaching App · Phase 18 · Prüfskript offene Punkte
-- Nach 022-offene-punkte.sql ausführen. Bricht absichtlich ab (Testdaten verschwinden).
-- =====================================================================
do $$
declare
  r   text := E'TESTERGEBNIS Offene Punkte (alle Testdaten werden zurückgenommen)\n';
  n   int;
  t   text;
  blockiert boolean;
  k   uuid := 'ffffffff-eeee-4000-8000-00000000000c';
  k2  uuid := 'ffffffff-eeee-4000-8000-00000000000d';
  a   uuid := 'ffffffff-eeee-4000-8000-00000000000a';
  nz  uuid;
  nk  uuid;
  ci  uuid;
  an  uuid := gen_random_uuid();
  te  uuid := gen_random_uuid();
  au  uuid := gen_random_uuid();
  rs  uuid;
  ue  uuid;
  ok  constant text := 'OK      ';
  err constant text := 'FEHLER  ';
begin
  insert into auth.users (id, instance_id, aud, role, email, created_at, updated_at) values
    (k,  '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'k@rls-test.invalid', now(), now()),
    (k2, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'k2@rls-test.invalid', now(), now()),
    (a,  '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'a@rls-test.invalid', now(), now());
  update public.profile set rolle = 'coach' where id in (k, k2);
  update public.profile set anzeigename = 'Offen-Test' where id = a;
  insert into public.coach_athlet (coach_id, athlet_id, status) values (k, a, 'aktiv');
  insert into public.einwilligungen (athlet_id, art, textversion) values
    (a, 'nutzung', 'test'), (a, 'videos', 'test'), (a, 'gesundheitsdaten', 'test');

  set local role authenticated;
  perform set_config('request.jwt.claims', json_build_object('sub', k, 'role', 'authenticated')::text, true);
  insert into public.uebungen (name, modul, bewegungsmuster, messart) values ('Test-Offen-Übung', 'reha', 'sonstiges', 'wdh') returning id into ue;
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  insert into public.kunden_nachrichten (art, text) values ('ziele_geaendert', 'Halbmarathon') returning id into nz;
  insert into public.kunden_nachrichten (art, text) values ('kommentar', 'Knie zwickt') returning id into nk;
  insert into public.checkins (schlaf, stress, energie, muskelkater, motivation, ausblick_schwierig) values (3, 3, 3, 3, 3, true) returning id into ci;
  insert into public.analysen (id, athlet_id, pfad, mime, groesse_bytes) values (an, a, a::text || '/' || an::text || '.mp4', 'video/mp4', 1000);
  insert into public.tages_checkins (energie) values (2);
  insert into public.trainingseinheiten (id, titel) values (te, 'T');
  insert into public.ausgefuehrte_uebungen (id, trainingseinheit_id, uebung_id, uebung_name, messart)
  values (au, te, ue, 'Test-Offen-Übung', 'wdh');
  insert into gesundheit.reha_schmerz (ausgefuehrte_uebung_id, wert, grenze) values (au, 6, 3) returning id into rs;

  -- Athlet selbst sieht keine offenen Punkte
  select count(*) into n from public.offene_punkte();
  r := r || case when n = 0 then ok else err end || 'Athlet bekommt keine offenen Punkte' || E'\n';
  begin perform public.punkt_gesehen('nachricht', nk, a); blockiert := false; exception when others then blockiert := true; end;
  r := r || case when blockiert then ok else err end || 'Athlet kann nichts als „gesehen“ markieren' || E'\n';

  perform set_config('request.jwt.claims', json_build_object('sub', k, 'role', 'authenticated')::text, true);
  select count(*) into n from public.offene_punkte();
  r := r || case when n = 6 then ok else err end || 'Coach sieht 6 offene Punkte (' || n || ')' || E'\n';
  select string_agg(art || ':' || dringlichkeit, ',' order by art) into t from public.offene_punkte(a);
  r := r || case when t = 'checkin:3,nachricht:2,reha:3,tagesabfrage:1,video:2,ziele:3' then ok else err end || 'Dringlichkeit je Art stimmt (' || t || ')' || E'\n';
  select count(*) into n from public.offene_punkte() where art = 'reha' and titel not like '%6%';
  r := r || case when n = 1 then ok else err end || 'Reha-Punkt nennt keinen Schmerzwert' || E'\n';

  perform public.punkt_gesehen('ziele', nz, a);
  perform public.nachricht_beantworten(nk, 'Danke!');
  perform public.punkt_gesehen('checkin', ci, a);
  perform public.punkt_gesehen('tagesabfrage', null, a);
  perform public.punkt_gesehen('reha', rs, a);
  select count(*) into n from public.offene_punkte();
  r := r || case when n = 1 then ok else err end || 'Nach Antwort/„gesehen“ bleibt nur das Video offen' || E'\n';
  begin perform public.punkt_gesehen('video', an, a); blockiert := false; exception when others then blockiert := true; end;
  r := r || case when blockiert then ok else err end || 'Video wird nicht mit „gesehen“ erledigt, sondern bewertet' || E'\n';
  perform public.analyse_bewerten(an, 'gruen', '');
  select count(*) into n from public.offene_punkte();
  r := r || case when n = 0 then ok else err end || 'Nach der Bewertung ist nichts mehr offen' || E'\n';

  -- Fremder Coach
  perform set_config('request.jwt.claims', json_build_object('sub', k2, 'role', 'authenticated')::text, true);
  select count(*) into n from public.offene_punkte();
  r := r || case when n = 0 then ok else err end || 'Fremder Coach sieht nichts' || E'\n';
  begin perform public.punkt_gesehen('checkin', ci, a); blockiert := false; exception when others then blockiert := true; end;
  r := r || case when blockiert then ok else err end || 'Fremder Coach kann nichts markieren' || E'\n';

  -- Alter: nach 2 Tagen eine Stufe höher
  reset role;
  insert into public.kunden_nachrichten (athlet_id, art, text, erstellt_am) values (a, 'kommentar', 'alt', now() - interval '3 days');
  select dringlichkeit into n from intern.offene_punkte_fuer(k) where titel = 'alt';
  r := r || case when n = 3 then ok else err end || 'Nach 2 Tagen ohne Reaktion steigt mittel → hoch' || E'\n';
  -- Tägliche Zusammenfassung
  n := intern.offene_punkte_hinweise();
  select text_kurz into t from public.benachrichtigungen where empfaenger_id = k and art = 'zusammenfassung' order by erstellt_am desc limit 1;
  r := r || case when t like '1 offener Punkt, davon 1 dringend%' then ok else err end || 'Zeile in der Morgen-Zusammenfassung (' || coalesce(t, '-') || ')' || E'\n';

  raise exception '%', r;
end $$;
