import { useEffect, useState } from "react";
import { CheckCircle2, Pencil } from "lucide-react";
import { parseArquivo } from "../lib/import/index.js";
import { loadRegrasUsuario, salvarRegraCategorizacao, importarTransacoes, registrarImportLog, loadImportLog, loadTransacoes, renomearConta } from "../data/transactions.js";
import { getCategoriasMap, getPalavrasCategoria } from "../data/settings.js";
import { normalizar, brl, formatarDataBR, labelMes } from "../lib/finance/format.js";
import { Panel } from "./shared/ui.jsx";

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
  const [log, setLog] = useState(null);
  const [porConta, setPorConta] = useState(null);
  const [editandoConta, setEditandoConta] = useState(null);
  const [nomeContaInput, setNomeContaInput] = useState("");
  const [salvandoConta, setSalvandoConta] = useState(false);

  useEffect(() => {
    Promise.all([getCategoriasMap(), getPalavrasCategoria()]).then(([c, p]) => {
      setCategoriasMap(c);
      setPalavrasCategoria(p);
    });
    carregarLog();
    carregarPorConta();
  }, []);

  function carregarLog() {
    loadImportLog().then(setLog).catch(() => setLog([]));
  }

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
      carregarLog();
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
      carregarLog();
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

      {log && log.length > 0 && (
        <Panel title="Extratos já importados">
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {log.map((l) => (
              <div key={l.id} style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13, padding: "6px 0", borderBottom: "1px solid var(--rule)" }}>
                <CheckCircle2 size={16} color="var(--credit)" style={{ flexShrink: 0 }} />
                <span style={{ fontWeight: 600 }}>{labelMes(l.competencia.slice(0, 7))}</span>
                <span style={{ color: "var(--ink-faint)" }}>—</span>
                <span>{l.banco}</span>
                <span style={{ color: "var(--ink-faint)", marginLeft: "auto", textAlign: "right" }}>
                  {l.transacoes_importadas} transação(ões) · importado em {formatarDataBR(l.created_at.slice(0, 10))}
                </span>
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
    </div>
  );
}
