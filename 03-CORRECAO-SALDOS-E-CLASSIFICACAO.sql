-- ============================================================================
-- Rodar no Supabase SQL Editor (Seu projeto → SQL Editor → colar tudo → Run)
-- ============================================================================
-- Corrige o que o 02-INVESTIMENTOS-MIGRATION.sql gravou errado:
--  1) os valores eram números aleatórios, não os fechamentos reais;
--  2) 14 tickers ali não existem na carteira real (Tesouro/Debênture/USD Bond
--     genéricos) — remove só esses, só nos meses mai/jun/jul-2026, só do
--     seu usuário;
--  3) faltavam as 14 ações fracionadas EUA reais (AAPL, MSFT, GOOG...);
--  4) a classificação de grupo/tipo em `settings` usa chaves em CAIXA ALTA
--     que não batem (case-sensitive) com o nome real do ticker — corrige
--     casing e aplica a reclassificação sem bucket "Congelado".
-- Idempotente: pode rodar mais de uma vez sem duplicar ou piorar nada.
-- ============================================================================

BEGIN;

-- 1) Remove os 14 tickers fictícios (só se existirem)
DELETE FROM asset_snapshots
WHERE user_id = (SELECT id FROM auth.users WHERE email = 'brunno.ifrs@gmail.com')
  AND month IN ('2026-05-01', '2026-06-01', '2026-07-01')
  AND ticker IN (
    'Tesouro IPCA+ 2035', 'Tesouro IPCA+ 2040',
    'Tesouro Prefixado 2027', 'Tesouro Prefixado 2033',
    'Debenture A', 'Debenture B', 'Debenture C', 'Debenture D',
    'USD Bond 1', 'USD Bond 2', 'USD Bond 3', 'USD Bond 4', 'USD Bond 5', 'USD Bond 6'
  );

-- 2) Upsert dos 27 ativos reais × 3 meses (corrige valor se já existir)
INSERT INTO asset_snapshots (user_id, month, ticker, valor)
SELECT (SELECT id FROM auth.users WHERE email = 'brunno.ifrs@gmail.com'), month, ticker, valor
FROM (VALUES
  -- Crescimento
  ('2026-05-01'::date, 'WRLD11', 1154.16), ('2026-06-01'::date, 'WRLD11', 1932.58), ('2026-07-01'::date, 'WRLD11', 2430.83),
  ('2026-05-01'::date, 'NASD11', 1065.00), ('2026-06-01'::date, 'NASD11', 1598.25), ('2026-07-01'::date, 'NASD11', 1895.25),
  ('2026-05-01'::date, 'QQQI11', 395.40),  ('2026-06-01'::date, 'QQQI11', 795.04),  ('2026-07-01'::date, 'QQQI11', 738.16),
  ('2026-05-01'::date, 'ITSA4', 258.00),   ('2026-06-01'::date, 'ITSA4', 273.20),   ('2026-07-01'::date, 'ITSA4', 278.40),
  ('2026-05-01'::date, 'MTRE3', 147.20),   ('2026-06-01'::date, 'MTRE3', 132.80),   ('2026-07-01'::date, 'MTRE3', 115.60),
  ('2026-05-01'::date, 'BTC', 503.28),     ('2026-06-01'::date, 'BTC', 465.15),     ('2026-07-01'::date, 'BTC', 452.92),
  ('2026-05-01'::date, 'UNI', 20.88),      ('2026-06-01'::date, 'UNI', 23.88),      ('2026-07-01'::date, 'UNI', 29.09),
  -- Reserva
  ('2026-05-01'::date, 'Cofrinho MP', 5045.00),      ('2026-06-01'::date, 'Cofrinho MP', 5106.15),      ('2026-07-01'::date, 'Cofrinho MP', 5155.83),
  ('2026-05-01'::date, 'Butiá FIC FIRF', 3448.68),   ('2026-06-01'::date, 'Butiá FIC FIRF', 3492.40),   ('2026-07-01'::date, 'Butiá FIC FIRF', 3533.95),
  ('2026-05-01'::date, 'Inter FIRF', 3192.13),       ('2026-06-01'::date, 'Inter FIRF', 3231.78),       ('2026-07-01'::date, 'Inter FIRF', 3268.08),
  ('2026-05-01'::date, 'TD Inter', 77.92),           ('2026-06-01'::date, 'TD Inter', 83.38),            ('2026-07-01'::date, 'TD Inter', 77.55),
  ('2026-05-01'::date, 'AAPL', 27.73), ('2026-06-01'::date, 'AAPL', 29.81), ('2026-07-01'::date, 'AAPL', 27.60),
  ('2026-05-01'::date, 'MSFT', 29.35), ('2026-06-01'::date, 'MSFT', 26.57), ('2026-07-01'::date, 'MSFT', 29.30),
  ('2026-05-01'::date, 'GOOG', 29.15), ('2026-06-01'::date, 'GOOG', 29.75), ('2026-07-01'::date, 'GOOG', 27.60),
  ('2026-05-01'::date, 'AMZN', 32.13), ('2026-06-01'::date, 'AMZN', 31.86), ('2026-07-01'::date, 'AMZN', 33.00),
  ('2026-05-01'::date, 'META', 23.07), ('2026-06-01'::date, 'META', 23.92), ('2026-07-01'::date, 'META', 21.15),
  ('2026-05-01'::date, 'NVDA', 30.92), ('2026-06-01'::date, 'NVDA', 28.67), ('2026-07-01'::date, 'NVDA', 27.35),
  ('2026-05-01'::date, 'TSLA', 25.60), ('2026-06-01'::date, 'TSLA', 25.81), ('2026-07-01'::date, 'TSLA', 18.90),
  ('2026-05-01'::date, 'JPM', 23.28),  ('2026-06-01'::date, 'JPM', 27.97),  ('2026-07-01'::date, 'JPM', 27.25),
  ('2026-05-01'::date, 'BAC', 23.12),  ('2026-06-01'::date, 'BAC', 28.13),  ('2026-07-01'::date, 'BAC', 27.45),
  ('2026-05-01'::date, 'C', 26.67),    ('2026-06-01'::date, 'C', 30.83),    ('2026-07-01'::date, 'C', 27.05),
  ('2026-05-01'::date, 'GS', 28.79),   ('2026-06-01'::date, 'GS', 29.92),   ('2026-07-01'::date, 'GS', 27.65),
  ('2026-05-01'::date, 'MS', 29.70),   ('2026-06-01'::date, 'MS', 32.13),   ('2026-07-01'::date, 'MS', 29.25),
  ('2026-05-01'::date, 'WFC', 20.75),  ('2026-06-01'::date, 'WFC', 24.52),  ('2026-07-01'::date, 'WFC', 22.95),
  ('2026-05-01'::date, 'HSBC', 26.46), ('2026-06-01'::date, 'HSBC', 29.32), ('2026-07-01'::date, 'HSBC', 29.90),
  -- Caixa
  ('2026-05-01'::date, 'CDB Inter (Porquinho)', 2434.55), ('2026-06-01'::date, 'CDB Inter (Porquinho)', 3370.29), ('2026-07-01'::date, 'CDB Inter (Porquinho)', 2915.90),
  ('2026-05-01'::date, 'Poupança', 1480.82), ('2026-06-01'::date, 'Poupança', 0.00), ('2026-07-01'::date, 'Poupança', 0.00)
) AS v(month, ticker, valor)
ON CONFLICT (user_id, month, ticker) DO UPDATE SET valor = excluded.valor;

-- 3) Corrige classificação (grupo/tipo) — merge não-destrutivo: preserva
--    qualquer chave que você já tenha customizado pela tela "Meus ativos"
--    e só adiciona/corrige as listadas abaixo.
INSERT INTO settings (user_id, chave, valor)
VALUES (
  (SELECT id FROM auth.users WHERE email = 'brunno.ifrs@gmail.com'),
  'asset_group',
  '{
    "WRLD11": "CRESCIMENTO", "NASD11": "CRESCIMENTO", "QQQI11": "CRESCIMENTO", "ITSA4": "CRESCIMENTO", "MTRE3": "CRESCIMENTO", "BTC": "CRESCIMENTO", "UNI": "CRESCIMENTO",
    "Cofrinho MP": "RESERVA", "Butiá FIC FIRF": "RESERVA", "Inter FIRF": "RESERVA", "TD Inter": "RESERVA",
    "AAPL": "RESERVA", "MSFT": "RESERVA", "GOOG": "RESERVA", "AMZN": "RESERVA", "META": "RESERVA", "NVDA": "RESERVA", "TSLA": "RESERVA", "JPM": "RESERVA", "BAC": "RESERVA", "C": "RESERVA", "GS": "RESERVA", "MS": "RESERVA", "WFC": "RESERVA", "HSBC": "RESERVA",
    "CDB Inter (Porquinho)": "LIQUIDEZ", "Poupança": "LIQUIDEZ"
  }'::jsonb
)
ON CONFLICT (user_id, chave) DO UPDATE SET valor = settings.valor || excluded.valor, updated_at = now();

INSERT INTO settings (user_id, chave, valor)
VALUES (
  (SELECT id FROM auth.users WHERE email = 'brunno.ifrs@gmail.com'),
  'asset_tipo',
  '{
    "Cofrinho MP": "RENDA_FIXA", "Butiá FIC FIRF": "RENDA_FIXA", "Inter FIRF": "RENDA_FIXA", "TD Inter": "RENDA_FIXA",
    "CDB Inter (Porquinho)": "CAIXA", "Poupança": "CAIXA",
    "WRLD11": "ETF", "NASD11": "ETF", "QQQI11": "ETF",
    "ITSA4": "ACOES_BR", "MTRE3": "ACOES_BR",
    "BTC": "CRIPTO", "UNI": "CRIPTO",
    "AAPL": "BOND_USD", "MSFT": "BOND_USD", "GOOG": "BOND_USD", "AMZN": "BOND_USD", "META": "BOND_USD", "NVDA": "BOND_USD", "TSLA": "BOND_USD", "JPM": "BOND_USD", "BAC": "BOND_USD", "C": "BOND_USD", "GS": "BOND_USD", "MS": "BOND_USD", "WFC": "BOND_USD", "HSBC": "BOND_USD"
  }'::jsonb
)
ON CONFLICT (user_id, chave) DO UPDATE SET valor = settings.valor || excluded.valor, updated_at = now();

COMMIT;

-- Conferência rápida — deve bater com o total geral do arquivo que você mandou
-- (mai R$ 19.599,74 · jun R$ 20.904,11 · jul R$ 21.267,96):
SELECT month, SUM(valor) AS total
FROM asset_snapshots
WHERE user_id = (SELECT id FROM auth.users WHERE email = 'brunno.ifrs@gmail.com')
  AND month IN ('2026-05-01', '2026-06-01', '2026-07-01')
GROUP BY month ORDER BY month;
