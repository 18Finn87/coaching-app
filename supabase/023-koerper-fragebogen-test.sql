-- =====================================================================
-- Coaching App · Phase 19 · Prüfskript Körperstellen und Fragebogen
-- Nach 023-koerper-fragebogen.sql ausführen. Bricht absichtlich ab (Testdaten verschwinden).
-- =====================================================================
do $$
declare
  r   text := E'TESTERGEBNIS Körperstellen und Fragebogen (alle Testdaten werden zurückgenommen)\n';
  n   int;
  t   text;
  blockiert boolean;
  k   uuid := 'ffffffff-ffff-4000-8000-00000000000c';
  k2  uuid := 'ffffffff-ffff-4000-8000-00000000000d';
  a   uuid := 'ffffffff-ffff-4000-8000-00000000000a';
  b   uuid := 'ffffffff-ffff-4000-8000-00000000000b';
  bs  uuid;
  ok  constant text := 'OK      ';
  err constant text := 'FEHLER  ';
begin
  insert into auth.users (id, instance_id, aud, role, email, created_at, updated_at) values
    (k,  '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'k@rls-test.invalid', now(), now()),
    (k2, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'k2@rls-test.invalid', now(), now()),
    (a,  '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'a@rls-test.invalid', now(), now()),
    (b,  '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'b@rls-test.invalid', now(), now());
  update public.profile set rolle = 'coach' where id in (k, k2);
  insert into public.coach_athlet (coach_id, athlet_id, status) values (k, a, 'aktiv'), (k2, b, 'aktiv');
  insert into public.einwilligungen (athlet_id, art, textversion) values (a, 'nutzung', 'test'), (a, 'gesundheitsdaten', 'test');

  set local role authenticated;
  -- Körperstellen
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  begin
    bs := public.beschwerde_speichern_stellen(null, 'knie', array['knie_links', 'oberschenkel_hinten_links'], 'zieht beim Laufen', current_date, null);
    blockiert := false;
  exception when others then blockiert := true; r := r || '        (' || sqlerrm || ')' || E'\n'; end;
  r := r || case when not blockiert then ok else err end || 'Beschwerde mit zwei Körperstellen gespeichert' || E'\n';
  select array_to_string(koerperstellen, ',') into t from public.beschwerden_liste(a) where id = bs;
  r := r || case when t = 'knie_links,oberschenkel_hinten_links' then ok else err end || 'Liste liefert die Stellen (' || coalesce(t, '-') || ')' || E'\n';
  begin perform public.beschwerde_speichern_stellen(bs, 'knie', array['knie_mitte'], '', null, null); blockiert := false; exception when others then blockiert := true; end;
  r := r || case when blockiert then ok else err end || 'Unbekannte Körperstelle wird abgelehnt' || E'\n';
  perform public.beschwerde_speichern(null, 'schulter', 'alte Art', null, null);
  select count(*) into n from public.beschwerden_liste(a) where koerperregion = 'schulter' and koerperstellen = '{}';
  r := r || case when n = 1 then ok else err end || 'Alte Speicherart ohne Stellen geht weiter' || E'\n';

  -- Fragebogen
  begin perform public.fragebogen_speichern('[{"id":"x","typ":"janein","text":"?"}]'); blockiert := false; exception when others then blockiert := true; end;
  r := r || case when blockiert then ok else err end || 'Kunde kann keinen Fragebogen anlegen' || E'\n';

  perform set_config('request.jwt.claims', json_build_object('sub', k, 'role', 'authenticated')::text, true);
  n := public.fragebogen_speichern('[{"id":"f1","typ":"janein","text":"Rauchst du?"},{"id":"f2","typ":"auswahl","text":"Wie oft Sport?","optionen":["nie","1–2×","3+×"]}]');
  r := r || case when n = 1 then ok else err end || 'Coach legt Fassung 1 an' || E'\n';
  n := public.fragebogen_speichern('[{"id":"f1","typ":"janein","text":"Rauchst du regelmäßig?"}]');
  r := r || case when n = 2 then ok else err end || 'Nächste Fassung bekommt Nummer 2' || E'\n';
  begin update public.anamnese_frageboegen set fragen = '[]' where coach_id = k; get diagnostics n = row_count; blockiert := n = 0; exception when others then blockiert := true; end;
  r := r || case when blockiert then ok else err end || 'Fassungen lassen sich nicht nachträglich ändern' || E'\n';
  begin perform public.fragebogen_speichern('[]'); blockiert := false; exception when others then blockiert := true; end;
  r := r || case when blockiert then ok else err end || 'Leerer Fragebogen wird abgelehnt' || E'\n';

  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  select count(*) into n from public.anamnese_frageboegen;
  r := r || case when n = 2 then ok else err end || 'Kunde sieht die Fragebögen seines Coachs' || E'\n';
  perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);
  select count(*) into n from public.anamnese_frageboegen where coach_id = k;
  r := r || case when n = 0 then ok else err end || 'Kunde eines anderen Coachs sieht sie nicht' || E'\n';
  perform set_config('request.jwt.claims', json_build_object('sub', k2, 'role', 'authenticated')::text, true);
  select count(*) into n from public.anamnese_frageboegen where coach_id = k;
  r := r || case when n = 0 then ok else err end || 'Fremder Coach sieht sie nicht' || E'\n';

  raise exception '%', r;
end $$;
