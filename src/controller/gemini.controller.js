import logger from '../utils/logger.js';
import geminiService from '../services/gemini.service.js';
import Settings from '../models/settings.model.js';

export const getSettings = async (req, res) => {
  try {
    const settings = await Settings.findOne({ name: 'gemini' });

    if (!settings) {
      return res.status(200).json({
        name: 'gemini',
        value: {
          agentName: '',
          token: '',
          prompt: ''
        },
        status: 'disabled'
      });
    }

    return res.status(200).json(settings);
  } catch (err) {
    logger.error('gemini getSettings error >>> ', err);
    res.status(500).json({ message: 'Internal server error' });
  }
};

export const saveSettings = async (req, res) => {
  try {
    const { agentName, token, prompt, status } = req.body;

    if (!agentName || !token || !prompt) {
      return res.status(400).json({ message: 'Nome do agente, token e prompt são obrigatórios' });
    }

    const result = await geminiService.save({ agentName, token, prompt, status });

    const settings = await Settings.findOne({ name: 'gemini' });

    return res.status(200).json({
      message: result.message,
      settings: settings
    });
  } catch (err) {
    logger.error('gemini saveSettings error >>> ', err);
    res.status(500).json({ message: 'Internal server error' });
  }
};

export const updateSettings = async (req, res) => {
  try {
    const { agentName, token, prompt, status } = req.body;

    if (!agentName || !token || !prompt) {
      return res.status(400).json({ message: 'Nome do agente, token e prompt são obrigatórios' });
    }

    const result = await geminiService.save({ agentName, token, prompt, status });

    const settings = await Settings.findOne({ name: 'gemini' });

    return res.status(200).json({
      message: result.message,
      settings: settings
    });
  } catch (err) {
    logger.error('gemini updateSettings error >>> ', err);
    res.status(500).json({ message: 'Internal server error' });
  }
};

export const deleteSettings = async (req, res) => {
  try {
    const settings = await Settings.findOne({ name: 'gemini' });

    if (!settings) {
      return res.status(404).json({ message: 'Configuração não encontrada' });
    }

    await Settings.deleteOne({ name: 'gemini' });

    return res.status(204).json({});
  } catch (err) {
    logger.error('gemini deleteSettings error >>> ', err);
    res.status(500).json({ message: 'Internal server error' });
  }
};

export const sendMessage = async (req, res) => {
  try {
    const { message } = req.body;

    if (!message) {
      return res.status(400).json({ message: 'Mensagem é obrigatória' });
    }

    const response = await geminiService.send(message);

    return res.status(200).json(response);
  } catch (err) {
    logger.error('gemini sendMessage error >>> ', err);

    if (err.message && err.message.includes('não está configurado')) {
      return res.status(400).json({ message: err.message });
    }

    res.status(500).json({ message: 'Internal server error' });
  }
};
