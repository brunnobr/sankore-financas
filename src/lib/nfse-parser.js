/**
 * NFS-e XML Parser
 * Extrai dados essenciais de NFS-e (Nota Fiscal de Serviço Eletrônica)
 * Suporta o layout "padrão nacional" (sped.fazenda.gov.br/nfse) e
 * formatos antigos de prefeitura (varia por município).
 */

export function parseNFSeXML(xmlString) {
  try {
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlString, 'text/xml');

    if (xmlDoc.getElementsByTagName('parsererror').length > 0) {
      throw new Error('XML inválido');
    }

    const nfse = extractNFSeData(xmlDoc);

    if (!nfse.valor || !nfse.competencia || !nfse.tomador) {
      throw new Error('Campos obrigatórios faltando: valor, competencia (data), tomador');
    }

    return nfse;
  } catch (error) {
    throw new Error(`Erro ao parsear NFS-e XML: ${error.message}`);
  }
}

function matchesTag(el, tagName) {
  return el.tagName === tagName || el.localName === tagName || el.nodeName === tagName
    || el.nodeName.split(':').pop() === tagName;
}

// Busca a primeira tag `tagName` em qualquer lugar do documento.
function getTextContent(xmlDoc, tagName) {
  for (const el of xmlDoc.getElementsByTagName('*')) {
    if (matchesTag(el, tagName)) return el.textContent?.trim() || null;
  }
  return null;
}

// Busca `childTag` só dentro do primeiro `parentTag` encontrado — usado
// pra desambiguar tags que existem tanto no emitente quanto no tomador
// (ex: <xNome> aparece em <emit> e em <toma>).
function getScopedTextContent(xmlDoc, parentTag, childTag) {
  for (const parent of xmlDoc.getElementsByTagName('*')) {
    if (!matchesTag(parent, parentTag)) continue;
    for (const child of parent.getElementsByTagName('*')) {
      if (matchesTag(child, childTag)) return child.textContent?.trim() || null;
    }
  }
  return null;
}

function extractNFSeData(xmlDoc) {
  const nfse = {
    numero: null,
    chave: null,
    competencia: null,
    valor: null,
    tomador: null,
    descricaoServico: null,
    status: 'pendente_revisao',
    raw: xmlDoc.documentElement.outerHTML,
  };

  nfse.numero =
    getTextContent(xmlDoc, 'nNFSe') || // padrão nacional
    getTextContent(xmlDoc, 'Numero') ||
    getTextContent(xmlDoc, 'numero') ||
    getTextContent(xmlDoc, 'NumeroNFSe');

  // Chave: tag explícita, senão o atributo Id de <infNFSe> (padrão nacional)
  nfse.chave =
    getTextContent(xmlDoc, 'Chave') ||
    getTextContent(xmlDoc, 'chave') ||
    getTextContent(xmlDoc, 'IdentificacaoRPS');
  if (!nfse.chave) {
    for (const el of xmlDoc.getElementsByTagName('*')) {
      if (matchesTag(el, 'infNFSe') && el.getAttribute('Id')) {
        nfse.chave = el.getAttribute('Id');
        break;
      }
    }
  }

  // Competência: dCompet (padrão nacional) tem prioridade sobre data de emissão
  nfse.competencia =
    getTextContent(xmlDoc, 'dCompet') ||
    getTextContent(xmlDoc, 'DataCompetencia') ||
    getTextContent(xmlDoc, 'dataCompetencia') ||
    getTextContent(xmlDoc, 'DataEmissao') ||
    getTextContent(xmlDoc, 'dataEmissao') ||
    getTextContent(xmlDoc, 'DataCriacao') ||
    getTextContent(xmlDoc, 'dataCriacao');

  // Valor: vServ (bruto, o que conta pro teto MEI) > vLiq (líquido) > formatos antigos
  const valorString =
    getTextContent(xmlDoc, 'vServ') ||
    getTextContent(xmlDoc, 'vLiq') ||
    getTextContent(xmlDoc, 'ValorServicos') ||
    getTextContent(xmlDoc, 'valorServicos') ||
    getTextContent(xmlDoc, 'Valor') ||
    getTextContent(xmlDoc, 'valor');
  if (valorString) {
    nfse.valor = parseFloat(valorString.replace(',', '.'));
  }

  // Tomador: no padrão nacional, xNome existe em <emit> E <toma> — precisa
  // escopar pro <toma>, senão pega o nome do próprio emitente por engano.
  nfse.tomador =
    getScopedTextContent(xmlDoc, 'toma', 'xNome') ||
    getTextContent(xmlDoc, 'TomadorNome') ||
    getTextContent(xmlDoc, 'tomadorNome') ||
    getTextContent(xmlDoc, 'RazaoSocial') ||
    getTextContent(xmlDoc, 'razaoSocial') ||
    getTextContent(xmlDoc, 'NomeCliente') ||
    getTextContent(xmlDoc, 'nomeCliente') ||
    'Sem identificação';

  nfse.descricaoServico =
    getTextContent(xmlDoc, 'xDescServ') || // padrão nacional
    getTextContent(xmlDoc, 'DescricaoServico') ||
    getTextContent(xmlDoc, 'descricaoServico') ||
    getTextContent(xmlDoc, 'Descricao') ||
    getTextContent(xmlDoc, 'descricao');

  if (nfse.competencia) {
    nfse.competencia = normalizarData(nfse.competencia);
  }

  if (nfse.chave && nfse.chave.length > 50) {
    nfse.chave = nfse.chave.substring(0, 50);
  }

  return nfse;
}

function normalizarData(dataString) {
  if (!dataString) return null;

  if (/^\d{4}-\d{2}-\d{2}/.test(dataString)) {
    return dataString.split('T')[0];
  }

  if (/^\d{2}\/\d{2}\/\d{4}/.test(dataString)) {
    const [dia, mes, ano] = dataString.split('/');
    return `${ano}-${mes}-${dia}`;
  }

  try {
    const d = new Date(dataString);
    if (!isNaN(d)) {
      return d.toISOString().split('T')[0];
    }
  } catch (e) {}

  return null;
}

export function validarNFSe(nfse) {
  const erros = [];

  if (!nfse.valor || nfse.valor <= 0) {
    erros.push('Valor deve ser maior que 0');
  }

  if (!nfse.competencia) {
    erros.push('Data de competência obrigatória');
  } else if (!/^\d{4}-\d{2}-\d{2}$/.test(nfse.competencia)) {
    erros.push('Data em formato inválido');
  }

  if (!nfse.tomador || nfse.tomador.length < 2) {
    erros.push('Tomador/Cliente obrigatório');
  }

  if (!nfse.numero && !nfse.chave) {
    erros.push('Número ou chave da NFS-e obrigatória');
  }

  return {
    valida: erros.length === 0,
    erros,
  };
}

export function gerarHashDedup(nfse) {
  const str = `${nfse.numero || ''}|${nfse.chave || ''}|${nfse.competencia}|${nfse.valor}|${nfse.tomador}`;
  return hashString(str);
}

function hashString(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(16);
}
