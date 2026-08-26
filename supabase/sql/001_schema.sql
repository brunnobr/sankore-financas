-- ERP Financeiro — schema inicial (Fases 0-3)
-- Todas as tabelas levam user_id desde o início, mesmo sendo uso individual
-- hoje: evita retrabalho se um dia precisar dar acesso a outra pessoa (ex: contador).
-- RLS (row level security) garante que cada usuário só vê as próprias linhas.

create extension if not exists "uuid-ossp";

-- ── Configuração editável (substitui constantes hardcoded no código) ──
create table settings (
  user_id uuid not null references auth.users(id) default auth.uid(),
  chave text not null,
  valor jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, chave)
);
-- chaves esperadas: 'asset_group', 'asset_tipo', 'categorias', 'perfil_investidor',
-- 'teto_mei_2026', 'taxa_retirada', 'prioridades_meta'

-- ── Investimentos ──
create table asset_snapshots (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) default auth.uid(),
  month date not null,           -- primeiro dia do mês de fechamento
  ticker text not null,
  valor numeric(14,2) not null,
  created_at timestamptz not null default now(),
  unique (user_id, month, ticker)
);

create table contributions (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) default auth.uid(),
  month date not null,
  total numeric(14,2) not null,
  data_iso date not null,
  origem text,
  nota_numero text,
  breakdown jsonb not null default '{}',      -- {ticker: {valor, cotas, preco, nome}}
  taxas jsonb not null default '[]',          -- [{nome, valor}]
  doc_storage_path text,                       -- PDF original em Supabase Storage
  created_at timestamptz not null default now(),
  unique (user_id, month)
);

create table dividends (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) default auth.uid(),
  month date not null,
  total numeric(14,2) not null,
  itens jsonb not null default '[]',          -- [{ticker, valor}]
  created_at timestamptz not null default now(),
  unique (user_id, month)
);

create table benchmarks (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) default auth.uid(),
  month date not null,
  indice text not null,                        -- 'CDI' | 'IPCA' | 'Ibovespa'
  valor numeric(10,4) not null,
  fonte text,
  created_at timestamptz not null default now(),
  unique (user_id, month, indice)
);

-- ── Fluxo de caixa ──
create table transactions (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) default auth.uid(),
  data date not null,
  descricao text not null,
  categoria text not null,
  banco text,
  valor numeric(14,2) not null,
  origem_doc_id uuid,                          -- referencia import_queue.id quando veio de upload
  hash_dedup text not null,                     -- sha256(data|desc_normalizada|valor|banco)
  created_at timestamptz not null default now(),
  unique (user_id, hash_dedup)
);
create index transactions_user_data_idx on transactions (user_id, data);

create table categorization_rules (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) default auth.uid(),
  padrao text not null,                         -- descrição normalizada -> categoria (regra do usuário)
  categoria text not null,
  created_at timestamptz not null default now(),
  unique (user_id, padrao)
);

-- ── Cartão de crédito ──
create table card_installment_plans (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) default auth.uid(),
  cartao text not null,
  descricao text not null,
  valor_parcela numeric(14,2) not null,
  total_parcelas int not null,
  primeira_fatura date not null,
  created_at timestamptz not null default now()
);

create table card_charges (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) default auth.uid(),
  cartao text not null,
  fatura date not null,
  descricao text not null,
  categoria text not null,
  valor numeric(14,2) not null,
  plano_id uuid references card_installment_plans(id),
  parcela_atual int,
  created_at timestamptz not null default now()
);

create table card_invoices (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) default auth.uid(),
  cartao text not null,
  fatura date not null,
  vencimento date,
  limite_total numeric(14,2),
  limite_disponivel numeric(14,2),
  parcelado_futuro numeric(14,2),
  saldo_aberto numeric(14,2),
  estorno numeric(14,2),
  pago_efetivo numeric(14,2),
  created_at timestamptz not null default now(),
  unique (user_id, cartao, fatura)
);

-- ── Notas fiscais / MEI ──
create table nfse (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) default auth.uid(),
  numero text not null,
  chave text,
  competencia date,
  emissao date,
  valor numeric(14,2) not null,
  status text not null,                          -- conciliado | extrato-pendente | aguardando
  tomador text,
  cnpj_tomador text,
  recebimento_iso date,
  conta_recebimento text,
  descricao text,
  created_at timestamptz not null default now()
);

-- ── Metas ──
create table goals (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) default auth.uid(),
  titulo text not null,
  valor_alvo numeric(14,2) not null,
  valor_atual numeric(14,2) not null default 0,
  prazo date,
  prioridade text not null default 'media',      -- alta | media | baixa
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ── Fila de revisão de importação (Fase 4 — upload de documento) ──
create table import_queue (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) default auth.uid(),
  tipo text not null,                             -- extrato | nota_corretagem | fatura_cartao | nfse
  doc_storage_path text not null,
  status text not null default 'pendente',        -- pendente | confirmado | rejeitado
  linhas_extraidas jsonb not null default '[]',
  created_at timestamptz not null default now(),
  reviewed_at timestamptz
);

-- ── RLS: cada usuário só enxerga as próprias linhas ──
do $$
declare t text;
begin
  for t in select unnest(array[
    'settings','asset_snapshots','contributions','dividends','benchmarks',
    'transactions','categorization_rules','card_installment_plans','card_charges',
    'card_invoices','nfse','goals','import_queue'
  ])
  loop
    execute format('alter table %I enable row level security', t);
    execute format('create policy %I on %I for all using (user_id = auth.uid()) with check (user_id = auth.uid())', t || '_owner', t);
  end loop;
end $$;
