-- ════════════════════════════════════════════════════════════════════
-- DropLife Brasil — conferir e corrigir o contador do ranking
--
-- profiles.total_births é mantido pelo trigger zz_recount_total_births,
-- que só dispara em insert/delete de births. Linhas gravadas ANTES de o
-- trigger existir nunca provocaram recontagem, então o contador pode ter
-- ficado defasado em contas antigas. Estas consultas mostram e corrigem.
-- ════════════════════════════════════════════════════════════════════


-- ── 1) Onde o contador diverge da contagem real (só leitura) ──────────
select
  p.nickname,
  p.total_births                      as contador_do_ranking,
  count(b.id)                         as nascimentos_reais,
  p.total_births - count(b.id)        as diferenca
from public.profiles p
left join public.births b on b.user_id = p.id
group by p.id, p.nickname, p.total_births
having p.total_births <> count(b.id)
order by abs(p.total_births - count(b.id)) desc;


-- ── 2) Correção: recontar todo mundo a partir da tabela births ───────
-- Idempotente e seguro: só toca em quem está divergente, e a fonte é a
-- própria tabela de nascimentos (não dá para inflar por aqui).
update public.profiles p
set total_births = sub.n
from (
  select p2.id, count(b.id) as n
  from public.profiles p2
  left join public.births b on b.user_id = p2.id
  group by p2.id
) sub
where sub.id = p.id
  and p.total_births <> sub.n;


-- ── 3) Confere um jogador específico (troque o apelido) ──────────────
select
  p.nickname,
  p.total_births                              as contador_do_ranking,
  count(b.id)                                 as nascimentos_no_servidor,
  count(distinct b.city_key)                  as cidades_distintas,
  min(coalesce(b.born_at, b.created_at))      as primeiro,
  max(coalesce(b.born_at, b.created_at))      as ultimo
from public.profiles p
left join public.births b on b.user_id = p.id
where lower(p.nickname) = lower('Draak')
group by p.id, p.nickname, p.total_births;
