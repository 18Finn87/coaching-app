-- =====================================================================
-- Coaching App · Phase 13 · Biomechanik (Video-Analyse)
-- Im SQL Editor EINMAL ausführen, nach 016a-videos-einwilligung.sql.
--
-- * Storage-Bucket "videos" (privat, max. 50 MB pro Datei, nur Videos)
--   Pfad: <athlet_id>/<analyse_id>.<endung>
-- * public.analysen: ein Video mit Titel, Übung, Größe, Löschdatum
--   (12 Monate). Nach dem Löschen des Videos bleibt die Zeile mit den
--   Anmerkungen erhalten (video_geloescht_am gesetzt).
-- * public.analyse_anmerkungen: Text an einem Zeitpunkt, optional mit
--   Zeichnung (Punkte/Linien/Winkel, von Hand gesetzt – keine Automatik)
-- * Hochladen und Ansehen nur mit Einwilligung "videos" der Person.
--   Löschen: die Person alles von sich, der Coach was er selbst hochgeladen hat.
--   Abgelaufene Videos (oder nach Widerruf) dürfen beide entfernen – die App
--   räumt beim Öffnen auf, weil Supabase Dateien nur über die Storage-API löscht.
-- =====================================================================

begin;

-- ---------------------------------------------------------------------
-- Speicher
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('videos', 'videos', false, 52428800, array['video/mp4', 'video/webm', 'video/quicktime'])
on conflict (id) do update
  set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

-- ---------------------------------------------------------------------
-- Tabellen
-- ---------------------------------------------------------------------
create table public.analysen (
  id                      uuid primary key default gen_random_uuid(),
  athlet_id               uuid not null references public.profile (id) on delete cascade,
  hochgeladen_von         uuid not null default auth.uid() references public.profile (id) on delete cascade,
  uebung_id               uuid references public.uebungen (id) on delete set null,
  ausgefuehrte_uebung_id  uuid references public.ausgefuehrte_uebungen (id) on delete set null,
  titel                   text not null default '' check (char_length(titel) <= 120),
  pfad                    text not null unique,
  mime                    text not null check (mime in ('video/mp4', 'video/webm', 'video/quicktime')),
  groesse_bytes           integer not null check (groesse_bytes between 1 and 52428800),
  dauer_sek               numeric(5, 2) check (dauer_sek > 0 and dauer_sek <= 31),
  breite                  smallint,
  hoehe                   smallint,
  erstellt_am             timestamptz not null default now(),
  loeschen_am             timestamptz not null default now() + interval '12 months',
  video_geloescht_am      timestamptz,
  check (pfad = athlet_id::text || '/' || id::text || case mime when 'video/webm' then '.webm' when 'video/quicktime' then '.mov' else '.mp4' end)
);
create index analysen_athlet_idx on public.analysen (athlet_id, erstellt_am desc);
comment on table public.analysen is
  'Video-Analysen. Videos liegen privat im Bucket "videos" und werden nach 12 Monaten gelöscht; Anmerkungen bleiben.';

create table public.analyse_anmerkungen (
  id           uuid primary key default gen_random_uuid(),
  analyse_id   uuid not null references public.analysen (id) on delete cascade,
  autor_id     uuid not null default auth.uid() references public.profile (id) on delete cascade,
  zeit_sek     numeric(6, 3) not null check (zeit_sek >= 0 and zeit_sek <= 60),
  text         text not null default '' check (char_length(text) <= 1000),
  zeichnung    jsonb check (zeichnung is null or (jsonb_typeof(zeichnung) = 'object' and octet_length(zeichnung::text) <= 4000)),
  erstellt_am  timestamptz not null default now(),
  check (char_length(text) > 0 or zeichnung is not null)
);
create index analyse_anmerkungen_idx on public.analyse_anmerkungen (analyse_id, zeit_sek);
comment on column public.analyse_anmerkungen.zeichnung is
  'Von Hand gesetzte Punkte (0–1 relativ zum Bild) als Linie oder Winkel, z. B. {"art":"winkel","punkte":[[x,y],[x,y],[x,y]],"grad":142}.';

-- Darf die angemeldete Person diese Analyse sehen? (Person selbst oder ihr Coach)
create function intern.darf_analyse_sehen(p_athlet uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select p_athlet = (select auth.uid()) or intern.betreut(p_athlet);
$$;
revoke all on function intern.darf_analyse_sehen(uuid) from public, anon;
grant execute on function intern.darf_analyse_sehen(uuid) to authenticated;

alter table public.analysen enable row level security;
alter table public.analyse_anmerkungen enable row level security;
revoke all on public.analysen, public.analyse_anmerkungen from public, anon, authenticated;

grant select, delete on public.analysen to authenticated;
grant insert (id, athlet_id, uebung_id, ausgefuehrte_uebung_id, titel, pfad, mime, groesse_bytes, dauer_sek, breite, hoehe)
  on public.analysen to authenticated;
grant update (titel, uebung_id) on public.analysen to authenticated;

grant select, delete on public.analyse_anmerkungen to authenticated;
grant insert (analyse_id, zeit_sek, text, zeichnung) on public.analyse_anmerkungen to authenticated;
grant update (zeit_sek, text, zeichnung) on public.analyse_anmerkungen to authenticated;

create policy analysen_lesen on public.analysen for select to authenticated
  using (intern.darf_analyse_sehen(athlet_id));
create policy analysen_anlegen on public.analysen for insert to authenticated
  with check (hochgeladen_von = (select auth.uid())
              and (athlet_id = (select auth.uid()) or intern.betreut(athlet_id))
              and intern.hat_einwilligung(athlet_id, 'videos'));
create policy analysen_aendern on public.analysen for update to authenticated
  using (athlet_id = (select auth.uid()) or (hochgeladen_von = (select auth.uid()) and intern.betreut(athlet_id)));
create policy analysen_loeschen on public.analysen for delete to authenticated
  using (athlet_id = (select auth.uid()) or (hochgeladen_von = (select auth.uid()) and intern.betreut(athlet_id)));

create policy anmerkungen_lesen on public.analyse_anmerkungen for select to authenticated
  using (exists (select 1 from public.analysen a where a.id = analyse_id));
create policy anmerkungen_anlegen on public.analyse_anmerkungen for insert to authenticated
  with check (autor_id = (select auth.uid()) and exists (select 1 from public.analysen a where a.id = analyse_id));
create policy anmerkungen_aendern on public.analyse_anmerkungen for update to authenticated
  using (autor_id = (select auth.uid()));
create policy anmerkungen_loeschen on public.analyse_anmerkungen for delete to authenticated
  using (autor_id = (select auth.uid())
         or exists (select 1 from public.analysen a where a.id = analyse_id and a.athlet_id = (select auth.uid())));

-- ---------------------------------------------------------------------
-- Zugriffsregeln für die Video-Dateien
-- ---------------------------------------------------------------------
-- Ansehen: Video nicht gelöscht, nicht abgelaufen, Einwilligung besteht
create policy videos_lesen on storage.objects for select to authenticated
  using (bucket_id = 'videos' and exists (
    select 1 from public.analysen a
    where a.pfad = name and a.video_geloescht_am is null and a.loeschen_am > now()
      and intern.hat_einwilligung(a.athlet_id, 'videos')));

-- Hochladen: nur zu einer eigenen, gerade angelegten Analyse
create policy videos_hochladen on storage.objects for insert to authenticated
  with check (bucket_id = 'videos' and exists (
    select 1 from public.analysen a
    where a.pfad = name and a.hochgeladen_von = (select auth.uid()) and a.video_geloescht_am is null
      and intern.hat_einwilligung(a.athlet_id, 'videos')));

-- Löschen: Person alles in ihrem Ordner; Coach eigene Uploads;
-- beide abgelaufene Videos und Videos nach Widerruf (Aufräumen)
create policy videos_loeschen on storage.objects for delete to authenticated
  using (bucket_id = 'videos' and (
    (storage.foldername(name))[1] = (select auth.uid())::text
    or exists (
      select 1 from public.analysen a
      where a.pfad = name and intern.betreut(a.athlet_id)
        and (a.hochgeladen_von = (select auth.uid())
             or a.loeschen_am <= now()
             or not intern.hat_einwilligung(a.athlet_id, 'videos')))));

-- ---------------------------------------------------------------------
-- Funktionen für die App
-- ---------------------------------------------------------------------
-- Nach dem Löschen der Datei: Analyse als "Video gelöscht" markieren
-- (nur wenn die Datei wirklich weg ist und man die Analyse sehen darf)
create function public.analyse_video_entfernt(p_analyse uuid)
returns boolean language plpgsql volatile security definer set search_path = '' as $$
declare
  v_pfad text;
  v_athlet uuid;
begin
  select pfad, athlet_id into v_pfad, v_athlet from public.analysen where id = p_analyse;
  if v_pfad is null or not intern.darf_analyse_sehen(v_athlet) then
    return false;
  end if;
  if exists (select 1 from storage.objects where bucket_id = 'videos' and name = v_pfad) then
    return false;
  end if;
  update public.analysen set video_geloescht_am = coalesce(video_geloescht_am, now()) where id = p_analyse;
  return true;
end;
$$;
revoke all on function public.analyse_video_entfernt(uuid) from public, anon;
grant execute on function public.analyse_video_entfernt(uuid) to authenticated;

-- Welche Videos sind fällig zum Aufräumen? (abgelaufen oder Einwilligung widerrufen)
create function public.videos_zum_aufraeumen()
returns table (analyse_id uuid, pfad text)
language sql stable security definer set search_path = '' as $$
  select a.id, a.pfad from public.analysen a
  where a.video_geloescht_am is null
    and intern.darf_analyse_sehen(a.athlet_id)
    and (a.loeschen_am <= now() or not intern.hat_einwilligung(a.athlet_id, 'videos'));
$$;
revoke all on function public.videos_zum_aufraeumen() from public, anon;
grant execute on function public.videos_zum_aufraeumen() to authenticated;

-- Speicherstand für den Coach (alle Videos zusammen, Gratis-Tarif 1 GB)
create function public.video_speicher()
returns table (anzahl bigint, bytes bigint)
language sql stable security definer set search_path = '' as $$
  select count(*), coalesce(sum((metadata ->> 'size')::bigint), 0)
  from storage.objects
  where bucket_id = 'videos' and intern.ist_coach();
$$;
revoke all on function public.video_speicher() from public, anon;
grant execute on function public.video_speicher() to authenticated;

commit;

select 'eingerichtet' as ergebnis;
