/* Parser do extrato em PDF do Banrisul — relatório de colunas fixas
   ("PARA SIMPLES CONFERENCIA"). Espera as linhas já reconstruídas por
   posição Y (ver ../pdfText.js). Formato real (testado contra extrato
   de julho/2026):

     ++   MOVIMENTOS JUL/2026              <- define mês/ano corrente
     01   DEP DIN 24HRS       009144       150,00     <- transação nova (dia + histórico + doc + valor)
          PIX ENVIADO         102936       150,00-    <- continuação do mesmo dia (sem dia na frente)
           NOME: BRUNNO BARROS RIBEIRO                <- enriquece a descrição da transação anterior
          SALDO NA DATA                     8,82       <- ignorado
*/
const MESES = { JAN: "01", FEV: "02", MAR: "03", ABR: "04", MAI: "05", JUN: "06", JUL: "07", AGO: "08", SET: "09", OUT: "10", NOV: "11", DEZ: "12" };

function parseValor(str, negativo) {
  const n = parseFloat(str.replace(/\./g, "").replace(",", "."));
  return negativo ? -n : n;
}

export function parseBanrisul(linhas) {
  const transacoes = [];
  let anoMes = null; // "2026-07"

  for (const linha of linhas) {
    const cabecalho = linha.match(/^\+\+\s*MOVIMENTOS\s+([A-Z]{3})\/(\d{4})/i);
    if (cabecalho) {
      const mes = MESES[cabecalho[1].toUpperCase()];
      if (mes) anoMes = `${cabecalho[2]}-${mes}`;
      continue;
    }

    const nome = linha.match(/^NOME:\s*(.+)$/i);
    if (nome && transacoes.length) {
      const ultima = transacoes[transacoes.length - 1];
      ultima.desc = `${ultima.desc} - ${nome[1].trim()}`;
      continue;
    }

    if (!anoMes) continue;

    const comDia = linha.match(/^(\d{1,2})\s+(.+?)\s+(\d{6})\s+([\d.,]+)(-)?$/);
    if (comDia) {
      const [, dia, desc, , valorStr, sinal] = comDia;
      transacoes.push({ data: `${anoMes}-${dia.padStart(2, "0")}`, desc: desc.trim(), valor: parseValor(valorStr, !!sinal) });
      continue;
    }

    const continuacao = linha.match(/^([A-Za-zÀ-ú][A-Za-zÀ-ú0-9 ]*?)\s+(\d{6})\s+([\d.,]+)(-)?$/);
    if (continuacao && transacoes.length) {
      const [, desc, , valorStr, sinal] = continuacao;
      const ultimoDia = transacoes[transacoes.length - 1].data;
      transacoes.push({ data: ultimoDia, desc: desc.trim(), valor: parseValor(valorStr, !!sinal) });
    }
  }

  return transacoes;
}
