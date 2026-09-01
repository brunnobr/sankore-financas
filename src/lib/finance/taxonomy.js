/* ═══════════════════════════════════════════════════════════════
   Taxonomia da carteira de investimentos.
   Portado quase verbatim de dashboardinvestimentos.jsx (linhas 17-52).
   Diferença: ASSET_GROUP/ASSET_TIPO deixam de ser mapa fixo no código
   e passam a ser carregados da tabela `settings` (chave "asset_taxonomy")
   — grupoDe/tipoDe recebem o mapa como parâmetro em vez de fechar sobre
   uma constante, pra você poder reclassificar um ativo pela interface
   sem precisar de deploy. Ver src/data/settings.js.
   ═══════════════════════════════════════════════════════════════ */

export const GRUPO = {
  RESERVA:     { label: "Reserva",     cor: "#3C5C7A", desc: "Baixo risco e saque rápido. Protege, não cresce." },
  CRESCIMENTO: { label: "Crescimento", cor: "#186040", desc: "Onde entra aporte novo. É o motor." },
  CONGELADO:   { label: "Congelado",   cor: "#7B846F", desc: "Parado por decisão. Sem aporte, sem venda." },
  LIQUIDEZ:    { label: "Caixa",       cor: "#6B5B3E", desc: "Garantia dos pagamentos do mês seguinte. Fora do cálculo." },
};
export const ORDEM_GRUPO = ["RESERVA", "CRESCIMENTO", "CONGELADO"];

export const TIPO = {
  RENDA_FIXA: { label: "Renda fixa",  cor: "#3C5C7A" },
  CAIXA:      { label: "Caixa",       cor: "#6B5B3E" },
  ETF:        { label: "ETFs",        cor: "#186040" },
  ACOES_BR:   { label: "Ações BR",    cor: "#4B8064" },
  BOND_USD:   { label: "Bond estruturado (USD)", cor: "#7B846F" },
  CRIPTO:     { label: "Cripto",      cor: "#9A7B4F" },
};
export const ORDEM_TIPO = ["RENDA_FIXA", "CAIXA", "ETF", "ACOES_BR", "BOND_USD", "CRIPTO"];

// Seed inicial — carregado na tabela settings na migração da Fase 1, não usado direto em produção.
export const ASSET_GROUP_SEED = {
  "COFRINHO MP": "RESERVA", "BUTIÁ FIC FIRF": "RESERVA", "INTER FIRF": "RESERVA",
  "CDB INTER": "LIQUIDEZ", "POUPANÇA": "LIQUIDEZ",
  "WRLD11": "CRESCIMENTO", "NASD11": "CRESCIMENTO", "QQQI11": "CRESCIMENTO", "ITSA4": "CRESCIMENTO",
};
export const ASSET_TIPO_SEED = {
  "COFRINHO MP": "RENDA_FIXA", "BUTIÁ FIC FIRF": "RENDA_FIXA", "INTER FIRF": "RENDA_FIXA", "TD INTER": "RENDA_FIXA",
  "CDB INTER": "CAIXA", "POUPANÇA": "CAIXA",
  "WRLD11": "ETF", "NASD11": "ETF", "QQQI11": "ETF",
  "ITSA4": "ACOES_BR", "MTRE3": "ACOES_BR",
  "BTC": "CRIPTO", "UNI": "CRIPTO",
};

export const grupoDe = (assetGroupMap, nome) => assetGroupMap[nome] || "CONGELADO";
export const ehCaixa = (assetGroupMap, nome) => grupoDe(assetGroupMap, nome) === "LIQUIDEZ";
export const tipoDe = (assetTipoMap, nome) => assetTipoMap[nome] || "BOND_USD";

// Categorias de fluxo de caixa (receita/despesa/aporte) — mesma lógica de settings editável.
export const CATEGORIAS_SEED = {
  "Mercado":          { cor: "#3C5C7A", tipo: "despesa" },
  "Alimentação":      { cor: "#9C6B45", tipo: "despesa" },
  "Transporte":       { cor: "#6B5B3E", tipo: "despesa" },
  "Combustível":      { cor: "#7A5C3C", tipo: "despesa" },
  "Farmácia":         { cor: "#4B8064", tipo: "despesa" },
  "Saúde":            { cor: "#3E6E56", tipo: "despesa" },
  "Educação":         { cor: "#5A6B8A", tipo: "despesa" },
  "Moradia":          { cor: "#6E5A8A", tipo: "despesa" },
  "Energia":          { cor: "#8A7A3C", tipo: "despesa" },
  "Água":             { cor: "#3C7A8A", tipo: "despesa" },
  "Internet":         { cor: "#5A7A8A", tipo: "despesa" },
  "Telefone":         { cor: "#6A7A8A", tipo: "despesa" },
  "Assinaturas":      { cor: "#8A6A4B", tipo: "despesa" },
  "Lazer":            { cor: "#A37B3C", tipo: "despesa" },
  "Compras":          { cor: "#7B5C8A", tipo: "despesa" },
  "Investimentos":    { cor: "#186040", tipo: "aporte" },
  "Resgate de investimentos": { cor: "#4B8064", tipo: "aporte" },
  "Cartão de crédito":{ cor: "#8E2721", tipo: "despesa" },
  "Impostos":         { cor: "#8E2721", tipo: "despesa" },
  "Seguro":           { cor: "#4A6B5C", tipo: "despesa" },
  "Mesada":           { cor: "#8A6B8F", tipo: "despesa" },
  "Empréstimos":      { cor: "#9C6B3E", tipo: "despesa" },
  "Atividades da filha": { cor: "#B0785A", tipo: "despesa" },
  "Transferências":   { cor: "#94826B", tipo: "despesa" },
  "Transferência entre contas": { cor: "#7A8B94", tipo: "despesa" },
  "Cashback":         { cor: "#2E8F5E", tipo: "receita" },
  "Repasses de terceiros": { cor: "#6B7A94", tipo: "despesa" },
  "Vestuário":        { cor: "#7B5C6E", tipo: "despesa" },
  "Outros":           { cor: "#7B846F", tipo: "despesa" },
  "Salário":          { cor: "#186040", tipo: "receita" },
  "Faturamento PJ":   { cor: "#1F6F4A", tipo: "receita" },
  "Serviços prestados": { cor: "#2E8F5E", tipo: "receita" },
  "PIX recebido":     { cor: "#2E7D52", tipo: "receita" },
  "Reembolsos":       { cor: "#3C8A63", tipo: "receita" },
  "Dividendos":       { cor: "#4B9670", tipo: "receita" },
  "Outras receitas":  { cor: "#5CA37D", tipo: "receita" },
};
export const ORDEM_CATEGORIAS_SEED = Object.keys(CATEGORIAS_SEED);
