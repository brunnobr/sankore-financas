import { useEffect, useMemo, useState } from "react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from "recharts";
import { loadMonths } from "../data/investments.js";
import { loadTransacoes } from "../data/transactions.js";
import { getAssetGroupMap, getAssetTipoMap, getCategoriasMap } from "../data/settings.js";
import { agregarPeriodo } from "../lib/finance/analytics.js";
import { investido } from "../lib/finance/returns.js";
import { montarContextoMes } from "../lib/finance/score.js";
import {
  HORIZONTES_FORECAST, CENARIOS_FORECAST, projetarCenario, previaMesAtual,
} from "../lib/finance/forecast.js";
import { brl, labelMes } from "../lib/finance/format.js";
import { Panel, StatCard } from "./shared/ui.jsx";

const selectStyle = { padding: "6px 10px", border: "1px solid var(--rule)", borderRadius: 8, fontSize: 13, background: "var(--panel)" };

function InputPremissa({ label, valor, onChange, sufixo, passo }) {
  return (
    <div style={{ flex: "1 1 140px" }}>
      <div style={{ fontSize: 11, color: "var(--ink-faint)" }}>{label}</div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginTop: 4 }}>
        <input
          type="number" step={passo || 0.1} value={valor}
          onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
          style={{ width: 90, fontSize: 16, fontWeight: 700, border: "1px solid var(--rule)", borderRadius: 6, padding: "6px 8px", background: "var(--panel)", color: "var(--ink)" }}
        />
        <span style={{ fontSize: 12, color: "var(--ink-faint)" }}>{sufixo}</span>
      </div>
    </div>
  );
}

function LinhaRecorrente({ rotulo, valor, destaque, sub }) {
  return (
    <div style={{ display: "flex", gap: 10, padding: "7px 0", borderTop: "1px solid var(--rule)", fontSize: 12.5, fontWeight: destaque ? 700 : 400 }}>
      <span style={{ flex: 1 }}>{rotulo}</span>
      {sub && <span style={{ fontSize: 10.5, color: "var(--ink-faint)", alignSelf: "center" }}>{sub}</span>}
      <span style={{ fontVariantNumeric: "tabular-nums", minWidth: 90, textAlign: "right" }}>{brl(valor)}</span>
    </div>
  );
}

export default function Forecast() {
  const [months, setMonths] = useState(null);
  const [transacoes, setTransacoes] = useState(null);
  const [categoriasMap, setCategoriasMap] = useState(null);
  const [assetGroupMap, setAssetGroupMap] = useState(null);
  const [assetTipoMap, setAssetTipoMap] = useState(null);
  const [erro, setErro] = useState("");

  const [horizonteKey, setHorizonteKey] = useState("1a");
  const [rentabilidadeAA, setRentabilidadeAA] = useState(null);
  const [aporteMensalInput, setAporteMensalInput] = useState(null);
  const [inflacaoAA, setInflacaoAA] = useState(null);

  useEffect(() => {
    Promise.all([loadMonths(), loadTransacoes(), getCategoriasMap(), getAssetGroupMap(), getAssetTipoMap()])
      .then(([ms, t, c, g, at]) => { setMonths(ms); setTransacoes(t); setCategoriasMap(c); setAssetGroupMap(g); setAssetTipoMap(at); })
      .catch((e) => setErro(e.message || "Não foi possível carregar os dados pra projeção."));
  }, []);

  const pronto = months && transacoes && categoriasMap && assetGroupMap && assetTipoMap;
  const latest = pronto && months.length ? months[months.length - 1] : null;
  const idx = pronto ? months.length - 1 : 0;

  const todasMeses = useMemo(() => {
    if (!pronto) return [];
    const doExtrato = transacoes.map((t) => t.data.slice(0, 7));
    const doInvest = months.map((m) => m.key.slice(0, 7));
    return [...new Set([...doExtrato, ...doInvest])].sort();
  }, [pronto, transacoes, months]);

  // Contexto do score reaproveitado (reserva/reservaAlvo/despesaMediaHist/CDI)
  // em vez de recalcular tudo de novo aqui — mesma fonte que a aba Analytics
  // usa pro Financial Score.
  const ctx = useMemo(() => {
    if (!pronto || !latest) return null;
    const ym = latest.key.slice(0, 7);
    const prevYM = idx > 0 ? months[idx - 1].key.slice(0, 7) : null;
    return montarContextoMes({
      months, idxMes: idx, assetGroupMap, assetTipoMap, categoriasMap,
      transacoesDoMes: transacoes.filter((t) => t.data.slice(0, 7) === ym),
      transacoesMesAnterior: prevYM ? transacoes.filter((t) => t.data.slice(0, 7) === prevYM) : null,
      transacoesTodas: transacoes,
    });
  }, [pronto, latest, idx, months, assetGroupMap, assetTipoMap, categoriasMap, transacoes]);

  // Médias dos últimos 12 meses de extrato — mesma janela usada nas séries
  // da aba Analytics — base pra prévia do mês e pro card "próximo mês".
  const mediasHist = useMemo(() => {
    if (!pronto) return null;
    const janela = todasMeses.slice(-12);
    if (!janela.length) return null;
    const ag = agregarPeriodo(transacoes, categoriasMap, janela);
    return { receita: ag.receita / janela.length, despesa: ag.despesa / janela.length, aporte: ag.aporte / janela.length, n: janela.length };
  }, [pronto, transacoes, categoriasMap, todasMeses]);

  const mesCorrenteYM = new Date().toISOString().slice(0, 7);
  const previa = useMemo(() => {
    if (!pronto || !mediasHist) return null;
    return previaMesAtual(transacoes, mesCorrenteYM, categoriasMap, mediasHist);
  }, [pronto, transacoes, categoriasMap, mediasHist, mesCorrenteYM]);

  // Defaults calculados de dado real, só na primeira vez que ctx chega —
  // depois disso ficam editáveis livremente, isso aqui é ponto de partida.
  useEffect(() => {
    if (!ctx || rentabilidadeAA !== null) return;
    const cdiAA = ctx.cdiPct != null ? (Math.pow(1 + ctx.cdiPct / 100, 12) - 1) * 100 : 12;
    setRentabilidadeAA(+cdiAA.toFixed(1));
    const ipcaMeses = (months || []).map((m) => m.benchmarks?.IPCA?.valor).filter((v) => v != null);
    const ipcaMedio = ipcaMeses.length ? ipcaMeses.reduce((s, v) => s + v, 0) / ipcaMeses.length : 0.3;
    setInflacaoAA(+((Math.pow(1 + ipcaMedio / 100, 12) - 1) * 100).toFixed(2));
    const aportesHist = (months || []).map((m) => m.aportes?.total || 0).filter((v) => v > 0);
    const aporteMedio = aportesHist.length ? aportesHist.reduce((s, v) => s + v, 0) / aportesHist.length : 0;
    setAporteMensalInput(+aporteMedio.toFixed(2));
  }, [ctx, months, rentabilidadeAA]);

  const horizonte = HORIZONTES_FORECAST.find((h) => h.key === horizonteKey);

  const cenarios = useMemo(() => {
    if (!ctx || !latest || rentabilidadeAA === null || aporteMensalInput === null || inflacaoAA === null) return [];
    const crescimentoAtual = Math.max(0, investido(assetGroupMap, latest) - ctx.reservaAtual);
    return CENARIOS_FORECAST.map((c) => ({
      ...c,
      ...projetarCenario({
        reservaAtual: ctx.reservaAtual, despesaMediaHoje: ctx.despesaMediaHist || ctx.despesaAtual,
        crescimentoAtual, aporteMensal: aporteMensalInput, rentabilidadeAA: rentabilidadeAA + c.ajustePP,
        inflacaoAA, meses: horizonte.meses,
      }),
    }));
  }, [ctx, latest, assetGroupMap, rentabilidadeAA, aporteMensalInput, inflacaoAA, horizonte]);

  const serieGrafico = useMemo(() => {
    if (!ctx || !latest || rentabilidadeAA === null || aporteMensalInput === null || inflacaoAA === null) return [];
    const crescimentoAtual = Math.max(0, investido(assetGroupMap, latest) - ctx.reservaAtual);
    const pontos = [0, 1, 3, 6, 12, 24, 36, 60, 84, 120, 180, 240].filter((m) => m <= horizonte.meses);
    if (pontos[pontos.length - 1] !== horizonte.meses) pontos.push(horizonte.meses);
    return pontos.map((m) => {
      const linha = { label: m === 0 ? "hoje" : m < 12 ? `${m}m` : `${Math.round(m / 12)}a` };
      CENARIOS_FORECAST.forEach((c) => {
        const r = projetarCenario({
          reservaAtual: ctx.reservaAtual, despesaMediaHoje: ctx.despesaMediaHist || ctx.despesaAtual,
          crescimentoAtual, aporteMensal: aporteMensalInput, rentabilidadeAA: rentabilidadeAA + c.ajustePP,
          inflacaoAA, meses: m,
        });
        linha[c.key] = +r.totalFuturo.toFixed(2);
      });
      return linha;
    });
  }, [ctx, latest, assetGroupMap, rentabilidadeAA, aporteMensalInput, inflacaoAA, horizonte]);

  if (erro) return <p style={{ color: "var(--debit)" }}>{erro}</p>;
  if (!pronto) return <p style={{ color: "var(--ink-faint)" }}>Carregando…</p>;
  if (!latest || !ctx) {
    return <Panel><p style={{ color: "var(--ink-faint)", margin: 0 }}>Nenhum fechamento de investimento cadastrado ainda — registre um saldo em Importar pra projetar cenários.</p></Panel>;
  }
  if (rentabilidadeAA === null) return <p style={{ color: "var(--ink-faint)" }}>Calculando…</p>;

  const cenarioBase = cenarios.find((c) => c.key === "base");

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div>
        <p style={{ color: "var(--ink-faint)", fontSize: 13, margin: "0 0 4px" }}>Simulação, não previsão.</p>
        <p style={{ color: "var(--ink-faint)", fontSize: 12.5, margin: 0, lineHeight: 1.6, maxWidth: 640 }}>
          Com {months.length} {months.length === 1 ? "mês" : "meses"} de histórico real, isso é aritmética de juros compostos
          sobre premissas que você define abaixo — não é uma previsão estatística. Os três cenários variam a rentabilidade em
          ±3 p.p. ao ano como sensibilidade simples, não como banda de confiança calculada.
        </p>
      </div>

      {/* Prévia do mês em curso */}
      {previa && (
        <Panel title={`Prévia de ${labelMes(previa.ym).toLowerCase()}`}>
          <p style={{ fontSize: 13, margin: "0 0 14px", fontWeight: 600 }}>
            {previa.sobraPrevista >= 0 ? `Deve sobrar ${brl(previa.sobraPrevista)} no mês.` : `Deve faltar ${brl(Math.abs(previa.sobraPrevista))} no mês.`}
          </p>
          <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginBottom: 16 }}>
            <StatCard cor="green" rotulo="Entradas previstas" valor={brl(previa.receitaPrevista)} sub={`${brl(previa.agRealizado.receita)} já lançado`} />
            <StatCard cor="red" rotulo="Saídas previstas" valor={brl(previa.despesaPrevista)} sub={`${brl(previa.agRealizado.despesa)} já lançado`} />
            <StatCard cor="purple" rotulo="Aporte previsto" valor={brl(previa.aportePrevisto)} sub="média histórica" />
            <StatCard cor={previa.sobraPrevista >= 0 ? "green" : "red"} rotulo="Sobra prevista" valor={brl(previa.sobraPrevista)} />
          </div>

          <p style={{ fontSize: 12, color: "var(--ink-faint)", margin: "0 0 10px" }}>
            {previa.temRealizado
              ? <>Extrato lançado até o dia <b>{previa.diaAtual}</b>: {brl(previa.agRealizado.despesa)} já saíram e {brl(previa.agRealizado.receita)} já entraram. O resto é estimativa pelo seu padrão.</>
              : <>Ainda sem extrato lançado neste mês — a previsão inteira é estimativa pela média histórica.</>}
            {" "}Sem fatura de cartão confirmada aqui — a aba Cartão ainda não tem dado real pra puxar.
          </p>

          <div style={{ fontSize: 11, color: "var(--ink-faint)", textTransform: "uppercase", letterSpacing: 0.3, marginTop: 10 }}>
            Recorrentes esperados <span style={{ fontWeight: 400, textTransform: "none" }}>— detectados do histórico</span>
          </div>
          {previa.recorrentes.map((r) => (
            <LinhaRecorrente key={r.chave} rotulo={r.desc} valor={r.media} sub={`${r.meses}/12 meses`} />
          ))}
          <LinhaRecorrente rotulo="Soma dos recorrentes" valor={previa.totalRecorrente} destaque />
          <LinhaRecorrente rotulo="Demais gastos variáveis (estimativa pela média)" valor={previa.restoEstimado} />
        </Panel>
      )}

      {/* Premissas editáveis */}
      <Panel title="Premissas">
        <div style={{ display: "flex", flexWrap: "wrap", gap: 20 }}>
          <InputPremissa label="Rentabilidade esperada" valor={rentabilidadeAA} onChange={setRentabilidadeAA} sufixo="% a.a." />
          <InputPremissa label="Aporte mensal" valor={aporteMensalInput} onChange={setAporteMensalInput} sufixo="R$/mês" passo={50} />
          <InputPremissa label="Inflação esperada" valor={inflacaoAA} onChange={setInflacaoAA} sufixo="% a.a." />
        </div>
        <p style={{ fontSize: 11, color: "var(--ink-faint)", marginTop: 12, marginBottom: 0, lineHeight: 1.5 }}>
          Defaults: rentabilidade a partir do CDI de {labelMes(latest.key.slice(0, 7)).toLowerCase()} anualizado; aporte a partir
          da média dos {months.length} meses de histórico de investimento; inflação a partir da média do IPCA capturado (ajuste se
          não representar sua expectativa). Editáveis livremente.
        </p>
      </Panel>

      {/* Horizonte */}
      <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
        <span style={{ fontSize: 13, color: "var(--ink-faint)" }}>Horizonte:</span>
        <select value={horizonteKey} onChange={(e) => setHorizonteKey(e.target.value)} style={selectStyle}>
          {HORIZONTES_FORECAST.map((h) => <option key={h.key} value={h.key}>{h.label}</option>)}
        </select>
      </div>

      {/* Resultado do cenário base */}
      {cenarioBase && (
        <Panel title={`Cenário base em ${horizonte.label.toLowerCase()}`}>
          <div style={{ fontSize: 30, fontWeight: 700, color: "var(--ink)" }}>{brl(cenarioBase.totalFuturo)}</div>
          <div style={{ fontSize: 12, color: "var(--ink-faint)", marginTop: 4, marginBottom: 16 }}>
            Hoje: {brl(investido(assetGroupMap, latest))} investidos · dessa diferença, {brl(cenarioBase.aportadoTotal)} seriam aporte seu
            e {brl(cenarioBase.totalFuturo - investido(assetGroupMap, latest) - cenarioBase.aportadoTotal)} seriam rendimento composto.
          </div>
          <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
            {cenarios.map((c) => (
              <StatCard key={c.key} rotulo={c.label} valor={brl(c.totalFuturo)} cor={c.key === "conservador" ? "red" : c.key === "otimista" ? "purple" : "green"} />
            ))}
          </div>
        </Panel>
      )}

      {/* Gráfico */}
      {serieGrafico.length >= 2 && (
        <Panel title="Trajetória do patrimônio — três cenários">
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={serieGrafico}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--rule)" />
              <XAxis dataKey="label" stroke="var(--ink-faint)" fontSize={12} />
              <YAxis stroke="var(--ink-faint)" fontSize={12} tickFormatter={(v) => brl(v)} width={90} />
              <Tooltip formatter={(v, n) => [brl(v), CENARIOS_FORECAST.find((c) => c.key === n)?.label || n]} />
              <Legend formatter={(v) => CENARIOS_FORECAST.find((c) => c.key === v)?.label || v} />
              {CENARIOS_FORECAST.map((c) => (
                <Line key={c.key} type="monotone" dataKey={c.key} name={c.key} stroke={c.cor} strokeWidth={c.key === "base" ? 2.5 : 1.5} strokeDasharray={c.key === "base" ? undefined : "5 3"} dot={{ r: 2.5 }} />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </Panel>
      )}

      {/* Curto prazo: próximo mês, na média */}
      {mediasHist && (
        <Panel title="Próximo mês, na média do que já aconteceu">
          <p style={{ fontSize: 11.5, color: "var(--ink-faint)", margin: "0 0 14px" }}>
            Simples média dos últimos {mediasHist.n} meses de extrato — não é ajustado por sazonalidade, porque não há dado suficiente pra detectar uma.
          </p>
          <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
            <StatCard cor="green" rotulo="Receita prevista" valor={brl(mediasHist.receita)} />
            <StatCard cor="red" rotulo="Despesa prevista" valor={brl(mediasHist.despesa)} />
            <StatCard cor="purple" rotulo="Aporte previsto" valor={brl(aporteMensalInput)} sub="premissa acima" />
          </div>
        </Panel>
      )}
    </div>
  );
}
