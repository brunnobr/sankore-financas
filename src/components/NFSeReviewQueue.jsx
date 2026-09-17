import { useEffect, useState } from "react";
import { CheckCircle2, AlertCircle, Trash2 } from "lucide-react";
import { supabase } from "../data/supabaseClient";
import { useAuth } from "../data/AuthContext";

export function NFSeReviewQueue() {
  const auth = useAuth();
  const user = auth?.session?.user;
  
  const [queue, setQueue] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");
  const [processando, setProcessando] = useState(null);

  useEffect(() => {
    if (!user) {
      setCarregando(false);
      return;
    }
    carregarQueue();
  }, [user]);

  async function carregarQueue() {
    try {
      setCarregando(true);
      const { data, error } = await supabase
        .from("nfse")
        .select("*")
        .eq("user_id", user.id)
        .eq("status", "pendente")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setQueue(data || []);
    } catch (e) {
      setErro(`Erro ao carregar fila: ${e.message}`);
    } finally {
      setCarregando(false);
    }
  }

  async function confirmar(id) {
    setProcessando(id);
    try {
      const { error } = await supabase
        .from("nfse")
        .update({ status: "confirmada" })
        .eq("id", id)
        .eq("user_id", user.id);

      if (error) throw error;
      carregarQueue();
    } catch (e) {
      setErro(`Erro ao confirmar: ${e.message}`);
    } finally {
      setProcessando(null);
    }
  }

  async function rejeitar(id) {
    setProcessando(id);
    try {
      const { error } = await supabase
        .from("nfse")
        .update({ status: "rejeitada" })
        .eq("id", id)
        .eq("user_id", user.id);

      if (error) throw error;
      carregarQueue();
    } catch (e) {
      setErro(`Erro ao rejeitar: ${e.message}`);
    } finally {
      setProcessando(null);
    }
  }

  if (!user) {
    return <p style={{ color: "var(--ink-faint)", fontSize: 13 }}>Faça login para ver a fila de revisão.</p>;
  }

  if (carregando) {
    return <p style={{ color: "var(--ink-faint)", fontSize: 13 }}>Carregando fila…</p>;
  }

  if (queue.length === 0) {
    return <p style={{ color: "var(--ink-faint)", fontSize: 13 }}>Nenhuma nota fiscal pendente.</p>;
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {erro && <p style={{ color: "var(--debit)", marginBottom: 0 }}>{erro}</p>}
      
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
          <thead>
            <tr style={{ textAlign: "left", borderBottom: "1px solid var(--rule)", color: "var(--ink-faint)" }}>
              <th style={{ padding: "8px 4px" }}>Data</th>
              <th style={{ padding: "8px 4px" }}>Tomador</th>
              <th style={{ padding: "8px 4px", textAlign: "right" }}>Valor</th>
              <th style={{ padding: "8px 4px" }}>Descrição</th>
              <th style={{ padding: "8px 4px", textAlign: "center" }}>Ações</th>
            </tr>
          </thead>
          <tbody>
            {queue.map((item) => (
              <tr key={item.id} style={{ borderBottom: "1px solid var(--rule)" }}>
                <td style={{ padding: "8px 4px", whiteSpace: "nowrap" }}>
                  {new Date(item.data_emissao).toLocaleDateString("pt-BR")}
                </td>
                <td style={{ padding: "8px 4px" }}>{item.tomador_nome}</td>
                <td style={{ padding: "8px 4px", textAlign: "right", color: "var(--credit)" }}>
                  R$ {(item.valor / 100).toFixed(2).replace(".", ",")}
                </td>
                <td style={{ padding: "8px 4px", fontSize: 11, color: "var(--ink-faint)" }}>
                  {item.descricao_servico?.slice(0, 40)}…
                </td>
                <td style={{ padding: "8px 4px", textAlign: "center", display: "flex", gap: 4, justifyContent: "center" }}>
                  <button
                    onClick={() => confirmar(item.id)}
                    disabled={processando === item.id}
                    title="Confirmar"
                    style={{
                      background: "transparent",
                      border: "none",
                      padding: 4,
                      cursor: "pointer",
                      color: "var(--credit)",
                      display: "flex",
                    }}
                  >
                    <CheckCircle2 size={14} />
                  </button>
                  <button
                    onClick={() => rejeitar(item.id)}
                    disabled={processando === item.id}
                    title="Rejeitar"
                    style={{
                      background: "transparent",
                      border: "none",
                      padding: 4,
                      cursor: "pointer",
                      color: "var(--debit)",
                      display: "flex",
                    }}
                  >
                    <Trash2 size={14} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
