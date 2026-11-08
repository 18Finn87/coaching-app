-- =====================================================================
-- Coaching App · Schritt 2.1 · Prüfskript für Einladungen
-- Nach 002-einladungen.sql im SQL Editor ausführen. Bricht am Ende
-- absichtlich ab: Ergebnis steht in der Fehlermeldung, Testdaten verschwinden.
-- Erwartung: jede Zeile beginnt mit "OK".
-- =====================================================================
do $$
declare
  r  text := E'TESTERGEBNIS Einladungen (alle Testdaten werden zurückgenommen)\n';
  n  int;
  t  text;
  blockiert boolean;
  k  uuid := '22222222-0000-4000-8000-00000000000c';  -- Coach K
  a  uuid := '22222222-0000-4000-8000-00000000000a';  -- eingeladene Athletin A
  x  uuid := '22222222-0000-4000-8000-00000000000e';  -- Person mit abgelaufener Einladung
  f  uuid := '22222222-0000-4000-8000-00000000000f';  -- fremde Person ohne Einladung
  ok  constant text := 'OK      ';
  err constant text := 'FEHLER  ';
begin
  ---------------- Vorbereitung (als Admin) ----------------
  insert into auth.users (id, instance_id, aud, role, email, created_at, updated_at)
  values (k, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'k@rls-test.invalid', now(), now());
  update public.profile set rolle = 'coach' where id = k;

  insert into public.einladungen (coach_id, email, name) values (k, 'a@rls-test.invalid', 'Anna Test');
  insert into public.einladungen (coach_id, email, name, gueltig_bis)
    values (k, 'x@rls-test.invalid', 'Alt', now() - interval '1 day');

  -- So legt Supabase beim Einladen das Konto an:
  insert into auth.users (id, instance_id, aud, role, email, created_at, updated_at) values
    (a, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'A@RLS-test.invalid', now(), now()),
    (x, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'x@rls-test.invalid', now(), now()),
    (f, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'f@rls-test.invalid', now(), now());

  select count(*) into n from public.coach_athlet where coach_id = k and athlet_id = a and status = 'eingeladen';
  r := r || case when n = 1 then ok else err end || 'Eingeladenes Konto wird automatisch dem Coach zugeordnet (Status eingeladen)' || E'\n';
  select anzeigename into t from public.profile where id = a;
  r := r || case when t = 'Anna Test' then ok else err end || 'Name aus der Einladung wird übernommen (' || coalesce(t, '-') || ')' || E'\n';
  select rolle::text into t from public.profile where id = a;
  r := r || case when t = 'athlet' then ok else err end || 'Eingeladene Person hat die Rolle athlet' || E'\n';
  select count(*) into n from public.coach_athlet where athlet_id = x;
  r := r || case when n = 0 then ok else err end || 'Abgelaufene Einladung wird nicht verknüpft' || E'\n';
  select count(*) into n from public.coach_athlet where athlet_id = f;
  r := r || case when n = 0 then ok else err end || 'Person ohne Einladung wird niemandem zugeordnet' || E'\n';

  set local role authenticated;

  ---------------- Coach K vor der Annahme ----------------
  perform set_config('request.jwt.claims', json_build_object('sub', k, 'role', 'authenticated')::text, true);
  select count(*) into n from public.profile where id = a;
  r := r || case when n = 1 then ok else err end || 'K sieht die eingeladene Person schon vor der ersten Anmeldung' || E'\n';
  select count(*) into n from public.profile where id in (x, f);
  r := r || case when n = 0 then ok else err end || 'K sieht Personen ohne gültige Einladung nicht' || E'\n';
  begin insert into public.einladungen (email, name) values ('b@rls-test.invalid', 'Ben'); blockiert := false; exception when others then blockiert := true; end;
  r := r || case when not blockiert then ok else err end || 'K kann Einladungen mit Namen anlegen' || E'\n';
  begin insert into public.einladungen (email, name) values ('b@rls-test.invalid', 'Ben'); blockiert := false; exception when others then blockiert := true; end;
  r := r || case when blockiert then ok else err end || 'Doppelte offene Einladung an dieselbe Adresse wird abgelehnt' || E'\n';
  begin insert into public.einladungen (email, name) values ('c@rls-test.invalid', '  Leerzeichen  '); blockiert := false; exception when others then blockiert := true; end;
  r := r || case when blockiert then ok else err end || 'Namen mit Leerzeichen am Rand werden abgelehnt' || E'\n';

  ---------------- Athletin A meldet sich zum ersten Mal an ----------------
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  select public.einladung_annehmen() into n;
  r := r || case when n = 1 then ok else err end || 'A nimmt die Einladung an (' || n || ' Betreuung aktiviert)' || E'\n';
  select status::text into t from public.coach_athlet where athlet_id = a;
  r := r || case when t = 'aktiv' then ok else err end || 'Betreuung ist jetzt aktiv' || E'\n';
  select public.einladung_annehmen() into n;
  r := r || case when n = 0 then ok else err end || 'Zweiter Aufruf ändert nichts mehr' || E'\n';
  select count(*) into n from public.einladungen;
  r := r || case when n = 0 then ok else err end || 'A sieht keine Einladungen (auch nicht ihre eigene)' || E'\n';
  select count(*) into n from public.profile;
  r := r || case when n = 2 then ok else err end || 'A sieht sich und ihren Coach (' || n || ')' || E'\n';

  ---------------- Fremde Person F ----------------
  perform set_config('request.jwt.claims', json_build_object('sub', f, 'role', 'authenticated')::text, true);
  select public.einladung_annehmen() into n;
  r := r || case when n = 0 then ok else err end || 'F ohne Einladung: Annehmen bewirkt nichts' || E'\n';
  select count(*) into n from public.coach_athlet;
  r := r || case when n = 0 then ok else err end || 'F hat danach keine Betreuung' || E'\n';

  ---------------- Coach K nach der Annahme ----------------
  perform set_config('request.jwt.claims', json_build_object('sub', k, 'role', 'authenticated')::text, true);
  select count(*) into n from public.einladungen where email = 'a@rls-test.invalid' and angenommen_am is not null and angenommen_von = a;
  r := r || case when n = 1 then ok else err end || 'K sieht, dass die Einladung angenommen wurde' || E'\n';

  ---------------- Ohne Anmeldung ----------------
  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  set local role anon;
  begin perform public.einladung_annehmen(); blockiert := false; exception when others then blockiert := true; end;
  r := r || case when blockiert then ok else err end || 'Ohne Anmeldung kann niemand Einladungen annehmen' || E'\n';

  raise exception '%', r;
end $$;
