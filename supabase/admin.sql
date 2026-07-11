-- ════════════════════════════════════════════════════════════════════
-- DropLife Brasil — painel /admin (rode UMA vez no SQL Editor)
--
-- A página /admin é só interface: todo o poder mora nas funções abaixo
-- (SECURITY DEFINER), que verificam is_admin no servidor a cada chamada.
-- Quem não for admin recebe "nao_autorizado", não importa o que faça no
-- navegador.
-- ════════════════════════════════════════════════════════════════════

-- 1) Flag de administrador (só editável por aqui — a API pública não tem
--    grant de update nessa coluna)
alter table public.profiles add column if not exists is_admin boolean not null default false;

-- 2) Guarda comum: aborta se quem chama não é admin
create or replace function public.assert_admin()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.profiles p where p.id = auth.uid() and p.is_admin
  ) then
    raise exception 'nao_autorizado';
  end if;
end;
$$;

-- 3) Banir / desbanir (ate = null: permanente; com data: temporário)
create or replace function public.admin_set_ban(alvo uuid, banir boolean, ate timestamptz default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.assert_admin();
  update public.profiles set banned = banir, banned_until = ate where id = alvo;
end;
$$;

-- 4) Ajustar o número de cidades: mantém as `manter` mais ANTIGAS e apaga
--    o excedente (as mais recentes — normalmente as infladas). Só reduz:
--    inventar nascimentos não existe nem para admin. O total_births é
--    recontado automaticamente pelo trigger.
create or replace function public.admin_trim_births(alvo uuid, manter int)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  removidas int;
begin
  perform public.assert_admin();
  if manter < 0 then
    manter := 0;
  end if;
  with alem as (
    select city_key from public.births
    where user_id = alvo
    order by created_at asc
    offset manter
  )
  delete from public.births b
  using alem
  where b.user_id = alvo and b.city_key = alem.city_key;
  get diagnostics removidas = row_count;
  return removidas;
end;
$$;

-- 5) Aviso de moderação: o jogador vê a mensagem num modal ao abrir o jogo
--    (ex.: "pare de usar programas maliciosos ou será banido")
alter table public.profiles add column if not exists warning text;

create or replace function public.admin_set_warning(alvo uuid, mensagem text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.assert_admin();
  -- mensagem vazia remove o aviso
  update public.profiles set warning = nullif(trim(mensagem), '') where id = alvo;
end;
$$;

-- O próprio jogador confirma que viu o aviso (o jogo chama ao exibir o
-- modal) — só limpa o aviso DELE, nada mais.
create or replace function public.ack_warning()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.profiles set warning = null where id = auth.uid();
end;
$$;

revoke all on function public.assert_admin() from public;
revoke all on function public.admin_set_ban(uuid, boolean, timestamptz) from public;
revoke all on function public.admin_trim_births(uuid, int) from public;
revoke all on function public.admin_set_warning(uuid, text) from public;
revoke all on function public.ack_warning() from public;
grant execute on function public.admin_set_ban(uuid, boolean, timestamptz) to authenticated;
grant execute on function public.admin_trim_births(uuid, int) to authenticated;
grant execute on function public.admin_set_warning(uuid, text) to authenticated;
grant execute on function public.ack_warning() to authenticated;

-- 6) POR ÚLTIMO: torne a SUA conta admin (troque o apelido e descomente):
-- update public.profiles set is_admin = true where nickname = 'SeuApelido';
