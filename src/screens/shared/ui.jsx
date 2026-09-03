/* Componentes visuais reaproveitados entre telas — linguagem visual
   "Sankore": cards brancos com ícone circular colorido, painéis com
   título + ação no canto, sidebar escura com destaque verde. */

export function Panel({ title, action, children, style }) {
  return (
    <div style={{ background: "var(--panel)", border: "1px solid var(--rule)", borderRadius: "var(--radius)", boxShadow: "var(--shadow)", padding: 20, ...style }}>
      {(title || action) && (
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          {title && <h3 style={{ fontSize: 14, fontWeight: 600, margin: 0, color: "var(--ink)" }}>{title}</h3>}
          {action}
        </div>
      )}
      {children}
    </div>
  );
}

const CORES_ICONE = { green: "#16a34a", blue: "#2563eb", purple: "#7c3aed", red: "#dc2626", amber: "#d97706" };

export function StatCard({ icon: Icon, cor = "green", rotulo, valor, variacao, variacaoInvertida, sub, onClick }) {
  const corIcone = CORES_ICONE[cor] || CORES_ICONE.green;
  const bom = variacao != null ? (variacaoInvertida ? variacao < 0 : variacao >= 0) : null;
  return (
    <div
      onClick={onClick}
      style={{ background: "var(--panel)", border: "1px solid var(--rule)", borderRadius: "var(--radius)", boxShadow: "var(--shadow)", padding: 18, display: "flex", flexDirection: "column", gap: 12, minWidth: 200, flex: 1, cursor: onClick ? "pointer" : "default" }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <div style={{ width: 40, height: 40, borderRadius: 10, background: `${corIcone}1a`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          {Icon && <Icon size={20} color={corIcone} strokeWidth={2} />}
        </div>
        <div style={{ fontSize: 13, color: "var(--ink-faint)" }}>{rotulo}</div>
      </div>
      <div style={{ fontSize: 22, fontWeight: 700, color: "var(--ink)" }}>{valor}</div>
      {(variacao != null || sub) && (
        <div style={{ fontSize: 12, color: bom != null ? (bom ? "var(--credit)" : "var(--debit)") : "var(--ink-faint)", display: "flex", alignItems: "center", gap: 4 }}>
          {variacao != null && <span>{variacao >= 0 ? "▲" : "▼"} {Math.abs(variacao).toFixed(1)}% vs mês anterior</span>}
          {sub && <span style={{ color: "var(--ink-faint)" }}>{sub}</span>}
        </div>
      )}
    </div>
  );
}

export function Badge({ tom = "faint", children }) {
  const tons = {
    credit: { bg: "#16a34a1a", cor: "var(--credit)" },
    debit: { bg: "#dc26261a", cor: "var(--debit)" },
    faint: { bg: "#7a84941a", cor: "var(--ink-faint)" },
  };
  const t = tons[tom] || tons.faint;
  return (
    <span style={{ background: t.bg, color: t.cor, fontSize: 12, fontWeight: 600, padding: "2px 8px", borderRadius: 6 }}>{children}</span>
  );
}
