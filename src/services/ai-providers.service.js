import { GoogleGenerativeAI } from '@google/generative-ai';
import Settings from '../models/settings.model.js';

const PROVIDERS = ['gemini', 'openai', 'claude'];

class AiProvidersService {

  // ─── Settings CRUD ──────────────────────────────────────────────────────────

  async getAll() {
    const settings = await Settings.find({ name: { $in: PROVIDERS.map(p => `ai_provider_${p}`) } });
    const result = {};
    for (const p of PROVIDERS) {
      const s = settings.find(s => s.name === `ai_provider_${p}`);
      result[p] = s ? { ...s.toObject(), value: { ...s.value, token: s.value?.token ? '••••••••' : '' } } : null;
    }
    return result;
  }

  async getProvider(provider) {
    return Settings.findOne({ name: `ai_provider_${provider}` });
  }

  async save(provider, data) {
    const { token, model, status } = data;
    const existing = await Settings.findOne({ name: `ai_provider_${provider}` });

    const value = existing?.value || {};
    // Só atualiza o token se um novo foi enviado (não é máscara)
    if (token && !token.startsWith('••')) value.token = token;
    if (model) value.model = model;

    if (existing) {
      existing.value = value;
      existing.status = status || existing.status || 'enabled';
      await existing.save();
      return existing;
    } else {
      return Settings.create({ name: `ai_provider_${provider}`, value, status: status || 'enabled' });
    }
  }

  async remove(provider) {
    return Settings.deleteOne({ name: `ai_provider_${provider}` });
  }

  // ─── Send message ────────────────────────────────────────────────────────────

  async send(provider, message, systemPrompt = '') {
    const settings = await this.getProvider(provider);
    if (!settings?.value?.token) {
      throw new Error(`Provedor ${provider} não configurado`);
    }
    const { token, model } = settings.value;

    switch (provider) {
      case 'gemini':  return this._sendGemini(token, model, message, systemPrompt);
      case 'openai':  return this._sendOpenAI(token, model, message, systemPrompt);
      case 'claude':  return this._sendClaude(token, model, message, systemPrompt);
      default: throw new Error(`Provedor desconhecido: ${provider}`);
    }
  }

  // ─── Test connection ──────────────────────────────────────────────────────────

  async test(provider, token, model) {
    const testMessage = 'Responda apenas: OK';
    switch (provider) {
      case 'gemini':  return this._sendGemini(token, model, testMessage, '');
      case 'openai':  return this._sendOpenAI(token, model, testMessage, '');
      case 'claude':  return this._sendClaude(token, model, testMessage, '');
      default: throw new Error(`Provedor desconhecido: ${provider}`);
    }
  }

  // ─── Gemini ──────────────────────────────────────────────────────────────────

  async _sendGemini(token, model, message, systemPrompt) {
    const genAI = new GoogleGenerativeAI(token);
    const geminiModel = genAI.getGenerativeModel({ model: model || 'gemini-2.0-flash-exp' });
    const prompt = systemPrompt ? `${systemPrompt}\n\n${message}` : message;
    const result = await geminiModel.generateContent(prompt);
    return { text: result.response.text() };
  }

  // ─── OpenAI ──────────────────────────────────────────────────────────────────

  async _sendOpenAI(token, model, message, systemPrompt) {
    const messages = [];
    if (systemPrompt) messages.push({ role: 'system', content: systemPrompt });
    messages.push({ role: 'user', content: message });

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        model: model || 'gpt-4o-mini',
        messages,
        max_tokens: 1024
      })
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err?.error?.message || `OpenAI error: ${response.status}`);
    }

    const data = await response.json();
    return { text: data.choices?.[0]?.message?.content || '' };
  }

  // ─── Claude ──────────────────────────────────────────────────────────────────

  async _sendClaude(token, model, message, systemPrompt) {
    const body = {
      model: model || 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      messages: [{ role: 'user', content: message }]
    };
    if (systemPrompt) body.system = systemPrompt;

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': token,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err?.error?.message || `Claude error: ${response.status}`);
    }

    const data = await response.json();
    return { text: data.content?.[0]?.text || '' };
  }
}

export default new AiProvidersService();
