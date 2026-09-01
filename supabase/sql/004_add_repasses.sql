-- Rodar uma vez: adiciona "Repasses de terceiros" na config já existente
-- (dinheiro que passa pela sua conta mas não é seu — ex: seguro pago em
-- seu nome e reembolsado por outra pessoa). Usar essa categoria nas DUAS
-- pontas (saída do boleto e entrada do reembolso) pra zerar o efeito no
-- relatório sem contaminar categorias de gasto real (ex: "Seguro").
update settings
set valor = valor || '{
  "Repasses de terceiros": {"cor": "#6B7A94", "tipo": "despesa"}
}'::jsonb,
updated_at = now()
where chave = 'categorias';
