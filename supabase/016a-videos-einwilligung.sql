-- =====================================================================
-- Coaching App · Phase 13 · Teil A: neue Einwilligungsart "videos"
-- Im SQL Editor EINMAL ausführen, VOR 016-videos.sql (eigener Lauf, weil ein
-- neuer Enum-Wert erst nach dem Speichern benutzt werden kann).
-- =====================================================================
alter type public.einwilligung_art add value if not exists 'videos';

select 'Einwilligungsart videos angelegt' as ergebnis;
