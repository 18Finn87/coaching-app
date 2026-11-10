-- =====================================================================
-- Coaching App · Phase 8 · Mobilität
-- Im SQL Editor EINMAL ausführen, nach 010-module-grundlage.sql.
--
-- * Messart "umfang": Messwert in cm (z. B. Finger-Boden-Abstand)
-- * Übung: "kleiner_besser" (z. B. Abstand zum Boden: weniger ist besser)
-- * Ausgeführte Sätze: Spalte "messwert"
-- * Startbestand: 18 Mobilitätsübungen + 5 Messtests für jeden Coach
--   (vorhandene Namen werden nicht doppelt angelegt)
-- =====================================================================

begin;

-- Messart erweitern
do $$
declare
  c record;
begin
  for c in
    select conname from pg_constraint
    where conrelid = 'public.uebungen'::regclass and contype = 'c' and pg_get_constraintdef(oid) like '%messart%'
  loop
    execute format('alter table public.uebungen drop constraint %I', c.conname);
  end loop;
end $$;

alter table public.uebungen
  add constraint uebungen_messart_check
  check (messart in ('wdh_last', 'wdh', 'zeit', 'zeit_last', 'distanz', 'distanz_last', 'umfang'));

alter table public.uebungen
  add column kleiner_besser boolean not null default false;
comment on column public.uebungen.kleiner_besser is 'true = ein kleinerer Messwert ist besser (z. B. Abstand Finger–Boden).';
grant insert (kleiner_besser) on public.uebungen to authenticated;
grant update (kleiner_besser) on public.uebungen to authenticated;

alter table public.ausgefuehrte_saetze
  add column messwert numeric(7, 2) check (messwert between -1000 and 10000);
comment on column public.ausgefuehrte_saetze.messwert is 'Gemessener Wert bei Messtests (Einheit je nach Messart, z. B. cm).';
grant insert (messwert) on public.ausgefuehrte_saetze to authenticated;
grant update (messwert) on public.ausgefuehrte_saetze to authenticated;

-- ---------------------------------------------------------------------
-- Startbestand Mobilität
-- ---------------------------------------------------------------------
with liste (name, muster, geraet, seiten, messart, kleiner, text) as (
  values
  -- Halten (Sekunden)
  ('Kniender Hüftbeuger-Stretch', 'dehnen', array['matte'], true, 'zeit', false,
   'Kniestand, Becken leicht nach hinten kippen, Gesäß anspannen und die Hüfte nach vorn schieben. Rücken bleibt gerade.'),
  ('90/90-Hüftdehnung', 'dehnen', array['matte'], true, 'zeit', false,
   'Sitzen, vorderes und hinteres Bein je 90° gebeugt. Aufrecht über das vordere Schienbein nach vorn lehnen.'),
  ('Taubenhaltung', 'dehnen', array['matte'], true, 'zeit', false,
   'Vorderes Bein angewinkelt vor dem Körper, hinteres Bein lang. Becken gerade halten, Oberkörper langsam absenken.'),
  ('Wadendehnung an der Wand', 'dehnen', array[]::text[], true, 'zeit', false,
   'Hände an die Wand, hinteres Bein gestreckt, Ferse am Boden. Für die tiefe Wade das hintere Knie leicht beugen.'),
  ('Beinbeuger-Dehnung stehend', 'dehnen', array[]::text[], true, 'zeit', false,
   'Ferse auf eine Erhöhung, Bein gestreckt. Mit geradem Rücken aus der Hüfte nach vorn beugen.'),
  ('Brustdehnung im Türrahmen', 'dehnen', array[]::text[], true, 'zeit', false,
   'Unterarm in Schulterhöhe an den Türrahmen, Körper langsam vom Arm wegdrehen.'),
  ('Froschhaltung', 'dehnen', array['matte'], false, 'zeit', false,
   'Vierfüßlerstand, Knie weit auseinander, Unterschenkel parallel. Gesäß langsam nach hinten schieben.'),
  ('Lat-Dehnung an der Bank', 'dehnen', array['sonstiges'], false, 'zeit', false,
   'Kniend vor einer Bank, Ellbogen auf der Bank, Hände zusammen. Brust nach unten sinken lassen.'),
  ('Kindhaltung', 'dehnen', array['matte'], false, 'zeit', false,
   'Auf den Fersen sitzen, Arme lang nach vorn, Stirn Richtung Boden. Ruhig in den Rücken atmen.'),
  ('Tiefe Hocke halten', 'halten', array[]::text[], false, 'zeit', false,
   'Füße etwa schulterbreit, so tief wie möglich in die Hocke, Fersen bleiben am Boden. Bei Bedarf festhalten.'),
  -- Dynamisch (Wiederholungen)
  ('Katze-Kuh', 'mobilisieren', array['matte'], false, 'wdh', false,
   'Vierfüßlerstand. Im Wechsel den Rücken rund machen und ins Hohlkreuz gehen, Bewegung mit dem Atem.'),
  ('BWS-Rotation im Vierfüßlerstand', 'mobilisieren', array['matte'], true, 'wdh', false,
   'Vierfüßlerstand, eine Hand an den Hinterkopf. Ellbogen nach oben aufdrehen, Becken bleibt ruhig.'),
  ('Offenes Buch', 'mobilisieren', array['matte'], true, 'wdh', false,
   'Seitlage, Knie angewinkelt, Arme gestreckt vor der Brust. Oberen Arm wie eine Buchseite nach hinten öffnen.'),
  ('World''s Greatest Stretch', 'mobilisieren', array[]::text[], true, 'wdh', false,
   'Ausfallschritt, Hand innen neben den vorderen Fuß, Ellbogen Richtung Boden, dann Arm nach oben aufdrehen.'),
  ('Hüftkreisen im Vierfüßlerstand', 'mobilisieren', array['matte'], true, 'wdh', false,
   'Vierfüßlerstand, ein Knie langsam in einem möglichst großen Kreis bewegen. Rumpf bleibt stabil.'),
  ('Schulterkreisen mit Band', 'mobilisieren', array['baender'], false, 'wdh', false,
   'Band breit greifen, Arme gestreckt langsam über den Kopf nach hinten und zurück führen. Griff bei Bedarf weiter.'),
  ('Sprunggelenk-Mobilisation an der Wand', 'mobilisieren', array[]::text[], true, 'wdh', false,
   'Fuß vor die Wand, Knie über die Zehen Richtung Wand schieben, Ferse bleibt am Boden.'),
  ('Kosaken-Kniebeuge', 'mobilisieren', array[]::text[], true, 'wdh', false,
   'Breiter Stand, Gewicht zu einer Seite in die tiefe Hocke verlagern, anderes Bein gestreckt, Zehen nach oben.'),
  -- Messtests (cm)
  ('Messtest: Finger-Boden-Abstand', 'dehnen', array[]::text[], false, 'umfang', true,
   'Stehen, Beine gestreckt, langsam nach vorn beugen. Abstand Fingerspitzen–Boden in cm. Boden berührt = 0, weiter darunter (z. B. auf einer Stufe) = Minuswert. Kleiner ist besser.'),
  ('Messtest: Knie-zur-Wand', 'mobilisieren', array[]::text[], true, 'umfang', false,
   'Ferse am Boden, Knie berührt die Wand. Größter Abstand große Zehe–Wand in cm, bei dem das noch klappt. Größer ist besser.'),
  ('Messtest: Sitz-und-Reich', 'dehnen', array['sonstiges'], false, 'umfang', false,
   'Sitzen, Beine gestreckt, Fußsohlen an einer Kiste. Wie weit reichen die Finger über die Fußsohlen hinaus (cm, davor = Minuswert)? Größer ist besser.'),
  ('Messtest: Schulter-Reichweite hinter dem Rücken', 'mobilisieren', array[]::text[], true, 'umfang', true,
   'Eine Hand von oben, die andere von unten hinter den Rücken. Abstand zwischen den Fingerspitzen in cm (Überlappung = Minuswert). Seite = oberer Arm. Kleiner ist besser.'),
  ('Messtest: Tiefe Hocke Gesäß–Boden', 'halten', array[]::text[], false, 'umfang', true,
   'Tiefste Hocke mit Fersen am Boden. Abstand Gesäß–Boden in cm. Kleiner ist besser.')
)
insert into public.uebungen (coach_id, name, modul, bewegungsmuster, ausstattung, einseitig, seiten_getrennt,
                             messart, kleiner_besser, beschreibung)
select p.id, l.name, 'mobilitaet', l.muster, l.geraet, l.seiten, l.seiten, l.messart, l.kleiner, l.text
from liste l
cross join public.profile p
where p.rolle = 'coach'
on conflict do nothing;

commit;

select count(*) as mobilitaetsuebungen from public.uebungen where modul = 'mobilitaet';
