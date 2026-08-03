-- ════════════════════════════════════════════════════════════════════
-- DropLife Brasil — perfil público de jogador (rode UMA vez no SQL Editor)
--
-- O ranking passou a abrir o perfil de quem você clica. Só que a tabela
-- births é privada por RLS ("le apenas os proprios nascimentos"), então o
-- navegador NÃO consegue — e não deve — ler as cidades de outra pessoa.
--
-- Esta função roda como SECURITY DEFINER (ignora a RLS) mas devolve
-- exclusivamente AGREGADOS: contagem por estado, datas e posição. A lista
-- de cidades de ninguém sai daqui, e nenhum dado pessoal existe na tabela
-- profiles (só apelido, total e data de criação — e-mail mora em
-- auth.users, fora do alcance da API pública).
-- ════════════════════════════════════════════════════════════════════

create or replace function public.perfil_publico(p_nickname text)
returns jsonb
language sql
security definer
set search_path = public
stable
as $$
  with alvo as (
    select p.id, p.nickname, p.total_births, p.created_at
    from public.profiles p
    where lower(btrim(p.nickname)) = lower(btrim(p_nickname))
      and coalesce(p.banned, false) = false
    limit 1
  ),
  posicao as (
    -- quantos perfis ativos têm MAIS cidades que o alvo (+1 = colocação)
    select count(*) + 1 as pos
    from public.profiles p2
    where coalesce(p2.banned, false) = false
      and p2.total_births > coalesce((select total_births from alvo), -1)
  ),
  nasc as (
    -- a sigla do estado é o trecho depois do último hífen da chave
    -- ("saopaulo-sp" -> "sp"), do mesmo jeito que o cliente monta a chave
    select substring(b.city_key from '[^-]+$') as uf, b.created_at
    from public.births b
    where b.user_id = (select id from alvo)
  ),
  por_estado as (
    select uf, count(*)::int as n
    from nasc
    group by uf
  )
  select case
    when (select count(*) from alvo) = 0 then null::jsonb
    else jsonb_build_object(
      'nickname',            (select nickname from alvo),
      'total_births',        (select total_births from alvo),
      'membro_desde',        (select created_at from alvo),
      'posicao',             (select pos from posicao),
      'estados_distintos',   (select count(*) from por_estado),
      'primeiro_nascimento', (select min(created_at) from nasc),
      'ultimo_nascimento',   (select max(created_at) from nasc),
      'top_estados', coalesce(
        (select jsonb_agg(jsonb_build_object('uf', upper(uf), 'n', n) order by n desc, uf)
         from (select * from por_estado order by n desc, uf limit 6) t),
        '[]'::jsonb
      )
    )
  end;
$$;

-- Leitura pública: o ranking já é aberto, e a função só devolve agregados.
revoke all on function public.perfil_publico(text) from public;
grant execute on function public.perfil_publico(text) to anon, authenticated;
