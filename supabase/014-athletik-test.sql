-- =====================================================================
-- Coaching App · Phase 11 · Prüfskript Athletik
-- Nach 014-athletik.sql ausführen. Bricht absichtlich ab (Testdaten verschwinden).
-- Prüft: Startbestand, eigener Test mit Einheit/Wertung, Versuche als Sätze,
--        falsche Einheit wird abgelehnt, Athlet sieht nur eigene Versuche.
-- =====================================================================
do $$
declare
  r   text := E'TESTERGEBNIS Athletik (alle Testdaten werden zurückgenommen)\n';
  n   int;
  blockiert boolean;
  k   uuid := 'ffffffff-7777-4000-8000-00000000000c';
  a   uuid := 'ffffffff-7777-4000-8000-00000000000a';
  b   uuid := 'ffffffff-7777-4000-8000-00000000000b';
  ue  uuid;
  te  uuid;
  tu  uuid;
  ok  constant text := 'OK      ';
  err constant text := 'FEHLER  ';
begin
  select count(*) into n from public.uebungen u join public.profile p on p.id = u.coach_id
  where p.rolle = 'coach' and u.modul = 'athletik' and u.messart = 'test' and u.einheit is not null;
  r := r || case when n >= 14 then ok else err end || 'Startbestand Leistungstests vorhanden (' || n || ')' || E'\n';

  select count(*) into n from public.uebungen where name = 'Test: Sprint 10 m' and kleiner_besser and einheit = 's' and wertung = 'bester';
  r := r || case when n >= 1 then ok else err end || 'Sprint 10 m: Sekunden, kleiner ist besser, bester Versuch' || E'\n';

  insert into auth.users (id, instance_id, aud, role, email, created_at, updated_at) values
    (k, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'k@rls-test.invalid', now(), now()),
    (a, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'a@rls-test.invalid', now(), now()),
    (b, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'b@rls-test.invalid', now(), now());
  update public.profile set rolle = 'coach' where id = k;
  insert into public.coach_athlet (coach_id, athlet_id, status) values (k, a, 'aktiv'), (k, b, 'aktiv');
  insert into public.einwilligungen (athlet_id, art, textversion) values (a, 'nutzung', 'test');

  set local role authenticated;
  perform set_config('request.jwt.claims', json_build_object('sub', k, 'role', 'authenticated')::text, true);
  begin
    insert into public.uebungen (name, modul, bewegungsmuster, messart, einheit, wertung, kleiner_besser)
    values ('Test-Drop-Jump', 'athletik', 'springen', 'test', 'cm', 'schnitt', false)
    returning id into ue;
    blockiert := false;
  exception when others then blockiert := true; end;
  r := r || case when not blockiert then ok else err end || 'Coach legt eigenen Test an (cm, Durchschnitt)' || E'\n';

  begin
    insert into public.uebungen (name, modul, bewegungsmuster, messart, einheit) values ('Test-Falsch', 'athletik', 'springen', 'test', 'zoll');
    blockiert := false;
  exception when others then blockiert := true; end;
  r := r || case when blockiert then ok else err end || 'Unbekannte Einheit wird abgelehnt' || E'\n';

  begin
    update public.uebungen set wertung = 'mittel' where id = ue;
    blockiert := false;
  exception when others then blockiert := true; end;
  r := r || case when blockiert then ok else err end || 'Unbekannte Wertung wird abgelehnt' || E'\n';

  -- Athlet A trägt einen Testtag mit 3 Versuchen ein
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  te := gen_random_uuid();
  tu := gen_random_uuid();
  begin
    insert into public.trainingseinheiten (id, titel) values (te, 'Testtag');
    insert into public.ausgefuehrte_uebungen (id, trainingseinheit_id, uebung_id, uebung_name, messart)
    values (tu, te, ue, 'Test-Drop-Jump', 'test');
    insert into public.ausgefuehrte_saetze (id, ausgefuehrte_uebung_id, satznummer, messwert, erledigt)
    values (gen_random_uuid(), tu, 1, 31.5, true),
           (gen_random_uuid(), tu, 2, 33.25, true),
           (gen_random_uuid(), tu, 3, 32, true);
    blockiert := false;
  exception when others then
    blockiert := true;
    r := r || '        (' || sqlerrm || ')' || E'\n';
  end;
  r := r || case when not blockiert then ok else err end || 'Athlet trägt 3 Versuche mit Kommazahlen ein' || E'\n';

  select count(*) into n from public.ausgefuehrte_saetze where ausgefuehrte_uebung_id = tu and messwert = 33.25;
  r := r || case when n = 1 then ok else err end || 'Versuch 33,25 cm genau gespeichert' || E'\n';

  -- Athlet B sieht die Versuche von A nicht
  perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);
  select count(*) into n from public.ausgefuehrte_saetze where ausgefuehrte_uebung_id = tu;
  r := r || case when n = 0 then ok else err end || 'Anderer Athlet sieht die Versuche nicht' || E'\n';

  -- Coach sieht sie
  perform set_config('request.jwt.claims', json_build_object('sub', k, 'role', 'authenticated')::text, true);
  select count(*) into n from public.ausgefuehrte_saetze where ausgefuehrte_uebung_id = tu;
  r := r || case when n = 3 then ok else err end || 'Coach sieht alle 3 Versuche' || E'\n';

  raise exception '%', r;
end $$;
