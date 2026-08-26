/* Remove transações que são ruído/movimentação interna, não fluxo de
   caixa real — decidido explicitamente com o usuário na Fase 2:
   - sweep automático "CDB Porq Obj" (Aplicacao/Resgate) do Inter, que
     só movimenta dinheiro entre conta corrente e a reserva.
   - "Rendimentos" diários do Mercado Pago (juros sobre saldo em conta,
     centavos por dia) — mesma lógica, excluído por completo. */
import { normalizar } from "../finance/format.js";

export function filtrarRuido(transacoes) {
  return transacoes.filter((t) => {
    const d = normalizar(t.desc);
    if (d.includes("cdb porq obj")) return false;
    if (d === "rendimentos") return false;
    return true;
  });
}
