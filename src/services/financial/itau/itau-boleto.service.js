import QRCode from 'qrcode';
import logger from '../../../utils/logger.js';
import itauBoletoRepository from '../../../repositories/financial/itau/itau-boleto.repository.js';
import itauConfigRepository from '../../../repositories/financial/itau/itau-config.repository.js';
import receivableRepository from '../../../repositories/financial/receivable.repository.js';
import companyRepository from '../../../repositories/company.repository.js';
import itauConfigService from './itau-config.service.js';
import { registrarBoleto, consultarBoleto, baixarBoleto } from './itau-api.client.js';
import { buildBoletoPdf } from './itau-boleto-pdf.service.js';

function httpError(message, status) {
  return Object.assign(new Error(message), { status: status || 422 });
}

const onlyDigits = (v) => String(v || '').replace(/\D/g, '');
const toMoney = (n) => (Number(n) || 0).toFixed(2);
const toIsoDate = (d) => new Date(d).toISOString().slice(0, 10);

function pagadorFromCustomer(customer) {
  const c = customer || {};
  const doc = onlyDigits(c.document);
  const tipo = doc.length === 11 ? 'cpf' : 'cnpj';
  const a = c.address || {};
  return {
    nome: c.name || 'Pagador não identificado',
    documento: doc,
    documentoTipo: tipo,
    email: c.email || undefined,
    logradouro: a.street || undefined,
    numero: a.number || undefined,
    complemento: a.complement || undefined,
    bairro: a.neighborhood || undefined,
    cidade: a.city || undefined,
    uf: a.state || undefined,
    cep: onlyDigits(a.zipCode) || undefined
  };
}

// Monta o corpo da API Cobrança v2 do Itaú (boleto híbrido com QR Pix).
function buildRegistrarPayload({ cfg, receivable, pagador, nossoNumero }) {
  const pessoaCodigo = pagador.documentoTipo === 'cpf' ? 'F' : 'J';
  const pessoa = {
    nome_pessoa: pagador.nome,
    tipo_pessoa: {
      codigo_tipo_pessoa: pessoaCodigo,
      ...(pessoaCodigo === 'F'
        ? { numero_cadastro_pessoa_fisica: pagador.documento }
        : { numero_cadastro_nacional_pessoa_juridica: pagador.documento })
    }
  };

  const dadosIndividuais = {
    numero_nosso_numero: nossoNumero,
    data_vencimento: toIsoDate(receivable.dueDate),
    valor_titulo: toMoney(receivable.amount),
    texto_seu_numero: receivable.number || String(receivable._id)
  };

  const dadoBoleto = {
    descricao_instrumento_cobranca: 'boleto_pix',
    tipo_boleto: 'a vista',
    forma_envio: 'impressao',
    codigo_carteira: cfg.carteira,
    valor_total_titulo: toMoney(receivable.amount),
    data_emissao: toIsoDate(new Date()),
    pagador: {
      pessoa,
      endereco: {
        nome_logradouro: pagador.logradouro || 'Não informado',
        nome_bairro: pagador.bairro || 'Não informado',
        nome_cidade: pagador.cidade || 'Não informado',
        sigla_UF: pagador.uf || 'SP',
        numero_CEP: pagador.cep || '00000000'
      }
    },
    dados_individuais_boleto: [dadosIndividuais],
    dados_qrcode: { chave: cfg.pixKey }
  };

  if (Number(cfg.jurosPercent) > 0) {
    dadoBoleto.juros = { tipo_juros: '93', percentual_juros: toMoney(cfg.jurosPercent) }; // 93 = % ao mês
  }
  if (Number(cfg.multaPercent) > 0) {
    dadoBoleto.multa = { tipo_multa: '02', percentual_multa: toMoney(cfg.multaPercent) }; // 02 = percentual
  }
  if (cfg.instrucoes) {
    dadoBoleto.instrucao_cobranca = [{ codigo_instrucao_cobranca: '99', quantidade_dias_instrucao_cobranca: 0, mensagem: cfg.instrucoes }];
  }

  return {
    data: {
      etapa_processo_boleto: 'efetivacao',
      beneficiario: { id_beneficiario: cfg.beneficiaryId },
      dado_boleto: dadoBoleto
    }
  };
}

// Extrai os campos úteis da resposta do Itaú, tolerando variações de layout.
function extractBoletoResult(resp) {
  const data = resp?.data || resp || {};
  const dado = data.dado_boleto || data;
  const ind = (dado.dados_individuais_boleto && dado.dados_individuais_boleto[0]) || {};
  const qr = dado.dados_qrcode || data.dados_qrcode || ind.dados_qrcode || {};

  return {
    itauId: data.id_boleto || dado.id_boleto || ind.id_boleto,
    nossoNumero: ind.numero_nosso_numero || dado.numero_nosso_numero,
    linhaDigitavel: ind.numero_linha_digitavel || dado.numero_linha_digitavel || ind.linha_digitavel,
    codigoBarras: ind.codigo_barras || dado.codigo_barras || ind.numero_codigo_barras,
    pixEmv: qr.emv || qr.txt_emv || qr.qr_code,
    txid: qr.txid || qr.id_location || data.txid,
    location: qr.location || qr.url_location
  };
}

class ItauBoletoService {
  async _loadReceivable(companyId, receivableId) {
    const rec = await receivableRepository.findById(companyId, receivableId);
    if (!rec) throw httpError('Título não encontrado', 404);
    return rec;
  }

  async getByReceivable(companyId, receivableId) {
    const boleto = await itauBoletoRepository.findActiveByReceivable(companyId, receivableId);
    return boleto || null;
  }

  async generateForReceivable({ companyId, userId, receivableId }) {
    const cfg = await itauConfigService.getEffectiveConfig(companyId);
    if (!cfg.isActive) {
      throw httpError('A integração Itaú não está ativa para esta empresa. Ative-a em Financeiro › Integração Itaú › Configuração.');
    }
    if (!cfg.raw.isComplete()) {
      throw httpError('Configuração Itaú incompleta. Verifique credenciais, certificado, chave mTLS, dados da conta e chave PIX.');
    }
    if (!cfg.beneficiaryId) throw httpError('id_beneficiário do Itaú não pôde ser calculado. Confira agência, conta e dígito.');

    const receivable = await this._loadReceivable(companyId, receivableId);
    if (receivable.status === 'cancelled') throw httpError('Título cancelado não pode gerar boleto', 422);
    if (receivable.status === 'paid') throw httpError('Título já está pago', 422);

    // Idempotência: reaproveita o boleto ativo, se houver.
    const existing = await itauBoletoRepository.findActiveByReceivable(companyId, receivableId);
    if (existing && existing.status !== 'erro') return existing;
    if (existing && existing.status === 'erro') {
      await itauBoletoRepository.softDelete(companyId, existing._id);
    }

    const pagador = pagadorFromCustomer(receivable.customerId);
    if (!pagador.documento) {
      throw httpError('O cliente do título não possui CPF/CNPJ cadastrado — obrigatório para registrar o boleto.', 422);
    }

    const seq = await itauConfigRepository.allocateNextNossoNumero(companyId);
    const nossoNumero = String(seq).padStart(8, '0');

    const payload = buildRegistrarPayload({ cfg, receivable, pagador, nossoNumero });

    let apiResp;
    try {
      apiResp = await registrarBoleto(cfg, payload, { receivableId });
    } catch (err) {
      // Persiste o boleto com status de erro para rastreio no Histórico.
      await itauBoletoRepository.create({
        companyId, receivableId, customerId: receivable.customerId?._id || receivable.customerId || null,
        nossoNumero, carteira: cfg.carteira, agencia: cfg.agencia, conta: cfg.conta,
        valor: receivable.amount, dataVencimento: receivable.dueDate, dataEmissao: new Date(),
        pagador, status: 'erro', errorMessage: err.message,
        statusHistory: [{ status: 'erro', message: err.message, at: new Date() }],
        rawRequest: payload, createdBy: userId
      });
      throw err;
    }

    const result = extractBoletoResult(apiResp);
    const emv = result.pixEmv;
    let qrCodeImage;
    if (emv) {
      try { qrCodeImage = await QRCode.toDataURL(emv, { margin: 1, width: 320 }); }
      catch (e) { logger.warn('itau-boleto :: falha ao gerar QR PNG >> ', e.message); }
    }

    const boleto = await itauBoletoRepository.create({
      companyId,
      receivableId,
      customerId: receivable.customerId?._id || receivable.customerId || null,
      nossoNumero: result.nossoNumero || nossoNumero,
      carteira: cfg.carteira,
      agencia: cfg.agencia,
      conta: cfg.conta,
      itauId: result.itauId,
      txid: result.txid,
      valor: receivable.amount,
      dataVencimento: receivable.dueDate,
      dataEmissao: new Date(),
      linhaDigitavel: result.linhaDigitavel,
      codigoBarras: result.codigoBarras,
      pix: emv ? { emv, qrCodeImage, txid: result.txid, location: result.location } : null,
      status: 'registrado',
      statusHistory: [{ status: 'registrado', message: 'Boleto registrado no Itaú', at: new Date() }],
      pagador,
      rawRequest: payload,
      rawResponse: apiResp,
      createdBy: userId
    });

    // Reflete no título que a cobrança agora é por boleto (sem tocar no billing
    // da plataforma — este é o Receivable do tenant).
    try {
      if (receivable.paymentMethod !== 'boleto') {
        await receivableRepository.update(companyId, receivableId, { paymentMethod: 'boleto' });
      }
    } catch (e) {
      logger.warn('itau-boleto :: não foi possível marcar paymentMethod=boleto >> ', e.message);
    }

    return boleto;
  }

  async refreshStatus({ companyId, boletoId }) {
    const boleto = await itauBoletoRepository.findById(companyId, boletoId);
    if (!boleto) throw httpError('Boleto não encontrado', 404);
    const cfg = await itauConfigService.getEffectiveConfig(companyId);

    const ref = boleto.itauId || `${boleto.carteira}${boleto.nossoNumero}`;
    const resp = await consultarBoleto(cfg, ref, { boletoId, receivableId: boleto.receivableId });

    const situacao = String(
      resp?.data?.situacao_geral_boleto || resp?.data?.codigo_situacao || resp?.situacao || ''
    ).toLowerCase();

    let status = boleto.status;
    if (/pag|liquidad/.test(situacao)) status = 'pago';
    else if (/baix/.test(situacao)) status = 'baixado';
    else if (/venc|expirad/.test(situacao)) status = 'vencido';

    if (status !== boleto.status) {
      await itauBoletoRepository.pushStatus(companyId, boletoId, {
        status, message: `Situação Itaú: ${situacao || 'n/d'}`, at: new Date()
      });
      if (status === 'pago') await this._markReceivablePaid(companyId, boleto.receivableId);
    }
    return itauBoletoRepository.findById(companyId, boletoId);
  }

  async cancel({ companyId, userId, boletoId }) {
    const boleto = await itauBoletoRepository.findById(companyId, boletoId);
    if (!boleto) throw httpError('Boleto não encontrado', 404);
    if (['pago', 'baixado', 'cancelado'].includes(boleto.status)) {
      throw httpError(`Boleto ${boleto.status} não pode ser cancelado`, 422);
    }
    const cfg = await itauConfigService.getEffectiveConfig(companyId);
    const ref = boleto.itauId || `${boleto.carteira}${boleto.nossoNumero}`;
    try {
      await baixarBoleto(cfg, ref, { boletoId, receivableId: boleto.receivableId });
    } catch (err) {
      logger.warn('itau-boleto :: baixa no Itaú falhou, cancelando localmente >> ', err.message);
    }
    await itauBoletoRepository.update(companyId, boletoId, { cancelledBy: userId });
    await itauBoletoRepository.pushStatus(companyId, boletoId, {
      status: 'cancelado', message: 'Cancelado pelo usuário', at: new Date()
    });
    return itauBoletoRepository.findById(companyId, boletoId);
  }

  async list(companyId, params) {
    return itauBoletoRepository.list(companyId, params);
  }

  async getById(companyId, id) {
    const boleto = await itauBoletoRepository.findById(companyId, id);
    if (!boleto) throw httpError('Boleto não encontrado', 404);
    return boleto;
  }

  async buildPdfForReceivable(companyId, receivableId) {
    const boleto = await itauBoletoRepository.findActiveByReceivable(companyId, receivableId);
    if (!boleto) throw httpError('Nenhum boleto Itaú gerado para este título.', 404);
    return this._buildPdf(companyId, boleto);
  }

  async buildPdfById(companyId, boletoId) {
    const boleto = await itauBoletoRepository.findById(companyId, boletoId);
    if (!boleto) throw httpError('Boleto não encontrado', 404);
    return this._buildPdf(companyId, boleto);
  }

  async _buildPdf(companyId, boleto) {
    const cfg = await itauConfigService.getEffectiveConfig(companyId);
    const company = await companyRepository.findById(companyId);
    const receivable = await receivableRepository.findById(companyId, boleto.receivableId?._id || boleto.receivableId);
    const pdf = await buildBoletoPdf({ boleto, config: cfg, company, receivable });
    itauBoletoRepository.update(companyId, boleto._id, { pdfGeneratedAt: new Date() }).catch(() => {});
    return pdf;
  }

  async _markReceivablePaid(companyId, receivableId) {
    try {
      const rec = await receivableRepository.findById(companyId, receivableId);
      if (rec && rec.status !== 'paid' && rec.status !== 'cancelled') {
        await receivableRepository.update(companyId, receivableId, {
          status: 'paid', paymentDate: new Date()
        });
        await receivableRepository.pushStatus(companyId, receivableId, {
          status: 'paid', notes: 'Baixa automática — boleto Itaú liquidado', changedAt: new Date()
        });
      }
    } catch (e) {
      logger.error('itau-boleto :: _markReceivablePaid >> ', e.message);
    }
  }

  // Chamado pelo webhook.
  async applyWebhookEvent({ companyId, nossoNumero, itauId, txid, status }) {
    const boleto = await itauBoletoRepository.findByExternalRef(companyId, { nossoNumero, itauId, txid });
    if (!boleto) {
      logger.warn(`itau-boleto :: webhook sem boleto correspondente (nn=${nossoNumero} id=${itauId})`);
      return null;
    }
    if (status && status !== boleto.status) {
      await itauBoletoRepository.pushStatus(boleto.companyId, boleto._id, {
        status, message: 'Atualizado via webhook Itaú', at: new Date()
      });
      if (status === 'pago') await this._markReceivablePaid(boleto.companyId, boleto.receivableId);
    }
    return itauBoletoRepository.findById(boleto.companyId, boleto._id);
  }
}

export default new ItauBoletoService();
