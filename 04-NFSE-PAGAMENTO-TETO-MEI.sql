-- ============================================================================
-- Rodar no Supabase SQL Editor.
-- ============================================================================
-- IMPORTANTE: a tabela `nfse` que já existe em produção é a versão de
-- supabase/sql/001_schema.sql (id uuid, numero, chave, competencia, emissao,
-- valor, status, tomador, cnpj_tomador, recebimento_iso, conta_recebimento,
-- descricao) — NÃO é a versão do 01-SUPABASE-SQL.sql (que tem hash_dedup/
-- raw_xml/descricao_servico e nunca chegou a rodar). Este script estende a
-- tabela REAL em vez de duplicar. Tabela está vazia (0 linhas) — seguro.
-- ============================================================================

BEGIN;

-- numero era NOT NULL, mas a validação do app aceita numero OU chave
ALTER TABLE nfse ALTER COLUMN numero DROP NOT NULL;

-- dedup na reimportação do mesmo XML
ALTER TABLE nfse ADD COLUMN IF NOT EXISTS hash_dedup TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS idx_nfse_user_hash ON nfse(user_id, hash_dedup) WHERE hash_dedup IS NOT NULL;

-- guarda o XML original como evidência (mesmo padrão de doc_storage_path em contributions)
ALTER TABLE nfse ADD COLUMN IF NOT EXISTS raw_xml TEXT;

-- status = resultado da revisão da extração do XML (a tabela está vazia,
-- seguro redefinir o significado — nunca foi usada por nenhum código real)
ALTER TABLE nfse ALTER COLUMN status SET DEFAULT 'pendente_revisao';

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'nfse_status_check') THEN
    ALTER TABLE nfse ADD CONSTRAINT nfse_status_check
      CHECK (status IN ('pendente_revisao', 'confirmada', 'rejeitada', 'anulada'));
  END IF;
END $$;

-- Status de pagamento NÃO ganha coluna nova — reaproveita o que já existia:
--   recebimento_iso NULL     -> aguardando pagamento
--   recebimento_iso preenchido -> recebido nessa data
--   conta_recebimento         -> em qual conta caiu (Inter PF, Mercado Pago...)

COMMIT;

-- Conferência
SELECT column_name, data_type, is_nullable FROM information_schema.columns WHERE table_name='nfse' ORDER BY ordinal_position;
