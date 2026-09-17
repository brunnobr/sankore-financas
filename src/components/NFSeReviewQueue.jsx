import { useEffect, useState } from "react";
import { CheckCircle2, Trash2 } from "lucide-react";
import { useAuth } from "../data/AuthContext";
import { loadFilaRevisao, confirmarNFSe, rejeitarNFSe } from "../data/nfse.js";
import { brl, formatarDataBR } from "../lib/finance/format.js";
import { Panel } from "../screens/shared/ui.jsx";

export function NFSeReviewQueue() {
  const auth = useAuth();
  const user = auth?.session?.user;

  const [fila, setFila] = useState(null);
  const [erro, setErro] = useState("");
  const [processando, setProcessando] = useState(null);

  useEffect(() => {
    if (!user) return;
    carregar();
  }, [user]);

  function carregar() {
    loadFilaRevisao().then(setFila).catch((e) => setErro(`Erro ao carregar fila: ${e.message}`));
  }

  async function confirmar(id) {
    setProcessando(id);
    try {
      await confirmarNFSe(id);
      carregar();
    } catch (e) {
      setErro(`Erro ao confirmar: ${e.message}`);
    } finally {
      setProcessando(null);
    }
  }

  async function rejeitar(id) {
    setProcessando(id);
    try {
      await rejeitarNFSe(id);
      carregar();
    } catch (e) {
      setErro(`Erro ao rejeitar: ${e.message}`);
    } finally {
      setProcessando(null);
    }
  }

  if (!user || !fila || fila.length === 0) return null;

  return (
    <Panel title={`NFS-e pendentes de revisão (${fila.length})`}>
      {erro && <p style={{ color: "var(--debit)", marginBottom: 8 }}>{erro}</p>}
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
          <thead>
            <tr style={{ textAlign: "left", borderBottom: "1px solid var(--rule)", color: "var(--ink-faint)" }}>
              <th style={{ padding: "8px 4px" }}>Competência</th>
              <th style={{ padding: "8px 4px" }}>Tomador</th>
              <th style={{ padding: "8px 4px", textAlign: "right" }}>Valor</th>
              <th style={{ padding: "8px 4px" }}>Descrição</th>
              <th style={{ padding: "8px 4px", textAlign: "center" }}>Ações</th>
            </tr>
          </thead>
          <tbody>
            {fila.map((item) => (
              <tr key={item.id} style={{ borderBottom: "1px solid var(--rule)", opacity: processando === item.id ? 0.5 : 1 }}>
                <td style={{ padding: "8px 4px", whiteSpace: "nowrap" }}>{formatarDataBR(item.competencia)}</td>
                <td style={{ padding: "8px 4px" }}>{item.tomador}</td>
                <td style={{ padding: "8px 4px", textAlign: "right", color: "var(--credit)" }}>{brl(Number(item.valor))}</td>
                <td style={{ padding: "8px 4px", fontSize: 11, color: "var(--ink-faint)" }}>
                  {item.descricao ? `${item.descricao.slice(0, 40)}…` : "—"}
                </td>
                <td style={{ padding: "8px 4px", textAlign: "center", display: "flex", gap: 4, justifyContent: "center" }}>
                  <button
                    onClick={() => confirmar(item.id)}
                    disabled={processando === item.id}
                    title="Confirmar"
                    style={{ background: "transparent", border: "none", padding: 4, cursor: "pointer", color: "var(--credit)", display: "flex" }}
                  >
                    <CheckCircle2 size={14} />
                  </button>
                  <button
                    onClick={() => rejeitar(item.id)}
                    disabled={processando === item.id}
                    title="Rejeitar"
                    style={{ background: "transparent", border: "none", padding: 4, cursor: "pointer", color: "var(--debit)", display: "flex" }}
                  >
                    <Trash2 size={14} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}
