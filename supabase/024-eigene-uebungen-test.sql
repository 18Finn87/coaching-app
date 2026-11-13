-- =====================================================================
-- Coaching App · Phase 20 · Prüfskript eigene Übungen und Vorschläge
-- Nach 024-eigene-uebungen.sql ausführen. Bricht absichtlich ab (Testdaten verschwinden).
-- =====================================================================
do $$
declare
  r   text := E'TESTERGEBNIS Eigene Übungen (alle Testdaten werden zurückgenommen)\n';
  n   int;
  t   text;
  blockiert boolean;
  k   uuid := 'ffffffff-ffff-4000-8000-00000000000c';
  k2  uuid := 'ffffffff-ffff-4000-8000-00000000000d';
  a   uuid := 'ffffffff-ffff-4000-8000-00000000000a';
  a2  uuid := 'ffffffff-ffff-4000-8000-00000000000e';
  b   uuid := 'ffffffff-ffff-4000-8000-00000000000b';
  u   uuid;
  uk  uuid;
  te  uuid;
  ok  constant text := 'OK      ';
  err constant text := 'FEHLER  ';
begin
  insert into auth.users (id, instance_id, aud, role, email, created_at, updated_at) values
    (k,  '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'k@rls-test.invalid', now(), now()),
    (k2, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'k2@rls-test.invalid', now(), now()),
    (a,  '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'a@rls-test.invalid', now(), now()),
    (a2, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'a2@rls-test.invalid', now(), now()),
    (b,  '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'b@rls-test.invalid', now(), now());
  update public.profile set rolle = 'coach' where id in (k, k2);
  insert into public.coach_athlet (coach_id, athlet_id, status) values (k, a, 'aktiv'), (k, a2, 'aktiv'), (k2, b, 'aktiv');
  insert into public.einwilligungen (athlet_id, art, textversion) values
    (a, 'nutzung', 'test'), (a2, 'nutzung', 'test'), (b, 'nutzung', 'test');

  set local role authenticated;

  -- Kunde legt eigene Übung an
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  begin
    insert into public.uebungen (name, privat_fuer) values ('Testübung eigen', a) returning id into u;
    blockiert := false;
  exception when others then blockiert := true; r := r || '        (' || sqlerrm || ')' || E'\n'; end;
  r := r || case when not blockiert then ok else err end || 'Kunde legt eigene Übung an' || E'\n';
  select count(*) into n from public.uebungen where id = u and coach_id = k;
  r := r || case when n = 1 then ok else err end || 'Übung gehört automatisch zur Sammlung des Coachs' || E'\n';
  begin insert into public.uebungen (name) values ('Testübung ohne privat'); blockiert := false; exception when others then blockiert := true; end;
  r := r || case when blockiert then ok else err end || 'Kunde kann keine Übung für alle anlegen' || E'\n';
  begin insert into public.uebungen (name, privat_fuer) values ('Testübung für andere', a2); blockiert := false; exception when others then blockiert := true; end;
  r := r || case when blockiert then ok else err end || 'Kunde kann keine Übung für andere anlegen' || E'\n';
  update public.uebungen set beschreibung = 'geändert' where id = u;
  get diagnostics n = row_count;
  r := r || case when n = 1 then ok else err end || 'Kunde ändert eigene Übung' || E'\n';
  begin
    update public.uebungen set privat_fuer = null where id = u;
    get diagnostics n = row_count;
    blockiert := n = 0;
  exception when others then blockiert := true; end;
  r := r || case when blockiert then ok else err end || 'Kunde kann eigene Übung nicht selbst freigeben' || E'\n';
  select count(*) into n from public.uebungen where id = u and privat_fuer = a;
  r := r || case when n = 1 then ok else err end || 'Übung bleibt privat' || E'\n';

  -- Freies Training mit eigener Übung
  te := gen_random_uuid();
  insert into public.trainingseinheiten (id, titel) values (te, 'Freies Training');
  begin
    insert into public.ausgefuehrte_uebungen (id, trainingseinheit_id, uebung_id, uebung_name) values (gen_random_uuid(), te, u, 'Testübung eigen');
    blockiert := false;
  exception when others then blockiert := true; r := r || '        (' || sqlerrm || ')' || E'\n'; end;
  r := r || case when not blockiert then ok else err end || 'Eigene Übung im freien Training nutzbar' || E'\n';

  -- Vorschlag
  begin
    insert into public.kunden_nachrichten (art, text, uebung_id) values ('uebung_vorschlag', 'Könnte die in meinen Plan?', u);
    blockiert := false;
  exception when others then blockiert := true; r := r || '        (' || sqlerrm || ')' || E'\n'; end;
  r := r || case when not blockiert then ok else err end || 'Kunde schlägt eigene Übung vor' || E'\n';
  begin insert into public.kunden_nachrichten (art, text) values ('uebung_vorschlag', 'ohne Übung'); blockiert := false; exception when others then blockiert := true; end;
  r := r || case when blockiert then ok else err end || 'Vorschlag ohne Übung wird abgelehnt' || E'\n';

  -- Anderer Kunde desselben Coachs
  perform set_config('request.jwt.claims', json_build_object('sub', a2, 'role', 'authenticated')::text, true);
  select count(*) into n from public.uebungen where id = u;
  r := r || case when n = 0 then ok else err end || 'Anderer Kunde sieht die eigene Übung nicht' || E'\n';
  begin insert into public.uebungen (name, privat_fuer) values ('Testübung eigen', a2); blockiert := false; exception when others then blockiert := true; end;
  r := r || case when not blockiert then ok else err end || 'Gleicher Name bei anderem Kunden erlaubt' || E'\n';
  begin insert into public.kunden_nachrichten (art, text, uebung_id) values ('uebung_vorschlag', 'fremd', u); blockiert := false; exception when others then blockiert := true; end;
  r := r || case when blockiert then ok else err end || 'Fremde Übung kann nicht vorgeschlagen werden' || E'\n';

  -- Fremder Coach
  perform set_config('request.jwt.claims', json_build_object('sub', k2, 'role', 'authenticated')::text, true);
  select count(*) into n from public.uebungen where id = u;
  r := r || case when n = 0 then ok else err end || 'Fremder Coach sieht sie nicht' || E'\n';

  -- Coach
  perform set_config('request.jwt.claims', json_build_object('sub', k, 'role', 'authenticated')::text, true);
  select count(*) into n from public.uebungen where id = u;
  r := r || case when n = 1 then ok else err end || 'Coach sieht die eigene Übung' || E'\n';
  select count(*) into n from public.kunden_nachrichten where art = 'uebung_vorschlag' and uebung_id = u;
  r := r || case when n = 1 then ok else err end || 'Coach sieht den Vorschlag' || E'\n';
  update public.uebungen set privat_fuer = null where id = u;
  get diagnostics n = row_count;
  r := r || case when n = 1 then ok else err end || 'Coach gibt die Übung für alle frei' || E'\n';

  perform set_config('request.jwt.claims', json_build_object('sub', a2, 'role', 'authenticated')::text, true);
  select count(*) into n from public.uebungen where id = u;
  r := r || case when n = 1 then ok else err end || 'Nach Freigabe sehen alle Kunden des Coachs sie' || E'\n';
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  update public.uebungen set beschreibung = 'nochmal' where id = u;
  get diagnostics n = row_count;
  r := r || case when n = 0 then ok else err end || 'Nach Freigabe ändert nur noch der Coach' || E'\n';

  raise exception '%', r;
end $$;
