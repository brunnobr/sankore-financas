import { useEffect, useState } from "react";
import { Receipt, AlertTriangle, CheckCircle2, Clock } from "lucide-react";
import { loadNFSeConfirmadas, marcarPagamento } from "../data/nfse.js";
import { resumoTetoMei } from "../data/nfse.js";
import { brl, pct, formatarDataBR } from "../lib/finance/format.js";
import { Panel, StatCard, Badge } from "./shared/ui.jsx";

const anoAtual = new Date().getFullYear();

function TetoMei({ resumo }) {
  if (!resumo) return null;
  const passouLimite = resumo.faturado > resumo.limite;
  const passouTolerancia = resumo.faturado > resumo.tolerancia;
  const pctBarra = Math.min(100, (resumo.faturado / resumo.tolerancia) * 100);
  return (
    <Panel title={`Teto MEI ${anoAtual}`}>
      <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginBottom: 16 }}>
        <StatCard icon={Receipt} cor={passouTolerancia ? "red" : passouLimite ? "amber" : "green"} rotulo="Faturado no ano" valor={brl(resumo.faturado)} sub={pct((resumo.faturado / resumo.limite) * 100, 1) + " do limite"} />
        <StatCard icon={AlertTriangle} cor={resumo.restanteAteLimite < 0 ? "red" : "blue"} rotulo="Até o limite (R$ 81.000)" valor={brl(resumo.restanteAteLimite)} />
        <StatCard icon={AlertTriangle} cor={resumo.restanteAteTolerancia < 0 ? "red" : "purple"} rotulo="Até a tolerância (R$ 97.200)" valor={brl(resumo.restanteAteTolerancia)} />
      </div>
      <div style={{ height: 10, borderRadius: 999, background: "var(--bg)", border: "1px solid var(--rule)", overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${pctBarra}%`, background: passouTolerancia ? "var(--debit)" : passouLimite ? "#d97706" : "var(--credit)", transition: "width .3s" }} />
      </div>
      {passouLimite && (
        <p style={{ fontSize: 12.5, color: passouTolerancia ? "var(--debit)" : "#d97706", marginTop: 10, marginBottom: 0 }}>
          {passouTolerancia
            ? "Faturamento já passou da tolerância de 20% — risco de desenquadramento do MEI, vale conversar com o contador."
            : "Faturamento já passou do limite anual — ainda dentro da tolerância de 20%, mas fique de olho."}
        </p>
      )}
    </Panel>
  );
}

export default function NotasMEI() {
  const [notas, setNotas] = useState(null);
  const [resumo, setResumo] = useState(null);
  const [erro, setErro] = useState("");
  const [processando, setProcessando] = useState(null);

  function carregar() {
    Promise.all([loadNFSeConfirmadas(), resumoTetoMei(anoAtual)])
      .then(([n, r]) => { setNotas(n); setResumo(r); })
      .catch((e) => setErro(e.message || "Erro ao carregar notas."));
  }

  useEffect(() => { carregar(); }, []);

  async function alternarPagamento(id, statusAtual) {
    setProcessando(id);
    try {
      await marcarPagamento(id, statusAtual === "recebido" ? "aguardando" : "recebido");
      carregar();
    } catch (e) {
      setErro(e.message || "Erro ao atualizar pagamento.");
    } finally {
      setProcessando(null);
    }
  }

  if (erro) return <p style={{ color: "var(--debit)" }}>{erro}</p>;
  if (!notas) return <p style={{ color: "var(--ink-faint)" }}>Carregando…</p>;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <TetoMei resumo={resumo} />

      <Panel title={`Notas fiscais confirmadas (${notas.length})`}>
        {notas.length === 0 ? (
          <p style={{ color: "var(--ink-faint)", margin: 0 }}>
            Nenhuma nota confirmada ainda. Suba o XML em <strong>Importar</strong> — depois de revisado e confirmado, aparece aqui.
          </p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ textAlign: "left", borderBottom: "1px solid var(--rule)", color: "var(--ink-faint)" }}>
                  <th style={{ padding: "6px 4px" }}>Competência</th>
                  <th style={{ padding: "6px 4px" }}>Nº</th>
                  <th style={{ padding: "6px 4px" }}>Tomador</th>
                  <th style={{ padding: "6px 4px", textAlign: "right" }}>Valor</th>
                  <th style={{ padding: "6px 4px" }}>Pagamento</th>
                </tr>
              </thead>
              <tbody>
                {notas.map((n) => (
                  <tr key={n.id} style={{ borderBottom: "1px solid var(--rule)", opacity: processando === n.id ? 0.5 : 1 }}>
                    <td style={{ padding: "8px 4px", whiteSpace: "nowrap" }}>{formatarDataBR(n.competencia)}</td>
                    <td style={{ padding: "8px 4px", color: "var(--ink-faint)" }}>{n.numero || "—"}</td>
                    <td style={{ padding: "8px 4px" }}>{n.tomador}</td>
                    <td style={{ padding: "8px 4px", textAlign: "right" }}>{brl(Number(n.valor))}</td>
                    <td style={{ padding: "8px 4px" }}>
                      <button
                        onClick={() => alternarPagamento(n.id, n.recebimento_iso ? "recebido" : "aguardando")}
                        disabled={processando === n.id}
                        style={{ background: "transparent", border: "none", padding: 0, cursor: "pointer" }}
                        title="Clique para alternar"
                      >
                        {n.recebimento_iso ? (
                          <Badge tom="credit"><CheckCircle2 size={11} style={{ marginRight: 4, marginBottom: -1 }} />Recebido em {formatarDataBR(n.recebimento_iso)}</Badge>
                        ) : (
                          <Badge tom="faint"><Clock size={11} style={{ marginRight: 4, marginBottom: -1 }} />Aguardando</Badge>
                        )}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </div>
  );
}
