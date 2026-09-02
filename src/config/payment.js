// Configuração dos provedores de pagamento do billing da plataforma.
//
// A fonte da verdade é o painel super-admin (doc único em Settings via
// payment-settings.service). As variáveis abaixo são só FALLBACK, aplicadas
// quando o campo equivalente não está preenchido no painel — mesmo espírito
// do config/abacatepay.js e do email.service.
//
//   Itaú (Pix / Pix recorrente)
//   ITAU_ENV               'sandbox' | 'production' (default: production)
//   ITAU_CLIENT_ID
//   ITAU_CLIENT_SECRET
//   ITAU_CERTIFICATE_PATH  caminho do .crt (PEM) já presente no servidor
//   ITAU_PRIVATE_KEY_PATH  caminho do .key mTLS (PEM) já presente no servidor
//   ITAU_WEBHOOK_SECRET    segredo p/ validar o HMAC do webhook de cobrança
//
//   Stripe (cartão — integração futura)
//   STRIPE_SECRET_KEY
//   STRIPE_WEBHOOK_SECRET

import fs from 'fs';
import logger from '../utils/logger.js';

function readFileMaybe(path) {
  if (!path) return undefined;
  try {
    return fs.readFileSync(path, 'utf8');
  } catch (err) {
    logger.warn(`payment config :: não foi possível ler ${path}: ${err.message}`);
    return undefined;
  }
}

export function getItauEnvConfig() {
  const env = (process.env.ITAU_ENV || 'production').trim();
  return {
    environment: env === 'sandbox' ? 'sandbox' : 'production',
    clientId: process.env.ITAU_CLIENT_ID?.trim() || undefined,
    clientSecret: process.env.ITAU_CLIENT_SECRET?.trim() || undefined,
    webhookSecret: process.env.ITAU_WEBHOOK_SECRET?.trim() || undefined,
    certificatePem: readFileMaybe(process.env.ITAU_CERTIFICATE_PATH?.trim()),
    privateKeyPem: readFileMaybe(process.env.ITAU_PRIVATE_KEY_PATH?.trim())
  };
}

export function getStripeEnvConfig() {
  return {
    secretKey: process.env.STRIPE_SECRET_KEY?.trim() || undefined,
    webhookSecret: process.env.STRIPE_WEBHOOK_SECRET?.trim() || undefined
  };
}
