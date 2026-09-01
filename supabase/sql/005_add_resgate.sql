-- Rodar uma vez: adiciona "Resgate de investimentos" na config já
-- existente (dinheiro voltando de um investimento pro caixa). Tipo
-- "aporte" — mesma lógica de "Investimentos", só que no sentido
-- contrário: reduz o aporte líquido do mês em vez de aumentar.
update settings
set valor = valor || '{
  "Resgate de investimentos": {"cor": "#4B8064", "tipo": "aporte"}
}'::jsonb,
updated_at = now()
where chave = 'categorias';
