-- =====================================================================
-- Coaching App · Schritt 3.1 · Startbestand der Übungsbibliothek
-- Nach 005-uebungen.sql EINMAL ausführen. Legt die Übungen für das
-- Coach-Konto an. Bereits vorhandene Namen werden übersprungen.
-- =====================================================================

begin;

with coach as (
  select id from public.profile where rolle = 'coach' order by erstellt_am limit 1
),
liste (name, muster, muskeln, geraet, einseitig, messart, e1rm) as (
  values
  -- Kniebeuge
  ('Kniebeuge (Langhantel)',            'kniebeuge',           '{quadrizeps,gesaess,adduktoren}',        '{langhantel}',      false, 'wdh_last', true),
  ('Frontkniebeuge',                    'kniebeuge',           '{quadrizeps,gesaess,bauch}',             '{langhantel}',      false, 'wdh_last', true),
  ('Goblet Squat',                      'kniebeuge',           '{quadrizeps,gesaess}',                   '{kurzhantel,kettlebell}', false, 'wdh_last', false),
  ('Beinpresse',                        'kniebeuge',           '{quadrizeps,gesaess}',                   '{maschine}',        false, 'wdh_last', true),
  ('Hackenschmidt-Kniebeuge',           'kniebeuge',           '{quadrizeps,gesaess}',                   '{maschine}',        false, 'wdh_last', false),
  ('Box Squat',                         'kniebeuge',           '{quadrizeps,gesaess,beinbeuger}',        '{langhantel}',      false, 'wdh_last', true),
  -- Ausfallschritt / einbeinig
  ('Bulgarian Split Squat',             'ausfallschritt',      '{quadrizeps,gesaess}',                   '{kurzhantel}',      true,  'wdh_last', false),
  ('Ausfallschritte gehend',            'ausfallschritt',      '{quadrizeps,gesaess}',                   '{kurzhantel}',      true,  'wdh_last', false),
  ('Ausfallschritt rückwärts',          'ausfallschritt',      '{quadrizeps,gesaess}',                   '{kurzhantel,langhantel}', true, 'wdh_last', false),
  ('Step-up',                           'ausfallschritt',      '{quadrizeps,gesaess}',                   '{kurzhantel}',      true,  'wdh_last', false),
  -- Hüftstreckung
  ('Kreuzheben',                        'hueftstreckung',      '{gesaess,beinbeuger,unterer_ruecken,ruecken_oben}', '{langhantel}', false, 'wdh_last', true),
  ('Sumo-Kreuzheben',                   'hueftstreckung',      '{gesaess,adduktoren,beinbeuger}',        '{langhantel}',      false, 'wdh_last', true),
  ('Rumänisches Kreuzheben',            'hueftstreckung',      '{beinbeuger,gesaess,unterer_ruecken}',   '{langhantel,kurzhantel}', false, 'wdh_last', true),
  ('Einbeiniges Rumänisches Kreuzheben','hueftstreckung',      '{beinbeuger,gesaess}',                   '{kurzhantel,kettlebell}', true, 'wdh_last', false),
  ('Hip Thrust',                        'hueftstreckung',      '{gesaess,beinbeuger}',                   '{langhantel}',      false, 'wdh_last', true),
  ('Glute Bridge',                      'hueftstreckung',      '{gesaess}',                              '{koerpergewicht,langhantel}', false, 'wdh_last', false),
  ('Kettlebell Swing',                  'hueftstreckung',      '{gesaess,beinbeuger}',                   '{kettlebell}',      false, 'wdh_last', false),
  ('Good Morning',                      'hueftstreckung',      '{beinbeuger,unterer_ruecken}',           '{langhantel}',      false, 'wdh_last', false),
  ('Rückenstrecker (Hyperextension)',   'hueftstreckung',      '{unterer_ruecken,gesaess}',              '{maschine,koerpergewicht}', false, 'wdh_last', false),
  ('Nordic Hamstring Curl',             'hueftstreckung',      '{beinbeuger}',                           '{koerpergewicht}',  false, 'wdh',      false),
  -- Drücken horizontal
  ('Bankdrücken (Langhantel)',          'druecken_horizontal', '{brust,trizeps,schultern}',              '{langhantel}',      false, 'wdh_last', true),
  ('Bankdrücken (Kurzhantel)',          'druecken_horizontal', '{brust,trizeps,schultern}',              '{kurzhantel}',      false, 'wdh_last', false),
  ('Schrägbankdrücken',                 'druecken_horizontal', '{brust,schultern,trizeps}',              '{langhantel,kurzhantel}', false, 'wdh_last', true),
  ('Liegestütz',                        'druecken_horizontal', '{brust,trizeps,schultern}',              '{koerpergewicht}',  false, 'wdh',      false),
  ('Dips',                              'druecken_horizontal', '{brust,trizeps}',                        '{koerpergewicht}',  false, 'wdh_last', false),
  ('Brustpresse (Maschine)',            'druecken_horizontal', '{brust,trizeps}',                        '{maschine}',        false, 'wdh_last', false),
  -- Drücken vertikal
  ('Schulterdrücken stehend (Langhantel)', 'druecken_vertikal', '{schultern,trizeps}',                   '{langhantel}',      false, 'wdh_last', true),
  ('Schulterdrücken sitzend (Kurzhantel)', 'druecken_vertikal', '{schultern,trizeps}',                   '{kurzhantel}',      false, 'wdh_last', false),
  ('Landmine Press',                    'druecken_vertikal',   '{schultern,brust,trizeps}',              '{langhantel}',      true,  'wdh_last', false),
  -- Ziehen horizontal
  ('Langhantelrudern',                  'ziehen_horizontal',   '{ruecken_oben,latissimus,bizeps}',       '{langhantel}',      false, 'wdh_last', true),
  ('Kurzhantelrudern einarmig',         'ziehen_horizontal',   '{latissimus,ruecken_oben,bizeps}',       '{kurzhantel}',      true,  'wdh_last', false),
  ('Kabelrudern sitzend',               'ziehen_horizontal',   '{ruecken_oben,latissimus,bizeps}',       '{kabelzug}',        false, 'wdh_last', false),
  ('Brustgestütztes Rudern',            'ziehen_horizontal',   '{ruecken_oben,latissimus}',              '{kurzhantel,maschine}', false, 'wdh_last', false),
  ('Face Pull',                         'ziehen_horizontal',   '{schultern,ruecken_oben}',               '{kabelzug,baender}', false, 'wdh_last', false),
  ('Inverted Row',                      'ziehen_horizontal',   '{ruecken_oben,latissimus,bizeps}',       '{koerpergewicht}',  false, 'wdh',      false),
  -- Ziehen vertikal
  ('Klimmzug',                          'ziehen_vertikal',     '{latissimus,bizeps,ruecken_oben}',       '{koerpergewicht}',  false, 'wdh_last', false),
  ('Chin-up (Untergriff)',              'ziehen_vertikal',     '{latissimus,bizeps}',                    '{koerpergewicht}',  false, 'wdh_last', false),
  ('Latzug',                            'ziehen_vertikal',     '{latissimus,bizeps}',                    '{kabelzug,maschine}', false, 'wdh_last', false),
  ('Latzug eng',                        'ziehen_vertikal',     '{latissimus,bizeps}',                    '{kabelzug}',        false, 'wdh_last', false),
  -- Isolation
  ('Seitheben',                         'isolation',           '{schultern}',                            '{kurzhantel,kabelzug}', false, 'wdh_last', false),
  ('Reverse Flys',                      'isolation',           '{schultern,ruecken_oben}',               '{kurzhantel,maschine}', false, 'wdh_last', false),
  ('Kabel-Fliegende',                   'isolation',           '{brust}',                                '{kabelzug}',        false, 'wdh_last', false),
  ('Bizepscurl (Kurzhantel)',           'isolation',           '{bizeps}',                               '{kurzhantel}',      false, 'wdh_last', false),
  ('Hammercurl',                        'isolation',           '{bizeps,unterarme}',                     '{kurzhantel}',      false, 'wdh_last', false),
  ('Trizepsdrücken am Kabel',           'isolation',           '{trizeps}',                              '{kabelzug}',        false, 'wdh_last', false),
  ('Beinstrecker',                      'isolation',           '{quadrizeps}',                           '{maschine}',        false, 'wdh_last', false),
  ('Beinbeuger liegend',                'isolation',           '{beinbeuger}',                           '{maschine}',        false, 'wdh_last', false),
  ('Beinbeuger sitzend',                'isolation',           '{beinbeuger}',                           '{maschine}',        false, 'wdh_last', false),
  ('Wadenheben stehend',                'isolation',           '{waden}',                                '{maschine,kurzhantel}', false, 'wdh_last', false),
  ('Adduktorenmaschine',                'isolation',           '{adduktoren}',                           '{maschine}',        false, 'wdh_last', false),
  -- Rumpf
  ('Unterarmstütz (Plank)',             'rumpf',               '{bauch}',                                '{koerpergewicht}',  false, 'zeit',     false),
  ('Seitstütz',                         'rumpf',               '{bauch}',                                '{koerpergewicht}',  true,  'zeit',     false),
  ('Pallof Press',                      'rumpf',               '{bauch}',                                '{kabelzug,baender}', true, 'wdh_last', false),
  ('Dead Bug',                          'rumpf',               '{bauch}',                                '{koerpergewicht}',  false, 'wdh',      false),
  ('Knieheben hängend',                 'rumpf',               '{bauch}',                                '{koerpergewicht}',  false, 'wdh',      false),
  ('Ab Wheel Rollout',                  'rumpf',               '{bauch}',                                '{sonstiges}',       false, 'wdh',      false),
  -- Tragen
  ('Farmer''s Walk',                    'tragen',              '{unterarme,ruecken_oben,bauch}',         '{kurzhantel,kettlebell}', false, 'distanz_last', false),
  ('Suitcase Carry',                    'tragen',              '{bauch,unterarme}',                      '{kurzhantel,kettlebell}', true, 'distanz_last', false)
)
insert into public.uebungen (coach_id, name, bewegungsmuster, muskelgruppen, ausstattung, einseitig, messart, e1rm_geeignet)
select coach.id, l.name, l.muster, l.muskeln::text[], l.geraet::text[], l.einseitig, l.messart, l.e1rm
from liste l cross join coach
on conflict (coach_id, lower(name)) do nothing;

commit;

select count(*) as uebungen_im_bestand from public.uebungen;
