import { useEffect, useMemo, useState } from "react";
import { Pencil } from "lucide-react";
import { parseArquivo } from "../lib/import/index.js";
import { extrairLinhasPdf } from "../lib/import/pdfText.js";
import { parseNotaCorretagem } from "../lib/import/parsers/notaCorretagem.js";
import { loadRegrasUsuario, salvarRegraCategorizacao, importarTransacoes, registrarImportLog, loadTransacoes, renomearConta } from "../data/transactions.js";
import { getCategoriasMap, getPalavrasCategoria, getAliasAtivos, salvarAliasAtivo } from "../data/settings.js";
import { loadMonths, salvarSnapshotAtivo, salvarAporteAtivo, salvarAporteNotaCorretagem, extrairSaldosDePrint } from "../data/investments.js";
import { normalizar, brl, formatarDataBR, labelMes } from "../lib/finance/format.js";
import { Panel } from "./shared/ui.jsx";
import { NFSeUpload } from "../components/NFSeUpload";
import { NFSeReviewQueue } from "../components/NFSeReviewQueue";

/* Ativo sem extrato baixável (Banco Inter, cripto, cofrinhos...): o
   usuário lê o saldo de um print e registra aqui — upsert por mês, então
   reenviar o mesmo mês só corrige o valor. Movido de Investimentos.jsx:
   Importar concentra toda entrada de dado; Investimentos só mostra. */
function AtualizarSaldoForm({ tickers, onSalvo }) {
  const hoje = new Date().toISOString().slice(0, 7);
  const [ticker, setTicker] = useState("");
  const [mes, setMes] = useState(hoje);
  const [valor, setValor] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");

  async function onSubmit(e) {
    e.preventDefault();
    if (!ticker.trim() || !mes || valor === "") return;
    setSalvando(true);
    setErro("");
    try {
      await salvarSnapshotAtivo({ ticker: ticker.trim(), mes: `${mes}-01`, valor: Number(valor) });
      setTicker("");
      setValor("");
      onSalvo();
    } catch (e2) {
      setErro(e2.message || "Erro ao salvar saldo.");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Panel title="Atualizar saldo de investimento manualmente">
      <p style={{ fontSize: 13, color: "var(--ink-faint)", marginTop: -8, marginBottom: 12 }}>
        Para ativos sem extrato baixável (ex: investimentos do Banco Inter) — registra o fechamento do mês a partir do que você vê no app/print.
      </p>
      <form onSubmit={onSubmit} style={{ display: "flex", gap: 10, alignItems: "flex-end", flexWrap: "wrap" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <label style={{ fontSize: 12, color: "var(--ink-faint)" }}>Ativo</label>
          <input list="tickers-existentes" value={ticker} onChange={(e) => setTicker(e.target.value)} placeholder="ex: Inter FIRF" style={{ padding: "6px 8px", border: "1px solid var(--rule)", borderRadius: 6, minWidth: 180 }} />
          <datalist id="tickers-existentes">
            {tickers.map((t) => <option key={t} value={t} />)}
          </datalist>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <label style={{ fontSize: 12, color: "var(--ink-faint)" }}>Mês</label>
          <input type="month" value={mes} onChange={(e) => setMes(e.target.value)} style={{ padding: "6px 8px", border: "1px solid var(--rule)", borderRadius: 6 }} />
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <label style={{ fontSize: 12, color: "var(--ink-faint)" }}>Saldo (R$)</label>
          <input type="number" step="0.01" value={valor} onChange={(e) => setValor(e.target.value)} placeholder="0,00" style={{ padding: "6px 8px", border: "1px solid var(--rule)", borderRadius: 6, width: 140 }} />
        </div>
        <button type="submit" disabled={salvando} style={{ padding: "8px 16px", background: "var(--accent)", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", fontWeight: 600 }}>
          {salvando ? "Salvando…" : "Salvar"}
        </button>
      </form>
      {erro && <p style={{ color: "var(--debit)", marginBottom: 0, marginTop: 8 }}>{erro}</p>}
    </Panel>
  );
}

/* Aporte por ativo — vem da nota de corretagem ou do extrato (quanto
   entrou em qual ativo naquele mês). Separado do saldo (que é o
   fechamento total do ativo), grava em contributions.breakdown e
   alimenta "Composição do aporte do mês" no Dashboard. */
/* Sobe o PDF da nota de corretagem, extrai os negócios (client-side,
   pdfjs-dist — sem Edge Function, o PDF já tem texto selecionável) e
   cai numa fila de revisão igual ao print: o "ticker" extraído pode vir
   com o código do segmento grudado (ex: "CI WRLD11"), então sempre
   revisa antes de confirmar. */
function ImportarCorretagemForm({ tickers, onSalvo }) {
  const [lendo, setLendo] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [nota, setNota] = useState(null); // { notaNumero, dataPregao, taxas }
  const [itens, setItens] = useState(null);
  const [erro, setErro] = useState("");

  async function onArquivo(e) {
    const file = e.target.files[0];
    e.target.value = "";
    if (!file) return;
    setErro("");
    setItens(null);
    setNota(null);
    setLendo(true);
    try {
      const [linhas, aliasMap] = await Promise.all([extrairLinhasPdf(file), getAliasAtivos()]);
      const r = parseNotaCorretagem(linhas);
      setNota({ notaNumero: r.notaNumero, dataPregao: r.dataPregao, taxas: r.taxas });
      // "bruto" guarda o texto original da nota — se você corrigir o
      // ticker antes de confirmar, o apelido bruto->ticker fica salvo
      // pra próxima nota já vir resolvida (ver confirmar()).
      setItens(r.itens.map((it) => ({ ...it, bruto: it.ticker, ticker: aliasMap[it.ticker] || it.ticker, incluir: true })));
    } catch (e2) {
      setErro(e2.message || "Erro ao ler a nota de corretagem.");
    } finally {
      setLendo(false);
    }
  }

  function atualizarItem(i, campo, valor) {
    setItens((prev) => prev.map((it, idx) => (idx === i ? { ...it, [campo]: valor } : it)));
  }

  async function confirmar() {
    setSalvando(true);
    setErro("");
    try {
      const incluidos = itens.filter((it) => it.incluir).map((it) => ({ ...it, ticker: it.ticker.trim(), valor: Number(it.valor) }));
      await Promise.all(
        incluidos.filter((it) => it.bruto && it.bruto !== it.ticker).map((it) => salvarAliasAtivo(it.bruto, it.ticker))
      );
      await salvarAporteNotaCorretagem({
        mes: `${nota.dataPregao.slice(0, 7)}-01`,
        dataISO: nota.dataPregao,
        notaNumero: nota.notaNumero,
        itens: incluidos,
        taxas: nota.taxas,
      });
      setItens(null);
      setNota(null);
      onSalvo();
    } catch (e2) {
      setErro(e2.message || "Erro ao salvar a nota de corretagem.");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Panel title="Importar nota de corretagem">
      <p style={{ fontSize: 13, color: "var(--ink-faint)", marginTop: -8, marginBottom: 12 }}>
        Sobe o PDF da nota — lê os negócios do pregão, você confere/corrige o ativo e confirma antes de gravar como aporte do mês.
        O nome pode sair grudado com o código do segmento (ex: "CI WRLD11") — corrija pro ticker certo aqui embaixo; a correção fica salva e a próxima nota com esse mesmo texto já vem certa.
      </p>
      <input type="file" accept="application/pdf" onChange={onArquivo} disabled={lendo || salvando} />
      {lendo && <span style={{ marginLeft: 10, fontSize: 13, color: "var(--ink-faint)" }}>Lendo a nota…</span>}

      {erro && <p style={{ color: "var(--debit)", marginTop: 12, marginBottom: 0 }}>{erro}</p>}

      {nota && itens && itens.length > 0 && (
        <div style={{ marginTop: 16 }}>
          <p style={{ fontSize: 12.5, color: "var(--ink-faint)", margin: "0 0 8px" }}>
            Nota nº {nota.notaNumero} — pregão {formatarDataBR(nota.dataPregao)}
            {nota.taxas?.[0] && ` — ${nota.taxas[0].nome}: ${brl(nota.taxas[0].valor)}`}
          </p>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ textAlign: "left", borderBottom: "1px solid var(--rule)", color: "var(--ink-faint)" }}>
                  <th style={{ padding: "6px 4px" }}></th>
                  <th style={{ padding: "6px 4px" }}>Ativo</th>
                  <th style={{ padding: "6px 4px" }}>C/V</th>
                  <th style={{ padding: "6px 4px", textAlign: "right" }}>Qtd</th>
                  <th style={{ padding: "6px 4px", textAlign: "right" }}>Preço</th>
                  <th style={{ padding: "6px 4px", textAlign: "right" }}>Valor</th>
                </tr>
              </thead>
              <tbody>
                {itens.map((it, i) => (
                  <tr key={i} style={{ borderBottom: "1px solid var(--rule)", opacity: it.incluir ? 1 : 0.4 }}>
                    <td style={{ padding: "8px 4px" }}>
                      <input type="checkbox" checked={it.incluir} onChange={(e) => atualizarItem(i, "incluir", e.target.checked)} />
                    </td>
                    <td style={{ padding: "8px 4px" }}>
                      <input list="tickers-existentes-corretagem" value={it.ticker} onChange={(e) => atualizarItem(i, "ticker", e.target.value)} style={{ padding: "4px 8px", border: "1px solid var(--rule)", borderRadius: 6, minWidth: 160 }} />
                    </td>
                    <td style={{ padding: "8px 4px", color: it.cv === "C" ? "var(--debit)" : "var(--credit)" }}>{it.cv === "C" ? "Compra" : "Venda"}</td>
                    <td style={{ padding: "8px 4px", textAlign: "right" }}>{it.quantidade}</td>
                    <td style={{ padding: "8px 4px", textAlign: "right" }}>{brl(it.preco)}</td>
                    <td style={{ padding: "8px 4px", textAlign: "right" }}>
                      <input type="number" step="0.01" value={it.valor} onChange={(e) => atualizarItem(i, "valor", e.target.value)} style={{ padding: "4px 8px", border: "1px solid var(--rule)", borderRadius: 6, width: 110, textAlign: "right" }} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <datalist id="tickers-existentes-corretagem">
            {tickers.map((t) => <option key={t} value={t} />)}
          </datalist>
          <button
            onClick={confirmar}
            disabled={salvando || !itens.some((it) => it.incluir)}
            style={{ marginTop: 16, padding: "10px 20px", background: "var(--accent)", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", fontWeight: 600 }}
          >
            {salvando ? "Salvando…" : `Confirmar e gravar ${itens.filter((it) => it.incluir).length} negócio(s)`}
          </button>
        </div>
      )}
    </Panel>
  );
}

function RegistrarAporteForm({ tickers, onSalvo }) {
  const hoje = new Date().toISOString().slice(0, 10);
  const [ticker, setTicker] = useState("");
  const [mes, setMes] = useState(hoje.slice(0, 7));
  const [valor, setValor] = useState("");
  const [data, setData] = useState(hoje);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");

  async function onSubmit(e) {
    e.preventDefault();
    if (!ticker.trim() || !mes || valor === "") return;
    setSalvando(true);
    setErro("");
    try {
      await salvarAporteAtivo({ ticker: ticker.trim(), mes: `${mes}-01`, valor: Number(valor), dataISO: data });
      setTicker("");
      setValor("");
      onSalvo();
    } catch (e2) {
      setErro(e2.message || "Erro ao salvar aporte.");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Panel title="Registrar aporte por ativo">
      <p style={{ fontSize: 13, color: "var(--ink-faint)", marginTop: -8, marginBottom: 12 }}>
        Da nota de corretagem ou do extrato — quanto entrou em qual ativo no mês.
      </p>
      <form onSubmit={onSubmit} style={{ display: "flex", gap: 10, alignItems: "flex-end", flexWrap: "wrap" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <label style={{ fontSize: 12, color: "var(--ink-faint)" }}>Ativo</label>
          <input list="tickers-existentes" value={ticker} onChange={(e) => setTicker(e.target.value)} placeholder="ex: WRLD11" style={{ padding: "6px 8px", border: "1px solid var(--rule)", borderRadius: 6, minWidth: 180 }} />
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <label style={{ fontSize: 12, color: "var(--ink-faint)" }}>Mês</label>
          <input type="month" value={mes} onChange={(e) => setMes(e.target.value)} style={{ padding: "6px 8px", border: "1px solid var(--rule)", borderRadius: 6 }} />
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <label style={{ fontSize: 12, color: "var(--ink-faint)" }}>Data do aporte</label>
          <input type="date" value={data} onChange={(e) => setData(e.target.value)} style={{ padding: "6px 8px", border: "1px solid var(--rule)", borderRadius: 6 }} />
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <label style={{ fontSize: 12, color: "var(--ink-faint)" }}>Valor (R$)</label>
          <input type="number" step="0.01" value={valor} onChange={(e) => setValor(e.target.value)} placeholder="0,00" style={{ padding: "6px 8px", border: "1px solid var(--rule)", borderRadius: 6, width: 140 }} />
        </div>
        <button type="submit" disabled={salvando} style={{ padding: "8px 16px", background: "var(--accent)", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", fontWeight: 600 }}>
          {salvando ? "Salvando…" : "Salvar"}
        </button>
      </form>
      {erro && <p style={{ color: "var(--debit)", marginBottom: 0, marginTop: 8 }}>{erro}</p>}
    </Panel>
  );
}

function fileParaBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result.split(",")[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/* Importa saldos por print da tela do banco — sobe 1+ capturas, a Edge
   Function chama a API da Claude e devolve os pares ativo/valor, que
   caem numa fila de revisão (igual ao import de extrato) antes de
   gravar em asset_snapshots. Movido de Investimentos.jsx. */
function ImportarPrintForm({ tickers, onSalvo }) {
  const hoje = new Date().toISOString().slice(0, 7);
  const [mes, setMes] = useState(hoje);
  const [extraindo, setExtraindo] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [itens, setItens] = useState(null);
  const [erro, setErro] = useState("");

  async function onArquivos(e) {
    const files = [...e.target.files];
    e.target.value = "";
    if (!files.length) return;
    setErro("");
    setItens(null);
    setExtraindo(true);
    try {
      const imagens = await Promise.all(files.map(async (f) => ({ data: await fileParaBase64(f), mediaType: f.type || "image/jpeg" })));
      const extraidos = await extrairSaldosDePrint(imagens);
      if (!extraidos.length) { setErro("Não consegui reconhecer nenhum ativo nesses prints."); return; }
      setItens(extraidos.map((it) => ({ ...it, incluir: true })));
    } catch (e2) {
      setErro(e2.message || "Erro ao extrair os saldos.");
    } finally {
      setExtraindo(false);
    }
  }

  function atualizarItem(i, campo, valor) {
    setItens((prev) => prev.map((it, idx) => (idx === i ? { ...it, [campo]: valor } : it)));
  }

  async function confirmar() {
    setSalvando(true);
    setErro("");
    try {
      const incluidos = itens.filter((it) => it.incluir);
      await Promise.all(incluidos.map((it) => salvarSnapshotAtivo({ ticker: it.nome.trim(), mes: `${mes}-01`, valor: Number(it.valor) })));
      setItens(null);
      onSalvo();
    } catch (e2) {
      setErro(e2.message || "Erro ao salvar os saldos.");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Panel title="Importar saldo de investimento por print">
      <p style={{ fontSize: 13, color: "var(--ink-faint)", marginTop: -8, marginBottom: 12 }}>
        Sobe uma ou mais capturas de tela do app do banco — a IA lê os ativos e saldos, você confere e confirma antes de gravar.
      </p>
      <div style={{ display: "flex", gap: 10, alignItems: "flex-end", flexWrap: "wrap" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <label style={{ fontSize: 12, color: "var(--ink-faint)" }}>Mês do fechamento</label>
          <input type="month" value={mes} onChange={(e) => setMes(e.target.value)} style={{ padding: "6px 8px", border: "1px solid var(--rule)", borderRadius: 6 }} />
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <label style={{ fontSize: 12, color: "var(--ink-faint)" }}>Prints</label>
          <input type="file" accept="image/*" multiple onChange={onArquivos} disabled={extraindo || salvando} />
        </div>
        {extraindo && <span style={{ fontSize: 13, color: "var(--ink-faint)" }}>Lendo os prints…</span>}
      </div>

      {erro && <p style={{ color: "var(--debit)", marginTop: 12, marginBottom: 0 }}>{erro}</p>}

      {itens && itens.length > 0 && (
        <div style={{ marginTop: 16 }}>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ textAlign: "left", borderBottom: "1px solid var(--rule)", color: "var(--ink-faint)" }}>
                  <th style={{ padding: "6px 4px" }}></th>
                  <th style={{ padding: "6px 4px" }}>Ativo</th>
                  <th style={{ padding: "6px 4px", textAlign: "right" }}>Valor</th>
                </tr>
              </thead>
              <tbody>
                {itens.map((it, i) => (
                  <tr key={i} style={{ borderBottom: "1px solid var(--rule)", opacity: it.incluir ? 1 : 0.4 }}>
                    <td style={{ padding: "8px 4px" }}>
                      <input type="checkbox" checked={it.incluir} onChange={(e) => atualizarItem(i, "incluir", e.target.checked)} />
                    </td>
                    <td style={{ padding: "8px 4px" }}>
                      <input list="tickers-existentes-print" value={it.nome} onChange={(e) => atualizarItem(i, "nome", e.target.value)} style={{ padding: "4px 8px", border: "1px solid var(--rule)", borderRadius: 6, minWidth: 180 }} />
                    </td>
                    <td style={{ padding: "8px 4px", textAlign: "right" }}>
                      <input type="number" step="0.01" value={it.valor} onChange={(e) => atualizarItem(i, "valor", e.target.value)} style={{ padding: "4px 8px", border: "1px solid var(--rule)", borderRadius: 6, width: 120, textAlign: "right" }} />
                      {it.moeda === "USD" && <span style={{ marginLeft: 6, fontSize: 11, color: "var(--debit)" }}>USD — converta pra R$</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <datalist id="tickers-existentes-print">
            {tickers.map((t) => <option key={t} value={t} />)}
          </datalist>
          <button
            onClick={confirmar}
            disabled={salvando || !itens.some((it) => it.incluir)}
            style={{ marginTop: 16, padding: "10px 20px", background: "var(--accent)", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", fontWeight: 600 }}
          >
            {salvando ? "Salvando…" : `Confirmar e gravar ${itens.filter((it) => it.incluir).length} ativo(s)`}
          </button>
        </div>
      )}
    </Panel>
  );
}

/* Mês mais frequente entre as datas — usado como "competência" do
   extrato pro checklist (um extrato normalmente cobre um mês; se cruzar
   virada de mês, o mês com mais lançamentos vence). */
/* Agrupa as transações já gravadas por conta (banco) -> lista de meses
   (YYYY-MM) com dados, pra responder "o que já foi importado em cada
   conta" a partir do que realmente está no banco, não só do log de
   importação. */
function agruparPorConta(transacoes) {
  const porBanco = {};
  for (const t of transacoes) {
    (porBanco[t.banco] ||= new Set()).add(t.data.slice(0, 7));
  }
  return Object.entries(porBanco)
    .map(([banco, meses]) => ({ banco, meses: [...meses].sort() }))
    .sort((a, b) => a.banco.localeCompare(b.banco));
}

function competenciaDominante(datas) {
  const contagem = {};
  for (const d of datas) {
    const ym = d.slice(0, 7);
    contagem[ym] = (contagem[ym] || 0) + 1;
  }
  const [ym] = Object.entries(contagem).sort((a, b) => b[1] - a[1])[0];
  return `${ym}-01`;
}

export default function Importar() {
  const [categoriasMap, setCategoriasMap] = useState(null);
  const [palavrasCategoria, setPalavrasCategoria] = useState(null);
  const [linhas, setLinhas] = useState(null);
  const [fonte, setFonte] = useState(null);
  const [nomeArquivo, setNomeArquivo] = useState("");
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState("");
  const [resultado, setResultado] = useState(null);
  const [porConta, setPorConta] = useState(null);
  const [editandoConta, setEditandoConta] = useState(null);
  const [nomeContaInput, setNomeContaInput] = useState("");
  const [salvandoConta, setSalvandoConta] = useState(false);
  const [investMonths, setInvestMonths] = useState([]);

  useEffect(() => {
    Promise.all([getCategoriasMap(), getPalavrasCategoria()]).then(([c, p]) => {
      setCategoriasMap(c);
      setPalavrasCategoria(p);
    });
    carregarPorConta();
    carregarInvestMonths();
  }, []);

  function carregarInvestMonths() {
    loadMonths().then(setInvestMonths).catch(() => setInvestMonths([]));
  }

  const tickersInvestimento = useMemo(
    () => [...new Set(investMonths.flatMap((m) => m.assets.map((a) => a.nome)))].sort(),
    [investMonths]
  );

  function carregarPorConta() {
    loadTransacoes().then((t) => setPorConta(agruparPorConta(t))).catch(() => setPorConta([]));
  }

  async function salvarNomeConta(bancoAntigo) {
    const novo = nomeContaInput.trim();
    setEditandoConta(null);
    if (!novo || novo === bancoAntigo) return;
    setSalvandoConta(true);
    try {
      await renomearConta(bancoAntigo, novo);
      carregarPorConta();
    } catch (e2) {
      setErro(`Erro ao renomear conta: ${e2.message}`);
    } finally {
      setSalvandoConta(false);
    }
  }

  const categoriasDisponiveis = categoriasMap ? Object.keys(categoriasMap) : [];

  async function onArquivo(e) {
    const file = e.target.files[0];
    e.target.value = "";
    if (!file) return;
    setErro("");
    setResultado(null);
    setCarregando(true);
    try {
      const regras = await loadRegrasUsuario();
      const { fonte: fonteDetectada, transacoes } = await parseArquivo(file, palavrasCategoria, regras);
      setFonte(fonteDetectada);
      setLinhas(transacoes.map((t) => ({ ...t, incluir: true, sempreAssim: false })));
      setNomeArquivo(file.name);
    } catch (e2) {
      setErro(e2.message);
      setLinhas(null);
    } finally {
      setCarregando(false);
    }
  }

  function atualizarLinha(i, campo, valor) {
    setLinhas((prev) => prev.map((l, idx) => (idx === i ? { ...l, [campo]: valor } : l)));
  }

  async function confirmar() {
    setCarregando(true);
    setErro("");
    try {
      const incluidas = linhas.filter((l) => l.incluir);
      await Promise.all(
        incluidas.filter((l) => l.sempreAssim).map((l) => salvarRegraCategorizacao(normalizar(l.desc), l.cat))
      );
      const r = await importarTransacoes(incluidas, fonte.banco);
      await registrarImportLog({
        banco: fonte.banco,
        arquivoNome: nomeArquivo,
        competencia: competenciaDominante(incluidas.map((l) => l.data)),
        importadas: r.importadas,
        duplicadas: r.duplicadas,
      });
      setResultado(r);
      setLinhas(null);
      carregarPorConta();
    } catch (e2) {
      setErro(`Erro ao importar: ${e2.message}`);
    } finally {
      setCarregando(false);
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20, maxWidth: 900 }}>
      <p style={{ color: "var(--ink-faint)", fontSize: 13, margin: 0 }}>Nada é gravado antes de você revisar e confirmar abaixo.</p>

      {porConta && porConta.length > 0 && (
        <Panel title="Importado por conta">
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {porConta.map((c) => (
              <div key={c.banco}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
                  {editandoConta === c.banco ? (
                    <>
                      <input
                        autoFocus
                        value={nomeContaInput}
                        onChange={(e) => setNomeContaInput(e.target.value)}
                        onKeyDown={(e) => { if (e.key === "Enter") salvarNomeConta(c.banco); if (e.key === "Escape") setEditandoConta(null); }}
                        style={{ padding: "4px 8px", border: "1px solid var(--rule)", borderRadius: 6, fontSize: 13.5, fontWeight: 600 }}
                      />
                      <button onClick={() => salvarNomeConta(c.banco)} style={{ padding: "4px 10px", background: "var(--accent)", color: "#fff", border: "none", borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>Salvar</button>
                      <button onClick={() => setEditandoConta(null)} style={{ padding: "4px 10px", background: "transparent", color: "var(--ink-faint)", border: "1px solid var(--rule)", borderRadius: 6, fontSize: 12, cursor: "pointer" }}>Cancelar</button>
                    </>
                  ) : (
                    <>
                      <span style={{ fontWeight: 600, fontSize: 13.5 }}>{c.banco}</span>
                      <button
                        onClick={() => { setEditandoConta(c.banco); setNomeContaInput(c.banco); }}
                        disabled={salvandoConta}
                        title="Renomear conta"
                        style={{ background: "transparent", border: "none", padding: 2, cursor: "pointer", color: "var(--ink-faint)", display: "flex" }}
                      >
                        <Pencil size={13} strokeWidth={2} />
                      </button>
                    </>
                  )}
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {c.meses.map((m) => (
                    <span
                      key={m}
                      style={{ padding: "4px 10px", background: "var(--sidebar-active-bg)", color: "var(--sidebar-active)", borderRadius: 999, fontSize: 12, fontWeight: 600 }}
                    >
                      {labelMes(m)}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </Panel>
      )}

      <Panel>
        <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
          <input type="file" accept=".ofx,.pdf" onChange={onArquivo} disabled={carregando} />
          <span style={{ fontSize: 12, color: "var(--ink-faint)" }}>Reconheço automaticamente Banco Inter (.ofx), Banrisul e Mercado Pago (.pdf).</span>
        </div>

        {erro && <p style={{ color: "var(--debit)", marginBottom: 0 }}>{erro}</p>}
        {carregando && <p style={{ color: "var(--ink-faint)", marginBottom: 0 }}>Processando…</p>}

        {resultado && (
          <div style={{ marginTop: 16, background: "var(--bg)", border: "1px solid var(--rule)", borderRadius: 8, padding: 16 }}>
            <strong style={{ color: "var(--credit)" }}>{resultado.importadas}</strong> transação(ões) importada(s).
            {resultado.duplicadas > 0 && <span style={{ color: "var(--ink-faint)" }}> {resultado.duplicadas} já existia(m) e foram ignoradas.</span>}
          </div>
        )}
      </Panel>

      {linhas && (
        <Panel title={`${fonte.label} — ${linhas.length} linha(s) encontrada(s)`}>
          <p style={{ fontSize: 13, color: "var(--ink-faint)", marginTop: -8, marginBottom: 12 }}>
            Desmarque o que não deve entrar, corrija a categoria onde fizer sentido, e confirme.
          </p>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ textAlign: "left", borderBottom: "1px solid var(--rule)", color: "var(--ink-faint)" }}>
                  <th style={{ padding: "6px 4px" }}></th>
                  <th style={{ padding: "6px 4px" }}>Data</th>
                  <th style={{ padding: "6px 4px" }}>Descrição</th>
                  <th style={{ padding: "6px 4px" }}>Categoria</th>
                  <th style={{ padding: "6px 4px", textAlign: "right" }}>Valor</th>
                  <th style={{ padding: "6px 4px" }}>Sempre assim</th>
                </tr>
              </thead>
              <tbody>
                {linhas.map((l, i) => (
                  <tr key={i} style={{ borderBottom: "1px solid var(--rule)", opacity: l.incluir ? 1 : 0.4 }}>
                    <td style={{ padding: "8px 4px" }}>
                      <input type="checkbox" checked={l.incluir} onChange={(e) => atualizarLinha(i, "incluir", e.target.checked)} />
                    </td>
                    <td style={{ padding: "8px 4px", whiteSpace: "nowrap" }}>{formatarDataBR(l.data)}</td>
                    <td style={{ padding: "8px 4px" }}>{l.desc}</td>
                    <td style={{ padding: "8px 4px" }}>
                      <select value={l.cat} onChange={(e) => atualizarLinha(i, "cat", e.target.value)} style={{ padding: 4, border: "1px solid var(--rule)", borderRadius: 6 }}>
                        {categoriasDisponiveis.map((c) => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </td>
                    <td style={{ padding: "8px 4px", textAlign: "right", color: l.valor >= 0 ? "var(--credit)" : "var(--debit)", whiteSpace: "nowrap" }}>{brl(l.valor)}</td>
                    <td style={{ padding: "8px 4px", textAlign: "center" }}>
                      <input type="checkbox" checked={l.sempreAssim} onChange={(e) => atualizarLinha(i, "sempreAssim", e.target.checked)} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button
            onClick={confirmar}
            disabled={carregando || !linhas.some((l) => l.incluir)}
            style={{ marginTop: 16, padding: "10px 20px", background: "var(--accent)", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", fontWeight: 600 }}
          >
            Confirmar e importar {linhas.filter((l) => l.incluir).length} transação(ões)
          </button>
        </Panel>
      )}

      {/* ========== Investimentos ========== */}
      <div style={{ borderTop: "1px solid var(--rule)", paddingTop: 20, marginTop: 20, display: "flex", flexDirection: "column", gap: 20 }}>
        <h2 style={{ fontSize: 16, fontWeight: 600, margin: 0 }}>Saldos de investimento</h2>
        <ImportarPrintForm tickers={tickersInvestimento} onSalvo={carregarInvestMonths} />
        <ImportarCorretagemForm tickers={tickersInvestimento} onSalvo={carregarInvestMonths} />
        <AtualizarSaldoForm tickers={tickersInvestimento} onSalvo={carregarInvestMonths} />
        <RegistrarAporteForm tickers={tickersInvestimento} onSalvo={carregarInvestMonths} />
      </div>

      {/* ========== NFS-e (MEI) ========== */}
      <div style={{ borderTop: "1px solid var(--rule)", paddingTop: 20, marginTop: 20 }}>
        <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 12 }}>Notas Fiscais (MEI)</h2>
        <NFSeUpload />
      </div>

      <div>
        <NFSeReviewQueue />
      </div>
    </div>
  );
}
