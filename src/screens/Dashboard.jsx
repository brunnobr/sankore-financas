import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Wallet, TrendingUp, TrendingDown, PiggyBank } from "lucide-react";
import { loadTransacoes } from "../data/transactions.js";
import { loadMonths } from "../data/investments.js";
import { getCategoriasMap } from "../data/settings.js";
import { agregarTx, categoriasDespesa, categoriasReceita, categoriasAporte, avaliarGastos, variacaoPct } from "../lib/finance/categorization.js";
import { brl, labelMes } from "../lib/finance/format.js";
import { Panel, StatCard } from "./shared/ui.jsx";

function mesDe(dataISO) {
  return dataISO.slice(0, 7);
}

const selectStyle = { padding: "6px 10px", border: "1px solid var(--rule)", borderRadius: 8, fontSize: 13, background: "var(--panel)" };

export default function Dashboard() {
  const navigate = useNavigate();
  const [transacoes, setTransacoes] = useState(null);
  const [categoriasMap, setCategoriasMap] = useState(null);
  const [erro, setErro] = useState("");
  const [mesSelecionado, setMesSelecionado] = useState("");
  const [investMonths, setInvestMonths] = useState([]);

  useEffect(() => {
    Promise.all([loadTransacoes(), getCategoriasMap()])
      .then(([t, c]) => { setTransacoes(t); setCategoriasMap(c); })
      .catch((e) => setErro(e.message));
    loadMonths().then(setInvestMonths).catch(() => setInvestMonths([]));
  }, []);

  const pronto = transacoes && categoriasMap;

  // Une os meses do extrato com os meses que só têm aporte registrado
  // (nota de corretagem/print/manual) — o aporte de um mês pode existir
  // antes do extrato bancário daquele mês ser importado, e sem isso o
  // mês nem aparecia como opção pra selecionar.
  const meses = useMemo(() => {
    if (!pronto) return [];
    const doExtrato = transacoes.map((t) => mesDe(t.data));
    const doInvest = investMonths.map((m) => m.key.slice(0, 7));
    return [...new Set([...doExtrato, ...doInvest])].sort();
  }, [pronto, transacoes, investMonths]);

  const mesAtual = mesSelecionado && meses.includes(mesSelecionado) ? mesSelecionado : meses[meses.length - 1];
  const mesAnterior = meses[meses.indexOf(mesAtual) - 1];

  const agAtual = useMemo(() => {
    if (!pronto || !mesAtual) return null;
    return agregarTx(transacoes.filter((t) => mesDe(t.data) === mesAtual), categoriasMap);
  }, [pronto, transacoes, categoriasMap, mesAtual]);

  const agAnterior = useMemo(() => {
    if (!pronto || !mesAnterior) return null;
    return agregarTx(transacoes.filter((t) => mesDe(t.data) === mesAnterior), categoriasMap);
  }, [pronto, transacoes, categoriasMap, mesAnterior]);

  const despesasPorCategoria = agAtual ? categoriasDespesa(agAtual, categoriasMap) : [];
  const receitasPorCategoria = agAtual ? categoriasReceita(agAtual, categoriasMap) : [];
  const aportePorCategoria = agAtual ? categoriasAporte(agAtual, categoriasMap) : [];

  // Para qual ativo específico foi o aporte do mês (contributions.breakdown,
  // já usado em Investimentos > Retorno por ativo) — mesAtual é "YYYY-MM",
  // o mês de investimento é "YYYY-MM-01".
  const aportePorAtivo = useMemo(() => {
    const mes = investMonths.find((m) => m.key.slice(0, 7) === mesAtual);
    const breakdown = mes?.aportes?.ativoBreakdown;
    if (!breakdown || typeof breakdown !== "object") return [];
    return Object.entries(breakdown)
      .map(([ticker, info]) => ({ ticker, valor: Number(info?.valor) || 0 }))
      .filter((a) => a.valor !== 0)
      .sort((a, b) => b.valor - a.valor);
  }, [investMonths, mesAtual]);
  const insights = agAtual ? avaliarGastos(agAtual, agAnterior, categoriasMap) : [];

  const varReceita = agAtual && agAnterior ? variacaoPct(agAtual.receita, agAnterior.receita) : null;
  const varDespesa = agAtual && agAnterior ? variacaoPct(agAtual.despesa, agAnterior.despesa) : null;
  const varAporte = agAtual && agAnterior ? variacaoPct(agAtual.aporte, agAnterior.aporte) : null;
  const varSobra = agAtual && agAnterior ? variacaoPct(agAtual.sobra, agAnterior.sobra) : null;

  if (erro) return <p style={{ color: "var(--debit)" }}>{erro}</p>;
  if (!pronto) return <p style={{ color: "var(--ink-faint)" }}>Carregando…</p>;
  if (!mesAtual) {
    return <Panel><p style={{ color: "var(--ink-faint)", margin: 0 }}>Nenhuma transação importada ainda — use a aba "Importar" para trazer seu extrato.</p></Panel>;
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <select value={mesAtual} onChange={(e) => setMesSelecionado(e.target.value)} style={{ ...selectStyle, alignSelf: "flex-start" }}>
        {[...meses].reverse().map((m) => <option key={m} value={m}>{labelMes(m)}</option>)}
      </select>

      <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
        <StatCard icon={TrendingUp} cor="green" rotulo="Receita" valor={brl(agAtual.receita)} variacao={varReceita} onClick={() => navigate(`/receitas-despesas?mes=${mesAtual}&tipo=receita`)} />
        <StatCard icon={TrendingDown} cor="red" rotulo="Despesa" valor={brl(agAtual.despesa)} variacao={varDespesa} variacaoInvertida onClick={() => navigate(`/receitas-despesas?mes=${mesAtual}&tipo=despesa`)} />
        <StatCard icon={Wallet} cor="blue" rotulo="Aporte" valor={brl(agAtual.aporte)} variacao={varAporte} onClick={() => navigate(`/receitas-despesas?mes=${mesAtual}&tipo=aporte`)} />
        <StatCard
          icon={PiggyBank}
          cor={agAtual.sobra >= 0 ? "green" : "red"}
          rotulo="Sobra do mês"
          valor={brl(agAtual.sobra)}
          variacao={varSobra}
          sub={agAtual.taxaPoupanca != null ? `${agAtual.taxaPoupanca.toFixed(1)}% de taxa de poupança` : undefined}
        />
      </div>

      {insights.length > 0 && (
        <Panel title="O que os dados mostram">
          <ul style={{ margin: 0, paddingLeft: 20, color: "var(--ink-soft)", fontSize: 13, display: "flex", flexDirection: "column", gap: 6 }}>
            {insights.map((i, idx) => (
              <li key={idx} style={{ color: i.tipo === "alta" ? "var(--debit)" : i.tipo === "queda" ? "var(--credit)" : "var(--ink-soft)" }}>{i.texto}</li>
            ))}
          </ul>
        </Panel>
      )}

      <div style={{ display: "flex", gap: 20, flexWrap: "wrap" }}>
        <Panel title="Receitas por categoria" style={{ flex: 1, minWidth: 300 }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <tbody>
              {receitasPorCategoria.map((c) => (
                <tr key={c.cat} style={{ borderBottom: "1px solid var(--rule)" }}>
                  <td style={{ padding: "8px 4px" }}>
                    <span style={{ display: "inline-block", width: 10, height: 10, borderRadius: 3, background: c.cor, marginRight: 8 }} />
                    {c.cat}
                  </td>
                  <td style={{ padding: "8px 4px", textAlign: "right" }}>{brl(c.valor)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>

        <Panel title="Despesas por categoria" style={{ flex: 1, minWidth: 300 }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <tbody>
              {despesasPorCategoria.map((c) => (
                <tr key={c.cat} style={{ borderBottom: "1px solid var(--rule)" }}>
                  <td style={{ padding: "8px 4px" }}>
                    <span style={{ display: "inline-block", width: 10, height: 10, borderRadius: 3, background: c.cor, marginRight: 8 }} />
                    {c.cat}
                  </td>
                  <td style={{ padding: "8px 4px", textAlign: "right" }}>{brl(c.valor)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>
      </div>

      {aportePorCategoria.length > 0 && (
        <Panel title="Composição do aporte do mês">
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <tbody>
              {aportePorCategoria.map((c) => (
                <tr key={c.cat} style={{ borderBottom: "1px solid var(--rule)" }}>
                  <td style={{ padding: "8px 4px" }}>
                    <span style={{ display: "inline-block", width: 10, height: 10, borderRadius: 3, background: c.cor, marginRight: 8 }} />
                    {c.cat}
                    <span style={{ marginLeft: 8, fontSize: 11.5, color: "var(--ink-faint)" }}>{c.valor >= 0 ? "saiu para" : "voltou de"}</span>
                  </td>
                  <td style={{ padding: "8px 4px", textAlign: "right", color: c.valor >= 0 ? "var(--credit)" : "var(--debit)" }}>{brl(c.valor)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {aportePorAtivo.length > 0 && (
            <>
              <p style={{ fontSize: 11.5, color: "var(--ink-faint)", margin: "14px 0 6px" }}>Foi para qual ativo:</p>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <tbody>
                  {aportePorAtivo.map((a) => (
                    <tr key={a.ticker} style={{ borderBottom: "1px solid var(--rule)" }}>
                      <td style={{ padding: "6px 4px" }}>{a.ticker}</td>
                      <td style={{ padding: "6px 4px", textAlign: "right", color: a.valor >= 0 ? "var(--credit)" : "var(--debit)" }}>{brl(a.valor)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
        </Panel>
      )}
    </div>
  );
}
