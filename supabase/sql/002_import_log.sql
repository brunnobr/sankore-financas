-- Checklist de extratos já importados — evita reimportar (retrabalho),
-- não é proteção contra duplicata (isso já é feito por hash_dedup em
-- transactions). Rode isso uma vez no SQL Editor do Supabase.

create table import_log (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) default auth.uid(),
  banco text not null,
  arquivo_nome text not null,
  competencia_inicio date,
  competencia_fim date,
  transacoes_importadas int not null default 0,
  transacoes_duplicadas int not null default 0,
  created_at timestamptz not null default now()
);

alter table import_log enable row level security;
create policy import_log_owner on import_log for all using (user_id = auth.uid()) with check (user_id = auth.uid());
