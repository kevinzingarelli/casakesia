-- ============================================================================
-- Casa Points — migrazione a più "case" (multi-tenant) con account veri
-- ============================================================================
-- DA ESEGUIRE A MANO nell'SQL Editor di Supabase. Non farlo eseguire a
-- Claude/un agente: un GRANT/RLS sbagliato ha già bloccato il login di
-- tutti una volta in un altro progetto — meglio farlo con calma, un pezzo
-- alla volta, e testare subito con un account VERO (non l'utente admin del
-- dashboard) dopo ogni fase.
--
-- COSA CAMBIA: oggi tutta l'app legge/scrive UNA riga sola ('main') nella
-- tabella household_data, accessibile pubblicamente con la chiave anonima.
-- Da qui in poi ogni coppia ("casa") ha la propria riga, protetta da Row
-- Level Security: solo chi ha fatto login ed è entrato in quella casa può
-- leggerla o scriverla.
--
-- STRUTTURA IN 2 FASI:
--
--   FASE 1 (sicura, additiva, non tocca nulla di esistente) — crea le
--     tabelle nuove (households, household_members) e le funzioni per
--     creare/unirsi a una casa. La riga 'main' con i dati veri di Kevin e
--     Asia resta esattamente come oggi, con le stesse policy pubbliche di
--     adesso: l'app attuale in produzione continua a funzionare invariata,
--     zero rischio.
--
--   FASE 2 (rompe il vecchio accesso pubblico — va fatta SOLO a cose
--     pronte) — collega la riga 'main' alla nuova casa di Kevin e Asia e
--     chiude l'accesso pubblico su household_data per sempre. Da questo
--     momento SOLO chi ha fatto login può leggere i dati: se il nuovo
--     codice dell'app coi login non è ancora online, l'app smette di
--     funzionare per tutti finché non lo pubblicate.
--
-- ORDINE CONSIGLIATO:
--   1. Esegui FASE 1 qui sotto (subito, sicuro).
--   2. Claude pubblica il nuovo codice dell'app (con login) — te lo dirà.
--   3. Tu e Asia vi registrate con la nuova schermata, ciascuno con la
--      propria email. Uno dei due preme "Crea una nuova casa" e manda il
--      codice all'altro, che preme "Ho un codice d'invito".
--   4. Esegui FASE 2 (in fondo a questo file), inserendo l'ID della casa
--      che avete appena creato.
--   5. Uscite e rientrate nell'app con le vostre vere email/password,
--      controllando che ci sia ancora tutto lo storico di sempre.
-- ============================================================================


-- ============================================================================
-- FASE 1 — sicura, eseguibile subito
-- ============================================================================

-- gen_random_uuid() è integrata in Postgres (Supabase gira su una versione
-- recente): non serve installare nessuna estensione a parte.

create table if not exists households (
  id uuid primary key default gen_random_uuid(),
  invite_code text unique not null,
  created_at timestamptz not null default now()
);

create table if not exists household_members (
  household_id uuid not null references households(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (household_id, user_id),
  unique (user_id)  -- un account sta in UNA sola casa
);

alter table households enable row level security;
alter table household_members enable row level security;

-- Funzione di appoggio: dà l'ID della casa dell'utente che ha fatto login
-- (o niente, se non ne ha ancora una). SECURITY DEFINER = legge
-- household_members "scavalcando" la sua stessa RLS — è il trucco per
-- evitare che le policy qui sotto interroghino la tabella su cui sono
-- definite (che con Postgres dà l'errore "infinite recursion detected in
-- policy": una policy che fa una sotto-query sulla propria tabella
-- riattiva sé stessa all'infinito).
create or replace function my_household_id()
returns uuid
language sql
security definer
stable
set search_path = public
as $$
  select household_id from household_members where user_id = auth.uid() limit 1;
$$;

revoke all on function my_household_id() from public;
grant execute on function my_household_id() to authenticated;

-- Ognuno vede solo la propria casa...
create policy "vedi la tua casa" on households
  for select using (id = my_household_id());

-- ...e i membri della propria casa (per sapere se il partner è già entrato).
-- "user_id = auth.uid()" da solo copre anche la primissima volta, prima
-- ancora di avere una casa (my_household_id() darebbe null e non
-- troverebbe righe, ma la tua riga la vedi comunque grazie a questa metà).
create policy "vedi i membri della tua casa" on household_members
  for select using (
    user_id = auth.uid()
    or household_id = my_household_id()
  );

-- Nessuna INSERT/UPDATE/DELETE diretta dei client su queste due tabelle:
-- passano tutte dalle funzioni qui sotto, che controllano le regole (una
-- casa = max 2 persone, un account = una casa sola) prima di scrivere.
-- SECURITY DEFINER = girano con permessi ampi ma SOLO quello scritto dentro,
-- quindi il controllo resta stretto (stesso principio delle Edge Function:
-- l'utente non tocca mai la tabella a mano).

create or replace function create_household()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  new_id uuid;
  code text;
begin
  if auth.uid() is null then
    raise exception 'Devi essere autenticato';
  end if;
  if exists (select 1 from household_members where user_id = auth.uid()) then
    raise exception 'Fai già parte di una casa';
  end if;

  code := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6));
  insert into households (invite_code) values (code) returning id into new_id;
  insert into household_members (household_id, user_id) values (new_id, auth.uid());

  -- Riga dati della nuova casa: vuota di proposito. L'app, al primo
  -- avvio, tratta una riga con value = {} esattamente come una casa
  -- nuova — ci mette da sola il catalogo lavori di serie, le 2 persone
  -- segnaposto ecc. (lo stesso codice usato oggi per la riga 'main'), e la
  -- scrive al primo salvataggio. Meglio così che duplicare qui a mano il
  -- catalogo lavori, che altrimenti andrebbe tenuto allineato in due posti.
  insert into household_data (id, value, updated_at) values (new_id::text, '{}'::jsonb, now());

  return jsonb_build_object('id', new_id, 'invite_code', code);
end;
$$;

revoke all on function create_household() from public;
grant execute on function create_household() to authenticated;


create or replace function join_household(p_code text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  target_id uuid;
  member_count int;
begin
  if auth.uid() is null then
    raise exception 'Devi essere autenticato';
  end if;
  if exists (select 1 from household_members where user_id = auth.uid()) then
    raise exception 'Fai già parte di una casa';
  end if;

  select id into target_id from households where invite_code = upper(trim(p_code));
  if target_id is null then
    raise exception 'Codice non valido';
  end if;

  select count(*) into member_count from household_members where household_id = target_id;
  if member_count >= 2 then
    raise exception 'Questa casa ha già due persone';
  end if;

  insert into household_members (household_id, user_id) values (target_id, auth.uid());
  return target_id;
end;
$$;

revoke all on function join_household(text) from public;
grant execute on function join_household(text) to authenticated;

-- Fine FASE 1. Da qui potete pubblicare il nuovo codice dell'app: chi si
-- registra da ora in poi passa da qui; la riga 'main' di Kevin e Asia non
-- è ancora toccata e continua a funzionare esattamente come prima.


-- ============================================================================
-- FASE 2 — da eseguire SOLO a cose pronte (leggere la premessa in cima al file)
-- ============================================================================
--
-- Prima di lanciare questa fase, verifica che siano vere ENTRAMBE le cose:
--   1. il nuovo codice dell'app (con login) è già online;
--   2. Kevin e Asia si sono già registrati con la nuova schermata e sono
--      entrati nella STESSA casa (uno crea, l'altro si unisce col codice).
--
-- Trova l'ID della casa che hanno creato con questa query di controllo
-- (sostituisce il bisogno di loggarti come loro):
--
--   select hm.household_id, u.email
--   from household_members hm
--   join auth.users u on u.id = hm.user_id
--   order by hm.household_id;
--
-- Controlla che ci siano ESATTAMENTE le due email di Kevin e Asia sulla
-- STESSA household_id, poi copia quella household_id e usala qui sotto al
-- posto di 'INCOLLA_QUI_ID_CASA' (senza toglierla dagli apici):

-- ATTENZIONE all'ordine di queste due istruzioni. Quando avete premuto
-- "Crea una nuova casa", la funzione create_household() ha già creato per
-- quella casa una riga dati VUOTA. Se provassimo a rinominare 'main' con
-- quell'id senza prima toglierla, Postgres rifiuterebbe tutto per chiave
-- duplicata. Quindi: prima si butta la riga vuota appena nata (non
-- contiene niente: '{}'), poi si rinomina quella vera.

-- 1) via la riga vuota creata dalla registrazione
delete from household_data
where id = 'INCOLLA_QUI_ID_CASA'
  and coalesce(value, '{}'::jsonb) = '{}'::jsonb;   -- salvagente: cancella SOLO se è davvero vuota

-- 2) la riga storica prende l'identità della vostra casa
update household_data set id = 'INCOLLA_QUI_ID_CASA' where id = 'main';

-- Questo rinomina la riga storica con tutti i punti/lavori/storico già
-- fatti: non copia né perde nulla, cambia solo la "chiave" con cui la si
-- trova. Se qualcosa va storto più sotto, si può sempre tornare indietro
-- con l'update opposto (id = 'main' where id = 'INCOLLA_QUI_ID_CASA').
--
-- Controllo di sicurezza: questa deve dire 266 (o comunque il numero di
-- voci che avete davvero in Storico), NON 0. Se dice 0 vi siete portati
-- dietro la riga vuota invece di quella vera: fermatevi e tornate indietro.
select jsonb_array_length(value->'log') as voci_storico_ritrovate
from household_data where id = 'INCOLLA_QUI_ID_CASA';

-- Ora chiude l'accesso pubblico su household_data e attiva quello vero,
-- per TUTTE le case (rimuove qualsiasi policy esistente, qualunque sia il
-- suo nome, così non serve saperlo in anticipo):
do $$
declare pol record;
begin
  for pol in select policyname from pg_policies where tablename = 'household_data' loop
    execute format('drop policy %I on household_data', pol.policyname);
  end loop;
end $$;

alter table household_data enable row level security;

create policy "leggi solo i dati della tua casa" on household_data
  for select using (id = my_household_id()::text);

create policy "scrivi solo i dati della tua casa" on household_data
  for update using (id = my_household_id()::text)
  with check (id = my_household_id()::text);

-- FATTO. Subito dopo, per la regola "mai fidarsi di un cambio RLS senza
-- testarlo con un utente vero non-admin": esci completamente dall'app (o
-- apri una scheda in incognito) e rientra prima come Kevin poi come Asia,
-- con le vostre vere email e password, controllando che i dati di sempre
-- ci siano ancora tutti — punti, storico, lavori personalizzati, regali.
