import { useEffect, useMemo, useState } from "react";
import { loadMonths } from "../data/investments.js";
import { loadTransacoes } from "../data/transactions.js";
import { getAssetGroupMap, getAssetTipoMap, getCategoriasMap } from "../data/settings.js";
import { calcularFinancialScore, montarContextoMes, gerarInsights } from "../lib/finance/score.js";
import { brl, num, pct, labelMes } from "../lib/finance/format.js";
import { Panel } from "./shared/ui.jsx";

const selectStyle = { padding: "6px 8px", border: "1px solid var(--rule)", borderRadius: 6, fontSize: 13, background: "var(--panel)" };

const PRIORIDADE_LABEL = { alta: "🔴 alta", media: "🟡 média", baixa: "⚪ baixa" };

function corNota(nota) {
  if (nota >= 7.5) return "var(--credit)";
  if (nota >= 5.5) return "#d97706";
  return "var(--debit)";
}

function BarraCriterio({ criterio }) {
  const semDado = criterio.nota === null;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <span style={{ flex: 1, fontSize: 12.5, color: "var(--ink-soft)" }}>{criterio.label}</span>
      <div style={{ width: 120, height: 8, borderRadius: 4, background: "var(--rule)", overflow: "hidden" }}>
        {!semDado && <div style={{ width: `${criterio.nota * 10}%`, height: "100%", background: corNota(criterio.nota) }} />}
      </div>
      <span style={{ width: 70, textAlign: "right", fontSize: 12.5, fontWeight: 600, color: semDado ? "var(--ink-faint)" : "var(--ink)" }}>
        {semDado ? "sem dado" : `${num(criterio.nota, 1)}/10`}
      </span>
    </div>
  );
}

function BlocoInsightsPorTipo({ titulo, cor, itens }) {
  if (!itens.length) return null;
  return (
    <div style={{ borderLeft: `3px solid ${cor}`, paddingLeft: 14 }}>
      <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: 0.4, textTransform: "uppercase", color: cor, marginBottom: 6 }}>{titulo}</div>
      {itens.map((ins) => (
        <div key={ins.id} style={{ padding: "8px 0", borderTop: "1px solid var(--rule)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
            <span style={{ fontSize: 13, fontWeight: 600 }}>{ins.titulo}</span>
            <span style={{ fontSize: 10.5, color: "var(--ink-faint)", flexShrink: 0 }}>{PRIORIDADE_LABEL[ins.prioridade]}</span>
          </div>
          <div style={{ fontSize: 12.5, color: "var(--ink-soft)", marginTop: 3, lineHeight: 1.5 }}>{ins.descricao}</div>
        </div>
      ))}
    </div>
  );
}

export default function Analytics() {
  const [months, setMonths] = useState(null);
  const [transacoes, setTransacoes] = useState(null);
  const [assetGroupMap, setAssetGroupMap] = useState(null);
  const [assetTipoMap, setAssetTipoMap] = useState(null);
  const [categoriasMap, setCategoriasMap] = useState(null);
  const [erro, setErro] = useState("");
  const [mesIndex, setMesIndex] = useState(null); // índice em `months`; null = último

  useEffect(() => {
    Promise.all([loadMonths(), loadTransacoes(), getAssetGroupMap(), getAssetTipoMap(), getCategoriasMap()])
      .then(([ms, t, g, at, c]) => { setMonths(ms); setTransacoes(t); setAssetGroupMap(g); setAssetTipoMap(at); setCategoriasMap(c); })
      .catch((e) => setErro(e.message || "Erro ao carregar dados de analytics."));
  }, []);

  const pronto = months && transacoes && assetGroupMap && assetTipoMap && categoriasMap;

  const idxMes = pronto && months.length ? (mesIndex ?? months.length - 1) : null;

  const { ctx, score, insights } = useMemo(() => {
    if (!pronto || idxMes == null) return { ctx: null, score: null, insights: [] };
    const latest = months[idxMes];
    const mesYM = latest.key.slice(0, 7);
    const prevMes = idxMes > 0 ? months[idxMes - 1] : null;
    const prevYM = prevMes ? prevMes.key.slice(0, 7) : null;
    const transacoesDoMes = transacoes.filter((t) => t.data.slice(0, 7) === mesYM);
    const transacoesMesAnterior = prevYM ? transacoes.filter((t) => t.data.slice(0, 7) === prevYM) : null;
    const c = montarContextoMes({ months, idxMes, assetGroupMap, assetTipoMap, categoriasMap, transacoesDoMes, transacoesMesAnterior, transacoesTodas: transacoes });
    return { ctx: c, score: calcularFinancialScore(c), insights: gerarInsights(c) };
  }, [pronto, idxMes, months, transacoes, assetGroupMap, assetTipoMap, categoriasMap]);

  if (erro) return <p style={{ color: "var(--debit)" }}>{erro}</p>;
  if (!pronto) return <p style={{ color: "var(--ink-faint)" }}>Carregando…</p>;
  if (!months.length) {
    return <Panel><p style={{ color: "var(--ink-faint)", margin: 0 }}>Nenhum fechamento de mês cadastrado ainda — registre um saldo em Importar ou Investimentos.</p></Panel>;
  }

  const porTipo = (tipo) => insights.filter((i) => i.tipo === tipo);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <select value={idxMes} onChange={(e) => setMesIndex(Number(e.target.value))} style={{ ...selectStyle, alignSelf: "flex-start" }}>
        {months.map((m, i) => <option key={m.key} value={i}>{labelMes(m.key)}</option>)}
      </select>

      <Panel title="Financial Score">
        <div style={{ display: "flex", gap: 24, alignItems: "flex-start", flexWrap: "wrap" }}>
          <div style={{ textAlign: "center", minWidth: 110 }}>
            <div style={{ fontSize: 40, fontWeight: 700, color: score.notaFinal != null ? corNota(score.notaFinal) : "var(--ink-faint)" }}>
              {score.notaFinal != null ? num(score.notaFinal, 1) : "—"}
            </div>
            <div style={{ fontSize: 11.5, color: "var(--ink-faint)" }}>de 10</div>
          </div>
          <div style={{ flex: 1, minWidth: 260, display: "flex", flexDirection: "column", gap: 8 }}>
            {score.criterios.map((c) => <BarraCriterio key={c.chave} criterio={c} />)}
          </div>
        </div>
      </Panel>

      {insights.length > 0 && (
        <Panel title="O que os dados mostram">
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <BlocoInsightsPorTipo titulo="Riscos e alertas" cor="var(--debit)" itens={[...porTipo("Risco"), ...porTipo("Alerta")]} />
            <BlocoInsightsPorTipo titulo="Oportunidades" cor="#2563eb" itens={porTipo("Oportunidade")} />
            <BlocoInsightsPorTipo titulo="Conquistas" cor="var(--credit)" itens={[...porTipo("Conquista"), ...porTipo("Sucesso")]} />
          </div>
        </Panel>
      )}
      {insights.length === 0 && (
        <Panel><p style={{ color: "var(--ink-faint)", margin: 0, fontSize: 13 }}>Nenhum ponto de atenção neste més.</p></Panel>
      )}

      <div style={{ display: "flex", gap: 20, flexWrap: "wrap" }}>
        <Panel title="Diagnóstico do mês" style={{ flex: 1, minWidth: 280 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 8, fontSize: 13 }}>
            <Linha rotulo="Receita" valor={brl(ctx.ag.receita)} />
            <Linha rotulo="Despesa" valor={brl(ctx.ag.despesa)} />
            <Linha rotulo="Aporte" valor={brl(ctx.ag.aporte)} />
            <Linha rotulo="Sobra" valor={brl(ctx.ag.sobra)} cor={ctx.ag.sobra >= 0 ? "var(--credit)" : "var(--debit)"} />
            <Linha rotulo="Taxa de poupança" valor={ctx.ag.taxaPoupanca != null ? pct(ctx.ag.taxaPoupanca, 1) : "—"} />
          </div>
        </Panel>
        <Panel title="Reserva" style={{ flex: 1, minWidth: 280 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 8, fontSize: 13 }}>
            <Linha rotulo="Reserva atual" valor={brl(ctx.reservaAtual)} />
            <Linha rotulo="Alvo (3 meses de despesa)" valor={ctx.reservaAlvo != null ? brl(ctx.reservaAlvo) : "sem histórico suficiente"} />
            <Linha rotulo="% em caixa" valor={ctx.pctCaixa != null ? pct(ctx.pctCaixa, 1) : "—"} />
          </div>
        </Panel>
      </div>
    </div>
  );
}

function Linha({ rotulo, valor, cor }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between" }}>
      <span style={{ color: "var(--ink-faint)" }}>{rotulo}</span>
      <span style={{ fontWeight: 600, color: cor || "var(--ink)" }}>{valor}</span>
    </div>
  );
}
