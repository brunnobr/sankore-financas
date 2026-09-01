import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { loadTransacoes, atualizarCategoriaTransacao } from "../data/transactions.js";
import { getCategoriasMap } from "../data/settings.js";
import { brl, formatarDataBR } from "../lib/finance/format.js";
import { Panel } from "./shared/ui.jsx";

const selectStyle = { padding: 8, border: "1px solid var(--rule)", borderRadius: 8, fontSize: 13, background: "var(--panel)" };
const selectCatStyle = { padding: "4px 6px", border: "1px solid var(--rule)", borderRadius: 6, fontSize: 13, background: "var(--panel)", color: "var(--ink-faint)" };
const TIPOS = { receita: "Receita", despesa: "Despesa", aporte: "Aporte" };

export default function ReceitasDespesas() {
  const [searchParams] = useSearchParams();
  const [transacoes, setTransacoes] = useState(null);
  const [categoriasMap, setCategoriasMap] = useState(null);
  const [erro, setErro] = useState("");
  const [filtroCategoria, setFiltroCategoria] = useState("");
  const [filtroBanco, setFiltroBanco] = useState("");
  const [filtroMes, setFiltroMes] = useState(searchParams.get("mes") || "");
  const [filtroTipo, setFiltroTipo] = useState(searchParams.get("tipo") || "");

  useEffect(() => {
    Promise.all([loadTransacoes(), getCategoriasMap()])
      .then(([t, c]) => { setTransacoes(t); setCategoriasMap(c); })
      .catch((e) => setErro(e.message));
  }, []);

  async function onMudarCategoria(id, novaCategoria) {
    setTransacoes((prev) => prev.map((t) => (t.id === id ? { ...t, cat: novaCategoria } : t)));
    try {
      await atualizarCategoriaTransacao(id, novaCategoria);
    } catch (e) {
      setErro(e.message || "Erro ao atualizar categoria.");
    }
  }

  const categoriasDisponiveis = useMemo(() => (categoriasMap ? Object.keys(categoriasMap).sort() : []), [categoriasMap]);
  const categorias = useMemo(() => transacoes ? [...new Set(transacoes.map((t) => t.cat))].sort() : [], [transacoes]);
  const bancos = useMemo(() => transacoes ? [...new Set(transacoes.map((t) => t.banco).filter(Boolean))].sort() : [], [transacoes]);
  const meses = useMemo(() => transacoes ? [...new Set(transacoes.map((t) => t.data.slice(0, 7)))].sort().reverse() : [], [transacoes]);

  const filtradas = useMemo(() => {
    if (!transacoes) return [];
    return transacoes.filter((t) =>
      (!filtroCategoria || t.cat === filtroCategoria) &&
      (!filtroBanco || t.banco === filtroBanco) &&
      (!filtroMes || t.data.slice(0, 7) === filtroMes) &&
      (!filtroTipo || (categoriasMap[t.cat]?.tipo || "despesa") === filtroTipo)
    );
  }, [transacoes, filtroCategoria, filtroBanco, filtroMes, filtroTipo, categoriasMap]);

  const total = filtradas.reduce((s, t) => s + t.valor, 0);

  if (erro) return <p style={{ color: "var(--debit)" }}>{erro}</p>;
  if (!transacoes || !categoriasMap) return <p style={{ color: "var(--ink-faint)" }}>Carregando…</p>;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
        <select value={filtroMes} onChange={(e) => setFiltroMes(e.target.value)} style={selectStyle}>
          <option value="">Todos os meses</option>
          {meses.map((m) => <option key={m} value={m}>{m}</option>)}
        </select>
        <select value={filtroCategoria} onChange={(e) => setFiltroCategoria(e.target.value)} style={selectStyle}>
          <option value="">Todas as categorias</option>
          {categorias.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <select value={filtroBanco} onChange={(e) => setFiltroBanco(e.target.value)} style={selectStyle}>
          <option value="">Todos os bancos</option>
          {bancos.map((b) => <option key={b} value={b}>{b}</option>)}
        </select>
        <select value={filtroTipo} onChange={(e) => setFiltroTipo(e.target.value)} style={selectStyle}>
          <option value="">Receita, despesa e aporte</option>
          {Object.entries(TIPOS).map(([k, label]) => <option key={k} value={k}>{label}</option>)}
        </select>
      </div>

      {transacoes.length === 0 ? (
        <Panel><p style={{ color: "var(--ink-faint)", margin: 0 }}>Nenhuma transação importada ainda — use a aba "Importar" para trazer seu extrato.</p></Panel>
      ) : (
        <Panel title={`${filtradas.length} transação(ões) — total ${brl(total)}`}>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ textAlign: "left", borderBottom: "1px solid var(--rule)", color: "var(--ink-faint)" }}>
                  <th style={{ padding: "6px 4px" }}>Data</th>
                  <th style={{ padding: "6px 4px" }}>Descrição</th>
                  <th style={{ padding: "6px 4px" }}>Categoria</th>
                  <th style={{ padding: "6px 4px" }}>Banco</th>
                  <th style={{ padding: "6px 4px", textAlign: "right" }}>Valor</th>
                </tr>
              </thead>
              <tbody>
                {filtradas.map((t) => (
                  <tr key={t.id} style={{ borderBottom: "1px solid var(--rule)" }}>
                    <td style={{ padding: "8px 4px", whiteSpace: "nowrap" }}>{formatarDataBR(t.data)}</td>
                    <td style={{ padding: "8px 4px" }}>{t.desc}</td>
                    <td style={{ padding: "8px 4px" }}>
                      <select value={t.cat} onChange={(e) => onMudarCategoria(t.id, e.target.value)} style={selectCatStyle}>
                        {!categoriasDisponiveis.includes(t.cat) && <option value={t.cat}>{t.cat}</option>}
                        {categoriasDisponiveis.map((c) => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </td>
                    <td style={{ padding: "8px 4px", color: "var(--ink-faint)" }}>{t.banco}</td>
                    <td style={{ padding: "8px 4px", textAlign: "right", color: t.valor >= 0 ? "var(--credit)" : "var(--debit)", whiteSpace: "nowrap" }}>{brl(t.valor)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      )}
    </div>
  );
}
