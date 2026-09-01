// Portado de dashboardinvestimentos.jsx (linha 65-67), sem alteração de lógica.
export const num = (v, d = 2) => Math.abs(v).toLocaleString("pt-BR", { minimumFractionDigits: d, maximumFractionDigits: d });
export const brl = (v) => (v < 0 ? "−" : "") + "R$ " + num(v);
export const pct = (v, d = 2) => (v > 0 ? "+" : v < 0 ? "−" : "") + num(Math.abs(v), d) + "%";

export const MESES_PT = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];
export const labelMes = (ym) => { const [y, m] = ym.split("-"); return `${MESES_PT[parseInt(m, 10) - 1]} ${y}`; };
export const curtoMes = (ym) => labelMes(ym).slice(0, 3);
export const formatarDataBR = (iso) => {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
};

export function normalizar(s) {
  return s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
}
