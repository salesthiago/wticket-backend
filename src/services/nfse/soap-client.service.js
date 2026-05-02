import axios from 'axios';
import https from 'https';
import { XMLParser } from 'fast-xml-parser';
import logger from '../../utils/logger.js';

// Operações suportadas pelo manual NFS-e Padrão Nacional v1.01.
// Cada operação envia uma mensagem XML como string em <nfseDadosMsg>
// e o cabeçalho com <versaoDados> em <nfseCabecMsg>.
export const NFSE_OPERATIONS = {
  GERAR_NFSE: {
    method: 'GerarNfse',
    soapAction: 'http://www.sped.fazenda.gov.br/nfse/GerarNfse'
  },
  RECEPCIONAR_LOTE_DPS: {
    method: 'RecepcionarLoteDps',
    soapAction: 'http://www.sped.fazenda.gov.br/nfse/RecepcionarLoteDps'
  },
  RECEPCIONAR_LOTE_DPS_SINCRONO: {
    method: 'RecepcionarLoteDpsSincrono',
    soapAction: 'http://www.sped.fazenda.gov.br/nfse/RecepcionarLoteDpsSincrono'
  },
  CANCELAR_NFSE: {
    method: 'CancelarNfse',
    soapAction: 'http://www.sped.fazenda.gov.br/nfse/CancelarNfse'
  },
  CONSULTAR_LOTE_DPS: {
    method: 'ConsultarLoteDps',
    soapAction: 'http://www.sped.fazenda.gov.br/nfse/ConsultarLoteDps'
  },
  CONSULTAR_NFSE_POR_DPS: {
    method: 'ConsultarNfsePorDps',
    soapAction: 'http://www.sped.fazenda.gov.br/nfse/ConsultarNfsePorDps'
  },
  CONSULTAR_NFSE_FAIXA: {
    method: 'ConsultarNfseFaixa',
    soapAction: 'http://www.sped.fazenda.gov.br/nfse/ConsultarNfseFaixa'
  },
  CONSULTAR_NFSE_SERVICO_PRESTADO: {
    method: 'ConsultarNfseServicoPrestado',
    soapAction: 'http://www.sped.fazenda.gov.br/nfse/ConsultarNfseServicoPrestado'
  },
  CONSULTAR_NFSE_SERVICO_TOMADO: {
    method: 'ConsultarNfseServicoTomado',
    soapAction: 'http://www.sped.fazenda.gov.br/nfse/ConsultarNfseServicoTomado'
  },
  CONSULTAR_DADOS_CADASTRAIS: {
    method: 'ConsultarDadosCadastrais',
    soapAction: 'http://www.sped.fazenda.gov.br/nfse/ConsultarDadosCadastrais'
  },
  CONSULTAR_DPS_DISPONIVEL: {
    method: 'ConsultarDpsDisponivel',
    soapAction: 'http://www.sped.fazenda.gov.br/nfse/ConsultarDpsDisponivel'
  },
  CONSULTAR_URL_NFSE: {
    method: 'ConsultarUrlNfse',
    soapAction: 'http://www.sped.fazenda.gov.br/nfse/ConsultarUrlNfse'
  }
};

const SOAP_NS = 'http://www.w3.org/2003/05/soap-envelope';
const NFSE_NS = 'http://www.sped.fazenda.gov.br/nfse';

function escapeXmlForSoap(xmlStr) {
  // O conteúdo XML é encapsulado em CDATA para preservar a assinatura
  return `<![CDATA[${xmlStr}]]>`;
}

/**
 * Monta o envelope SOAP 1.2 conforme padrão ABRASF/NFS-e Nacional.
 */
export function buildSoapEnvelope({ method, versaoDados = '1.01', xmlMessage }) {
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    `<soap:Envelope xmlns:soap="${SOAP_NS}" xmlns:nfse="${NFSE_NS}">`,
    '<soap:Header/>',
    '<soap:Body>',
    `<nfse:${method}Request>`,
    '<nfseCabecMsg>',
    `<![CDATA[<cabecalho versao="${versaoDados}" xmlns="${NFSE_NS}"><versaoDados>${versaoDados}</versaoDados></cabecalho>]]>`,
    '</nfseCabecMsg>',
    '<nfseDadosMsg>',
    escapeXmlForSoap(xmlMessage),
    '</nfseDadosMsg>',
    `</nfse:${method}Request>`,
    '</soap:Body>',
    '</soap:Envelope>'
  ].join('');
}

/**
 * Parsea o envelope SOAP de retorno e devolve a mensagem XML interna
 * (já saída do nfseDadosMsg/Result).
 */
export function parseSoapResponse(soapXml) {
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '@_',
    parseTagValue: false,
    cdataPropName: '__cdata',
    removeNSPrefix: true
  });
  const obj = parser.parse(soapXml);
  return obj;
}

/**
 * Envia uma chamada SOAP ao endpoint da prefeitura.
 *
 * @param {object} params
 * @param {string} params.endpoint        URL completa do webservice
 * @param {keyof typeof NFSE_OPERATIONS} params.operationKey
 * @param {string} params.xmlMessage      XML (DPS, Lote, Cancelamento etc.) já assinado
 * @param {string} [params.versaoDados]   Default '1.01'
 * @param {object} [params.tlsCertificate] { certPem, keyPem, caPems[] } para mTLS — opcional
 * @param {number} [params.timeoutMs]     Default 30s
 * @returns {Promise<{ httpStatus:number, durationMs:number, request:string, response:string, parsed:any }>}
 */
export async function sendSoap({ endpoint, operationKey, xmlMessage, versaoDados = '1.01', tlsCertificate, timeoutMs = 30000 }) {
  const op = NFSE_OPERATIONS[operationKey];
  if (!op) throw new Error(`Operação NFS-e desconhecida: ${operationKey}`);
  if (!endpoint) throw new Error('endpoint é obrigatório');

  const envelope = buildSoapEnvelope({ method: op.method, versaoDados, xmlMessage });

  // mTLS opcional — se a prefeitura exigir certificado de transmissão
  let httpsAgent;
  if (tlsCertificate?.certPem && tlsCertificate?.keyPem) {
    httpsAgent = new https.Agent({
      cert: tlsCertificate.certPem,
      key: tlsCertificate.keyPem,
      ca: tlsCertificate.caPems,
      rejectUnauthorized: true,
      keepAlive: false
    });
  }

  const started = Date.now();
  let httpStatus = 0;
  let response = '';
  try {
    const resp = await axios.post(endpoint, envelope, {
      headers: {
        'Content-Type': 'application/soap+xml; charset=utf-8',
        'SOAPAction': op.soapAction,
        'Accept': 'application/soap+xml, text/xml, application/xml'
      },
      httpsAgent,
      timeout: timeoutMs,
      // não validar status — devolvemos para o caller analisar
      validateStatus: () => true,
      transformResponse: [(data) => data] // mantém raw text
    });
    httpStatus = resp.status;
    response = typeof resp.data === 'string' ? resp.data : JSON.stringify(resp.data);
  } catch (err) {
    const durationMs = Date.now() - started;
    logger.error('NFSe SOAP :: send error >> ', err?.message);
    return {
      httpStatus: err.response?.status || 0,
      durationMs,
      request: envelope,
      response: err.response?.data || err.message,
      parsed: null,
      error: err.message
    };
  }

  const durationMs = Date.now() - started;
  let parsed = null;
  try {
    parsed = parseSoapResponse(response);
  } catch (e) {
    logger.warn('NFSe SOAP :: parse failed >> ', e?.message);
  }

  return { httpStatus, durationMs, request: envelope, response, parsed };
}

export default {
  NFSE_OPERATIONS,
  buildSoapEnvelope,
  parseSoapResponse,
  sendSoap
};
