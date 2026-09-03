/* Ponto único de entrada da importação de extratos — detecta o banco
   automaticamente pelo formato/conteúdo do arquivo (não pede pra
   escolher antes), filtra ruído interno, sugere categoria e calcula o
   hash de dedup. Cada linha resultante ainda passa pela fila de
   revisão antes de virar transação de verdade (ver Importar.jsx). */
import { extrairLinhasPdf } from "./pdfText.js";
import { parseOFX, extrairContaOFX } from "./parsers/ofx.js";
import { parseBanrisul } from "./parsers/banrisul.js";
import { parseMercadoPagoConta } from "./parsers/mercadoPagoConta.js";
import { filtrarRuido } from "./filtros.js";
import { categorizarPorPalavra, aplicarRegras, hashTransacao } from "../finance/categorization.js";

export const FONTES = [
  { id: "inter-ofx", label: "Banco Inter", banco: "Banco Inter" },
  { id: "banrisul-pdf", label: "Banrisul", banco: "Banrisul" },
  { id: "mp-pdf", label: "Mercado Pago", banco: "Mercado Pago" },
];

/* Aceita .ofx e .pdf; dentro do PDF, reconhece o layout pela assinatura
   de texto de cada banco. Formato novo ou não reconhecido -> erro
   explicando o que é suportado hoje (não tenta "adivinhar" um extrato
   desconhecido, nem lê print/imagem — só texto extraído de PDF/OFX). */
async function detectarEParsear(file) {
  const ext = file.name.split(".").pop().toLowerCase();

  if (ext === "ofx") {
    const texto = await file.text();
    const base = FONTES.find((f) => f.id === "inter-ofx");
    const conta = extrairContaOFX(texto);
    // Duas contas do mesmo banco (ex: Inter PF e PJ) não podem virar um
    // "banco" só — o nº da conta desambigua; renomeável depois em Importar.
    const banco = conta ? `${base.banco} •${conta.slice(-4)}` : base.banco;
    return { fonte: { ...base, banco }, brutas: parseOFX(texto) };
  }

  if (ext === "pdf") {
    const linhas = await extrairLinhasPdf(file);
    if (linhas.some((l) => /^\+\+\s*MOVIMENTOS\s+[A-Z]{3}\/\d{4}/i.test(l))) {
      return { fonte: FONTES.find((f) => f.id === "banrisul-pdf"), brutas: parseBanrisul(linhas) };
    }
    if (linhas.some((l) => /EXTRATO DE CONTA/i.test(l)) || linhas.some((l) => /^\d{2}-\d{2}-\d{4}\s+\d{6,}\s+R\$/.test(l))) {
      return { fonte: FONTES.find((f) => f.id === "mp-pdf"), brutas: parseMercadoPagoConta(linhas) };
    }
    throw new Error("Não reconheci o layout desse PDF. Hoje eu leio extratos do Banrisul e do Mercado Pago — um banco novo precisa de um parser novo.");
  }

  throw new Error(`Formato .${ext} não suportado. Hoje aceito .ofx (Banco Inter) e .pdf (Banrisul, Mercado Pago).`);
}

/* Retorna { fonte, transacoes } — transações já filtradas, categorizadas
   e com hash de dedup calculado, prontas pra fila de revisão. */
export async function parseArquivo(file, palavrasCategoria, regrasUsuario) {
  const { fonte, brutas } = await detectarEParsear(file);

  const comCategoriaSugerida = aplicarRegras(
    filtrarRuido(brutas).map((t) => ({ ...t, banco: fonte.banco, cat: categorizarPorPalavra(t.desc, palavrasCategoria) })),
    regrasUsuario
  );

  const transacoes = await Promise.all(
    comCategoriaSugerida.map(async (t) => ({ ...t, hash: await hashTransacao(t) }))
  );

  return { fonte, transacoes };
}
