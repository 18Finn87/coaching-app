# Coaching App – Planung der Erweiterungs-Module

Stand: 9. November 2026 · Status: **Fragen beantwortet, wartet auf Freigabe von Phase 7** · Es wurde noch kein Code geschrieben.

Version 1 (Phasen 1–6) ist fertig und online: Krafttraining, Pläne mit Versionen, Training auch ohne Internet,
Fortschritt, Check-ins und Evaluationen. Dieses Dokument plant die sechs Module, die laut erster Planung
„später“ dazukommen: **Mobilität, Ausdauer, Intervalle, Athletik, Reha, Biomechanik**.

Schneller Überblick: **Abschnitt 2** (Reihenfolge) und **Abschnitt 6** (offene Fragen).

---

## 1. Was schon da ist

Die erste Planung hat die Module schon mitgedacht. Vorhanden sind:

| Baustein | Stand |
|---|---|
| Übung hat ein Feld **Modul** | kraft, ausdauer, intervall, reha, athletik, mobilitaet, biomechanik – bisher immer „kraft“ |
| Übung hat eine **Messart** | wdh_last, wdh, zeit, zeit_last, distanz, distanz_last |
| Vorgabe pro Satz | Wdh., Last, RIR, Tempo, Pause, **Dauer**, **Strecke**, freies Zusatzfeld |
| Leistung pro Satz | Wdh., Last, RIR, **Dauer**, **Strecke** |
| Gesundheitsbereich | eigenes Schema mit Einwilligung, Beschwerden, Protokoll |
| Echte Tests getrennt von Schätzungen | Maximaltests |
| Diagramme | Liniendiagramm mit Tooltip und Tabelle |

**Was fehlt überall:** Die Trainings-Seite und der Plan-Editor zeigen bisher nur die Felder für Kraft (Wdh. × kg).
Die anderen Messarten sind in der Datenbank erlaubt, aber nicht bedienbar. Deshalb kommt zuerst eine
gemeinsame Grundlage (Phase 7).

---

## 2. Reihenfolge (Vorschlag)

Vom Kleinen zum Großen. Jede Phase ist für sich nutzbar und wird wie bisher getestet, zusammengefasst und erst
nach deiner Freigabe hochgeladen.

| Phase | Inhalt | Größe | Warum hier |
|---|---|---|---|
| **7** | Grundlage: Module in Bibliothek, Editor und Training | mittel | Alle anderen bauen darauf auf |
| **8** | Mobilität | klein | Braucht fast nur Phase 7 |
| **9** | Ausdauer | mittel | Neue Felder (Puls, Pace), eigene Auswertung |
| **10** | Intervalle | mittel | Baut auf Ausdauer auf (Zeit, Strecke, Puls) |
| **11** | Athletik (Leistungstests) | mittel | Eigene Testtabelle, Diagramme schon da |
| **12** | Reha | mittel | Gesundheitsbereich, Schmerz pro Übung |
| **13** | Biomechanik (Video-Analyse) | groß | Speicher, neue Einwilligung, Video-Bedienung |

Die Reihenfolge ist änderbar. Wenn dir z. B. Biomechanik am wichtigsten ist, kann sie direkt nach Phase 7 kommen.

---

## 3. Die Phasen im Einzelnen

### Phase 7 – Grundlage für alle Module

**Ziel:** Jede Übung kann je nach Modul und Messart richtig geplant und eingetragen werden.

- **Übungsbibliothek:** Modul auswählbar, Filter nach Modul. Neue Bewegungsmuster für die anderen Module
  (z. B. Laufen, Radfahren, Rudern, Springen, Sprinten, Dehnen, Halten).
- **Plan-Editor:** Je nach Messart passende Eingabefelder:
  - Wdh. (+ kg) wie bisher
  - Zeit (z. B. „Plank 3 × 45 s“)
  - Strecke (z. B. „Lauf 5 km“)
  - Zeit + Last (z. B. „Farmer's Walk 40 s mit 2 × 24 kg“)
- **Training:** Dieselben Felder beim Eintragen, dazu eine **Stoppuhr / ein Countdown** für Zeitsätze.
- **Leistung:** Neues Zusatzfeld auch für die Leistung (bisher nur bei der Vorgabe), damit spätere Werte wie
  Puls oder Seite (links/rechts) Platz haben.
- **Verlauf/Fortschritt:** Diagramme wählen die passende Kennzahl (bei Zeit: längste Zeit, bei Strecke: längste
  Strecke bzw. schnellste Zeit).

**Tests:** Zeit-, Strecken- und Wdh.-Übung planen und offline eintragen; die Vorgabe-Kopie stimmt; Kraft
funktioniert unverändert (alle bisherigen Prüfskripte laufen weiter grün).

### Phase 8 – Mobilität

**Ziel:** Beweglichkeit planen und Fortschritte sichtbar machen.

- Übungsarten: **Halten** (Sekunden, z. B. Couch-Stretch 2 × 60 s je Seite), **Wiederholungen**
  (z. B. Hüft-Kreisen 10 je Seite) und **Bewegungsumfang messen** (z. B. Abstand Finger–Boden in cm,
  Knie-zur-Wand-Test in cm).
- **Links/rechts getrennt** eintragen, weil Seitenunterschiede bei Mobilität wichtig sind.
- **Startbestand:** ca. 20 Mobilitätsübungen und 5 einfache Messtests (alle ohne Geräte).
- **Auswertung:** Verlauf je Seite in einem Diagramm (zwei Linien, links und rechts).

**Bewusst nicht:** Gelenkwinkel in Grad per Kamera messen (dazu Abschnitt Biomechanik).

### Phase 9 – Ausdauer

**Ziel:** Läufe, Radfahrten, Rudern usw. planen und auswerten.

- **Vorgabe:** Dauer oder Strecke, dazu **Intensität**. Wahlweise als Pulszone (Z1–Z5), Pace (min/km),
  Geschwindigkeit (km/h), Watt oder Anstrengung (1–10).
- **Leistung:** Dauer, Strecke, Ø-Puls (freiwillig), Anstrengung. Pace und Geschwindigkeit rechnet die App aus.
- **Pulszonen:** Der Coach trägt pro Person einen Maximal- oder Schwellenpuls ein, die App rechnet die Zonen aus.
  Hinweis in der App: Die Zonen sind eine **Schätzung**, wie beim 1RM.
- **Auswertung:** Wochenumfang (Minuten / km), Pace-Verlauf für gleiche Strecken, Anteil locker/hart.
- **Datei-Import (gewünscht):** Eine GPX- oder FIT-Datei von der Uhr hochladen (bei Garmin, Polar, Suunto,
  Strava usw. als Export erhältlich). Die App liest sie **auf dem Handy** aus und übernimmt Dauer, Strecke,
  Ø-Puls, Höhenmeter und Kilometer-Splits. Die Datei selbst wird **nicht** gespeichert, also auch keine
  GPS-Strecke mit Wohnort (Datensparsamkeit). Eigener Teilschritt 9b.
- **Bewusst nicht:** automatische Verbindung zu Uhren-Konten (Garmin Connect, Strava, Apple Health). Das wäre
  ein eigenes Projekt mit Anmeldungen bei diesen Anbietern.

### Phase 10 – Intervalle

**Ziel:** Belastung und Pause im Wechsel, z. B. „6 × 400 m, 90 s Trabpause“ oder „8 × 20 s / 10 s“.

- Im Plan-Editor ein **Intervall-Block:** Anzahl Runden, Belastung (Zeit oder Strecke), Pause, optional
  mehrere Serien mit Serienpause.
- Im Training ein **Intervall-Timer** mit großen Ziffern und Signalton bzw. Vibration bei jedem Wechsel.
  Läuft auch ohne Internet.
- Pro Runde eintragbar: Zeit (bei Streckenintervallen) bzw. Strecke (bei Zeitintervallen), optional Puls.
- **Auswertung:** Rundenzeiten im Vergleich (wird man über die Runden langsamer?), Verlauf über Wochen.

### Phase 11 – Athletik (Leistungstests)

**Ziel:** Standardtests wiederholbar messen und vergleichen.

- **Testbibliothek** mit festen Messregeln, z. B.:
  - Sprint 10 m / 30 m (Sekunden)
  - Standweitsprung, Counter-Movement-Jump (cm)
  - Pendellauf 5-10-5 (Sekunden)
  - Medizinball-Wurf (m)
- Der Coach kann eigene Tests anlegen (Name, Einheit, „kleiner ist besser“ ja/nein).
- **Mehrere Versuche** pro Test, die App wertet den besten (oder den Durchschnitt, je nach Test).
- Tests als **Testtag** im Plan oder einzeln eintragen.
- **Auswertung:** Verlauf pro Test, Veränderung in % zum letzten und zum ersten Test.
- **Bewusst nicht:** Vergleich mit Normwerten oder Altersgruppen (Normtabellen sind schnell falsch angewendet).

### Phase 12 – Reha

**Ziel:** Übungen nach Verletzungen begleiten, mit Schmerz-Rückmeldung pro Übung.

- Übungen mit Modul „Reha“, geplant wie gewohnt (Wdh., Zeit, Seite).
- Im Training nach jeder Reha-Übung eine **Schmerzangabe 0–10**, freiwillig mit Anmerkung. Sie liegt im
  **geschützten Gesundheitsbereich** (wie beim Check-in), nur mit Einwilligung zu Gesundheitsdaten.
- Der Coach sieht den **Schmerzverlauf pro Übung** über die Wochen.
- **Ampel nur als Anzeige, nicht als Regel:** Du legst pro Übung eine Schmerzgrenze fest (z. B. „bis 3 ok“).
  Die App markiert Einträge darüber. Sie **ändert nichts** und stellt **keine Diagnose**.
- Hinweis in der App: Reha ersetzt keine ärztliche oder physiotherapeutische Behandlung. Bei Schmerzen über
  der Grenze erscheint der Hinweis, die Übung zu beenden und Rücksprache zu halten.

### Phase 13 – Biomechanik (Video-Analyse)

**Ziel:** Technik per Video besprechen.

- **Hochladen:** Die Person (oder du) lädt ein kurzes Video einer Übung hoch, direkt aus dem Training
  heraus oder über die Personenseite. Die App **verkleinert** das Video vorher auf dem Handy.
- **Ansehen:** Zeitlupe (0,25× / 0,5×), Bild für Bild vor und zurück, Standbild.
- **Anmerkungen an Zeitpunkten:** z. B. bei 0:03,4 „Knie fällt nach innen“. Antippen springt an die Stelle.
- **Zeichnen auf dem Standbild (optional, eher später):** Linien und Winkel von Hand einzeichnen, z. B. für
  Rumpfneigung. Das ist dein eigenes Messen per Hand, keine automatische Erkennung.
- **Vergleich nebeneinander:** zwei Videos derselben Übung (vorher / nachher).
- **Speicher:** privater Bereich in Supabase Storage. Zugriff nur für die Person selbst und ihren Coach,
  gleiche Regeln wie bei den Trainingsdaten.
- **Eigene Einwilligung „Videos“:** Auf Videos sind Personen erkennbar. Ohne diese Einwilligung kann nichts
  hochgeladen werden. Beim Widerruf werden die Videos gelöscht.
- **Aufbewahrung:** Videos werden nach einer festen Zeit automatisch gelöscht (Vorschlag: 12 Monate), die
  Anmerkungen bleiben.
- **Bewusst nicht:** automatische Gelenkerkennung („Pose Estimation“) und automatische Technik-Bewertung.
  Das wäre technisch möglich, aber ein großes eigenes Projekt, und die Ergebnisse sind ohne Fachprüfung
  unzuverlässig.

**Grenzen des kostenlosen Supabase-Tarifs:** 1 GB Speicher gesamt, höchstens 50 MB pro Datei. Ein verkleinertes
15-Sekunden-Video hat etwa 3–8 MB, also passen ca. 150–300 Videos. Für mehr bräuchte es den Pro-Tarif
(ca. 25 $/Monat) oder kürzere Aufbewahrung.

---

## 4. Datenmodell (Kurzfassung)

| Phase | Neu in der Datenbank |
|---|---|
| 7 | `ausgefuehrte_saetze.zusatz` (jsonb), neue Bewegungsmuster, Seite links/rechts (`seite`) bei Vorgabe und Leistung |
| 8 | Messart `umfang` (cm/Grad) – sonst nichts Neues |
| 9 | `athlet_ausdauer` (Max-/Schwellenpuls pro Person), Puls/Pace im Zusatzfeld |
| 10 | Intervall-Block in `plan_uebungen.zusatz` (Runden, Belastung, Pause), Rundenwerte als einzelne Sätze |
| 11 | Messart `test`, Spalten `uebungen.einheit` und `uebungen.wertung` – Versuche sind normale Sätze mit `messwert` (keine neue Tabelle) |
| 12 | `gesundheit.reha_schmerz` (Schmerz pro ausgeführter Übung), Schmerzgrenze pro Plan-Übung |
| 13 | Storage-Bucket `videos` (privat), `analysen`, `analyse_anmerkungen`, neue Einwilligungsart `videos` |

Alle neuen Tabellen bekommen wie bisher RLS, ein Prüfskript und werden in „Meine Daten herunterladen“ und
„Konto löschen“ berücksichtigt.

---

## 5. Was gleich bleibt (Regeln aus Version 1)

- Vorgabe und Leistung bleiben getrennt, die Historie bleibt unverändert.
- Schätzungen (1RM, Pulszonen) sind als Schätzung gekennzeichnet.
- Gesundheitsdaten (Reha-Schmerz) nur im geschützten Bereich und nur mit Einwilligung.
- Die App ändert nie selbst einen Plan und stellt keine Diagnosen.
- Keine Nachricht pro Einheit, keine Geheimnisse im Repo.

---

## 6. Entscheidungen und offene Fragen

**Entschieden (9. November 2026):**

1. **Reihenfolge:** wie vorgeschlagen, 7 → 13.
2. **Ausdauer:** Eintippen **und** Datei-Import (GPX/FIT), siehe Phase 9b.
3. **Biomechanik:** Videos laden **beide** hoch, Athleten und Coach.
4. **Kosten:** kostenloser Tarif bleibt. Videos werden nach 12 Monaten automatisch gelöscht, die App zeigt
   an, wie voll der Speicher ist.

**Noch offen (klären wir in der jeweiligen Phase):**

5. **Athletik:** Welche Tests nutzt du wirklich? (Vorschlag: 10 m, 30 m, Standweitsprung, CMJ, 5-10-5)
6. **Reha:** Sollen Physiotherapeuten etwas sehen? (Annahme bis dahin: nur du und die Person.)
