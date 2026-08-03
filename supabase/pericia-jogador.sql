-- ════════════════════════════════════════════════════════════════════
-- DropLife Brasil — perícia de ritmo de jogo (SOMENTE LEITURA)
--
-- Objetivo: distinguir grind humano de automação olhando o INTERVALO
-- entre nascimentos consecutivos. O jogo trava o botão por 2,6 s no
-- cliente (era 1,5 s antes da roleta) e o banco exige 1,2 s. Então:
--   • intervalos MUITO regulares e colados no mínimo  -> cheiro de script
--   • intervalos irregulares, com pausas e madrugadas vazias -> humano
--
-- Nenhuma consulta aqui altera dados. Rode a 0 e a 1 e me mande a saída.
-- ════════════════════════════════════════════════════════════════════


-- ── 0) Qual coluna de tempo é confiável? ──────────────────────────────
-- IMPORTANTE: hardening.sql criou created_at com "default now()". Se ela
-- foi adicionada DEPOIS de já existirem nascimentos, todas as linhas
-- antigas receberam o MESMO horário (o do momento da migração) e vão
-- parecer uma rajada instantânea — falso positivo clássico. A coluna
-- born_at (do schema original) guarda o horário verdadeiro. Esta consulta
-- diz quais colunas existem e se elas divergem.
select
  (select string_agg(column_name, ', ' order by ordinal_position)
     from information_schema.columns
    where table_schema = 'public' and table_name = 'births') as colunas_de_births,
  (select count(*) from public.births)                        as total_nascimentos,
  (select count(*) from information_schema.columns
    where table_schema='public' and table_name='births' and column_name='born_at') as tem_born_at,
  (select count(*) from information_schema.columns
    where table_schema='public' and table_name='births' and column_name='created_at') as tem_created_at;


-- ── 1) Ritmo do TOP 5 (o investigado + base de comparação) ────────────
-- Sem uma linha de base não dá para dizer o que é "normal" neste jogo,
-- por isso os 5 primeiros entram juntos.
--
-- Se a consulta 0 disser que born_at NÃO existe, troque "coalesce(b.born_at,
-- b.created_at)" por "b.created_at" nas duas ocorrências abaixo.
with alvo as (
  select p.id, p.nickname, p.total_births
  from public.profiles p
  where p.total_births > 0 and coalesce(p.banned, false) = false
  order by p.total_births desc
  limit 5
),
seq as (
  select
    a.nickname,
    coalesce(b.born_at, b.created_at) as t,
    lag(coalesce(b.born_at, b.created_at))
      over (partition by b.user_id order by coalesce(b.born_at, b.created_at)) as anterior
  from public.births b
  join alvo a on a.id = b.user_id
),
gaps as (
  select nickname, t, extract(epoch from (t - anterior)) as dt
  from seq
)
select
  nickname,
  count(*)                                          as nascimentos,
  min(t)::date                                      as primeiro_dia,
  max(t)::date                                      as ultimo_dia,
  count(distinct t::date)                           as dias_ativos,
  round((extract(epoch from (max(t) - min(t))) / 3600.0)::numeric, 1) as horas_entre_1o_e_ultimo,
  count(distinct date_trunc('hour', t))             as horas_distintas_com_jogo,
  -- distribuição dos intervalos
  round((percentile_cont(0.5) within group (order by dt))::numeric, 2) as mediana_s,
  round(avg(dt)::numeric, 2)                        as media_s,
  round(stddev_samp(dt)::numeric, 2)                as desvio_padrao_s,
  count(*) filter (where dt < 1.5)                  as int_abaixo_1_5s,
  count(*) filter (where dt >= 1.5 and dt < 2.6)    as int_1_5_a_2_6s,
  count(*) filter (where dt >= 2.6 and dt < 3.5)    as int_2_6_a_3_5s,
  count(*) filter (where dt >= 3.5 and dt < 10)     as int_3_5_a_10s,
  count(*) filter (where dt >= 10 and dt < 300)     as int_10s_a_5min,
  count(*) filter (where dt >= 300)                 as int_acima_5min
from gaps
group by nickname
order by nascimentos desc;


-- ── 2) O jogador dorme? (nascimentos por hora do dia) ─────────────────
-- Humano tem madrugada vazia. Script distribui parelho pelas 24 h.
with alvo as (
  select p.id, p.nickname from public.profiles p
  where p.total_births > 0 and coalesce(p.banned, false) = false
  order by p.total_births desc limit 3
)
select
  a.nickname,
  extract(hour from (coalesce(b.born_at, b.created_at) at time zone 'America/Sao_Paulo')) as hora_brasilia,
  count(*) as nascimentos
from public.births b
join alvo a on a.id = b.user_id
group by a.nickname, hora_brasilia
order by a.nickname, hora_brasilia;


-- ── 3) Maior maratona sem pausa (janelas coladas) ─────────────────────
-- Agrupa nascimentos em "sessões": pausa acima de 2 minutos abre sessão
-- nova. Sessão de milhares de cliques sem NENHUMA pausa de 2 min é o
-- indício mais forte de automação.
with alvo as (
  select p.id, p.nickname from public.profiles p
  where p.total_births > 0 and coalesce(p.banned, false) = false
  order by p.total_births desc limit 3
),
seq as (
  select a.nickname, coalesce(b.born_at, b.created_at) as t,
         lag(coalesce(b.born_at, b.created_at))
           over (partition by b.user_id order by coalesce(b.born_at, b.created_at)) as anterior
  from public.births b join alvo a on a.id = b.user_id
),
marcado as (
  select nickname, t,
         sum(case when anterior is null
                   or extract(epoch from (t - anterior)) > 120 then 1 else 0 end)
           over (partition by nickname order by t) as sessao
  from seq
),
sessoes as (
  select nickname, sessao, count(*) as cliques,
         min(t) as inicio, max(t) as fim,
         round((extract(epoch from (max(t) - min(t))) / 60.0)::numeric, 1) as minutos
  from marcado group by nickname, sessao
)
select nickname, cliques, minutos, inicio, fim,
       round((cliques / nullif(minutos, 0))::numeric, 1) as cliques_por_minuto
from sessoes
where cliques > 50
order by cliques desc
limit 20;
