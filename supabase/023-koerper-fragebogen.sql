-- =====================================================================
-- Coaching App · Phase 19 · Körpermännchen und eigener Anamnese-Fragebogen
-- Im SQL Editor EINMAL ausführen, nach 022-offene-punkte.sql.
--
-- * gesundheit.beschwerden bekommt "koerperstellen" (mehrere Stellen mit
--   links/rechts, vorne/hinten). Die alte Spalte koerperregion bleibt für
--   ältere Einträge und als Grobzuordnung erhalten.
-- * public.anamnese_frageboegen: Fragebogen-Fassungen des Coachs (nur anlegen,
--   nie ändern). Die neueste gilt für alle seine Kunden. Die Fragen sind keine
--   Gesundheitsdaten; die Antworten bleiben im geschützten Bereich und
--   merken sich, zu welcher Fassung sie gehören (anamnese.fragenversion).
-- =====================================================================

begin;

-- ---------------------------------------------------------------------
-- Körperstellen
-- ---------------------------------------------------------------------
alter table gesundheit.beschwerden
  add column koerperstellen text[] not null default '{}'
    check (koerperstellen <@ array[
      'kopf', 'brust', 'bauch', 'nacken', 'oberer_ruecken', 'unterer_ruecken',
      'schulter_links', 'schulter_rechts', 'oberarm_links', 'oberarm_rechts',
      'ellbogen_links', 'ellbogen_rechts', 'unterarm_links', 'unterarm_rechts',
      'hand_links', 'hand_rechts', 'huefte_links', 'huefte_rechts', 'leiste_links', 'leiste_rechts',
      'oberschenkel_vorne_links', 'oberschenkel_vorne_rechts', 'knie_links', 'knie_rechts',
      'schienbein_links', 'schienbein_rechts', 'sprunggelenk_links', 'sprunggelenk_rechts',
      'fuss_links', 'fuss_rechts', 'gesaess_links', 'gesaess_rechts',
      'oberschenkel_hinten_links', 'oberschenkel_hinten_rechts', 'wade_links', 'wade_rechts',
      'achillessehne_links', 'achillessehne_rechts', 'sonstiges'
    ]::text[] and cardinality(koerperstellen) <= 20);
grant insert (koerperstellen) on gesundheit.beschwerden to authenticated;
grant update (koerperstellen) on gesundheit.beschwerden to authenticated;

drop function public.beschwerden_liste(uuid);
create function public.beschwerden_liste(p_athlet uuid)
returns table (id uuid, koerperregion text, koerperstellen text[], beschreibung text, seit date, bis date, aktualisiert_am timestamptz)
language sql stable security invoker set search_path = '' as $$
  select b.id, b.koerperregion, b.koerperstellen, b.beschreibung, b.seit, b.bis, b.aktualisiert_am
  from gesundheit.beschwerden b
  where b.athlet_id = p_athlet
  order by (b.bis is null) desc, coalesce(b.seit, b.erstellt_am::date) desc;
$$;

create function public.beschwerde_speichern_stellen(
  p_id uuid, p_koerperregion text, p_koerperstellen text[], p_beschreibung text, p_seit date, p_bis date
)
returns uuid
language plpgsql volatile security invoker set search_path = '' as $$
declare
  ergebnis uuid;
begin
  if p_id is null then
    insert into gesundheit.beschwerden (koerperregion, koerperstellen, beschreibung, seit, bis)
    values (p_koerperregion, coalesce(p_koerperstellen, '{}'), coalesce(p_beschreibung, ''), p_seit, p_bis)
    returning id into ergebnis;
  else
    update gesundheit.beschwerden
    set koerperregion = p_koerperregion, koerperstellen = coalesce(p_koerperstellen, '{}'),
        beschreibung = coalesce(p_beschreibung, ''), seit = p_seit, bis = p_bis
    where id = p_id
    returning id into ergebnis;
    if ergebnis is null then
      raise exception 'Beschwerde nicht gefunden oder nicht erlaubt';
    end if;
  end if;
  return ergebnis;
end;
$$;

revoke all on function public.beschwerden_liste(uuid) from public, anon;
revoke all on function public.beschwerde_speichern_stellen(uuid, text, text[], text, date, date) from public, anon;
grant execute on function public.beschwerden_liste(uuid) to authenticated;
grant execute on function public.beschwerde_speichern_stellen(uuid, text, text[], text, date, date) to authenticated;

-- ---------------------------------------------------------------------
-- Fragebogen-Fassungen des Coachs
-- ---------------------------------------------------------------------
create table public.anamnese_frageboegen (
  id           uuid primary key default gen_random_uuid(),
  coach_id     uuid not null default auth.uid() references public.profile (id) on delete cascade,
  version      integer not null,
  fragen       jsonb not null check (jsonb_typeof(fragen) = 'array' and jsonb_array_length(fragen) between 1 and 60
                                     and octet_length(fragen::text) <= 60000),
  erstellt_am  timestamptz not null default now(),
  unique (coach_id, version)
);
comment on table public.anamnese_frageboegen is
  'Anamnese-Fragebogen des Coachs, je Fassung eine Zeile (unveränderlich). Die neueste gilt für alle Kunden.';

alter table public.anamnese_frageboegen enable row level security;
revoke all on public.anamnese_frageboegen from public, anon, authenticated;
grant select on public.anamnese_frageboegen to authenticated;

-- Lesen: der Coach selbst und seine Kunden (die den Fragebogen ausfüllen)
create policy frageboegen_lesen on public.anamnese_frageboegen for select to authenticated
  using (coach_id = (select auth.uid()) or intern.ist_mein_coach(coach_id));

-- Neue Fassung anlegen (Version wird hochgezählt)
create function public.fragebogen_speichern(p_fragen jsonb)
returns integer language plpgsql volatile security definer set search_path = '' as $$
declare
  v integer;
begin
  if not intern.ist_coach() then
    raise exception 'Nur der Coach kann den Fragebogen ändern.' using errcode = '42501';
  end if;
  select coalesce(max(version), 0) + 1 into v from public.anamnese_frageboegen where coach_id = (select auth.uid());
  insert into public.anamnese_frageboegen (coach_id, version, fragen) values ((select auth.uid()), v, p_fragen);
  return v;
end;
$$;
revoke all on function public.fragebogen_speichern(jsonb) from public, anon;
grant execute on function public.fragebogen_speichern(jsonb) to authenticated;

commit;

select 'eingerichtet' as ergebnis;
