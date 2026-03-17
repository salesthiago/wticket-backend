import logger from '../utils/logger.js';
import aiProvidersService from '../services/ai-providers.service.js';

const VALID_PROVIDERS = ['gemini', 'openai', 'claude'];

function validateProvider(req, res) {
  if (!VALID_PROVIDERS.includes(req.params.provider)) {
    res.status(400).json({ message: `Provedor inválido. Use: ${VALID_PROVIDERS.join(', ')}` });
    return false;
  }
  return true;
}

export const getAll = async (req, res) => {
  try {
    const result = await aiProvidersService.getAll();
    return res.status(200).json(result);
  } catch (err) {
    logger.error('aiProviders getAll error >>> ', err);
    res.status(500).json({ message: 'Internal server error' });
  }
};

export const getProvider = async (req, res) => {
  if (!validateProvider(req, res)) return;
  try {
    const settings = await aiProvidersService.getProvider(req.params.provider);
    if (!settings) {
      return res.status(200).json({ configured: false });
    }
    // Mascara o token na resposta
    const safe = settings.toObject();
    if (safe.value?.token) safe.value.token = '••••••••';
    return res.status(200).json({ ...safe, configured: true });
  } catch (err) {
    logger.error('aiProviders getProvider error >>> ', err);
    res.status(500).json({ message: 'Internal server error' });
  }
};

export const saveProvider = async (req, res) => {
  if (!validateProvider(req, res)) return;
  try {
    const { token, model, status } = req.body;
    const result = await aiProvidersService.save(req.params.provider, { token, model, status });
    const safe = result.toObject();
    if (safe.value?.token) safe.value.token = '••••••••';
    return res.status(200).json({ message: 'Configuração salva com sucesso', settings: safe });
  } catch (err) {
    logger.error('aiProviders saveProvider error >>> ', err);
    res.status(500).json({ message: 'Internal server error' });
  }
};

export const deleteProvider = async (req, res) => {
  if (!validateProvider(req, res)) return;
  try {
    await aiProvidersService.remove(req.params.provider);
    return res.status(204).send();
  } catch (err) {
    logger.error('aiProviders deleteProvider error >>> ', err);
    res.status(500).json({ message: 'Internal server error' });
  }
};

export const testProvider = async (req, res) => {
  if (!validateProvider(req, res)) return;
  try {
    const { token, model } = req.body;

    if (!token || token.startsWith('••')) {
      // Testa com o token salvo
      const result = await aiProvidersService.send(req.params.provider, 'Responda apenas: OK', '');
      return res.status(200).json({ success: true, text: result.text });
    }

    // Testa com token fornecido antes de salvar
    const result = await aiProvidersService.test(req.params.provider, token, model);
    return res.status(200).json({ success: true, text: result.text });
  } catch (err) {
    logger.error('aiProviders testProvider error >>> ', err);
    const msg = err.message || 'Erro ao testar conexão';
    res.status(400).json({ success: false, message: msg });
  }
};
