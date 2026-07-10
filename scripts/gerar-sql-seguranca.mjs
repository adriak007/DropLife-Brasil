#!/usr/bin/env node

/**
 * Gera supabase/hardening.sql — migração de segurança completa:
 *   1. valid_cities: todas as chaves de município extraídas do MAPAESTADOS.svg
 *      (mesma lógica de chave do jogo: keyFor(cleanCity(nome), UF))
 *   2. RLS + grants de coluna em births/profiles
 *   3. Trigger de validação + rate limit em births
 *   4. Recontagem automática de total_births
 *
 * Uso: node scripts/gerar-sql-seguranca.mjs
 * Depois: cole supabase/hardening.sql no SQL Editor do Supabase e execute.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SVG_FILE = path.join(__dirname, '../public/MAPAESTADOS.svg');
const OUT_FILE = path.join(__dirname, '../supabase/hardening.sql');

const UFS = new Set([
  'AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG',
  'PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO',
]);

// Réplicas exatas de lib/text.ts (normalize, cleanCity, keyFor)
const normalize = (value = '') =>
  value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]/gi, '')
    .toLowerCase();

const cleanCity = (city) => city.replace(/\s+\d+$/, '').trim();

const keyFor = (city, state) => `${normalize(city)}-${normalize(state)}`;

const svg = fs.readFileSync(SVG_FILE, 'utf-8');
const keys = new Set();
for (const match of svg.matchAll(/data-name="([^"]*)"/g)) {
  const rawName = match[1];
  const [cidadeRaw = '', ufRaw = ''] = rawName.split(',').map((s) => s.trim());
  const cidade = cleanCity(cidadeRaw);
  const uf = ufRaw.toUpperCase();
  if (!cidade || !UFS.has(uf)) continue;
  keys.add(keyFor(cidade, uf));
}

if (keys.size < 5000) {
  console.error(`❌ Só ${keys.size} chaves extraídas — algo errado com o SVG. Abortando.`);
  process.exit(1);
}

const sorted = [...keys].sort();
const values = sorted.map((k) => `('${k.replace(/'/g, "''")}')`).join(',\n  ');

const sql = `-- ════════════════════════════════════════════════════════════════════
-- DropLife Brasil — migração de segurança (gerada por gerar-sql-seguranca.mjs)
-- Cole este arquivo inteiro no SQL Editor do Supabase e execute uma vez.
-- Idempotente: pode rodar de novo sem quebrar nada.
-- ════════════════════════════════════════════════════════════════════

-- ── 1. Cidades válidas (${sorted.length} chaves extraídas do mapa oficial) ──
create table if not exists public.valid_cities (key text primary key);
alter table public.valid_cities enable row level security;
-- sem policies e sem grants: a API pública não lê nem escreve; só os
-- triggers (security definer) enxergam esta tabela.
revoke all on table public.valid_cities from anon, authenticated;

truncate public.valid_cities;
insert into public.valid_cities (key) values
  ${values};

-- ── 2. births: estrutura mínima garantida ──
alter table public.births add column if not exists created_at timestamptz not null default now();

do $$ begin
  alter table public.births add constraint births_user_city_unique unique (user_id, city_key);
exception when duplicate_table or duplicate_object then null; end $$;

create index if not exists births_user_created_idx on public.births (user_id, created_at desc);

-- ── 3. births: RLS do zero (remove policies antigas e recria o conjunto certo) ──
alter table public.births enable row level security;

do $$
declare pol record;
begin
  for pol in select policyname from pg_policies
    where schemaname = 'public' and tablename = 'births'
  loop
    execute format('drop policy %I on public.births', pol.policyname);
  end loop;
end $$;

create policy "insere apenas o proprio nascimento" on public.births
  for insert to authenticated
  with check (auth.uid() = user_id);

create policy "le apenas os proprios nascimentos" on public.births
  for select to authenticated
  using (auth.uid() = user_id);

-- Grants de coluna: o cliente só fornece user_id e city_key.
-- created_at fica fora do alcance (impossível forjar data para burlar o rate limit).
revoke all on table public.births from anon, authenticated;
grant select on table public.births to authenticated;
grant insert (user_id, city_key) on table public.births to authenticated;

-- ── 4. births: validação + rate limit no banco ──
create or replace function public.births_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  last_at timestamptz;
  recent_count int;
begin
  -- cidade precisa existir no mapa oficial do jogo
  if not exists (select 1 from public.valid_cities vc where vc.key = new.city_key) then
    raise exception 'cidade_invalida';
  end if;

  -- banido não pontua (reforço do que a policy restritiva já faz)
  if exists (
    select 1 from public.profiles p
    where p.id = new.user_id
      and p.banned and (p.banned_until is null or p.banned_until > now())
  ) then
    raise exception 'conta_banida';
  end if;

  -- intervalo mínimo entre nascimentos (o jogo tem cooldown de 1,5s;
  -- 1,2s dá folga para variação de rede sem liberar spam)
  select max(created_at) into last_at
    from public.births where user_id = new.user_id;
  if last_at is not null and now() - last_at < interval '1.2 seconds' then
    raise exception 'rate_limit_intervalo';
  end if;

  -- teto por hora: humanamente impossível passar disso jogando
  select count(*) into recent_count
    from public.births
    where user_id = new.user_id and created_at > now() - interval '1 hour';
  if recent_count >= 1500 then
    raise exception 'rate_limit_hora';
  end if;

  return new;
end;
$$;

drop trigger if exists births_guard on public.births;
create trigger births_guard before insert on public.births
  for each row execute function public.births_guard();

-- ── 5. total_births: recontado pelo banco (cliente não consegue inflar) ──
-- Nome com prefixo zz_ para rodar por último (ordem alfabética de triggers):
-- mesmo que exista outro trigger de incremento, a recontagem prevalece.
create or replace function public.recount_total_births()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare uid uuid;
begin
  uid := coalesce(new.user_id, old.user_id);
  update public.profiles
    set total_births = (select count(*) from public.births b where b.user_id = uid)
    where id = uid;
  return coalesce(new, old);
end;
$$;

drop trigger if exists zz_recount_total_births on public.births;
create trigger zz_recount_total_births after insert or delete on public.births
  for each row execute function public.recount_total_births();

-- ── 6. profiles: RLS do zero + grants de coluna ──
alter table public.profiles enable row level security;

do $$
declare pol record;
begin
  for pol in select policyname from pg_policies
    where schemaname = 'public' and tablename = 'profiles'
  loop
    execute format('drop policy %I on public.profiles', pol.policyname);
  end loop;
end $$;

-- ranking é público: todo mundo lê perfis
create policy "perfis sao publicos" on public.profiles
  for select to anon, authenticated
  using (true);

create policy "cria o proprio perfil" on public.profiles
  for insert to authenticated
  with check (id = auth.uid());

create policy "edita o proprio perfil" on public.profiles
  for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- Grants de coluna: o cliente cria/edita SÓ o apelido.
-- total_births, banned e banned_until ficam fora do alcance da API pública
-- (adeus "update profiles set total_births = 999999" pelo console).
revoke all on table public.profiles from anon, authenticated;
grant select on table public.profiles to anon, authenticated;
grant insert (id, nickname) on table public.profiles to authenticated;
grant update (nickname) on table public.profiles to authenticated;

-- apelido com tamanho decente também no servidor
do $$ begin
  alter table public.profiles add constraint profiles_nickname_len
    check (char_length(nickname) between 2 and 20) not valid;
exception when duplicate_object then null; end $$;

-- ── 7. Ban continua valendo na escrita (recriada aqui pois o passo 3 limpou tudo) ──
create policy "banidos nao registram nascimento" on public.births
  as restrictive for insert to authenticated
  with check (
    coalesce(
      (select not (p.banned and (p.banned_until is null or p.banned_until > now()))
         from public.profiles p where p.id = auth.uid()),
      false
    )
  );
`;

fs.mkdirSync(path.dirname(OUT_FILE), { recursive: true });
fs.writeFileSync(OUT_FILE, sql);
console.log(`✅ ${OUT_FILE}`);
console.log(`   ${sorted.length} cidades válidas | ${(sql.length / 1024).toFixed(0)} KB de SQL`);
console.log('   Amostra:', sorted.slice(0, 3).join(', '), '...', sorted[sorted.length - 1]);
