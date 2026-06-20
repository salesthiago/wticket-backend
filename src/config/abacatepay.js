// Configuração da integração com a AbacatePay (https://abacatepay.com).
// Todas as credenciais vêm do .env — nada hardcoded.
//
//   ABACATEPAY_API_KEY        Token Bearer da API (obrigatório p/ gerar cobranças)
//   ABACATEPAY_API_URL        Base da API (default: https://api.abacatepay.com/v1)
//   ABACATEPAY_WEBHOOK_SECRET Segredo do webhook. A AbacatePay chama nossa URL como
//                             POST /api/billing/webhook?webhookSecret=<este valor>
//   ABACATEPAY_SUCCESS_URL    Para onde o cliente volta após pagar (completionUrl)
//   ABACATEPAY_CANCEL_URL     Para onde o cliente volta ao desistir (returnUrl)

export function getConfig() {
  const frontend = process.env.FRONTEND_URL || '';
  return {
    apiUrl: process.env.ABACATEPAY_API_URL || 'https://api.abacatepay.com/v1',
    apiKey: process.env.ABACATEPAY_API_KEY || '',
    webhookSecret: process.env.ABACATEPAY_WEBHOOK_SECRET || '',
    successUrl: process.env.ABACATEPAY_SUCCESS_URL || `${frontend}/login?assinatura=sucesso`,
    cancelUrl: process.env.ABACATEPAY_CANCEL_URL || `${frontend}/login?assinatura=cancelado`
  };
}

export function isConfigured() {
  return !!getConfig().apiKey;
}
