import logger from '../../utils/logger.js';
import ibgeService from '../../services/nfse/ibge.service.js';

export const search = async (req, res) => {
  try {
    const { q, uf, limit } = req.query;
    if (!q || String(q).trim().length < 2) {
      return res.status(200).json([]);
    }
    const lim = limit ? Math.min(parseInt(limit), 100) : 20;
    const results = await ibgeService.search(q, uf, lim);
    return res.status(200).json(results);
  } catch (err) {
    logger.error('IbgeController :: search >> ', err);
    return res.status(500).json({ message: 'Falha ao consultar IBGE' });
  }
};

export const getByCMun = async (req, res) => {
  try {
    const { cMun } = req.params;
    if (!/^\d{7}$/.test(String(cMun || ''))) {
      return res.status(422).json({ message: 'cMun deve ter 7 dígitos' });
    }
    const r = await ibgeService.getByCMun(cMun);
    if (!r) return res.status(404).json({ message: 'Município não encontrado' });
    return res.status(200).json(r);
  } catch (err) {
    logger.error('IbgeController :: getByCMun >> ', err);
    return res.status(500).json({ message: 'Falha ao consultar IBGE' });
  }
};

export const resolve = async (req, res) => {
  try {
    const { city, uf } = req.query;
    if (!city || !uf) {
      return res.status(422).json({ message: 'Parâmetros city e uf são obrigatórios' });
    }
    const r = await ibgeService.resolveByName(city, uf);
    if (!r) return res.status(404).json({ message: 'Município não encontrado ou ambíguo' });
    return res.status(200).json(r);
  } catch (err) {
    logger.error('IbgeController :: resolve >> ', err);
    return res.status(500).json({ message: 'Falha ao consultar IBGE' });
  }
};
