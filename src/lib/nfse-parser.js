/**
 * NFS-e XML Parser
 * Extrai dados essenciais de NFS-e (Nota Fiscal de Serviço Eletrônica)
 * Estrutura padrão: RPS + XML de NFS-e gerada
 */

export function parseNFSeXML(xmlString) {
  try {
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlString, 'text/xml');

    // Verificar se há erro no parse
    if (xmlDoc.getElementsByTagName('parsererror').length > 0) {
      throw new Error('XML inválido');
    }

    // Extrair dados da raiz (pode ser RPS ou NFe conforme formato)
    const nfse = extractNFSeData(xmlDoc);

    // Validar campos obrigatórios
    if (!nfse.valor || !nfse.competencia || !nfse.tomador) {
      throw new Error('Campos obrigatórios faltando: valor, competencia (data), tomador');
    }

    return nfse;
  } catch (error) {
    throw new Error(`Erro ao parsear NFS-e XML: ${error.message}`);
  }
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

  // Tentar diferentes caminhos de XML (varia por prefeitura)

  // Número da NFS-e
  nfse.numero =
    getTextContent(xmlDoc, 'Numero') ||
    getTextContent(xmlDoc, 'numero') ||
    getTextContent(xmlDoc, 'NumeroNFSe') ||
    getTextContent(xmlDoc, 'nfse > numero');

  // Chave de acesso / Identificação
  nfse.chave =
    getTextContent(xmlDoc, 'Chave') ||
    getTextContent(xmlDoc, 'chave') ||
    getTextContent(xmlDoc, 'IdentificacaoRPS') ||
    getTextContent(xmlDoc, 'Assinatura'); // fallback

  // Data de competência / emissão
  nfse.competencia =
    getTextContent(xmlDoc, 'DataEmissao') ||
    getTextContent(xmlDoc, 'dataEmissao') ||
    getTextContent(xmlDoc, 'DataCompetencia') ||
    getTextContent(xmlDoc, 'dataCompetencia') ||
    getTextContent(xmlDoc, 'DataCriacao') ||
    getTextContent(xmlDoc, 'dataCriacao');

  // Valor do serviço
  const valorString =
    getTextContent(xmlDoc, 'ValorServicos') ||
    getTextContent(xmlDoc, 'valorServicos') ||
    getTextContent(xmlDoc, 'Valor') ||
    getTextContent(xmlDoc, 'valor');

  if (valorString) {
    nfse.valor = parseFloat(valorString.replace(',', '.'));
  }

  // Tomador (cliente/pagador)
  nfse.tomador =
    getTextContent(xmlDoc, 'TomadorNome') ||
    getTextContent(xmlDoc, 'tomadorNome') ||
    getTextContent(xmlDoc, 'RazaoSocial') ||
    getTextContent(xmlDoc, 'razaoSocial') ||
    getTextContent(xmlDoc, 'NomeCliente') ||
    getTextContent(xmlDoc, 'nomeCliente') ||
    'Sem identificação';

  // Descrição do serviço (opcional)
  nfse.descricaoServico =
    getTextContent(xmlDoc, 'DescricaoServico') ||
    getTextContent(xmlDoc, 'descricaoServico') ||
    getTextContent(xmlDoc, 'Descricao') ||
    getTextContent(xmlDoc, 'descricao');

  // Normalizar data para ISO (YYYY-MM-DD)
  if (nfse.competencia) {
    nfse.competencia = normalizarData(nfse.competencia);
  }

  // Limpar chave de caracteres especiais se for base64/XML
  if (nfse.chave && nfse.chave.length > 50) {
    nfse.chave = nfse.chave.substring(0, 50); // limitar a 50 chars
  }

  return nfse;
}

function getTextContent(xmlDoc, tagName) {
  // Busca case-insensitive atravessando namespaces
  const elements = xmlDoc.getElementsByTagName('*');

  for (let el of elements) {
    if (el.tagName === tagName ||
        el.localName === tagName ||
        el.nodeName === tagName) {
      return el.textContent?.trim() || null;
    }
  }

  // Fallback: busca por partial match (último nome depois de :)
  for (let el of elements) {
    const localName = el.nodeName.split(':').pop();
    if (localName === tagName) {
      return el.textContent?.trim() || null;
    }
  }

  return null;
}

function normalizarData(dataString) {
  // Aceita: 2026-09-17, 17/09/2026, 2026-09-17T10:30:00
  if (!dataString) return null;

  // Se já está em ISO, retorna
  if (/^\d{4}-\d{2}-\d{2}/.test(dataString)) {
    return dataString.split('T')[0];
  }

  // Se é DD/MM/YYYY
  if (/^\d{2}\/\d{2}\/\d{4}/.test(dataString)) {
    const [dia, mes, ano] = dataString.split('/');
    return `${ano}-${mes}-${dia}`;
  }

  // Fallback: tenta construir da string
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
  // Hash de (numero + chave + competencia + valor + tomador)
  // para evitar duplicação na reimportação
  const str = `${nfse.numero || ''}|${nfse.chave || ''}|${nfse.competencia}|${nfse.valor}|${nfse.tomador}`;
  return hashString(str);
}

function hashString(str) {
  // Simple hash implementado em JS (não é crypto-grade, mas suficiente para dedup)
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash).toString(16);
}
