/* Parser de nota de corretagem (PDF) — testado contra nota real da Inter
   DTVM. O layout de "Negócios realizados" (Bovespa, C/V, tipo mercado,
   quantidade, preço, valor, D/C) é padrão CBLC/B3, usado por praticamente
   toda corretora (BTG, Rico, XP, Clear...), então o mesmo parser deve
   cobrir a maioria — só cobre operações à vista (VIS) na Bovespa; termo/
   opções/BM&F ficam de fora por enquanto (raro pro perfil de aporte).

   Espera as linhas já reconstruídas por posição Y (ver ../pdfText.js).
   "ticker" sai como o texto bruto da coluna "Especificação do título"
   (pode incluir o código do segmento, ex: "CI WRLD11") — sempre revisado
   e corrigido na tela antes de confirmar, igual ao import de print,
   porque a extração de texto do PDF pode grudar palavras/colunas. */

function parseNum(str) {
  return parseFloat(str.replace(/\./g, "").replace(",", "."));
}

export function parseNotaCorretagem(linhas) {
  let notaNumero = null;
  let dataPregao = null;
  let liquido = null;
  const itens = [];

  for (const linha of linhas) {
    if (!notaNumero) {
      const cab = linha.match(/^(\d{5,10})\s+\d{1,4}\s+(\d{2})\/(\d{2})\/(\d{4})$/);
      if (cab) {
        notaNumero = cab[1];
        dataPregao = `${cab[4]}-${cab[3]}-${cab[2]}`;
        continue;
      }
    }

    const negocio = linha.match(/^(?:Bovespa|BM&F|BMF)\s+([CV])\s+\S+\s+(.+?)\s+(\d+)\s+([\d.,]+)\s+([\d.,]+)\s+[DC]$/i);
    if (negocio) {
      const [, cv, especificacao, quantidade, precoStr, valorStr] = negocio;
      const valor = parseNum(valorStr) * (cv.toUpperCase() === "C" ? 1 : -1);
      itens.push({ ticker: especificacao.trim(), cv: cv.toUpperCase(), quantidade: Number(quantidade), preco: parseNum(precoStr), valor: Number(valor.toFixed(2)) });
      continue;
    }

    const liq = linha.match(/L[ií]quido para\s+\d{2}\/\d{2}\/\d{4}\s+([\d.,]+)/i);
    if (liq) liquido = parseNum(liq[1]);
  }

  if (!itens.length) {
    throw new Error("Não encontrei negócios nessa nota — confira se é um PDF com texto selecionável (não digitalizado/foto) e se é o layout padrão B3.");
  }

  // Taxas = diferença entre o líquido total da nota e a soma dos negócios
  // (não itemiza corretagem/emolumentos/IRRF separadamente por ora).
  const somaItens = itens.reduce((s, it) => s + it.valor, 0);
  const taxas = liquido != null ? [{ nome: "Taxas e custos (nota)", valor: Number((liquido - somaItens).toFixed(2)) }] : [];

  return { notaNumero, dataPregao, itens, liquido, taxas };
}
