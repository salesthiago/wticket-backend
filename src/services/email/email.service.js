import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses';
import Settings from '../../models/settings.model.js';
import logger from '../../utils/logger.js';
import { encryptSecret, decryptSecret } from '../../utils/crypto.util.js';

const SETTINGS_KEY = 'email_service';
const TEMPLATE_CODES = ['welcome', 'forgot_password', 'pending_debt'];

const DEFAULT_TEMPLATES = {
  welcome: {
    subject: 'Bem-vindo(a) ao WTicket, {{name}}!',
    body: 'Olá {{name}},\n\nO cadastro da empresa {{companyName}} foi realizado com sucesso no WTicket.\n\nEquipe WTicket'
  },
  forgot_password: {
    subject: 'Redefinição de senha — WTicket',
    body: 'Olá {{name}},\n\nRecebemos uma solicitação para redefinir sua senha. Clique no link abaixo para continuar:\n\n{{link}}\n\nEste link expira em {{expiresInMinutes}} minutos. Se você não solicitou, ignore este e-mail.\n\nEquipe WTicket'
  },
  pending_debt: {
    subject: 'Você tem débito(s) pendente(s) — WTicket',
    body: 'Olá {{name}},\n\nA empresa {{companyName}} possui os seguintes títulos pendentes:\n\n{{items}}\n\nTotal: {{totalAmount}}\n\nEquipe WTicket'
  }
};

// ─── Config (toggle + credenciais) ─────────────────────────────────────────────

function getDefaultConfig() {
  const cfg = {
    region: process.env.SES_REGION,
    accessKeyId: process.env.SES_ACCESS_KEY,
    secretAccessKey: process.env.SES_SECRET_KEY,
    fromEmail: process.env.SES_FROM_EMAIL,
    fromName: process.env.SES_FROM_NAME || 'WTicket'
  };
  if (!cfg.region || !cfg.accessKeyId || !cfg.secretAccessKey || !cfg.fromEmail) return null;
  return cfg;
}

class EmailService {
  // ─── Settings CRUD ────────────────────────────────────────────────────────

  async getSettings() {
    return Settings.findOne({ name: SETTINGS_KEY });
  }

  /** Retorna a config com a secret mascarada, para exibição no admin. */
  async getConfigForAdmin() {
    const settings = await this.getSettings();
    if (!settings) return { status: 'disabled', value: {} };
    const value = { ...settings.value };
    value.secretKey = value.secretKeyEnc ? '••••••••' : '';
    delete value.secretKeyEnc;
    return { status: settings.status, value };
  }

  async saveConfig({ status, region, accessKeyId, secretKey, fromEmail, fromName }) {
    const existing = await this.getSettings();
    const value = existing?.value || {};

    if (region !== undefined) value.region = region;
    if (accessKeyId !== undefined) value.accessKeyId = accessKeyId;
    if (fromEmail !== undefined) value.fromEmail = fromEmail;
    if (fromName !== undefined) value.fromName = fromName;
    // Só sobrescreve a secret se um novo valor foi enviado (não é a máscara)
    if (secretKey && !secretKey.startsWith('••')) value.secretKeyEnc = encryptSecret(secretKey);

    if (existing) {
      existing.value = value;
      existing.status = status || existing.status || 'disabled';
      await existing.save();
      return existing;
    }
    return Settings.create({ name: SETTINGS_KEY, value, status: status || 'disabled' });
  }

  /** Resolve a config efetiva (painel > .env), com a secret já descriptografada. */
  async resolveConfig() {
    const settings = await this.getSettings();
    if (settings?.status === 'enabled' && settings.value?.secretKeyEnc) {
      const { region, accessKeyId, secretKeyEnc, fromEmail, fromName } = settings.value;
      if (region && accessKeyId && fromEmail) {
        return {
          region,
          accessKeyId,
          secretAccessKey: decryptSecret(secretKeyEnc),
          fromEmail,
          fromName: fromName || 'WTicket'
        };
      }
    }
    return getDefaultConfig();
  }

  async isEnabled() {
    const settings = await this.getSettings();
    if (settings) return settings.status === 'enabled' && !!(await this.resolveConfig());
    // Sem doc no banco: habilitado implicitamente se houver fallback de .env completo
    return !!getDefaultConfig();
  }

  _buildClient(config) {
    return new SESClient({
      region: config.region,
      credentials: { accessKeyId: config.accessKeyId, secretAccessKey: config.secretAccessKey }
    });
  }

  // ─── Templates ────────────────────────────────────────────────────────────

  async getTemplate(code) {
    if (!TEMPLATE_CODES.includes(code)) throw new Error(`Template desconhecido: ${code}`);
    const settings = await Settings.findOne({ name: `email_template_${code}` });
    return settings?.value || DEFAULT_TEMPLATES[code];
  }

  async listTemplates() {
    const result = {};
    for (const code of TEMPLATE_CODES) {
      result[code] = await this.getTemplate(code);
    }
    return result;
  }

  async saveTemplate(code, { subject, body }) {
    if (!TEMPLATE_CODES.includes(code)) throw new Error(`Template desconhecido: ${code}`);
    const name = `email_template_${code}`;
    const existing = await Settings.findOne({ name });
    const value = { subject, body };
    if (existing) {
      existing.value = value;
      await existing.save();
      return existing;
    }
    return Settings.create({ name, value, status: 'enabled' });
  }

  _render(str, vars = {}) {
    return String(str || '').replace(/\{\{\s*(\w+)\s*\}\}/g, (_, key) => String(vars[key] ?? ''));
  }

  // ─── Envio ────────────────────────────────────────────────────────────────

  async _send(config, { to, subject, body }) {
    const client = this._buildClient(config);
    const fromAddress = config.fromName ? `${config.fromName} <${config.fromEmail}>` : config.fromEmail;
    const cmd = new SendEmailCommand({
      Source: fromAddress,
      Destination: { ToAddresses: [to] },
      Message: {
        Subject: { Data: subject, Charset: 'UTF-8' },
        Body: { Text: { Data: body, Charset: 'UTF-8' } }
      }
    });
    await client.send(cmd);
  }

  async sendTemplated(code, to, vars = {}) {
    const config = await this.resolveConfig();
    if (!config) throw new Error('Serviço de e-mail não configurado');
    const enabled = await this.isEnabled();
    if (!enabled) throw new Error('Serviço de e-mail está desabilitado');

    const template = await this.getTemplate(code);
    const subject = this._render(template.subject, vars);
    const body = this._render(template.body, vars);
    await this._send(config, { to, subject, body });
    logger.info(`EmailService :: e-mail '${code}' enviado para ${to}`);
  }

  async sendTest(to) {
    const config = await this.resolveConfig();
    if (!config) throw new Error('Serviço de e-mail não configurado');
    await this._send(config, {
      to,
      subject: 'Teste de envio — WTicket',
      body: 'Este é um e-mail de teste enviado pelo painel administrativo do WTicket.'
    });
  }
}

export default new EmailService();
