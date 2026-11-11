-- =====================================================================
-- Coaching App · Phase 13 · Teil B: Korrektur der Lösch- und Leserechte
-- Nach 016-videos.sql ausführen.
--
-- Supabase braucht zum Löschen einer Datei auch das Leserecht. Deshalb:
-- * Die Person sieht (und löscht) alles in ihrem eigenen Ordner – auch nach
--   einem Widerruf, damit die App die Videos dann sofort entfernen kann.
-- * Der Coach sieht Videos nur mit Einwilligung und solange sie nicht
--   abgelaufen sind; abgelaufene darf er zum Löschen abrufen.
-- * Aufräumen nach Widerruf macht die Person selbst, abgelaufene Videos beide.
-- =====================================================================

begin;

drop policy if exists videos_lesen on storage.objects;
drop policy if exists videos_loeschen on storage.objects;

create policy videos_lesen on storage.objects for select to authenticated
  using (bucket_id = 'videos' and (
    (storage.foldername(name))[1] = (select auth.uid())::text
    or exists (
      select 1 from public.analysen a
      where a.pfad = name and intern.betreut(a.athlet_id)
        and ((a.video_geloescht_am is null and a.loeschen_am > now() and intern.hat_einwilligung(a.athlet_id, 'videos'))
             or a.loeschen_am <= now()))));

create policy videos_loeschen on storage.objects for delete to authenticated
  using (bucket_id = 'videos' and (
    (storage.foldername(name))[1] = (select auth.uid())::text
    or exists (
      select 1 from public.analysen a
      where a.pfad = name and intern.betreut(a.athlet_id)
        and (a.hochgeladen_von = (select auth.uid()) or a.loeschen_am <= now()))));

create or replace function public.videos_zum_aufraeumen()
returns table (analyse_id uuid, pfad text)
language sql stable security definer set search_path = '' as $$
  select a.id, a.pfad from public.analysen a
  where a.video_geloescht_am is null
    and ((a.athlet_id = (select auth.uid())
          and (a.loeschen_am <= now() or not intern.hat_einwilligung(a.athlet_id, 'videos')))
         or (intern.betreut(a.athlet_id) and a.loeschen_am <= now()));
$$;

commit;

select 'korrigiert' as ergebnis;
