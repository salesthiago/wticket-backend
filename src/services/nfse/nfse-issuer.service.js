import logger from '../../utils/logger.js';
import nfseConfigRepository from '../../repositories/nfse/nfse-config.repository.js';
import nfseServiceCodeRepository from '../../repositories/nfse/nfse-service-code.repository.js';
import nfseIssuanceRepository from '../../repositories/nfse/nfse-issuance.repository.js';
import companyRepository from '../../repositories/company.repository.js';
import customerRepository from '../../repositories/customer.repository.js';
import certificateService from './certificate.service.js';
import { resolveEndpoint } from './municipality.registry.js';
import { buildDpsXml, computeValues } from './xml-builder.service.js';
import { signDps } from './xml-signer.service.js';
import { sendSoap, NFSE_OPERATIONS } from './soap-client.service.js';
import ibgeService from './ibge.service.js';
import { XMLParser } from 'fast-xml-parser';

// ─── Helpers de mapeamento ────────────────────────────────────────────────────

const onlyDigits = (s) => String(s ?? '').replace(/\D+/g, '');

function inferDocumentType(doc) {
  const d = onlyDigits(doc);
  if (d.length === 14) return 'cnpj';
  if (d.length === 11) return 'cpf';
  return null;
}

function buildPrestadorSnapshot({ company, config }) {
  const docType = company.documentType || 'cnpj';
  const addr = company.address || {};
  return {
    documentType: docType,
    document: onlyDigits(company.document),
    inscricaoMunicipal: config.inscricaoMunicipal || null,
    nome: company.name,
    email: company.email,
    fone: company.phone,
    endereco: {
      cMun: config.cMun,
      uf: addr.state || config.uf,
      cep: addr.zipCode,
      xLgr: addr.street,
      nro: addr.number,
      xCpl: addr.complement,
      xBairro: addr.neighborhood
    }
  };
}

async function buildTomadorSnapshot({ customer, override }) {
  if (!customer && !override) return null;

  // override tem prioridade sobre o customer
  if (override) {
    const snap = {
      documentType: override.documentType || inferDocumentType(override.document),
      document: onlyDigits(override.document),
      inscricaoMunicipal: override.inscricaoMunicipal,
      nome: override.nome || override.name,
      email: override.email,
      fone: override.fone || override.phone,
      endereco: { ...(override.endereco || override.address || {}) }
    };
    snap.endereco = await resolveEnderecoCMun(snap.endereco);
    return snap;
  }

  const addr = customer.address || {};
  const snap = {
    documentType: customer.documentType || inferDocumentType(customer.document),
    document: onlyDigits(customer.document),
    inscricaoMunicipal: null,
    nome: customer.name,
    email: customer.email,
    fone: customer.phone,
    endereco: {
      cMun: addr.cMun || null,
      uf: addr.state,
      cep: addr.zipCode,
      xLgr: addr.street,
      nro: addr.number,
      xCpl: addr.complement,
      xBairro: addr.neighborhood,
      // mantém o nome da cidade para resolução IBGE quando cMun ausente
      city: addr.city
    }
  };
  snap.endereco = await resolveEnderecoCMun(snap.endereco);
  // Limpeza: city é só auxiliar, não vai para o XML
  delete snap.endereco.city;
  return snap;
}

/**
 * Auto-resolve cMun via IBGE quando temos nome de cidade + UF mas não cMun.
 * Em caso de falha (rede/IBGE indisponível) ou ambiguidade, retorna o
 * endereço inalterado e a validação posterior alertará o usuário.
 */
async function resolveEnderecoCMun(end) {
  if (!end) return end;
  if (end.cMun) return end;
  const cityName = end.xCidade || end.city || end.cidade;
  const uf = end.uf;
  if (!cityName || !uf) return end;
  try {
    const r = await ibgeService.resolveByName(cityName, uf);
    if (r) {
      end.cMun = r.cMun;
      logger.info(`NfseIssuer :: cMun auto-resolvido para "${cityName}/${uf}" → ${r.cMun}`);
    } else {
      logger.warn(`NfseIssuer :: cMun não resolvido para "${cityName}/${uf}" (não encontrado ou ambíguo)`);
    }
  } catch (err) {
    logger.warn('NfseIssuer :: falha ao resolver cMun via IBGE >> ', err?.message);
  }
  return end;
}

function validateForIssuance({ config, company, prestador, servico, valores }) {
  const errors = [];
  if (!config) errors.push('Configuração NFS-e da empresa não encontrada');
  if (!config?.certificate?.storagePath) errors.push('Certificado digital não configurado');
  if (!config?.cMun) errors.push('Município emissor (cMun) não configurado');
  if (!company?.document) errors.push('CNPJ/CPF da empresa não informado');
  if (!prestador?.nome) errors.push('Nome do prestador não informado');
  if (!servico?.cTribNac) errors.push('Código de tributação nacional (cTribNac) é obrigatório');
  if (!servico?.xDescServ) errors.push('Descrição do serviço é obrigatória');
  if (!(valores?.vServ > 0)) errors.push('Valor do serviço deve ser maior que zero');
  return errors;
}

// ─── Orquestrador principal ───────────────────────────────────────────────────

class NfseIssuerService {
  /**
   * Emite uma NFS-e de forma síncrona via método GerarNfse.
   *
   * @param {object} params
   * @param {string} params.companyId
   * @param {object} params.input  payload de emissão
   * @returns {Promise<{ issuance:object, ws:object }>}
   */
  async issue({ companyId, input }) {
    if (!companyId) throw new Error('companyId é obrigatório');
    if (!input) throw new Error('input é obrigatório');

    // 1. Carregar config + company
    const config = await nfseConfigRepository.findByCompany(companyId);
    if (!config) {
      throw Object.assign(new Error('Configuração NFS-e não encontrada'), { status: 422 });
    }
    const company = await companyRepository.findById(companyId);
    if (!company) {
      throw Object.assign(new Error('Empresa não encontrada'), { status: 404 });
    }

    // 2. Resolver service code (catálogo) — opcional
    let serviceCode = null;
    if (input.serviceCodeId) {
      serviceCode = await nfseServiceCodeRepository.findById(companyId, input.serviceCodeId);
      if (!serviceCode || !serviceCode.isActive) {
        throw Object.assign(new Error('Código de serviço inválido ou inativo'), { status: 422 });
      }
    }

    // 3. Resolver customer (tomador) — opcional
    let customer = null;
    if (input.customerId) {
      customer = await customerRepository.findById(companyId, input.customerId);
      if (!customer) {
        throw Object.assign(new Error('Cliente não encontrado'), { status: 404 });
      }
    }

    // 4. Snapshots
    const prestador = buildPrestadorSnapshot({ company, config });
    const tomador = await buildTomadorSnapshot({ customer, override: input.tomadorOverride });

    const cTribNac = input.cTribNac || serviceCode?.cTribNac;
    const cTribMun = input.cTribMun || serviceCode?.cTribMun;
    const cNBS = input.cNBS || serviceCode?.cNBS;
    const xDescServ = input.xDescServ || input.descricao || serviceCode?.descricao;
    const cLocPrestacao = input.cLocPrestacao || config.cMun;

    const servico = {
      cTribNac,
      cTribMun,
      cNBS,
      xDescServ,
      cLocPrestacao,
      cPaisPrestacao: input.cPaisPrestacao || '1058'
    };

    const pAliq = input.pAliq != null ? Number(input.pAliq) : Number(serviceCode?.aliqISSQN || 0);
    const ret = serviceCode?.retencoes || {};
    const inputRet = input.retencoes || {};
    const valoresInput = {
      vServ: Number(input.vServ || 0),
      descIncond: Number(input.descIncond || 0),
      descCond: Number(input.descCond || 0),
      issqn: {
        tribISSQN: input.tribISSQN ?? 1,
        tpRetISSQN: (inputRet.iss ?? ret.iss) ? 2 : 1,
        pAliq
      },
      pis: { aliq: inputRet.pis?.aliq ?? ret.pis?.aliq ?? 0, retido: inputRet.pis?.retido ?? ret.pis?.retido ?? false },
      cofins: { aliq: inputRet.cofins?.aliq ?? ret.cofins?.aliq ?? 0, retido: inputRet.cofins?.retido ?? ret.cofins?.retido ?? false },
      irrf: { aliq: inputRet.irrf?.aliq ?? ret.irrf?.aliq ?? 0, retido: inputRet.irrf?.retido ?? ret.irrf?.retido ?? false },
      csll: { aliq: inputRet.csll?.aliq ?? ret.csll?.aliq ?? 0, retido: inputRet.csll?.retido ?? ret.csll?.retido ?? false },
      cp: { aliq: inputRet.cp?.aliq ?? ret.cp?.aliq ?? 0, retido: inputRet.cp?.retido ?? ret.cp?.retido ?? false }
    };
    const valores = computeValues(valoresInput);

    // 5. Validação
    const validationErrors = validateForIssuance({ config, company, prestador, servico, valores });
    if (validationErrors.length) {
      throw Object.assign(new Error(validationErrors.join('; ')), { status: 422, details: validationErrors });
    }

    // 6. Alocar próximo nDPS (atômico)
    const nDPS = await nfseConfigRepository.allocateNextDps(companyId);

    const dCompet = input.dCompet ? new Date(input.dCompet) : new Date();
    const dhEmi = new Date();

    // 7. Persistir issuance em estado 'signing'
    const issuance = await nfseIssuanceRepository.create({
      companyId,
      customerId: customer?._id || null,
      serviceOrderId: input.serviceOrderId || null,
      serie: config.serie,
      nDPS,
      tpAmb: config.ambiente,
      tpEmit: 1,
      cLocEmi: config.cMun,
      dCompet,
      dhEmi,
      prestador,
      tomador,
      servico,
      valores,
      status: 'signing',
      statusHistory: [{ status: 'draft', message: 'DPS criada', at: new Date() }]
    });

    try {
      // 8. Gerar XML
      const regTrib = {
        opSimpNac: config.opSimpNac,
        regApTribSN: config.regApTribSN,
        regEspTrib: config.regEspTrib
      };
      const { xml: dpsXmlPlain, dpsId } = buildDpsXml({
        cLocEmi: config.cMun,
        tpAmb: config.ambiente,
        tpEmit: 1,
        verAplic: config.verAplic,
        serie: config.serie,
        nDPS,
        dCompet,
        dhEmi,
        prestador,
        tomador,
        servico,
        valores,
        regTrib
      });

      // 9. Carregar certificado e assinar
      const cert = certificateService.loadStoredCertificate(config.certificate);
      const dpsXmlSigned = signDps(dpsXmlPlain, dpsId, cert);

      issuance.dpsId = dpsId;
      issuance.xmlDpsAssinado = dpsXmlSigned;
      issuance.pushStatus('sending', 'Enviando DPS ao webservice');
      await issuance.save();

      // 10. Enviar SOAP (GerarNfse)
      const overrideKey = config.ambiente === 1 ? 'producao' : 'homologacao';
      const endpoint = config.endpoints?.[overrideKey] || resolveEndpoint(config.cMun, config.ambiente);
      if (!endpoint) {
        throw new Error(`Endpoint não configurado para cMun=${config.cMun} ambiente=${config.ambiente}`);
      }

      const ws = await sendSoap({
        endpoint,
        operationKey: 'GERAR_NFSE',
        xmlMessage: dpsXmlSigned,
        versaoDados: '1.01'
      });

      // 11. Auditoria
      await nfseIssuanceRepository.logWsCall({
        companyId,
        issuanceId: issuance._id,
        operation: NFSE_OPERATIONS.GERAR_NFSE.method,
        endpoint,
        ambiente: config.ambiente,
        request: ws.request,
        response: ws.response,
        httpStatus: ws.httpStatus,
        durationMs: ws.durationMs,
        success: ws.httpStatus >= 200 && ws.httpStatus < 300,
        errorMessage: ws.error || null
      });

      // 12. Processar retorno
      const result = this.parseGerarNfseResponse(ws);
      issuance.xmlNfseRetorno = ws.response;

      if (result.success) {
        issuance.chaveAcesso = result.chaveAcesso || null;
        issuance.numeroNfse = result.numeroNfse || null;
        issuance.cStat = result.cStat || null;
        issuance.dhProc = result.dhProc || new Date();
        issuance.protocolo = result.protocolo || null;
        issuance.urlConsulta = result.urlConsulta || null;
        issuance.mensagensRetorno = result.mensagens || [];
        issuance.pushStatus('authorized', `NFS-e ${result.numeroNfse || ''} autorizada`);
      } else {
        issuance.mensagensRetorno = result.mensagens || [];
        issuance.pushStatus('rejected', result.mensagens?.[0]?.mensagem || 'Rejeitada');
      }
      await issuance.save();

      return { issuance, ws };
    } catch (err) {
      logger.error('NfseIssuer :: issue >> ', err);
      issuance.pushStatus('error', err.message);
      await issuance.save();
      throw err;
    }
  }

  /**
   * Extrai o resultado de uma resposta GerarNfse parseada.
   * Estrutura típica: GerarNfseResposta > ListaNfse > CompNfse > Nfse > InfNfse
   * ou ListaMensagemRetorno > MensagemRetorno (em caso de erro).
   */
  parseGerarNfseResponse(ws) {
    if (!ws.parsed) {
      const mensagens = [];
      if (ws.error) {
        mensagens.push({ codigo: String(ws.httpStatus || 0), mensagem: `Erro de comunicação: ${ws.error}` });
      } else if (ws.httpStatus && (ws.httpStatus < 200 || ws.httpStatus >= 300)) {
        const responseSnippet = typeof ws.response === 'string' ? ws.response.substring(0, 500) : null;
        mensagens.push({
          codigo: String(ws.httpStatus),
          mensagem: `Webservice retornou HTTP ${ws.httpStatus}`,
          correcao: responseSnippet || undefined
        });
      } else {
        mensagens.push({ codigo: 'PARSE', mensagem: 'Resposta inválida do webservice' });
      }
      return { success: false, mensagens };
    }

    // Navega genérica e tolerante a variações
    const env = ws.parsed.Envelope || ws.parsed;
    const body = env?.Body || env;
    const respKey = Object.keys(body || {}).find(k => /Response$/i.test(k) || /Resposta$/i.test(k));
    const wrapper = respKey ? body[respKey] : body;

    // Result interno (string CDATA com XML)
    const innerKey = wrapper && Object.keys(wrapper).find(k => /Result$/i.test(k) || /^Resposta/i.test(k));
    const inner = innerKey ? wrapper[innerKey] : wrapper;

    const innerStr = typeof inner === 'string' ? inner : (inner?.__cdata || null);

    // Se veio CDATA, parsear o XML interno também
    let payload = inner;
    if (innerStr) {
      try {
        const parser = new XMLParser({ ignoreAttributes: false, removeNSPrefix: true });
        payload = parser.parse(innerStr);
      } catch (_) {
        payload = inner;
      }
    }

    // Caminhos possíveis
    const lista = payload?.GerarNfseResposta?.ListaNfse
      || payload?.ListaNfse
      || payload?.CompNfse
      || null;

    const mensagensNode = payload?.GerarNfseResposta?.ListaMensagemRetorno
      || payload?.ListaMensagemRetorno
      || payload?.MensagemRetorno
      || null;

    const mensagens = [];
    if (mensagensNode) {
      const arr = Array.isArray(mensagensNode.MensagemRetorno)
        ? mensagensNode.MensagemRetorno
        : (mensagensNode.MensagemRetorno ? [mensagensNode.MensagemRetorno] : Array.isArray(mensagensNode) ? mensagensNode : [mensagensNode]);
      for (const m of arr) {
        mensagens.push({
          codigo: m.Codigo || m.codigo || null,
          mensagem: m.Mensagem || m.mensagem || null,
          correcao: m.Correcao || m.correcao || null
        });
      }
    }

    if (lista) {
      const comp = lista.CompNfse || lista;
      const nfse = comp.Nfse || comp;
      const infNfse = nfse.InfNfse || nfse.infNfse || nfse;
      return {
        success: true,
        chaveAcesso: infNfse?.ChaveAcesso || infNfse?.chNFSe || null,
        numeroNfse: infNfse?.Numero || infNfse?.nNFSe || null,
        cStat: infNfse?.cStat || null,
        dhProc: infNfse?.dhProc ? new Date(infNfse.dhProc) : null,
        protocolo: infNfse?.Protocolo || null,
        urlConsulta: infNfse?.UrlConsulta || null,
        mensagens
      };
    }

    return { success: false, mensagens };
  }

  /**
   * Retransmite uma DPS já assinada ao webservice da prefeitura.
   * Permitido apenas para issuances com status 'error' ou 'rejected'.
   */
  async retransmit({ companyId, issuanceId }) {
    if (!companyId) throw new Error('companyId é obrigatório');
    if (!issuanceId) throw new Error('issuanceId é obrigatório');

    const issuance = await nfseIssuanceRepository.findById(companyId, issuanceId);
    if (!issuance) {
      throw Object.assign(new Error('Emissão não encontrada'), { status: 404 });
    }
    if (!['error', 'rejected'].includes(issuance.status)) {
      throw Object.assign(
        new Error(`Retransmissão não permitida: status atual é "${issuance.status}". Apenas emissões com erro ou rejeitadas podem ser retransmitidas.`),
        { status: 422 }
      );
    }
    if (!issuance.xmlDpsAssinado) {
      throw Object.assign(new Error('XML assinado não disponível para retransmissão'), { status: 422 });
    }

    const config = await nfseConfigRepository.findByCompany(companyId);
    if (!config) {
      throw Object.assign(new Error('Configuração NFS-e não encontrada'), { status: 422 });
    }

    const overrideKey = config.ambiente === 1 ? 'producao' : 'homologacao';
    const endpoint = config.endpoints?.[overrideKey] || resolveEndpoint(config.cMun, config.ambiente);
    if (!endpoint) {
      throw Object.assign(
        new Error(`Endpoint não configurado para cMun=${config.cMun} ambiente=${config.ambiente}`),
        { status: 422 }
      );
    }

    issuance.pushStatus('sending', 'Retransmissão: enviando DPS ao webservice');
    await issuance.save();

    try {
      const ws = await sendSoap({
        endpoint,
        operationKey: 'GERAR_NFSE',
        xmlMessage: issuance.xmlDpsAssinado,
        versaoDados: '1.01'
      });

      await nfseIssuanceRepository.logWsCall({
        companyId,
        issuanceId: issuance._id,
        operation: NFSE_OPERATIONS.GERAR_NFSE.method,
        endpoint,
        ambiente: config.ambiente,
        request: ws.request,
        response: ws.response,
        httpStatus: ws.httpStatus,
        durationMs: ws.durationMs,
        success: ws.httpStatus >= 200 && ws.httpStatus < 300,
        errorMessage: ws.error || null
      });

      const result = this.parseGerarNfseResponse(ws);
      issuance.xmlNfseRetorno = ws.response;

      if (result.success) {
        issuance.chaveAcesso = result.chaveAcesso || null;
        issuance.numeroNfse = result.numeroNfse || null;
        issuance.cStat = result.cStat || null;
        issuance.dhProc = result.dhProc || new Date();
        issuance.protocolo = result.protocolo || null;
        issuance.urlConsulta = result.urlConsulta || null;
        issuance.mensagensRetorno = result.mensagens || [];
        issuance.pushStatus('authorized', `NFS-e ${result.numeroNfse || ''} autorizada`);
      } else {
        issuance.mensagensRetorno = result.mensagens || [];
        issuance.pushStatus('rejected', result.mensagens?.[0]?.mensagem || 'Rejeitada');
      }
      await issuance.save();

      return { issuance, ws };
    } catch (err) {
      logger.error('NfseIssuer :: retransmit >> ', err);
      issuance.pushStatus('error', err.message);
      await issuance.save();
      throw err;
    }
  }
}

export default new NfseIssuerService();
