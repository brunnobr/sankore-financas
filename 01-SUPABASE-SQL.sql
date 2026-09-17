-- ============================================================================
-- PASSO 1: Executar isso no Supabase SQL Editor
-- ============================================================================
-- 1. Ir em: https://app.supabase.com → Seu projeto → SQL Editor
-- 2. Colar TODO este arquivo
-- 3. Clicar em "Run" (ou Ctrl+Enter)
-- ============================================================================

-- Criar tabelas NFS-e com RLS
CREATE TABLE IF NOT EXISTS nfse (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  numero TEXT,
  chave TEXT UNIQUE,
  hash_dedup TEXT NOT NULL,

  competencia DATE NOT NULL,
  valor DECIMAL(12, 2) NOT NULL,
  tomador TEXT NOT NULL,
  descricao_servico TEXT,

  status TEXT DEFAULT 'pendente_revisao' CHECK (status IN ('pendente_revisao', 'confirmada', 'rejeitada', 'anulada')),
  raw_xml TEXT,

  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),

  CONSTRAINT chave_unica_por_usuario UNIQUE (user_id, chave)
);

CREATE INDEX IF NOT EXISTS idx_nfse_user_competencia ON nfse(user_id, competencia);
CREATE INDEX IF NOT EXISTS idx_nfse_status ON nfse(user_id, status);
CREATE INDEX IF NOT EXISTS idx_nfse_hash_dedup ON nfse(user_id, hash_dedup);

ALTER TABLE nfse ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "nfse_user_policy" ON nfse
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Tabela de auditoria
CREATE TABLE IF NOT EXISTS nfse_audit (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL,
  nfse_id BIGINT,
  acao TEXT NOT NULL,
  antes JSONB,
  depois JSONB,
  motivo TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

ALTER TABLE nfse_audit ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "nfse_audit_user_policy" ON nfse_audit
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Tabela de transações vinculadas
CREATE TABLE IF NOT EXISTS nfse_transactions (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  nfse_id BIGINT NOT NULL REFERENCES nfse(id) ON DELETE CASCADE,
  transaction_id BIGINT REFERENCES transactions(id) ON DELETE SET NULL,

  data DATE NOT NULL,
  descricao TEXT NOT NULL,
  valor DECIMAL(12, 2) NOT NULL,
  categoria TEXT DEFAULT 'receita_servicos',
  banco_conta TEXT DEFAULT 'MEI-Receitas',

  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_nfse_trans_nfse ON nfse_transactions(nfse_id);

ALTER TABLE nfse_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "nfse_transactions_user_policy" ON nfse_transactions
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Tabela de regras de categorização
CREATE TABLE IF NOT EXISTS nfse_categorization_rules (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  padrao TEXT NOT NULL,
  categoria TEXT NOT NULL,
  tipo_busca TEXT DEFAULT 'substring' CHECK (tipo_busca IN ('substring', 'regex')),

  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),

  UNIQUE (user_id, padrao)
);

ALTER TABLE nfse_categorization_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "nfse_cat_rules_user_policy" ON nfse_categorization_rules
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ✅ Sucesso: 4 tabelas criadas!
