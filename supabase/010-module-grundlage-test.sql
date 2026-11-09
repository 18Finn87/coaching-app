-- =====================================================================
-- Coaching App · Phase 7 · Prüfskript Grundlage für Module
-- Nach 010-module-grundlage.sql ausführen. Bricht absichtlich ab (Testdaten verschwinden).
-- =====================================================================
do $$
declare
  r   text := E'TESTERGEBNIS Module (alle Testdaten werden zurückgenommen)\n';
  n   int;
  blockiert boolean;
  k   uuid := 'cccccccc-3333-4000-8000-00000000000c';
  a   uuid := 'cccccccc-3333-4000-8000-00000000000a';
  f   uuid := 'cccccccc-3333-4000-8000-00000000000f';
  ue  uuid;
  te  uuid := 'cccccccc-3333-4000-8000-0000000000f1';
  au  uuid := 'cccccccc-3333-4000-8000-0000000000f2';
  ok  constant text := 'OK      ';
  err constant text := 'FEHLER  ';
begin
  insert into auth.users (id, instance_id, aud, role, email, created_at, updated_at) values
    (k, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'k@rls-test.invalid', now(), now()),
    (a, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'a@rls-test.invalid', now(), now()),
    (f, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'f@rls-test.invalid', now(), now());
  update public.profile set rolle = 'coach' where id = k;
  insert into public.coach_athlet (coach_id, athlet_id, status) values (k, a, 'aktiv');
  insert into public.einwilligungen (athlet_id, art, textversion) values (a, 'nutzung', 'test'), (f, 'nutzung', 'test');

  set local role authenticated;

  ---------------- Coach: neue Übungsarten ----------------
  perform set_config('request.jwt.claims', json_build_object('sub', k, 'role', 'authenticated')::text, true);
  begin
    insert into public.uebungen (name, modul, bewegungsmuster, ausstattung, messart, seiten_getrennt, einseitig)
    values ('Test-Couch-Stretch', 'mobilitaet', 'dehnen', array['matte'], 'zeit', true, true)
    returning id into ue;
    blockiert := false;
  exception when others then blockiert := true; end;
  r := r || case when not blockiert then ok else err end || 'K legt Mobilitätsübung (Zeit, Seiten getrennt) an' || E'\n';
  begin insert into public.uebungen (name, modul, bewegungsmuster, messart) values ('Test-Lauf', 'ausdauer', 'laufen', 'distanz'); blockiert := false; exception when others then blockiert := true; end;
  r := r || case when not blockiert then ok else err end || 'K legt Ausdauerübung (Strecke) an' || E'\n';
  begin insert into public.uebungen (name, modul, bewegungsmuster) values ('Test-Sprint', 'athletik', 'sprinten'); blockiert := false; exception when others then blockiert := true; end;
  r := r || case when not blockiert then ok else err end || 'K legt Athletikübung an' || E'\n';
  begin insert into public.uebungen (name, bewegungsmuster) values ('Test-Unsinn', 'fliegen'); blockiert := false; exception when others then blockiert := true; end;
  r := r || case when blockiert then ok else err end || 'Unbekanntes Bewegungsmuster wird abgelehnt' || E'\n';
  begin insert into public.uebungen (name, ausstattung) values ('Test-Unsinn2', array['jetpack']); blockiert := false; exception when others then blockiert := true; end;
  r := r || case when blockiert then ok else err end || 'Unbekannte Ausstattung wird abgelehnt' || E'\n';
  update public.uebungen set bewegungsmuster = 'kniebeuge', ausstattung = array['langhantel'] where id = ue;
  get diagnostics n = row_count;
  r := r || case when n = 1 then ok else err end || 'Bisherige Muster und Ausstattung bleiben gültig' || E'\n';
  update public.uebungen set bewegungsmuster = 'dehnen', ausstattung = array['matte'] where id = ue;

  ---------------- Athletin: Training mit Seiten ----------------
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  insert into public.trainingseinheiten (id, titel) values (te, 'Test');
  insert into public.ausgefuehrte_uebungen (id, trainingseinheit_id, uebung_id, uebung_name, messart)
  values (au, te, ue, 'Test-Couch-Stretch', 'zeit');
  begin
    insert into public.ausgefuehrte_saetze (id, ausgefuehrte_uebung_id, satznummer, seite, dauer_sek, erledigt, zusatz) values
      (gen_random_uuid(), au, 1, 'links', 60, true, '{}'),
      (gen_random_uuid(), au, 1, 'rechts', 45, true, '{"notiz_seite": "enger"}');
    blockiert := false;
  exception when others then blockiert := true; end;
  r := r || case when not blockiert then ok else err end || 'A trägt Satz 1 links und rechts getrennt ein' || E'\n';
  select count(*) into n from public.ausgefuehrte_saetze where ausgefuehrte_uebung_id = au and satznummer = 1;
  r := r || case when n = 2 then ok else err end || 'Beide Seiten sind gespeichert (' || n || ')' || E'\n';
  begin insert into public.ausgefuehrte_saetze (id, ausgefuehrte_uebung_id, satznummer, seite) values (gen_random_uuid(), au, 2, 'mitte'); blockiert := false; exception when others then blockiert := true; end;
  r := r || case when blockiert then ok else err end || 'Unbekannte Seite wird abgelehnt' || E'\n';
  begin insert into public.ausgefuehrte_saetze (id, ausgefuehrte_uebung_id, satznummer, zusatz) values (gen_random_uuid(), au, 3, '[1,2]'); blockiert := false; exception when others then blockiert := true; end;
  r := r || case when blockiert then ok else err end || 'Zusatzfeld muss ein Objekt sein' || E'\n';
  update public.ausgefuehrte_saetze set zusatz = '{"puls": 150}' where ausgefuehrte_uebung_id = au and seite = 'links';
  get diagnostics n = row_count;
  r := r || case when n = 1 then ok else err end || 'A kann das Zusatzfeld ändern' || E'\n';

  ---------------- Coach sieht, Fremde nicht ----------------
  perform set_config('request.jwt.claims', json_build_object('sub', k, 'role', 'authenticated')::text, true);
  select count(*) into n from public.ausgefuehrte_saetze where ausgefuehrte_uebung_id = au and seite is not null;
  r := r || case when n = 2 then ok else err end || 'K sieht beide Seiten' || E'\n';
  perform set_config('request.jwt.claims', json_build_object('sub', f, 'role', 'authenticated')::text, true);
  select count(*) into n from public.ausgefuehrte_saetze where ausgefuehrte_uebung_id = au;
  r := r || case when n = 0 then ok else err end || 'Fremde Person sieht nichts' || E'\n';
  select count(*) into n from public.uebungen where coach_id = k;
  r := r || case when n = 0 then ok else err end || 'Fremde Person sieht die Übungen von K nicht' || E'\n';

  raise exception '%', r;
end $$;
