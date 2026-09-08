import crypto from 'crypto';
import logger from '../../../utils/logger.js';
import { decryptSecret } from '../../../utils/crypto.util.js';
import itauConfigRepository from '../../../repositories/financial/itau/itau-config.repository.js';
import itauLogRepository from '../../../repositories/financial/itau/itau-integration-log.repository.js';
import itauBoletoService from '../../../services/financial/itau/itau-boleto.service.js';

function mapStatus(payload) {
  const raw = String(
    payload?.situacao || payload?.status || payload?.tipo_evento || payload?.evento || ''
  ).toLowerCase();
  if (/pag|liquidad|efetivad|concluid/.test(raw)) return 'pago';
  if (/baix/.test(raw)) return 'baixado';
  if (/venc|expirad/.test(raw)) return 'vencido';
  if (/cancel/.test(raw)) return 'cancelado';
  return null;
}

export const handle = async (req, res) => {
  const { companyId } = req.params;
  let success = false;
  let errorMessage;
  let httpStatus = 200;

  try {
    const config = await itauConfigRepository.findByCompany(companyId);
    if (!config) {
      httpStatus = 404;
      return res.status(404).json({ message: 'Configuração Itaú não encontrada' });
    }

    // Validação de assinatura (opcional — só quando há webhookSecret configurado).
    if (config.webhookSecretEnc) {
      let secret;
      try { secret = decryptSecret(config.webhookSecretEnc); } catch { secret = null; }
      const signature = req.headers['x-itau-signature'] || req.headers['x-hub-signature-256'];
      const expected = secret && crypto
        .createHmac('sha256', secret)
        .update(req.rawBody || Buffer.from(JSON.stringify(req.body || {})))
        .digest('hex');
      if (!signature || !expected || signature.replace(/^sha256=/, '') !== expected) {
        httpStatus = 401;
        errorMessage = 'Assinatura de webhook inválida';
        return res.status(401).json({ message: errorMessage });
      }
    }

    const payload = req.body || {};
    const data = payload.data || payload;
    const nossoNumero = data.numero_nosso_numero || data.nosso_numero || data.nossoNumero;
    const itauId = data.id_boleto || data.identificador_boleto;
    const txid = data.txid || data?.pix?.txid;
    const status = mapStatus(data) || mapStatus(payload);

    await itauBoletoService.applyWebhookEvent({ companyId, nossoNumero, itauId, txid, status });
    success = true;
    return res.status(200).json({ received: true });
  } catch (err) {
    logger.error('ItauWebhookController :: handle >> ', err);
    errorMessage = err.message;
    httpStatus = 500;
    return res.status(500).json({ message: 'Erro ao processar webhook' });
  } finally {
    itauLogRepository.create({
      companyId,
      operation: 'webhook',
      method: 'POST',
      url: req.originalUrl,
      requestBody: req.body,
      httpStatus,
      success,
      errorMessage
    });
  }
};
