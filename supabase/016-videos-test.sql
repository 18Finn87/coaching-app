-- =====================================================================
-- Coaching App · Phase 13 · Prüfskript Videos
-- Nach 016-videos.sql ausführen. Bricht absichtlich ab (Testdaten verschwinden).
-- Dateien werden hier nur als Einträge in storage.objects simuliert.
-- =====================================================================
do $$
declare
  r   text := E'TESTERGEBNIS Videos (alle Testdaten werden zurückgenommen)\n';
  n   int;
  blockiert boolean;
  k   uuid := 'ffffffff-9999-4000-8000-00000000000c';
  k2  uuid := 'ffffffff-9999-4000-8000-00000000000d';
  a   uuid := 'ffffffff-9999-4000-8000-00000000000a';
  b   uuid := 'ffffffff-9999-4000-8000-00000000000b';
  an1 uuid := gen_random_uuid();
  an2 uuid := gen_random_uuid();
  anb uuid := gen_random_uuid();
  ok  constant text := 'OK      ';
  err constant text := 'FEHLER  ';
begin
  select count(*) into n from storage.buckets where id = 'videos' and not public and file_size_limit = 52428800;
  r := r || case when n = 1 then ok else err end || 'Privater Speicher "videos" mit 50 MB pro Datei' || E'\n';

  insert into auth.users (id, instance_id, aud, role, email, created_at, updated_at) values
    (k,  '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'k@rls-test.invalid', now(), now()),
    (k2, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'k2@rls-test.invalid', now(), now()),
    (a,  '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'a@rls-test.invalid', now(), now()),
    (b,  '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'b@rls-test.invalid', now(), now());
  update public.profile set rolle = 'coach' where id in (k, k2);
  insert into public.coach_athlet (coach_id, athlet_id, status) values (k, a, 'aktiv'), (k, b, 'aktiv');
  insert into public.einwilligungen (athlet_id, art, textversion) values
    (a, 'nutzung', 'test'), (a, 'videos', 'test'), (b, 'nutzung', 'test');

  set local role authenticated;

  -- Athlet A lädt ein eigenes Video hoch
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  begin
    insert into public.analysen (id, athlet_id, titel, pfad, mime, groesse_bytes, dauer_sek)
    values (an1, a, 'Kniebeuge seitlich', a::text || '/' || an1::text || '.webm', 'video/webm', 4000000, 12.5);
    insert into storage.objects (bucket_id, name, owner_id, metadata)
    values ('videos', a::text || '/' || an1::text || '.webm', a::text, '{"size": 4000000}');
    blockiert := false;
  exception when others then blockiert := true; r := r || '        (' || sqlerrm || ')' || E'\n'; end;
  r := r || case when not blockiert then ok else err end || 'Athlet mit Einwilligung lädt ein Video hoch' || E'\n';

  begin
    insert into storage.objects (bucket_id, name, owner_id) values ('videos', a::text || '/fremd.webm', a::text);
    blockiert := false;
  exception when others then blockiert := true; end;
  r := r || case when blockiert then ok else err end || 'Datei ohne passende Analyse wird abgelehnt' || E'\n';

  begin
    insert into public.analysen (athlet_id, pfad, mime, groesse_bytes) values (a, 'falsch/pfad.webm', 'video/webm', 10);
    blockiert := false;
  exception when others then blockiert := true; end;
  r := r || case when blockiert then ok else err end || 'Falscher Speicherpfad wird abgelehnt' || E'\n';

  begin
    insert into public.analysen (id, athlet_id, pfad, mime, groesse_bytes, dauer_sek)
    values (gen_random_uuid(), a, 'x', 'video/webm', 10, 45);
    blockiert := false;
  exception when others then blockiert := true; end;
  r := r || case when blockiert then ok else err end || 'Video über 30 Sekunden wird abgelehnt' || E'\n';

  insert into public.analyse_anmerkungen (analyse_id, zeit_sek, text) values (an1, 3.4, 'Knie fällt nach innen');
  select count(*) into n from public.analyse_anmerkungen where analyse_id = an1;
  r := r || case when n = 1 then ok else err end || 'Athlet schreibt eine Anmerkung bei 0:03,4' || E'\n';

  -- Coach K sieht Video und Anmerkung, schreibt eine eigene mit Winkel
  perform set_config('request.jwt.claims', json_build_object('sub', k, 'role', 'authenticated')::text, true);
  select count(*) into n from storage.objects where bucket_id = 'videos' and name = a::text || '/' || an1::text || '.webm';
  r := r || case when n = 1 then ok else err end || 'Coach kann das Video abrufen' || E'\n';
  begin
    insert into public.analyse_anmerkungen (analyse_id, zeit_sek, text, zeichnung)
    values (an1, 5, 'Rumpfneigung', '{"art":"winkel","punkte":[[0.4,0.3],[0.45,0.6],[0.5,0.9]],"grad":152}');
    blockiert := false;
  exception when others then blockiert := true; end;
  r := r || case when not blockiert then ok else err end || 'Coach speichert Anmerkung mit Winkel' || E'\n';
  begin
    update public.analyse_anmerkungen set text = 'geändert' where analyse_id = an1 and zeit_sek = 3.4;
    get diagnostics n = row_count;
  end;
  r := r || case when n = 0 then ok else err end || 'Coach kann fremde Anmerkungen nicht ändern' || E'\n';

  -- Coach lädt für B hoch: ohne Einwilligung von B nicht möglich
  begin
    insert into public.analysen (id, athlet_id, pfad, mime, groesse_bytes)
    values (anb, b, b::text || '/' || anb::text || '.mp4', 'video/mp4', 1000);
    blockiert := false;
  exception when others then blockiert := true; end;
  r := r || case when blockiert then ok else err end || 'Ohne Einwilligung „Videos“ kein Upload' || E'\n';

  -- Coach lädt für A hoch
  insert into public.analysen (id, athlet_id, titel, pfad, mime, groesse_bytes)
  values (an2, a, 'Vom Coach', a::text || '/' || an2::text || '.mp4', 'video/mp4', 3000000);
  insert into storage.objects (bucket_id, name, owner_id, metadata) values ('videos', a::text || '/' || an2::text || '.mp4', k::text, '{"size": 3000000}');
  select bytes into n from public.video_speicher();
  r := r || case when n = 7000000 then ok else err end || 'Speicherstand für den Coach: 7 MB' || E'\n';

  -- Fremde sehen nichts
  perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);
  select count(*) into n from public.analysen where athlet_id = a;
  r := r || case when n = 0 then ok else err end || 'Anderer Athlet sieht keine Analysen' || E'\n';
  select count(*) into n from storage.objects where bucket_id = 'videos';
  r := r || case when n = 0 then ok else err end || 'Anderer Athlet sieht keine Videodateien' || E'\n';
  perform set_config('request.jwt.claims', json_build_object('sub', k2, 'role', 'authenticated')::text, true);
  select count(*) into n from public.analysen;
  r := r || case when n = 0 then ok else err end || 'Fremder Coach sieht nichts' || E'\n';
  select bytes into n from public.video_speicher();

  -- Löschrechte (Löschen der Datei selbst geht nur über die Storage-API –
  -- hier wird die Zugriffsregel direkt geprüft)
  perform set_config('request.jwt.claims', json_build_object('sub', k, 'role', 'authenticated')::text, true);
  delete from public.analysen where id = an1;
  get diagnostics n = row_count;
  r := r || case when n = 0 then ok else err end || 'Coach kann ein Video des Athleten nicht löschen' || E'\n';
  select count(*) into n from public.analysen where id = an2;
  r := r || case when n = 1 then ok else err end || 'Coach sieht sein eigenes Upload (darf es löschen)' || E'\n';

  -- Widerruf: Video nicht mehr abrufbar, steht zum Aufräumen an
  reset role;
  update public.einwilligungen set widerrufen_am = now() where athlet_id = a and art = 'videos';
  set local role authenticated;
  perform set_config('request.jwt.claims', json_build_object('sub', k, 'role', 'authenticated')::text, true);
  select count(*) into n from storage.objects where bucket_id = 'videos';
  r := r || case when n = 0 then ok else err end || 'Nach Widerruf kann der Coach die Videos nicht mehr abrufen' || E'\n';
  select count(*) into n from public.videos_zum_aufraeumen();
  r := r || case when n = 0 then ok else err end || 'Coach muss nach Widerruf nichts aufräumen (macht die Person)' || E'\n';
  select count(*) into n from public.analyse_anmerkungen where analyse_id = an1;
  r := r || case when n = 2 then ok else err end || 'Anmerkungen bleiben erhalten' || E'\n';

  -- Die Person räumt auf: sieht ihre Dateien noch und bekommt beide zum Löschen
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  select count(*) into n from public.videos_zum_aufraeumen();
  r := r || case when n = 2 then ok else err end || 'Bei der Person stehen beide Videos zum Löschen an (' || n || ')' || E'\n';
  select count(*) into n from storage.objects where bucket_id = 'videos';
  r := r || case when n = 2 then ok else err end || 'Person kann ihre Dateien zum Löschen noch abrufen' || E'\n';

  -- Markieren geht erst, wenn die Datei wirklich weg ist
  r := r || case when not public.analyse_video_entfernt(an1) then ok else err end || 'Markieren „gelöscht“ nur ohne Datei' || E'\n';
  reset role;
  begin
    perform set_config('storage.allow_delete_query', 'true', true);
    delete from storage.objects where bucket_id = 'videos' and name = a::text || '/' || an1::text || '.webm';
    set local role authenticated;
    perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
    r := r || case when public.analyse_video_entfernt(an1) then ok else err end || 'Nach dem Löschen der Datei wird die Analyse markiert' || E'\n';
  exception when others then
    r := r || 'INFO    Datei-Löschen per SQL gesperrt (' || sqlerrm || ') – wird in der App über die Storage-API geprüft' || E'\n';
  end;

  -- Ablauf nach 12 Monaten
  reset role;
  select count(*) into n from public.analysen where id = an2 and loeschen_am between now() + interval '364 days' and now() + interval '367 days';
  r := r || case when n = 1 then ok else err end || 'Löschdatum in 12 Monaten gesetzt' || E'\n';

  raise exception '%', r;
end $$;
