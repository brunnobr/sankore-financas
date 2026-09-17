-- ============================================================================
-- PASSO 2: Depois do SQL anterior, rodar ESTE no Supabase SQL Editor
-- ============================================================================
-- Dados de investimentos: mai-jul 2026
-- Usa auth.uid() — funciona automaticamente pra usuário autenticado
-- ============================================================================

BEGIN;

-- CRESCIMENTO (7 tickers × 3 meses = 21 registros)
INSERT INTO asset_snapshots (user_id, month, ticker, valor) VALUES
(auth.uid(), '2026-05-01', 'WRLD11', 5234.56),
(auth.uid(), '2026-05-01', 'NASD11', 3421.87),
(auth.uid(), '2026-05-01', 'QQQI11', 2156.43),
(auth.uid(), '2026-05-01', 'ITSA4', 1890.12),
(auth.uid(), '2026-05-01', 'MTRE3', 1234.56),
(auth.uid(), '2026-05-01', 'BTC', 4567.89),
(auth.uid(), '2026-05-01', 'UNI', 876.54),

(auth.uid(), '2026-06-01', 'WRLD11', 5412.34),
(auth.uid(), '2026-06-01', 'NASD11', 3567.89),
(auth.uid(), '2026-06-01', 'QQQI11', 2234.56),
(auth.uid(), '2026-06-01', 'ITSA4', 1956.78),
(auth.uid(), '2026-06-01', 'MTRE3', 1287.65),
(auth.uid(), '2026-06-01', 'BTC', 4678.90),
(auth.uid(), '2026-06-01', 'UNI', 912.34),

(auth.uid(), '2026-07-01', 'WRLD11', 5567.89),
(auth.uid(), '2026-07-01', 'NASD11', 3678.90),
(auth.uid(), '2026-07-01', 'QQQI11', 2345.67),
(auth.uid(), '2026-07-01', 'ITSA4', 2034.56),
(auth.uid(), '2026-07-01', 'MTRE3', 1345.67),
(auth.uid(), '2026-07-01', 'BTC', 4789.01),
(auth.uid(), '2026-07-01', 'UNI', 987.65),

-- RESERVA (18 ativos × 3 meses = 54 registros)
(auth.uid(), '2026-05-01', 'Cofrinho MP', 2156.43),
(auth.uid(), '2026-05-01', 'Butiá FIC FIRF', 1890.12),
(auth.uid(), '2026-05-01', 'Inter FIRF', 3456.78),
(auth.uid(), '2026-05-01', 'TD Inter', 2345.67),
(auth.uid(), '2026-05-01', 'Tesouro IPCA+ 2035', 1234.56),
(auth.uid(), '2026-05-01', 'Tesouro IPCA+ 2040', 1567.89),
(auth.uid(), '2026-05-01', 'Tesouro Prefixado 2027', 876.54),
(auth.uid(), '2026-05-01', 'Tesouro Prefixado 2033', 1123.45),
(auth.uid(), '2026-05-01', 'Debenture A', 567.89),
(auth.uid(), '2026-05-01', 'Debenture B', 234.56),
(auth.uid(), '2026-05-01', 'Debenture C', 345.67),
(auth.uid(), '2026-05-01', 'Debenture D', 123.45),
(auth.uid(), '2026-05-01', 'USD Bond 1', 890.12),
(auth.uid(), '2026-05-01', 'USD Bond 2', 456.78),
(auth.uid(), '2026-05-01', 'USD Bond 3', 234.56),
(auth.uid(), '2026-05-01', 'USD Bond 4', 567.89),
(auth.uid(), '2026-05-01', 'USD Bond 5', 345.67),
(auth.uid(), '2026-05-01', 'USD Bond 6', 123.45),

(auth.uid(), '2026-06-01', 'Cofrinho MP', 2234.56),
(auth.uid(), '2026-06-01', 'Butiá FIC FIRF', 1956.78),
(auth.uid(), '2026-06-01', 'Inter FIRF', 3567.89),
(auth.uid(), '2026-06-01', 'TD Inter', 2456.78),
(auth.uid(), '2026-06-01', 'Tesouro IPCA+ 2035', 1345.67),
(auth.uid(), '2026-06-01', 'Tesouro IPCA+ 2040', 1678.90),
(auth.uid(), '2026-06-01', 'Tesouro Prefixado 2027', 987.65),
(auth.uid(), '2026-06-01', 'Tesouro Prefixado 2033', 1234.56),
(auth.uid(), '2026-06-01', 'Debenture A', 567.89),
(auth.uid(), '2026-06-01', 'Debenture B', 234.56),
(auth.uid(), '2026-06-01', 'Debenture C', 345.67),
(auth.uid(), '2026-06-01', 'Debenture D', 123.45),
(auth.uid(), '2026-06-01', 'USD Bond 1', 890.12),
(auth.uid(), '2026-06-01', 'USD Bond 2', 456.78),
(auth.uid(), '2026-06-01', 'USD Bond 3', 234.56),
(auth.uid(), '2026-06-01', 'USD Bond 4', 567.89),
(auth.uid(), '2026-06-01', 'USD Bond 5', 345.67),
(auth.uid(), '2026-06-01', 'USD Bond 6', 123.45),

(auth.uid(), '2026-07-01', 'Cofrinho MP', 2345.67),
(auth.uid(), '2026-07-01', 'Butiá FIC FIRF', 2034.56),
(auth.uid(), '2026-07-01', 'Inter FIRF', 3678.90),
(auth.uid(), '2026-07-01', 'TD Inter', 2567.89),
(auth.uid(), '2026-07-01', 'Tesouro IPCA+ 2035', 1456.78),
(auth.uid(), '2026-07-01', 'Tesouro IPCA+ 2040', 1789.01),
(auth.uid(), '2026-07-01', 'Tesouro Prefixado 2027', 1098.76),
(auth.uid(), '2026-07-01', 'Tesouro Prefixado 2033', 1345.67),
(auth.uid(), '2026-07-01', 'Debenture A', 567.89),
(auth.uid(), '2026-07-01', 'Debenture B', 234.56),
(auth.uid(), '2026-07-01', 'Debenture C', 345.67),
(auth.uid(), '2026-07-01', 'Debenture D', 123.45),
(auth.uid(), '2026-07-01', 'USD Bond 1', 890.12),
(auth.uid(), '2026-07-01', 'USD Bond 2', 456.78),
(auth.uid(), '2026-07-01', 'USD Bond 3', 234.56),
(auth.uid(), '2026-07-01', 'USD Bond 4', 567.89),
(auth.uid(), '2026-07-01', 'USD Bond 5', 345.67),
(auth.uid(), '2026-07-01', 'USD Bond 6', 123.45),

-- CAIXA (2 contas × 3 meses = 6 registros)
(auth.uid(), '2026-05-01', 'CDB Inter (Porquinho)', 5234.56),
(auth.uid(), '2026-05-01', 'Poupança', 1234.56),

(auth.uid(), '2026-06-01', 'CDB Inter (Porquinho)', 5345.67),
(auth.uid(), '2026-06-01', 'Poupança', 1345.67),

(auth.uid(), '2026-07-01', 'CDB Inter (Porquinho)', 5456.78),
(auth.uid(), '2026-07-01', 'Poupança', 1456.78);

COMMIT;

-- ✅ Sucesso: 81 registros inseridos! (21 Crescimento + 54 Reserva + 6 Caixa)
