/* Parser do extrato de conta em PDF do Mercado Pago. Espera as linhas
   já reconstruídas por posição Y (ver ../pdfText.js) — nesse layout a
   descrição cai em linha(s) própria(s) logo antes da linha com
   data+id+valor+saldo. Formato real (testado contra extrato de julho/2026):

     Pix recebido BRUNNO
     BARROS RIBEIRO
     05-07-2026 167324768524 R$ 580,00 R$ 586,75
     Rendimentos
     06-07-2026 1746295411426 R$ 0,23 R$ 586,98
*/
const LINHA_TRANSACAO = /^(\d{2})-(\d{2})-(\d{4})\s+(\d{6,})\s+R\$\s*(-?[\d.,]+)\s+R\$\s*(-?[\d.,]+)$/;
const RUIDO = /^(Data|Descrição|ID da opera|Valor|Saldo|EXTRATO DE CONTA|DETALHE DOS MOVIMENTOS|Periodo:|Entradas:|Saidas:|Saldo inicial|Saldo final|CPF\/CNPJ|Data de gera)/i;

function parseValor(str) {
  return parseFloat(str.replace(/\./g, "").replace(",", "."));
}

export function parseMercadoPagoConta(linhas) {
  const transacoes = [];
  let pendenteDesc = [];

  for (const linha of linhas) {
    const m = linha.match(LINHA_TRANSACAO);
    if (m) {
      const [, dia, mes, ano, , valorStr] = m;
      transacoes.push({ data: `${ano}-${mes}-${dia}`, desc: pendenteDesc.join(" ").trim() || "(sem descrição)", valor: parseValor(valorStr) });
      pendenteDesc = [];
      continue;
    }
    if (!RUIDO.test(linha)) pendenteDesc.push(linha);
  }

  return transacoes;
}
