-- Rodar uma vez: mescla as categorias novas na config já existente do
-- usuário (settings.categorias) sem apagar nada que já estava lá.
update settings
set valor = valor || '{
  "Transferência entre contas": {"cor": "#7A8B94", "tipo": "despesa"},
  "Cashback": {"cor": "#2E8F5E", "tipo": "receita"}
}'::jsonb,
updated_at = now()
where chave = 'categorias';
