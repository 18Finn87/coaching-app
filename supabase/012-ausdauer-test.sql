-- =====================================================================
-- Coaching App · Phase 9 · Prüfskript Ausdauer
-- Nach 012-ausdauer.sql ausführen. Bricht absichtlich ab (Testdaten verschwinden).
-- =====================================================================
do $$
declare
  r   text := E'TESTERGEBNIS Ausdauer (alle Testdaten werden zurückgenommen)\n';
  n   int;
  blockiert boolean;
  k   uuid := 'eeeeeeee-5555-4000-8000-00000000000c';
  k2  uuid := 'eeeeeeee-5555-4000-8000-00000000000d';
  a   uuid := 'eeeeeeee-5555-4000-8000-00000000000a';
  f   uuid := 'eeeeeeee-5555-4000-8000-00000000000f';
  ue  uuid;
  te  uuid := 'eeeeeeee-5555-4000-8000-0000000000f1';
  au  uuid := 'eeeeeeee-5555-4000-8000-0000000000f2';
  ok  constant text := 'OK      ';
  err constant text := 'FEHLER  ';
begin
  select count(*) into n from public.uebungen u join public.profile p on p.id = u.coach_id
  where p.rolle = 'coach' and u.modul = 'ausdauer' and u.messart = 'ausdauer';
  r := r || case when n >= 7 then ok else err end || 'Startbestand Ausdauer vorhanden (' || n || ')' || E'\n';

  insert into auth.users (id, instance_id, aud, role, email, created_at, updated_at) values
    (k,  '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'k@rls-test.invalid',  now(), now()),
    (k2, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'k2@rls-test.invalid', now(), now()),
    (a,  '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'a@rls-test.invalid',  now(), now()),
    (f,  '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'f@rls-test.invalid',  now(), now());
  update public.profile set rolle = 'coach' where id in (k, k2);
  insert into public.coach_athlet (coach_id, athlet_id, status) values (k, a, 'aktiv');
  insert into public.einwilligungen (athlet_id, art, textversion) values (a, 'nutzung', 'test'), (f, 'nutzung', 'test');

  set local role authenticated;

  ---------------- Coach ----------------
  perform set_config('request.jwt.claims', json_build_object('sub', k, 'role', 'authenticated')::text, true);
  begin
    insert into public.uebungen (name, modul, bewegungsmuster, messart) values ('Test-Lauf', 'ausdauer', 'laufen', 'ausdauer')
    returning id into ue;
    blockiert := false;
  exception when others then blockiert := true; end;
  r := r || case when not blockiert then ok else err end || 'K legt eine Ausdauerübung (Zeit + Strecke) an' || E'\n';
  begin insert into public.athlet_ausdauer (athlet_id, hf_max, hf_schwelle) values (a, 195, 172); blockiert := false; exception when others then blockiert := true; end;
  r := r || case when not blockiert then ok else err end || 'K trägt Maximal- und Schwellenpuls für A ein' || E'\n';
  begin update public.athlet_ausdauer set hf_schwelle = 200 where athlet_id = a; blockiert := false; exception when others then blockiert := true; end;
  r := r || case when blockiert then ok else err end || 'Schwellenpuls über dem Maximalpuls wird abgelehnt' || E'\n';

  ---------------- Athletin ----------------
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  select count(*) into n from public.athlet_ausdauer where athlet_id = a and hf_max = 195;
  r := r || case when n = 1 then ok else err end || 'A sieht ihre Pulswerte' || E'\n';
  update public.athlet_ausdauer set hf_max = 193 where athlet_id = a; get diagnostics n = row_count;
  r := r || case when n = 1 then ok else err end || 'A kann ihre Pulswerte selbst ändern' || E'\n';
  insert into public.trainingseinheiten (id, titel) values (te, 'Test');
  insert into public.ausgefuehrte_uebungen (id, trainingseinheit_id, uebung_id, uebung_name, messart)
  values (au, te, ue, 'Test-Lauf', 'ausdauer');
  begin
    insert into public.ausgefuehrte_saetze (id, ausgefuehrte_uebung_id, satznummer, dauer_sek, distanz_m, puls_schnitt, anstrengung, erledigt)
    values (gen_random_uuid(), au, 1, 1800, 5000, 152, 4, true);
    blockiert := false;
  exception when others then blockiert := true; end;
  r := r || case when not blockiert then ok else err end || 'A trägt 30 min / 5 km / Puls 152 / Anstrengung 4 ein' || E'\n';
  begin insert into public.ausgefuehrte_saetze (id, ausgefuehrte_uebung_id, satznummer, puls_schnitt) values (gen_random_uuid(), au, 2, 400); blockiert := false; exception when others then blockiert := true; end;
  r := r || case when blockiert then ok else err end || 'Unmöglicher Puls (400) wird abgelehnt' || E'\n';
  begin insert into public.ausgefuehrte_saetze (id, ausgefuehrte_uebung_id, satznummer, anstrengung) values (gen_random_uuid(), au, 3, 11); blockiert := false; exception when others then blockiert := true; end;
  r := r || case when blockiert then ok else err end || 'Anstrengung über 10 wird abgelehnt' || E'\n';

  ---------------- Andere ----------------
  perform set_config('request.jwt.claims', json_build_object('sub', k2, 'role', 'authenticated')::text, true);
  select count(*) into n from public.athlet_ausdauer;
  r := r || case when n = 0 then ok else err end || 'Anderer Coach sieht keine Pulswerte' || E'\n';
  begin insert into public.athlet_ausdauer (athlet_id, hf_max) values (a, 180); blockiert := false; exception when others then blockiert := true; end;
  r := r || case when blockiert then ok else err end || 'Anderer Coach kann für A nichts eintragen' || E'\n';
  perform set_config('request.jwt.claims', json_build_object('sub', f, 'role', 'authenticated')::text, true);
  select count(*) into n from public.athlet_ausdauer;
  r := r || case when n = 0 then ok else err end || 'Fremde Person sieht keine Pulswerte' || E'\n';
  update public.athlet_ausdauer set hf_max = 150 where athlet_id = a; get diagnostics n = row_count;
  r := r || case when n = 0 then ok else err end || 'Fremde Person kann nichts ändern' || E'\n';

  perform set_config('request.jwt.claims', json_build_object('sub', k, 'role', 'authenticated')::text, true);
  select count(*) into n from public.ausgefuehrte_saetze where ausgefuehrte_uebung_id = au and puls_schnitt = 152;
  r := r || case when n = 1 then ok else err end || 'K sieht den Puls der Einheit' || E'\n';

  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  set local role anon;
  begin select count(*) into n from public.athlet_ausdauer; blockiert := false; exception when others then blockiert := true; end;
  r := r || case when blockiert then ok else err end || 'Ohne Anmeldung kein Zugriff' || E'\n';

  raise exception '%', r;
end $$;
