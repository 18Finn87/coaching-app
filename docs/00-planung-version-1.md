# Coaching App – Planung für Version 1

Stand: 8. November 2026 · Status: **Entwurf, wartet auf Freigabe** · Es wurde noch kein Code geschrieben.

Dieses Dokument beantwortet die neun Punkte aus „Deine erste Aufgabe“.
Für einen schnellen Überblick: Lies **Schritt 7** (Vorgehen in einfachen Worten) und **Schritt 8** (offene Fragen).

---

## Schritt 1 – Gibt es im Projektordner schon Dateien?

- Für die neue App gab es noch **keinen** Projektordner.
- Neu angelegt: Ordner „Coaching App“ in den Dokumenten mit dem Unterordner `docs\` (nur dieses Dokument liegt darin).
- Geprüft und **nicht angefasst**:
  - die bestehende Fußball-App – bleibt komplett getrennt.
  - ein Ordner eines anderen Programms – nur leere Ordner, hat nichts mit diesem Projekt zu tun.
  - Einige Word- und Excel-Dateien mit Trainingsplänen – das sind vermutlich deine bisherigen Pläne. Ich habe sie **nicht** geöffnet. Sie könnten später als Vorlage für die Übungsbibliothek dienen (siehe Frage 6).
- Vorschlag: ein **eigenes, neues Supabase-Projekt** (z. B. „coaching-app“, Region Frankfurt `eu-central-1`) und ein **eigenes GitHub-Repo**. Keine gemeinsame Datenbank mit der Fußball-App.

---

## Schritt 2 – Anforderungen analysieren

### Wer benutzt die App?

| Rolle | Wer | Darf |
|---|---|---|
| **Coach** | du | Athletinnen/Athleten einladen, Anamnese lesen, Pläne erstellen und ändern, alle Trainingsdaten der eigenen Athleten sehen, Evaluationen durchführen |
| **Athlet/Athletin** | Freunde und Bekannte | nur eigene Daten sehen, eigene Anamnese ausfüllen, Training eintragen, Check-ins abgeben, eigene Daten exportieren und löschen lassen |

Es gibt **keine** öffentliche Registrierung. Man kommt nur per Einladung vom Coach hinein.

### Fachliche Kernanforderungen

1. **Vorgabe und Leistung sind zwei verschiedene Dinge.** Der Plan sagt z. B. „3 × 8 bei 60 kg, RIR 2“. Eingetragen wird, was wirklich passiert ist, z. B. „8 / 8 / 6 bei 60 kg, RIR 1 / 0 / 0“. Beides wird getrennt gespeichert.
2. **Die Trainingshistorie bleibt unverändert.** Wird ein Plan geändert, entsteht eine **neue Planversion**. Alte Einheiten zeigen weiterhin auf die alte Version. Zusätzlich speichert jede durchgeführte Einheit eine Kopie der damaligen Vorgabe.
3. **1RM ist eine Schätzung.** Überall steht „geschätztes 1RM (e1RM)“ und die benutzte Formel. Die Formel ist austauschbar (Einstellung beim Coach). Ein echter Maximaltest wird getrennt als „getestet“ gespeichert.
4. **RIR ist eine subjektive Angabe.** Die Oberfläche kennzeichnet RIR als „Selbsteinschätzung“. Auswertungen mit RIR werden entsprechend beschriftet.
5. **Evaluationen:** Anfänger nach **4 Wochen oder 10 Einheiten – je nachdem, was zuerst eintritt**. Für Fortgeschrittene und Sehr Erfahrene stellt der Coach die Werte selbst ein. Die App **meldet nur**, dass eine Evaluation fällig ist. Sie **ändert nie selbst einen Plan**.
6. **Wöchentliche Check-ins** (z. B. Schlaf, Stress, Energie, Muskelkater, Motivation, Beschwerden, Notiz).
7. **Internes Benachrichtigungssystem** (Glocke mit Liste in der App). **Keine Push-Nachricht pro absolvierter Einheit.** Der Coach sieht stattdessen eine Zusammenfassung („3 neue Einheiten seit gestern“).
8. **Gesundheitsdaten** (Anamnese, Verletzungen, Beschwerden, Schmerzangaben) liegen **getrennt** von den Trainingsdaten und haben eigene, strengere Zugriffsregeln (RLS).
9. **DSGVO:** Gesundheitsdaten sind „besondere Kategorien“ (Art. 9 DSGVO). Dafür braucht es eine **ausdrückliche, widerrufbare Einwilligung**, Datensparsamkeit, Export- und Löschmöglichkeit. Ich behandle das Projekt so, als würde die DSGVO voll gelten. (Das ist keine Rechtsberatung.)
10. **Keine Diagnosen.** Die App sammelt Angaben und zeigt sie an. Sie bewertet nicht medizinisch, schlägt keine Behandlung vor und zieht keine Schlüsse wie „Verdacht auf …“.
11. **Erweiterbar:** Später kommen Ausdauer, Intervalle, Reha, Athletik, Mobilität und Biomechanik dazu. Das Datenmodell muss das jetzt schon vorsehen, ohne dass Version 1 kompliziert wird.

### Nicht-fachliche Anforderungen

- Läuft gut auf dem **Handy** (Training im Studio) und auf dem PC (Planerstellung).
- Komplett **deutsche** Oberfläche.
- **Keine Geheimnisse im Repo.** Schlüssel nur im Supabase Vault bzw. in Supabase-Einstellungen. Passwörter und API-Schlüssel gibst du selbst ein.
- Kleine Nutzerzahl (privat). Kostenlose Tarife sollen reichen.

---

## Schritt 3 – Technische Architektur

### Bausteine

| Baustein | Wahl | Warum |
|---|---|---|
| Sprache | **TypeScript** | wie gewünscht; Fehler fallen früher auf |
| Oberfläche | **React mit Next.js** (App Router), **Tailwind CSS** | wie gewünscht |
| Datenbank | **PostgreSQL in Supabase** | wie gewünscht; du kennst Supabase schon |
| Anmeldung | **Supabase Auth mit Magic-Link/Code per E-Mail**, Versand über GMX-SMTP | kennst du aus der Fußball-App; keine Passwörter für die Athleten |
| Rechte | **Row Level Security (RLS) auf jeder Tabelle** | die Datenbank selbst schützt die Daten, nicht nur die Oberfläche |
| Hintergrundaufgaben | **Supabase Edge Functions + pg_cron** | z. B. Evaluation fällig prüfen, Tageszusammenfassung erstellen |
| Dateien (später Videos für Biomechanik) | **Supabase Storage, privater Bucket** | mit eigenen Zugriffsregeln |
| Hosting der Oberfläche | **Vorschlag: GitHub Pages** (wie bisher) | siehe unten und Frage 2 |
| App aufs Handy | **PWA** (zum Startbildschirm hinzufügen) | keine App-Stores nötig |

### Eine bewusste Abweichung (mit Begründung)

Next.js kann eigentlich auch Code auf einem Server ausführen. **GitHub Pages kann aber nur fertige Dateien ausliefern.** Ich schlage deshalb vor, Next.js im Modus **„statischer Export“** zu benutzen:

- Die ganze Sicherheit liegt dann in der Datenbank (RLS) und in wenigen Datenbankfunktionen. Das ist bei Gesundheitsdaten ohnehin der sicherere Weg, weil kein Fehler in der Oberfläche die Rechte umgehen kann.
- Alles, was wirklich einen Server braucht (E-Mails, geplante Prüfungen), läuft als Supabase Edge Function.
- Nachteil: Seiten-Adressen sehen etwas schlichter aus (z. B. `/athlet?id=…` statt `/athlet/123`). Für eine private App ist das egal.

Alternative wäre **Vercel** (kostenloser Tarif, voller Next.js-Funktionsumfang). Das bedeutet aber ein weiteres Konto und einen weiteren Anbieter, der Daten weiterleitet. Ich empfehle GitHub Pages.

### Wie die Teile zusammenspielen

```
 Handy / PC (Browser, PWA)
        │  Next.js-Oberfläche (statische Dateien von GitHub Pages)
        │
        ▼
 Supabase (Frankfurt)
   ├─ Auth: Magic-Link / Code per E-Mail (GMX-SMTP)
   ├─ PostgreSQL
   │    ├─ Schema "public"      → Profile, Übungen, Pläne, Trainingsdaten, Check-ins …
   │    └─ Schema "gesundheit"  → Anamnese, Beschwerden, Körperdaten (strengere RLS)
   ├─ Datenbankfunktionen (z. B. Plan veröffentlichen, e1RM berechnen, Einladung annehmen)
   ├─ pg_cron  → einmal täglich: Evaluationen fällig? Check-in-Erinnerung? Zusammenfassung?
   ├─ Edge Functions → E-Mail-Einladungen, später optional Push
   └─ Vault → alle Geheimnisse (SMTP-Passwort, später Push-Schlüssel)
```

### Datenschutz-Technik

- **Region Frankfurt** für das Supabase-Projekt.
- **Auftragsverarbeitungsvertrag (AVV/DPA) mit Supabase** abschließen (geht im Supabase-Dashboard).
- **Einwilligung vor dem ersten Gesundheitsfeld:** Ohne gültige Einwilligung lässt die Datenbank keine Gesundheitsdaten zu (RLS prüft das).
- **Widerruf:** Nach Widerruf sieht der Coach die Gesundheitsdaten nicht mehr. Löschen erfolgt auf Wunsch vollständig.
- **Protokoll (Audit-Log):** Wer hat wann Gesundheitsdaten geändert oder gelöscht.
- **Export:** Athlet kann alle eigenen Daten als Datei herunterladen.
- **Keine Gesundheitsdaten in Benachrichtigungen, E-Mails oder Adresszeilen.** Benachrichtigungen sagen nur „Neuer Check-in von Anna“, nicht den Inhalt.

### Tests

- **RLS-Prüfskripte in SQL** (wie `supabase-phase8a-test.sql` in deinem Fußball-Projekt): Sie spielen „Coach“, „Athlet A“, „Athlet B“ und „Fremder“ durch und rollen am Ende alles zurück. Jede Phase bekommt ein eigenes Prüfskript.
- **Automatische Tests für Rechenlogik** (z. B. e1RM-Formeln, Evaluations-Fälligkeit) mit Vitest.
- **Klicktest im Browser** nach jedem Schritt; ich zeige dir Screenshots.

---

## Schritt 4 – Datenbankentwurf für Version 1

### Grundidee in drei Sätzen

1. Ein **Plan** hat mehrere **Versionen**. Eine veröffentlichte Version wird nie mehr verändert.
2. Eine **durchgeführte Einheit** zeigt auf die Planversion, nach der trainiert wurde, und speichert zusätzlich eine Kopie der Vorgabe.
3. Jede Übung und jede Vorgabe hat einen **Modul-Typ** (Kraft, Ausdauer, Intervall, Reha, Athletik, Mobilität, Biomechanik). Version 1 nutzt nur „Kraft“, die anderen Module passen später ohne Umbau hinein.

### Übersicht der Tabellen

**A) Personen und Rechte** (Schema `public`)

| Tabelle | Inhalt | Wichtige Felder |
|---|---|---|
| `profile` | eine Zeile pro angemeldeter Person | `id` (= Auth-Nutzer), `rolle` (coach/athlet), `anzeigename`, `erstellt_am` |
| `coach_athlet` | wer betreut wen | `coach_id`, `athlet_id`, `status` (eingeladen/aktiv/pausiert/beendet), `erfahrungsstufe` (anfaenger/fortgeschritten/sehr_erfahren), `start_am` |
| `einladungen` | offene Einladungen | `email`, `coach_id`, `code`, `gueltig_bis`, `angenommen_am` |
| `einwilligungen` | DSGVO-Einwilligungen | `athlet_id`, `art` (nutzung/gesundheitsdaten), `textversion`, `erteilt_am`, `widerrufen_am` |
| `athlet_stammdaten` | Trainingsrelevantes, **keine** Gesundheitsdaten | `athlet_id`, `geburtsjahr`, `trainingsalter_jahre`, `ziele` (Text + Auswahl), `verfuegbare_tage`, `ausstattung` |

**B) Gesundheitsdaten** (eigenes Schema `gesundheit`, strengere RLS)

| Tabelle | Inhalt | Wichtige Felder |
|---|---|---|
| `gesundheit.anamnese` | Erstanamnese, **versioniert** (jede Aktualisierung = neue Zeile) | `athlet_id`, `version`, `antworten` (strukturiert), `freitext`, `erstellt_am`, `erstellt_von` |
| `gesundheit.beschwerden` | Verletzungen und Einschränkungen mit Zeitraum | `athlet_id`, `koerperregion`, `beschreibung` (eigene Worte), `seit`, `bis`, `einschraenkung_fuer_training` |
| `gesundheit.koerperdaten` | Gewicht, Umfänge usw. | `athlet_id`, `datum`, `art`, `wert`, `einheit` |
| `gesundheit.checkin_gesundheit` | Gesundheitsteil des wöchentlichen Check-ins (Schmerzen, Beschwerden) | `checkin_id`, `schmerz_vorhanden`, `region`, `skala_0_10`, `notiz` |
| `gesundheit.zugriffsprotokoll` | Audit-Log | `wer`, `was`, `tabelle`, `zeile`, `zeitpunkt` |

Regeln: Lesen nur **Athlet selbst** und **sein aktiver Coach** – und das auch nur, solange eine **gültige Einwilligung** „gesundheitsdaten“ vorliegt. Löschen darf der Athlet selbst. Die App speichert **keine Diagnosen als Auswahlfeld**, sondern nur, was die Person selbst angibt.

**C) Übungsbibliothek**

| Tabelle | Inhalt | Wichtige Felder |
|---|---|---|
| `uebungen` | alle Übungen | `name`, `modul` (kraft/ausdauer/intervall/reha/athletik/mobilitaet/biomechanik), `bewegungsmuster` (z. B. Kniebeuge, Hüftstreckung, Drücken horizontal), `muskelgruppen`, `ausstattung`, `einseitig` (ja/nein), `messart` (wdh_last/zeit/distanz/…), `beschreibung`, `video_link`, `e1rm_geeignet` (ja/nein), `archiviert` |

Übungen werden nie gelöscht, nur archiviert – sonst würde alte Historie ins Leere zeigen.

**D) Trainingspläne (Vorgabe)**

| Tabelle | Inhalt | Wichtige Felder |
|---|---|---|
| `plaene` | „Rahmen“ eines Plans für eine Person | `athlet_id`, `coach_id`, `titel`, `ziel`, `status` (aktiv/archiviert) |
| `planversionen` | jede Fassung eines Plans | `plan_id`, `versionsnummer`, `status` (entwurf/veroeffentlicht/abgeloest), `gueltig_ab`, `aenderungsgrund`, `veroeffentlicht_am` |
| `plan_einheiten` | Trainingstage innerhalb einer Version | `planversion_id`, `name` (z. B. „Tag A – Unterkörper“), `reihenfolge` |
| `plan_uebungen` | Übungen eines Trainingstags | `plan_einheit_id`, `uebung_id`, `reihenfolge`, `gruppe` (für Supersätze), `hinweis` |
| `plan_saetze` | **die Vorgabe** pro Satz | `plan_uebung_id`, `satznummer`, `satztyp` (aufwaermen/arbeit/backoff/…), `wdh_min`, `wdh_max`, `last_kg`, `last_prozent_1rm`, `rir_ziel`, `tempo`, `pause_sek`, `dauer_sek`, `distanz_m`, `zusatz` (flexibel, für spätere Module) |

Schutz durch die Datenbank: Sobald eine Version „veröffentlicht“ ist, verhindert eine Regel (Trigger) jede Änderung an ihr und ihren Einheiten, Übungen und Sätzen. Ändern heißt: **Version kopieren → Entwurf bearbeiten → neu veröffentlichen**. Die alte Version wird „abgelöst“, bleibt aber erhalten.

**E) Training durchführen (tatsächliche Leistung)**

| Tabelle | Inhalt | Wichtige Felder |
|---|---|---|
| `trainingseinheiten` | eine durchgeführte Einheit | `athlet_id`, `planversion_id` (kann leer sein bei freiem Training), `plan_einheit_id`, `datum`, `status` (laeuft/abgeschlossen/abgebrochen), `session_rpe`, `dauer_min`, `notiz` |
| `ausgefuehrte_uebungen` | Übungen dieser Einheit | `trainingseinheit_id`, `uebung_id`, `plan_uebung_id` (falls geplant), `reihenfolge`, `ersetzt_durch_grund` |
| `ausgefuehrte_saetze` | **die tatsächliche Leistung** | `ausgefuehrte_uebung_id`, `plan_satz_id` (falls geplant), `vorgabe_kopie` (Kopie der damaligen Vorgabe), `wdh`, `last_kg`, `rir_selbsteinschaetzung`, `dauer_sek`, `distanz_m`, `erledigt`, `zusatz` |
| `korrekturprotokoll` | nachträgliche Änderungen an abgeschlossenen Einheiten | `tabelle`, `zeile`, `alt`, `neu`, `wer`, `wann` |

Abgeschlossene Einheiten können nachträglich korrigiert werden (Tippfehler passieren), aber jede Korrektur wird protokolliert.

**F) Auswertung**

| Tabelle / Funktion | Inhalt |
|---|---|
| `e1rm_formeln` | Liste der Formeln (z. B. Epley, Brzycki, RIR-angepasst) mit Gültigkeitsbereich (z. B. nur bis 10 Wiederholungen) |
| `coach_einstellungen` | gewählte Formel, Evaluationsregeln, Zusammenfassungs-Uhrzeit |
| Funktion `e1rm(last, wdh, rir, formel)` | berechnet die Schätzung **bei der Anzeige**. Gespeichert wird nur die echte Leistung. Wechselt der Coach die Formel, passen sich alle Diagramme an. |
| `maxtests` | echte, getestete Maximalwerte (getrennt von Schätzungen) |

**G) Coaching**

| Tabelle | Inhalt | Wichtige Felder |
|---|---|---|
| `evaluationsregeln` | je Erfahrungsstufe | `erfahrungsstufe`, `nach_wochen`, `nach_einheiten` (Anfänger fest: 4 / 10; die anderen einstellbar) |
| `evaluationen` | fällige und erledigte Evaluationen | `athlet_id`, `planversion_id`, `faellig_seit`, `ausloeser` (wochen/einheiten), `status` (faellig/erledigt/verschoben), `coach_notiz`, `entscheidung` (beibehalten/anpassen/…) |
| `checkins` | wöchentlicher Check-in (ohne Gesundheitsteil) | `athlet_id`, `kalenderwoche`, `schlaf_1_5`, `stress_1_5`, `energie_1_5`, `muskelkater_1_5`, `motivation_1_5`, `notiz`, `coach_antwort` |
| `benachrichtigungen` | interne Nachrichten (Glocke) | `empfaenger_id`, `art`, `bezug_tabelle`, `bezug_id`, `text_kurz` (ohne Gesundheitsinhalte), `erstellt_am`, `gelesen_am` |

Die Evaluationsprüfung läuft einmal täglich (pg_cron). Sie legt höchstens **eine** offene Evaluation pro Plan an und schreibt eine Benachrichtigung an den Coach. Sie ändert keinen Plan.

### Wie die späteren Module hineinpassen

| Modul | Was dazukommt | Was schon da ist |
|---|---|---|
| **Ausdauer** | neue Übungen mit `modul = ausdauer`, `messart = zeit/distanz`; Felder Herzfrequenzzone, Pace im Bereich `zusatz` | `dauer_sek`, `distanz_m` in Vorgabe und Leistung |
| **Intervalle** | Satztyp „belastung“ / „pause“, Wiederholungsblöcke über `gruppe` | Satz-Struktur, `pause_sek` |
| **Reha** | Übungen `modul = reha`, Schmerzangabe pro Übung im Schema `gesundheit` | getrennte Gesundheitsdaten, Einwilligung, Beschwerden |
| **Athletik** | neue Tabelle `leistungstests` (z. B. Sprint, Sprung, mit Wert und Einheit) | `maxtests`-Idee, Diagramme |
| **Mobilität** | Übungen `modul = mobilitaet`, Messart „Halten in Sekunden“ / „Bewegungsumfang in Grad“ | `dauer_sek`, `zusatz` |
| **Biomechanik** | Tabelle `analysen` mit Videos/Bildern im privaten Storage, Anmerkungen | Rechte-Modell, Storage-Regeln nach demselben Muster |

---

## Schritt 5 – Die wichtigsten Bildschirme

**Für alle**
1. Anmeldung (E-Mail eingeben → Code/Link)
2. Einladung annehmen + Einwilligungen (Nutzung, Gesundheitsdaten – getrennt anklickbar)
3. Benachrichtigungen (Glocke)
4. Profil & Datenschutz (Einwilligung ansehen/widerrufen, Daten exportieren, Löschung beantragen)

**Coach**
5. **Übersicht (Dashboard):** fällige Evaluationen, neue Check-ins, Zusammenfassung der letzten Einheiten
6. **Athletenliste** mit Status und Erfahrungsstufe, Button „Einladen“
7. **Athletenprofil** mit Reitern: Stammdaten · Anamnese · Beschwerden · Pläne · Verlauf · Check-ins · Evaluationen
8. **Übungsbibliothek** (suchen, filtern, anlegen, archivieren)
9. **Plan-Editor:** Trainingstage → Übungen → Sätze mit Vorgabe; „Entwurf speichern“ / „Veröffentlichen“
10. **Versionsverlauf eines Plans** mit Vergleich „was hat sich geändert“
11. **Evaluation durchführen:** Vorgabe vs. Leistung, e1RM-Verlauf, Check-ins des Zeitraums, Notiz und Entscheidung
12. **Einstellungen:** e1RM-Formel, Evaluationsregeln

**Athlet/Athletin**
13. **Heute / Mein Plan:** nächste Einheit, Button „Training starten“
14. **Training durchführen (Handy):** Satz für Satz, Vorgabe oben, Eingabe darunter (Wdh., kg, RIR), Pausentimer, Übung tauschen, Abschließen mit Session-RPE
15. **Erstanamnese ausfüllen** (Schritt-für-Schritt-Formular)
16. **Wöchentlicher Check-in**
17. **Mein Verlauf & Fortschritt:** Einheitenliste, Diagramme (Last, Volumen, geschätztes 1RM – klar als Schätzung beschriftet)

---

## Schritt 6 – Arbeit in kleine, testbare Schritte aufgeteilt

Nach **jedem** Schritt: ich teste, zeige dir das Ergebnis, fasse kurz zusammen und warte auf dein Okay.

### Phase 1 – Fundament
- 1.1 Projekt anlegen (Next.js, TypeScript, Tailwind), leere Startseite läuft lokal. *Test: Seite öffnet sich im Browser.*
- 1.2 Neues Supabase-Projekt anlegen (du klickst, ich leite an), AVV abschließen, GMX-SMTP eintragen (Passwort trägst du ein). *Test: Test-Mail kommt an.*
- 1.3 Anmeldung mit Code per E-Mail, öffentliche Registrierung aus. *Test: du meldest dich an, eine fremde Adresse kommt nicht hinein.*
- 1.4 Tabellen `profile`, `coach_athlet`, `einladungen`, `einwilligungen` + RLS + Prüfskript. *Test: Prüfskript meldet alle Fälle „ok“.*
- 1.5 Grundgerüst der Oberfläche (Menü Coach/Athlet, Handy-Ansicht), Veröffentlichung auf GitHub Pages. *Test: Seite online, auf dem Handy bedienbar.*

### Phase 2 – Personenverwaltung und Erstanamnese
- 2.1 Athlet einladen und Einladung annehmen. *Test: Testperson (zweite E-Mail-Adresse) kommt hinein, sieht nur sich selbst.*
- 2.2 Einwilligungs-Bildschirm mit Textversion. *Test: ohne Einwilligung keine Gesundheitseingabe möglich – auch nicht direkt über die Datenbank.*
- 2.3 Stammdaten und Erfahrungsstufe. *Test: Coach ändert Stufe, Athlet sieht sie.*
- 2.4 Schema `gesundheit` mit Anamnese (versioniert), Beschwerden, Audit-Log + RLS-Prüfskript. *Test: Athlet B sieht nichts von Athlet A; nach Widerruf sieht der Coach nichts mehr.*
- 2.5 Export und Löschung der eigenen Daten. *Test: Datei enthält alles; nach Löschung ist nichts mehr da.*

### Phase 3 – Übungsbibliothek und Plan-Editor mit Versionen
- 3.1 Übungsbibliothek (anlegen, suchen, archivieren) + Startbestand. *Test: Filter funktionieren, archivierte Übungen verschwinden aus der Auswahl.*
- 3.2 Plan anlegen mit Trainingstagen, Übungen, Sätzen (Entwurf). *Test: Plan wird gespeichert und wieder richtig geladen.*
- 3.3 Veröffentlichen und Sperre der veröffentlichten Version. *Test: Änderung an veröffentlichter Version wird von der Datenbank abgelehnt.*
- 3.4 Neue Version aus alter erstellen + Versionsvergleich. *Test: Unterschiede werden korrekt angezeigt.*
- 3.5 Athlet sieht seinen aktuellen Plan (nur lesen). *Test: Athlet kann nichts am Plan ändern.*

### Phase 4 – Training durchführen
- 4.1 Einheit starten, Vorgabe wird kopiert. *Test: Kopie stimmt mit Plan überein.*
- 4.2 Sätze eintragen (Wdh., kg, RIR als Selbsteinschätzung), Pausentimer. *Test am Handy: Eingabe flüssig, nichts geht verloren, wenn das Handy kurz gesperrt war.*
- 4.3 Übung tauschen / Zusatzsatz / freies Training ohne Plan. *Test: Verlauf zeigt Abweichung korrekt.*
- 4.4 Abschließen mit Session-RPE; Korrekturen protokolliert. *Test: Plan ändern → alte Einheit zeigt unverändert die alte Vorgabe.*
- 4.5 **Training ohne Internet:** Plan und laufende Einheit werden auf dem Handy zwischengespeichert. Sobald wieder Netz da ist, wird automatisch hochgeladen. Eine Anzeige zeigt „noch nicht hochgeladen“. *Test: Flugmodus an, komplette Einheit eintragen, Flugmodus aus → alles kommt vollständig und genau einmal in der Datenbank an.*

### Phase 5 – Fortschrittsanalyse
- 5.1 e1RM-Funktion mit austauschbarer Formel + automatische Tests. *Test: bekannte Rechenbeispiele stimmen; über Gültigkeitsbereich wird keine Schätzung angezeigt.*
- 5.2 Diagramme: Last, Volumen, e1RM (beschriftet als Schätzung), Vorgabe vs. Leistung. *Test: Zahlen stimmen mit Rohdaten überein.*
- 5.3 Echte Maximaltests getrennt erfassen. *Test: getestet und geschätzt sind klar unterscheidbar.*

### Phase 6 – Coaching und Evaluation
- 6.1 Wöchentlicher Check-in (mit getrenntem Gesundheitsteil). *Test: Gesundheitsteil nur mit Einwilligung sichtbar.*
- 6.2 Benachrichtigungen (Glocke), Tageszusammenfassung statt Einzelmeldungen. *Test: 3 Einheiten → 1 Zusammenfassung, keine Einzelmeldung.*
- 6.3 Evaluationsregeln + tägliche Prüfung. *Test mit Testdaten: Anfänger nach 10 Einheiten in 3 Wochen → fällig; nach 4 Wochen mit 6 Einheiten → fällig; keine doppelten Evaluationen; kein Plan wird verändert.*
- 6.4 Evaluations-Bildschirm mit Notiz und Entscheidung. *Test: Entscheidung „anpassen“ öffnet nur den Editor für eine neue Version – sonst passiert nichts automatisch.*

---

## Schritt 7 – So gehe ich vor (in einfachen Worten)

1. **Erst das Fundament, dann die Inhalte.** Zuerst sorge ich dafür, dass nur eingeladene Personen in die App kommen und jede Person nur das sieht, was sie sehen darf. Erst danach kommen Pläne und Training.
2. **Die Datenbank passt selbst auf.** Die Rechte stehen nicht nur in der Oberfläche, sondern direkt in der Datenbank. Selbst wenn jemand die App „austrickst“, kommt er nicht an fremde Daten.
3. **Gesundheitsdaten bekommen einen eigenen, abgeschlossenen Bereich.** Dort kommt man nur mit Einwilligung hinein, jeder Zugriff wird protokolliert.
4. **Was einmal trainiert wurde, bleibt so.** Ändert sich ein Plan, entsteht eine neue Version. Die alte bleibt im Archiv. So kannst du später genau sehen, wer nach welcher Vorgabe was geschafft hat.
5. **Die App rechnet, aber entscheidet nicht.** Sie schätzt das 1RM (und sagt dazu, dass es eine Schätzung ist) und erinnert dich an Evaluationen. Ob und wie ein Plan geändert wird, entscheidest immer du.
6. **Kleine Schritte.** Jeder Schritt dauert überschaubar lange und lässt sich einzeln ausprobieren. Ich teste selbst, zeige dir das Ergebnis und warte auf dein Okay. Hochgeladen wird erst nach deiner Freigabe.
7. **Du behältst die Schlüssel.** Passwörter, SMTP-Zugang und Schlüssel trägst du selbst ein. Ich sage dir genau, wo du klicken musst. Nichts Geheimes landet im Repo.
8. **Die Fußball-App bleibt unberührt.** Eigener Ordner, eigenes Repo, eigenes Supabase-Projekt.

**Hinweis zu Supabase kostenlos:** Im kostenlosen Tarif sind zwei aktive Projekte erlaubt. Mit der Fußball-App und dieser App wären das genau zwei. Kostenlose Projekte werden nach ca. einer Woche ohne Nutzung pausiert und lassen sich im Dashboard wieder starten. Bei regelmäßigem Training passiert das praktisch nicht.

---

## Schritt 8 – Offene Fragen (nur das, was vor dem Start geklärt sein muss)

1. **Projektordner:** Ist der Ordner „Coaching App“ in den Dokumenten als Ort und Name in Ordnung? (Das Repo würde z. B. `coaching-app` heißen.)
2. **Hosting und Repo:** GitHub Pages mit **öffentlichem** Repo (wie bei der Fußball-App, Code sichtbar, aber keine Daten und keine Geheimnisse darin) – oder lieber ein **privates** Repo? Hinweis: GitHub Pages aus einem privaten Repo kostet bei GitHub Geld; dann wäre Vercel (kostenlos) die Alternative. Meine Empfehlung: öffentliches Repo + GitHub Pages.
3. **Training ohne Internet:** Hast du oder deine Athleten im Studio manchmal kein Netz? Wenn ja, baue ich in Phase 4 einen Zwischenspeicher auf dem Handy ein, der später nachlädt. Das macht Phase 4 etwas größer.
4. **Alter:** Sind alle Athletinnen und Athleten **mindestens 16 Jahre** alt? Bei Jüngeren müssten Eltern in die Gesundheitsdaten einwilligen. Das würde ich dann anders bauen.
5. **Nur du als Coach?** Oder soll später eine zweite Person (z. B. ein Co-Coach) Athleten betreuen können? Das Datenmodell kann das schon, die Frage ist nur, ob ich es in Version 1 sichtbar mache.
6. **E-Mail-Versand:** Sollen die Anmeldecodes über **dieselbe GMX-Adresse** verschickt werden wie bei der Fußball-App, oder hast du eine andere Adresse dafür?

**Was ich ohne Rückmeldung so mache (du kannst jederzeit widersprechen):**
- Evaluationsregeln vorbelegt: Anfänger 4 Wochen / 10 Einheiten (fest), Fortgeschrittene 6 Wochen / 16 Einheiten, Sehr Erfahrene 8 Wochen / 20 Einheiten (beide änderbar).
- Standard-Formel für das e1RM: Epley, nur bis 10 Wiederholungen; Brzycki als Alternative wählbar.
- Gewichte in kg, Oberfläche nur auf Deutsch.
- Startbestand von ca. 40–60 gängigen Kraftübungen, den du ergänzen kannst. Falls du möchtest, schaue ich mir dafür deine bisherigen Word-Pläne an – nur mit deinem Okay.
- Design: schlicht, gut lesbar am Handy, mit hellem und dunklem Modus. Wenn du Wunschfarben hast, sag Bescheid.

---

### Antworten (8. November 2026)

| Frage | Entscheidung | Folge für den Plan |
|---|---|---|
| 1. Projektordner | Ordner „Coaching App“ bleibt | Repo-Name: `coaching-app` |
| 2. Hosting | öffentliches Repo + GitHub Pages | keine Geheimnisse im Repo, alles im Supabase Vault |
| 3. Internet im Studio | fehlt manchmal | Offline-Zwischenspeicher als Schritt 4.5; Satz-Einträge bekommen eine eindeutige Kennung vom Handy, damit nichts doppelt hochgeladen wird |
| 4. Alter | alle mindestens 16 | Einwilligung geben die Personen selbst; keine Eltern-Einwilligung nötig |
| 5. Coaches | nur du | Version 1 zeigt nur einen Coach; Datenbank bleibt für mehrere Coaches offen |
| 6. E-Mail-Absender | dieselbe GMX-Adresse wie bei der Fußball-App | Du trägst das GMX-App-Passwort im neuen Supabase-Projekt selbst ein |

## Schritt 9 – Freigabe

**Ich warte jetzt auf deine Freigabe.** Bis dahin schreibe ich keinen Code und lege nichts in Supabase oder GitHub an.

Die sechs Fragen sind beantwortet (siehe Tabelle oben). Wenn du einverstanden bist, schreibe „Freigabe Phase 1“. Dann beginne ich mit Schritt 1.1.
