-- =====================================================================
-- Coaching App · Phase 8 · Prüfskript Mobilität
-- Nach 011-mobilitaet.sql ausführen. Bricht absichtlich ab (Testdaten verschwinden).
-- =====================================================================
do $$
declare
  r   text := E'TESTERGEBNIS Mobilität (alle Testdaten werden zurückgenommen)\n';
  n   int;
  blockiert boolean;
  k   uuid := 'dddddddd-4444-4000-8000-00000000000c';
  a   uuid := 'dddddddd-4444-4000-8000-00000000000a';
  ue  uuid;
  te  uuid := 'dddddddd-4444-4000-8000-0000000000f1';
  au  uuid := 'dddddddd-4444-4000-8000-0000000000f2';
  ok  constant text := 'OK      ';
  err constant text := 'FEHLER  ';
begin
  -- Startbestand beim echten Coach vorhanden?
  select count(*) into n from public.uebungen u join public.profile p on p.id = u.coach_id
  where p.rolle = 'coach' and u.modul = 'mobilitaet' and u.messart = 'umfang';
  r := r || case when n >= 5 then ok else err end || 'Startbestand: Messtests vorhanden (' || n || ')' || E'\n';
  select count(*) into n from public.uebungen u join public.profile p on p.id = u.coach_id
  where p.rolle = 'coach' and u.name = 'Messtest: Finger-Boden-Abstand' and u.kleiner_besser;
  r := r || case when n >= 1 then ok else err end || 'Finger-Boden-Abstand: kleiner ist besser' || E'\n';
  select count(*) into n from (
    select u.coach_id, lower(u.name) from public.uebungen u group by 1, 2 having count(*) > 1) d;
  r := r || case when n = 0 then ok else err end || 'Keine doppelten Übungsnamen' || E'\n';

  insert into auth.users (id, instance_id, aud, role, email, created_at, updated_at) values
    (k, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'k@rls-test.invalid', now(), now()),
    (a, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'a@rls-test.invalid', now(), now());
  update public.profile set rolle = 'coach' where id = k;
  insert into public.coach_athlet (coach_id, athlet_id, status) values (k, a, 'aktiv');
  insert into public.einwilligungen (athlet_id, art, textversion) values (a, 'nutzung', 'test');

  set local role authenticated;
  perform set_config('request.jwt.claims', json_build_object('sub', k, 'role', 'authenticated')::text, true);
  begin
    insert into public.uebungen (name, modul, bewegungsmuster, messart, kleiner_besser, einseitig, seiten_getrennt)
    values ('Test-Knie-zur-Wand', 'mobilitaet', 'mobilisieren', 'umfang', false, true, true)
    returning id into ue;
    blockiert := false;
  exception when others then blockiert := true; end;
  r := r || case when not blockiert then ok else err end || 'K legt einen Messtest (cm) an' || E'\n';
  begin insert into public.uebungen (name, messart) values ('Test-Unsinn', 'gefuehl'); blockiert := false; exception when others then blockiert := true; end;
  r := r || case when blockiert then ok else err end || 'Unbekannte Messart wird abgelehnt' || E'\n';
  update public.uebungen set kleiner_besser = true where id = ue; get diagnostics n = row_count;
  r := r || case when n = 1 then ok else err end || 'K kann „kleiner ist besser“ ändern' || E'\n';

  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  insert into public.trainingseinheiten (id, titel) values (te, 'Test');
  insert into public.ausgefuehrte_uebungen (id, trainingseinheit_id, uebung_id, uebung_name, messart)
  values (au, te, ue, 'Test-Knie-zur-Wand', 'umfang');
  begin
    insert into public.ausgefuehrte_saetze (id, ausgefuehrte_uebung_id, satznummer, seite, messwert, erledigt) values
      (gen_random_uuid(), au, 1, 'links', 9.5, true),
      (gen_random_uuid(), au, 1, 'rechts', 12, true);
    blockiert := false;
  exception when others then blockiert := true; end;
  r := r || case when not blockiert then ok else err end || 'A trägt Messwerte links 9,5 / rechts 12 cm ein' || E'\n';
  begin insert into public.ausgefuehrte_saetze (id, ausgefuehrte_uebung_id, satznummer, messwert) values (gen_random_uuid(), au, 2, -4.5); blockiert := false; exception when others then blockiert := true; end;
  r := r || case when not blockiert then ok else err end || 'Minuswerte sind erlaubt (z. B. −4,5 cm)' || E'\n';
  begin insert into public.ausgefuehrte_saetze (id, ausgefuehrte_uebung_id, satznummer, messwert) values (gen_random_uuid(), au, 3, 99999); blockiert := false; exception when others then blockiert := true; end;
  r := r || case when blockiert then ok else err end || 'Unsinnig großer Wert wird abgelehnt' || E'\n';

  perform set_config('request.jwt.claims', json_build_object('sub', k, 'role', 'authenticated')::text, true);
  select count(*) into n from public.ausgefuehrte_saetze where ausgefuehrte_uebung_id = au and messwert is not null;
  r := r || case when n = 3 then ok else err end || 'K sieht die Messwerte (' || n || ')' || E'\n';

  raise exception '%', r;
end $$;
