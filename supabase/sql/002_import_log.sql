-- Checklist de extratos já importados, por banco + mês (competência) —
-- responde "o extrato de agosto/2026 do Banrisul já foi importado?"
-- de cara. Não é proteção contra duplicata (isso é hash_dedup em
-- transactions) — é só pra não perder tempo reimportando à toa.

create table import_log (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) default auth.uid(),
  banco text not null,
  competencia date not null,           -- primeiro dia do mês do extrato
  arquivo_nome text not null,
  transacoes_importadas int not null default 0,
  transacoes_duplicadas int not null default 0,
  created_at timestamptz not null default now(),
  unique (user_id, banco, competencia)
);

alter table import_log enable row level security;
create policy import_log_owner on import_log for all using (user_id = auth.uid()) with check (user_id = auth.uid());
