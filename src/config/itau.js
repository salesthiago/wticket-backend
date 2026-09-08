// Configuração da Integração Itaú por empresa (Financeiro › Contas a Receber).
//
// Ao contrário de config/payment.js (que é o billing da PLATAFORMA), aqui as
// credenciais vêm SEMPRE do documento itau-config de cada empresa (tenant).
// Este arquivo só resolve as URLs base da API Cobrança v2 do Itaú por ambiente,
// com possibilidade de sobrescrever por variável de ambiente (útil p/ apontar
// para um mock em testes locais).
//
//   ITAU_COBRANCA_ENV            'homologacao' | 'producao'  (default do seletor)
//   ITAU_COBRANCA_AUTH_URL       sobrescreve o host de OAuth2 (STS)
//   ITAU_COBRANCA_API_URL        sobrescreve o host da API de cobrança

const DEFAULTS = {
  homologacao: {
    authUrl: 'https://sts.itau.com.br',
    apiUrl: 'https://api.itau.com.br/itau-ep9-gtw-cash-management-ext-v2-hom'
  },
  producao: {
    authUrl: 'https://sts.itau.com.br',
    apiUrl: 'https://api.itau.com.br/itau-ep9-gtw-cash-management-ext-v2'
  }
};

export const ITAU_ENVIRONMENTS = ['homologacao', 'producao'];

export function resolveItauEndpoints(environment) {
  const env = ITAU_ENVIRONMENTS.includes(environment) ? environment : 'homologacao';
  const base = DEFAULTS[env];
  return {
    environment: env,
    authUrl: (process.env.ITAU_COBRANCA_AUTH_URL || base.authUrl).replace(/\/+$/, ''),
    apiUrl: (process.env.ITAU_COBRANCA_API_URL || base.apiUrl).replace(/\/+$/, ''),
    tokenPath: '/api/oauth/token',
    boletosPath: '/boletos'
  };
}

export function defaultItauEnvironment() {
  const env = (process.env.ITAU_COBRANCA_ENV || 'homologacao').trim();
  return ITAU_ENVIRONMENTS.includes(env) ? env : 'homologacao';
}
