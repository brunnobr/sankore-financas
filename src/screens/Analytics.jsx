import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  LineChart, Line, BarChart, Bar, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend, Cell,
} from "recharts";
import { loadMonths } from "../data/investments.js";
import { loadTransacoes } from "../data/transactions.js";
import { loadNFSeConfirmadas, resumoTetoMei } from "../data/nfse.js";
import { getAssetGroupMap, getAssetTipoMap, getCategoriasMap } from "../data/settings.js";
import {
  PERIODOS, COMPARACOES, resolverPeriodo, resolverComparacao, agregarPeriodo, serieFluxoMensal,
  seriePatrimonial, despesasComVariacao, maioresDespesas, receitasComRecorrencia, indicadoresFinanceiros,
  insightsAvancados, historicoAportes,
} from "../lib/finance/analytics.js";
import { gruposDoMes, tiposDoMes, investido, caixaDoMes } from "../lib/finance/returns.js";
import { calcularFinancialScore, montarContextoMes } from "../lib/finance/score.js";
import { brl, num, pct as pctFmt, labelMes } from "../lib/finance/format.js";
import { Panel } from "./shared/ui.jsx";

const selectStyle = { padding: "6px 10px", border: "1px solid var(--rule)", borderRadius: 8, fontSize: 13, background: "var(--panel)" };
const corVariacao = (v, invertida = false) => (v == null ? "var(--ink-faint)" : (invertida ? v <= 0 : v >= 0) ? "var(--credit)" : "var(--debit)");
const setaVariacao = (v) => (v == null ? "" : v >= 0 ? "▲" : "▼");
const CORES_TIPO_INSIGHT = { alerta: "var(--debit)", atencao: "#d97706", positivo: "var(--credit)", informativo: "var(--ink-faint)" };
const CHART_COLORS = ["#186040", "#3C5C7A", "#9C6B45", "#7B846F", "#8E2721", "#5A6B8A"];

function SemDados({ children }) {
  return <p style={{ color: "var(--ink-faint)", fontSize: 12.5, fontStyle: "italic", margin: "6px 0" }}>{children}</p>;
}

function Indicador({ rotulo, valor, variacao, invertida, cor }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4, flex: 1, minWidth: 180 }}>
      <span style={{ fontSize: 12, color: "var(--ink-faint)" }}>{rotulo}</span>
      <span style={{ fontSize: 22, fontWeight: 700, color: cor || "var(--ink)" }}>{valor}</span>
      {variacao != null && (
        <span style={{ fontSize: 12, color: corVariacao(variacao, invertida) }}>{setaVariacao(variacao)} {pctFmt(variacao, 1)} vs. comparação</span>
      )}
    </div>
  );
}

export default function Analytics() {
  const navigate = useNavigate();
  const [transacoes, setTransacoes] = useState(null);
  const [months, setMonths] = useState(null);
  const [categoriasMap, setCategoriasMap] = useState(null);
  const [assetGroupMap, setAssetGroupMap] = useState(null);
  const [assetTipoMap, setAssetTipoMap] = useState(null);
  const [nfseConfirmadas, setNfseConfirmadas] = useState(null);
  const [tetoMei, setTetoMei] = useState(null);
  const [erro, setErro] = useState("");

  const [periodo, setPeriodo] = useState("6m");
  const [compararCom, setCompararCom] = useState("anterior");
  const [customIni, setCustomIni] = useState("");
  const [customFim, setCustomFim] = useState("");
  const [filtroBanco, setFiltroBanco] = useState("");
  const [filtroCategoria, setFiltroCategoria] = useState("");
  const [filtroTipo, setFiltroTipo] = useState("");

  useEffect(() => {
    Promise.all([loadTransacoes(), loadMonths(), getCategoriasMap(), getAssetGroupMap(), getAssetTipoMap(), loadNFSeConfirmadas().catch(() => [])])
      .then(([t, ms, c, g, at, nf]) => {
        setTransacoes(t); setMonths(ms); setCategoriasMap(c); setAssetGroupMap(g); setAssetTipoMap(at); setNfseConfirmadas(nf);
        const ano = new Date().getFullYear();
        resumoTetoMei(ano).then(setTetoMei).catch(() => setTetoMei(null));
      })
      .catch((e) => setErro(e.message || "Erro ao carregar dados de analytics."));
  }, []);

  const pronto = transacoes && months && categoriasMap && assetGroupMap && assetTipoMap;

  // Mesma união usada em Dashboard.jsx — mês com só transação ou só
  // fechamento de investimento continua selecionável.
  const todasMeses = useMemo(() => {
    if (!pronto) return [];
    const doExtrato = transacoes.map((t) => t.data.slice(0, 7));
    const doInvest = months.map((m) => m.key.slice(0, 7));
    return [...new Set([...doExtrato, ...doInvest])].sort();
  }, [pronto, transacoes, months]);

  const transacoesFiltradasBase = useMemo(() => {
    if (!pronto) return [];
    return transacoes.filter((t) =>
      (!filtroBanco || t.banco === filtroBanco) &&
      (!filtroCategoria || t.cat === filtroCategoria) &&
      (!filtroTipo || (categoriasMap[t.cat]?.tipo || "despesa") === filtroTipo)
    );
  }, [pronto, transacoes, categoriasMap, filtroBanco, filtroCategoria, filtroTipo]);

  const bancos = useMemo(() => pronto ? [...new Set(transacoes.map((t) => t.banco).filter(Boolean))].sort() : [], [pronto, transacoes]);
  const categorias = useMemo(() => categoriasMap ? Object.keys(categoriasMap).sort() : [], [categoriasMap]);

  const mesesSelecionados = useMemo(() => resolverPeriodo(periodo, todasMeses, customIni, customFim), [periodo, todasMeses, customIni, customFim]);
  const mesesComparacao = useMemo(() => resolverComparacao(compararCom, mesesSelecionados, todasMeses), [compararCom, mesesSelecionados, todasMeses]);

  const analise = useMemo(() => {
    if (!pronto || !mesesSelecionados.length) return null;

    const agAtual = agregarPeriodo(transacoesFiltradasBase, categoriasMap, mesesSelecionados);
    const agAnterior = mesesComparacao ? agregarPeriodo(transacoesFiltradasBase, categoriasMap, mesesComparacao) : null;

    const fluxoSerie = serieFluxoMensal(transacoesFiltradasBase, categoriasMap, todasMeses.slice(-12));
    const patrimonioSerie = seriePatrimonial(months, assetGroupMap, todasMeses.slice(-12));

    const despesasVar = despesasComVariacao(agAtual, agAnterior, categoriasMap);
    const maioresDesp = maioresDespesas(agAtual.transacoes, categoriasMap, 8);
    const receitasVar = receitasComRecorrencia(transacoesFiltradasBase, categoriasMap, agAtual, agAnterior, todasMeses);

    const monthsSelecionados = months.filter((m) => mesesSelecionados.includes(m.key.slice(0, 7)));
    const ultimoMesInvest = monthsSelecionados[monthsSelecionados.length - 1] || null;
    const grupos = ultimoMesInvest ? gruposDoMes(assetGroupMap, ultimoMesInvest) : [];
    const tipos = ultimoMesInvest ? tiposDoMes(assetTipoMap, ultimoMesInvest) : [];
    const reservaGrupo = grupos.find((g) => g.grupo === "RESERVA");
    const reservaAtual = reservaGrupo ? reservaGrupo.valor : 0;

    const monthsComparacao = mesesComparacao ? months.filter((m) => mesesComparacao.includes(m.key.slice(0, 7))) : [];
    const ultimoMesInvestAnterior = monthsComparacao[monthsComparacao.length - 1] || null;

    const janelaDespesa = todasMeses.slice(-6);
    const mediaDespesa = janelaDespesa.length
      ? janelaDespesa.reduce((s, ym) => s + agregarPeriodo(transacoesFiltradasBase, categoriasMap, [ym]).despesa, 0) / janelaDespesa.length
      : null;

    const aportesEvolucao = todasMeses.slice(-12).map((ym) => {
      const m = months.find((mm) => mm.key.slice(0, 7) === ym);
      return { mes: ym, aporte: m?.aportes?.total || 0 };
    });

    const principalFonte = receitasVar[0];
    const indicadores = indicadoresFinanceiros({
      agAtual,
      patrimonioAtual: ultimoMesInvest ? investido(assetGroupMap, ultimoMesInvest) + caixaDoMes(assetGroupMap, ultimoMesInvest) : null,
      patrimonioAnterior: ultimoMesInvestAnterior ? investido(assetGroupMap, ultimoMesInvestAnterior) + caixaDoMes(assetGroupMap, ultimoMesInvestAnterior) : null,
      reservaAtual,
      despesaMediaMensal: mediaDespesa,
      principalFontePct: principalFonte ? principalFonte.pct : null,
    });

    const aportesHist = historicoAportes(months, todasMeses.slice(-12));
    const idxIndicadorPatrim = indicadores.findIndex((i) => i.chave === "crescimentoPatrimonial");
    const indPatrim = indicadores[idxIndicadorPatrim];
    const patrimonioDelta = (!indPatrim.semDados && ultimoMesInvest)
      ? { total: investido(assetGroupMap, ultimoMesInvest) + caixaDoMes(assetGroupMap, ultimoMesInvest) - (investido(assetGroupMap, ultimoMesInvestAnterior) + caixaDoMes(assetGroupMap, ultimoMesInvestAnterior)), aporte: null, valorizacao: null }
      : null;

    const insights = insightsAvancados({ despesasVar, receitasRec: receitasVar, aportesHistorico: aportesHist, patrimonioDelta, agAtual });

    // Financial Score — snapshot do último mês do período selecionado.
    let score = null;
    if (ultimoMesInvest) {
      const idxMes = months.indexOf(ultimoMesInvest);
      const mesYM = ultimoMesInvest.key.slice(0, 7);
      const idxAnterior = idxMes > 0 ? idxMes - 1 : -1;
      const prevYM = idxAnterior >= 0 ? months[idxAnterior].key.slice(0, 7) : null;
      const ctx = montarContextoMes({
        months, idxMes, assetGroupMap, assetTipoMap, categoriasMap,
        transacoesDoMes: transacoes.filter((t) => t.data.slice(0, 7) === mesYM),
        transacoesMesAnterior: prevYM ? transacoes.filter((t) => t.data.slice(0, 7) === prevYM) : null,
        transacoesTodas: transacoes,
      });
      score = calcularFinancialScore(ctx);
    }

    return { agAtual, agAnterior, fluxoSerie, patrimonioSerie, despesasVar, maioresDesp, receitasVar, grupos, tipos, indicadores, insights, score, aportesEvolucao, ultimoMesInvest };
  }, [pronto, mesesSelecionados, mesesComparacao, transacoesFiltradasBase, categoriasMap, months, assetGroupMap, assetTipoMap, todasMeses, transacoes]);

  if (erro) return <p style={{ color: "var(--debit)" }}>{erro}</p>;
  if (!pronto) return <p style={{ color: "var(--ink-faint)" }}>Carregando…</p>;
  if (!todasMeses.length) {
    return <Panel><p style={{ color: "var(--ink-faint)", margin: 0 }}>Nenhum dado importado ainda — use a aba "Importar" para trazer extrato e investimentos.</p></Panel>;
  }

  const rotuloPeriodo = mesesSelecionados.length === 1 ? labelMes(mesesSelecionados[0]) : mesesSelecionados.length ? `${labelMes(mesesSelecionados[0])} — ${labelMes(mesesSelecionados[mesesSelecionados.length - 1])}` : "—";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      {/* 1. Cabeçalho e filtros */}
      <div>
        <p style={{ color: "var(--ink-faint)", fontSize: 13, margin: "0 0 12px" }}>Entenda o comportamento das suas finanças.</p>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          <select value={periodo} onChange={(e) => setPeriodo(e.target.value)} style={selectStyle}>
            {PERIODOS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
          </select>
          {periodo === "custom" && (
            <>
              <input type="month" value={customIni} onChange={(e) => setCustomIni(e.target.value)} style={selectStyle} />
              <span style={{ color: "var(--ink-faint)" }}>até</span>
              <input type="month" value={customFim} onChange={(e) => setCustomFim(e.target.value)} style={selectStyle} />
            </>
          )}
          <select value={compararCom} onChange={(e) => setCompararCom(e.target.value)} style={selectStyle}>
            {COMPARACOES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
          </select>
          <select value={filtroBanco} onChange={(e) => setFiltroBanco(e.target.value)} style={selectStyle}>
            <option value="">Todas as contas</option>
            {bancos.map((b) => <option key={b} value={b}>{b}</option>)}
          </select>
          <select value={filtroCategoria} onChange={(e) => setFiltroCategoria(e.target.value)} style={selectStyle}>
            <option value="">Todas as categorias</option>
            {categorias.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <select value={filtroTipo} onChange={(e) => setFiltroTipo(e.target.value)} style={selectStyle}>
            <option value="">Todos os tipos</option>
            <option value="receita">Receita</option>
            <option value="despesa">Despesa</option>
            <option value="aporte">Aporte</option>
          </select>
        </div>
        {compararCom !== "nenhum" && !mesesComparacao && (
          <SemDados>Sem dados suficientes para essa comparação — mostrando só o período selecionado ({rotuloPeriodo}).</SemDados>
        )}
      </div>

      {!analise ? (
        <Panel><SemDados>Sem transações ou fechamentos no período selecionado.</SemDados></Panel>
      ) : (
        <>
          {/* 2. Visão financeira */}
          <Panel title="Visão financeira">
            <div style={{ display: "flex", gap: 20, flexWrap: "wrap", marginBottom: 16 }}>
              <Indicador rotulo="Receitas" valor={brl(analise.agAtual.receita)} variacao={analise.agAnterior ? variacaoPctLocal(analise.agAtual.receita, analise.agAnterior.receita) : null} />
              <Indicador rotulo="Despesas" valor={brl(analise.agAtual.despesa)} variacao={analise.agAnterior ? variacaoPctLocal(analise.agAtual.despesa, analise.agAnterior.despesa) : null} invertida />
              <Indicador rotulo="Resultado operacional" valor={brl(analise.agAtual.resultadoOperacional)} cor={analise.agAtual.resultadoOperacional >= 0 ? "var(--credit)" : "var(--debit)"} />
              <Indicador rotulo="Aportes" valor={brl(analise.agAtual.aporte)} variacao={analise.agAnterior ? variacaoPctLocal(analise.agAtual.aporte, analise.agAnterior.aporte) : null} />
            </div>
            <div style={{ padding: "12px 14px", background: "var(--bg-soft, rgba(0,0,0,0.02))", borderRadius: 8, fontSize: 13, display: "flex", flexDirection: "column", gap: 4 }}>
              <LinhaCalc label="Resultado operacional" valor={brl(analise.agAtual.resultadoOperacional)} />
              <LinhaCalc label="− Aportes" valor={brl(analise.agAtual.aporte)} />
              <LinhaCalc label="= Fluxo líquido após investimentos" valor={brl(analise.agAtual.fluxoLiquido)} destaque cor={analise.agAtual.fluxoLiquido >= 0 ? "var(--credit)" : "var(--debit)"} />
            </div>
          </Panel>

          {/* 3. Fluxo financeiro */}
          <Panel title="Fluxo financeiro">
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={analise.fluxoSerie}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--rule)" />
                <XAxis dataKey="mes" tickFormatter={(m) => labelMes(m).slice(0, 3)} stroke="var(--ink-faint)" fontSize={12} />
                <YAxis stroke="var(--ink-faint)" fontSize={12} tickFormatter={(v) => brl(v)} width={90} />
                <Tooltip labelFormatter={(m) => labelMes(m)} formatter={(v, n) => [brl(v), n]} />
                <Legend />
                <Line type="monotone" dataKey="receita" name="Receitas" stroke="var(--credit)" dot={false} />
                <Line type="monotone" dataKey="despesa" name="Despesas" stroke="var(--debit)" dot={false} />
                <Line type="monotone" dataKey="aporte" name="Aportes" stroke="#3C5C7A" dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </Panel>

          {/* 4. Evolução patrimonial */}
          <Panel title="Evolução patrimonial">
            {analise.patrimonioSerie.length ? (
              <ResponsiveContainer width="100%" height={240}>
                <AreaChart data={analise.patrimonioSerie}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--rule)" />
                  <XAxis dataKey="mes" tickFormatter={(m) => labelMes(m).slice(0, 3)} stroke="var(--ink-faint)" fontSize={12} />
                  <YAxis stroke="var(--ink-faint)" fontSize={12} tickFormatter={(v) => brl(v)} width={90} />
                  <Tooltip labelFormatter={(m) => labelMes(m)} formatter={(v, n) => [n === "rentabilidade" ? (v == null ? "—" : brl(v)) : brl(v), n === "patrimonio" ? "Patrimônio" : n === "aporte" ? "Aporte" : "Rentabilidade do mês"]} />
                  <Area type="monotone" dataKey="patrimonio" name="Patrimônio" stroke="var(--credit)" fill="var(--credit)" fillOpacity={0.15} />
                </AreaChart>
              </ResponsiveContainer>
            ) : <SemDados>Sem fechamentos de investimento no período.</SemDados>}
          </Panel>

          {/* 5. Análise de despesas */}
          <Panel title="Despesas">
            {analise.despesasVar.length ? (
              <>
                <ResponsiveContainer width="100%" height={Math.max(180, analise.despesasVar.length * 34)}>
                  <BarChart data={analise.despesasVar} layout="vertical" margin={{ left: 90 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--rule)" />
                    <XAxis type="number" tickFormatter={(v) => brl(v)} stroke="var(--ink-faint)" fontSize={11} />
                    <YAxis type="category" dataKey="cat" width={110} stroke="var(--ink-faint)" fontSize={12} />
                    <Tooltip formatter={(v) => brl(v)} />
                    <Bar dataKey="valor" radius={[0, 4, 4, 0]} onClick={(d) => navigate(`/receitas-despesas?categoria=${encodeURIComponent(d.cat)}`)} cursor="pointer">
                      {analise.despesasVar.map((c, i) => <Cell key={c.cat} fill={c.cor || CHART_COLORS[i % CHART_COLORS.length]} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5, marginTop: 8 }}>
                  <tbody>
                    {analise.despesasVar.map((c) => (
                      <tr key={c.cat} style={{ borderBottom: "1px solid var(--rule)", cursor: "pointer" }} onClick={() => navigate(`/receitas-despesas?categoria=${encodeURIComponent(c.cat)}`)}>
                        <td style={{ padding: "6px 4px" }}>{c.cat}</td>
                        <td style={{ padding: "6px 4px", textAlign: "right" }}>{brl(c.valor)}</td>
                        <td style={{ padding: "6px 4px", textAlign: "right", color: "var(--ink-faint)" }}>{num(c.pct, 1)}%</td>
                        <td style={{ padding: "6px 4px", textAlign: "right", color: corVariacao(c.variacao, true) }}>{c.variacao != null ? `${setaVariacao(c.variacao)} ${num(Math.abs(c.variacao), 0)}%` : "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p style={{ fontSize: 11.5, fontWeight: 600, color: "var(--ink-faint)", margin: "16px 0 6px" }}>Maiores despesas</p>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
                  <tbody>
                    {analise.maioresDesp.map((m) => (
                      <tr key={m.desc} style={{ borderBottom: "1px solid var(--rule)", cursor: "pointer" }} onClick={() => navigate(`/receitas-despesas?categoria=${encodeURIComponent(m.cat)}`)}>
                        <td style={{ padding: "6px 4px" }}>{m.desc}<span style={{ marginLeft: 8, color: "var(--ink-faint)" }}>{m.cat}</span></td>
                        <td style={{ padding: "6px 4px", textAlign: "right", color: "var(--ink-faint)" }}>{m.n}×</td>
                        <td style={{ padding: "6px 4px", textAlign: "right", fontWeight: 600 }}>{brl(m.valor)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            ) : <SemDados>Nenhuma despesa no período.</SemDados>}
          </Panel>

          {/* 6. Análise de receitas */}
          <Panel title="Receitas">
            {analise.receitasVar.length ? (
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
                <thead>
                  <tr style={{ textAlign: "left", color: "var(--ink-faint)", borderBottom: "1px solid var(--rule)" }}>
                    <th style={{ padding: "6px 4px" }}>Origem</th>
                    <th style={{ padding: "6px 4px", textAlign: "right" }}>Valor</th>
                    <th style={{ padding: "6px 4px", textAlign: "right" }}>%</th>
                    <th style={{ padding: "6px 4px", textAlign: "right" }}>Variação</th>
                    <th style={{ padding: "6px 4px", textAlign: "right" }}>Recorrência</th>
                  </tr>
                </thead>
                <tbody>
                  {analise.receitasVar.map((r) => (
                    <tr key={r.cat} style={{ borderBottom: "1px solid var(--rule)", cursor: "pointer" }} onClick={() => navigate(`/receitas-despesas?categoria=${encodeURIComponent(r.cat)}`)}>
                      <td style={{ padding: "6px 4px" }}>{r.cat}</td>
                      <td style={{ padding: "6px 4px", textAlign: "right" }}>{brl(r.valor)}</td>
                      <td style={{ padding: "6px 4px", textAlign: "right", color: "var(--ink-faint)" }}>{num(r.pct, 1)}%</td>
                      <td style={{ padding: "6px 4px", textAlign: "right", color: corVariacao(r.variacao) }}>{r.variacao != null ? `${setaVariacao(r.variacao)} ${num(Math.abs(r.variacao), 0)}%` : "—"}</td>
                      <td style={{ padding: "6px 4px", textAlign: "right", color: "var(--ink-faint)" }}>{r.recorrencia === "recorrente" ? "Recorrente" : r.recorrencia === "variável" ? "Variável" : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : <SemDados>Nenhuma receita no período.</SemDados>}
          </Panel>

          {/* 7. Cartões e compromissos — sem fonte de dado ainda */}
          <Panel title="Cartões e compromissos">
            <SemDados>Nenhum cartão conectado ainda. A aba Cartão está em construção — assim que houver dados de fatura e limite, esta seção mostra o comprometimento futuro real.</SemDados>
          </Panel>

          {/* 8. Investimentos */}
          <Panel title="Investimentos">
            {analise.ultimoMesInvest ? (
              <>
                <div style={{ display: "flex", gap: 20, flexWrap: "wrap", marginBottom: 16 }}>
                  <Indicador rotulo="Patrimônio investido" valor={brl(investido(assetGroupMap, analise.ultimoMesInvest))} />
                  <Indicador rotulo="Aportes no período" valor={brl(analise.agAtual.aporte)} />
                  <Indicador rotulo="Caixa" valor={brl(caixaDoMes(assetGroupMap, analise.ultimoMesInvest))} />
                </div>
                {analise.tipos.length > 0 && (
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={analise.tipos}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--rule)" />
                      <XAxis dataKey="label" stroke="var(--ink-faint)" fontSize={11} />
                      <YAxis stroke="var(--ink-faint)" fontSize={11} tickFormatter={(v) => brl(v)} width={80} />
                      <Tooltip formatter={(v) => brl(v)} />
                      <Bar dataKey="valor" radius={[4, 4, 0, 0]}>
                        {analise.tipos.map((t) => <Cell key={t.tipo} fill={t.cor} />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                )}
                <ResponsiveContainer width="100%" height={160}>
                  <BarChart data={analise.aportesEvolucao}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--rule)" />
                    <XAxis dataKey="mes" tickFormatter={(m) => labelMes(m).slice(0, 3)} stroke="var(--ink-faint)" fontSize={11} />
                    <YAxis stroke="var(--ink-faint)" fontSize={11} tickFormatter={(v) => brl(v)} width={80} />
                    <Tooltip labelFormatter={(m) => labelMes(m)} formatter={(v) => brl(v)} />
                    <Bar dataKey="aporte" name="Aporte" fill="#186040" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </>
            ) : <SemDados>Nenhum fechamento de investimento no período.</SemDados>}
          </Panel>

          {/* 9. NF-e / atividade empresarial */}
          {nfseConfirmadas && nfseConfirmadas.length > 0 && (
            <Panel title="Atividade empresarial">
              <NFSeSecao nfseConfirmadas={nfseConfirmadas} mesesSelecionados={mesesSelecionados} tetoMei={tetoMei} navigate={navigate} />
            </Panel>
          )}

          {/* 10. Indicadores financeiros */}
          <Panel title="Indicadores financeiros">
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 16 }}>
              {analise.indicadores.map((ind) => (
                <div key={ind.chave} style={{ padding: 12, border: "1px solid var(--rule)", borderRadius: 8 }}>
                  <div style={{ fontSize: 12, color: "var(--ink-faint)", marginBottom: 4 }}>{ind.label}</div>
                  {ind.semDados ? (
                    <SemDados>{ind.motivo || "Sem dados suficientes."}</SemDados>
                  ) : (
                    <div style={{ fontSize: 20, fontWeight: 700 }}>
                      {ind.unidade === "pct" ? `${num(ind.valor, 1)}%` : ind.unidade === "meses" ? `${num(ind.valor, 1)} meses` : brl(ind.valor)}
                    </div>
                  )}
                  <div style={{ fontSize: 10.5, color: "var(--ink-faint)", marginTop: 4 }}>{ind.formula}</div>
                </div>
              ))}
            </div>
          </Panel>

          {/* 11. Insights automáticos */}
          <Panel title="O que os dados mostram">
            {analise.insights.length ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {analise.insights.map((ins, i) => (
                  <div key={i} style={{ borderLeft: `3px solid ${CORES_TIPO_INSIGHT[ins.tipo]}`, paddingLeft: 12 }}>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>{ins.titulo}</div>
                    <div style={{ fontSize: 12.5, color: "var(--ink-soft)", marginTop: 2 }}>{ins.texto}</div>
                  </div>
                ))}
              </div>
            ) : <SemDados>Nenhum padrão relevante identificado neste período.</SemDados>}
          </Panel>

          {/* 12. Financial Score — sempre por último */}
          <Panel title="Financial Score">
            {analise.score ? (
              <div style={{ display: "flex", gap: 24, alignItems: "flex-start", flexWrap: "wrap" }}>
                <div style={{ textAlign: "center", minWidth: 110 }}>
                  <div style={{ fontSize: 40, fontWeight: 700, color: analise.score.notaFinal != null ? corNota(analise.score.notaFinal) : "var(--ink-faint)" }}>
                    {analise.score.notaFinal != null ? num(analise.score.notaFinal, 1) : "—"}
                  </div>
                  <div style={{ fontSize: 11.5, color: "var(--ink-faint)" }}>de 10</div>
                </div>
                <div style={{ flex: 1, minWidth: 260, display: "flex", flexDirection: "column", gap: 8 }}>
                  {analise.score.criterios.map((c) => (
                    <div key={c.chave} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <span style={{ flex: 1, fontSize: 12.5, color: "var(--ink-soft)" }}>{c.label}</span>
                      <div style={{ width: 120, height: 8, borderRadius: 4, background: "var(--rule)", overflow: "hidden" }}>
                        {c.nota !== null && <div style={{ width: `${c.nota * 10}%`, height: "100%", background: corNota(c.nota) }} />}
                      </div>
                      <span style={{ width: 70, textAlign: "right", fontSize: 12.5, fontWeight: 600, color: c.nota === null ? "var(--ink-faint)" : "var(--ink)" }}>
                        {c.nota === null ? "sem dados" : `${num(c.nota, 1)}/10`}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ) : <SemDados>Sem fechamento de investimento no período para calcular o score.</SemDados>}
            {analise.score && (analise.score.acima.length > 0 || analise.score.abaixo.length > 0) && (
              <div style={{ display: "flex", gap: 24, flexWrap: "wrap", marginTop: 16, fontSize: 12.5 }}>
                {analise.score.acima.length > 0 && (
                  <div><span style={{ color: "var(--credit)", fontWeight: 600 }}>Pontos fortes: </span>{analise.score.acima.map((c) => c.label).join(", ")}</div>
                )}
                {analise.score.abaixo.length > 0 && (
                  <div><span style={{ color: "var(--debit)", fontWeight: 600 }}>Precisam de atenção: </span>{analise.score.abaixo.map((c) => c.label).join(", ")}</div>
                )}
              </div>
            )}
          </Panel>
        </>
      )}
    </div>
  );
}

function LinhaCalc({ label, valor, destaque, cor }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", fontWeight: destaque ? 700 : 400, borderTop: destaque ? "1px solid var(--rule)" : "none", paddingTop: destaque ? 6 : 0 }}>
      <span style={{ color: destaque ? "var(--ink)" : "var(--ink-faint)" }}>{label}</span>
      <span style={{ color: cor || "var(--ink)" }}>{valor}</span>
    </div>
  );
}

function corNota(nota) {
  if (nota >= 7.5) return "var(--credit)";
  if (nota >= 5.5) return "#d97706";
  return "var(--debit)";
}

function variacaoPctLocal(atual, anterior) {
  if (anterior == null || anterior === 0) return null;
  return ((atual - anterior) / Math.abs(anterior)) * 100;
}

function NFSeSecao({ nfseConfirmadas, mesesSelecionados, tetoMei, navigate }) {
  const set = new Set(mesesSelecionados);
  const doPeriodo = nfseConfirmadas.filter((n) => set.has(String(n.competencia).slice(0, 7)));
  const faturamento = doPeriodo.reduce((s, n) => s + Number(n.valor), 0);
  const ticketMedio = doPeriodo.length ? faturamento / doPeriodo.length : 0;

  const porCliente = {};
  for (const n of doPeriodo) {
    porCliente[n.tomador] ??= { tomador: n.tomador, valor: 0, n: 0 };
    porCliente[n.tomador].valor += Number(n.valor);
    porCliente[n.tomador].n += 1;
  }
  const clientes = Object.values(porCliente).sort((a, b) => b.valor - a.valor);

  const porMes = {};
  for (const n of nfseConfirmadas) {
    const ym = String(n.competencia).slice(0, 7);
    porMes[ym] = (porMes[ym] || 0) + Number(n.valor);
  }
  const evolucao = Object.entries(porMes).sort(([a], [b]) => a.localeCompare(b)).slice(-12).map(([mes, valor]) => ({ mes, valor }));

  return (
    <div>
      <div style={{ display: "flex", gap: 20, flexWrap: "wrap", marginBottom: 16 }}>
        <Indicador rotulo="Faturamento no período" valor={brl(faturamento)} />
        <Indicador rotulo="NF-e emitidas" valor={String(doPeriodo.length)} />
        <Indicador rotulo="Ticket médio" valor={brl(ticketMedio)} />
        {tetoMei && <Indicador rotulo="% do teto MEI (ano)" valor={`${(tetoMei.pctLimite * 100).toFixed(1)}%`} cor={tetoMei.pctLimite >= 0.9 ? "var(--debit)" : undefined} />}
      </div>
      {evolucao.length > 1 && (
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={evolucao}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--rule)" />
            <XAxis dataKey="mes" tickFormatter={(m) => labelMes(m).slice(0, 3)} stroke="var(--ink-faint)" fontSize={11} />
            <YAxis stroke="var(--ink-faint)" fontSize={11} tickFormatter={(v) => brl(v)} width={80} />
            <Tooltip labelFormatter={(m) => labelMes(m)} formatter={(v) => brl(v)} />
            <Bar dataKey="valor" name="Faturamento" fill="#186040" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      )}
      {clientes.length > 0 && (
        <>
          <p style={{ fontSize: 11.5, fontWeight: 600, color: "var(--ink-faint)", margin: "16px 0 6px" }}>Receita por cliente</p>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
            <tbody>
              {clientes.map((c) => (
                <tr key={c.tomador} style={{ borderBottom: "1px solid var(--rule)" }}>
                  <td style={{ padding: "6px 4px" }}>{c.tomador}</td>
                  <td style={{ padding: "6px 4px", textAlign: "right", color: "var(--ink-faint)" }}>{c.n} NF-e</td>
                  <td style={{ padding: "6px 4px", textAlign: "right", fontWeight: 600 }}>{brl(c.valor)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
      <SemDados>Faturamento PJ mostrado separado da renda pessoal (extrato bancário) — não há mistura automática entre os dois.</SemDados>
    </div>
  );
}
