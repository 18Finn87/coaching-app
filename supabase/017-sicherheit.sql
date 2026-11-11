-- =====================================================================
-- Coaching App · Sicherheits-Check (11.11.2026)
-- Bereits ausgeführt. Interne Trigger-Funktionen nicht direkt aufrufbar machen
-- (sie liefen ohnehin nur als Trigger; das intern-Schema ist nicht in der API).
-- =====================================================================
revoke all on function intern.aktualisiert_setzen() from public, anon, authenticated;
revoke all on function intern.einwilligung_schuetzen() from public, anon, authenticated;
