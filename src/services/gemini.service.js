import Settings from '../models/settings.model.js'
import { GoogleGenerativeAI } from "@google/generative-ai";

class GoogleGemini {
  constructor() {
    this.genAI = null;
    this.model = null;
    this.settings = null;
    this.initialize();
  }

  async initialize() {
    try {
      await this.loadSettings();
      if (this.settings?.value?.token) {
        this.genAI = new GoogleGenerativeAI(this.settings.value.token);
        this.model = this.genAI.getGenerativeModel({ model: 'gemini-2.0-flash-exp' });
      }
    } catch (error) {
      console.error('Erro ao inicializar Gemini:', error);
    }
  }

  async loadSettings() {
    try {
      this.settings = await Settings.findOne({ name: 'gemini' });
      if (this.settings?.value?.token && this.genAI === null) {
        this.genAI = new GoogleGenerativeAI(this.settings.value.token);
        this.model = this.genAI.getGenerativeModel({ model: 'gemini-2.0-flash-exp' });
      }
    } catch (error) {
      console.error('Erro ao carregar settings do Gemini:', error);
    }
  }

  async getSettings() {
    await this.loadSettings();
    return this.settings;
  }

  async save(data) {
    try {
      const settings = await Settings.findOne({ name: 'gemini' });

      if (settings) {
        settings.value = {
          agentName: data.agentName,
          token: data.token,
          prompt: data.prompt
        };
        settings.status = data.status || 'enabled';
        await settings.save();
      } else {
        await Settings.create({
          name: 'gemini',
          value: {
            agentName: data.agentName,
            token: data.token,
            prompt: data.prompt
          },
          status: data.status || 'enabled'
        });
      }

      // Reinicializa com o novo token
      await this.initialize();

      return { success: true, message: 'Configurações salvas com sucesso' };
    } catch (error) {
      console.error('Erro ao salvar configurações do Gemini:', error);
      throw error;
    }
  }

  async send(message) {
    try {
      if (!this.model) {
        await this.initialize();
        if (!this.model) {
          throw new Error('Gemini não está configurado. Configure o token da API primeiro.');
        }
      }

      const prompt = this.settings?.value?.prompt
        ? `${this.settings.value.prompt}\n\nMensagem do usuário: ${message}`
        : message;

      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      const text = response.text();

      return {
        success: true,
        text: text,
        raw: response
      };
    } catch (error) {
      console.error('Erro ao enviar mensagem para Gemini:', error);
      throw error;
    }
  }
}

export default new GoogleGemini()