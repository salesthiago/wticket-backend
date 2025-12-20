

import logger from '../utils/logger.js';
import { diacriticSensitiveRegex, onlyNumbers } from '../utils/formatter.js';
import botConfigRepository from '../repositories/bot-config.repository.js';
import autoResponseRepository from '../repositories/auto-response.repository.js';
import Session from '../models/session.model.js';

export const findAll = async (req, res) => {
  try {
    
    const { search, isActive, enabled } = req.query;
    const page = (req?.page - 1) || 0;
    const rowsPerPage = req?.perPage || 10;
    
    const query = {}
    if (search) {
        query.name = {
            $regex: diacriticSensitiveRegex(search),
            $options: "i",
        }
    }
    if (isActive) {
      query.isActive = isActive
    }

    if (enabled) {
      query.enabled = enabled
    }
    
    const items = await botConfigRepository.findAll({ query, page, rowsPerPage })

    return res.status(200).json(items);
  } catch (err) {
    logger.error('bot-config FindALL error >>> ', err);
    res.status(500).json({ message: 'Internal server error' });
  }
};

export const create = async (req, res) => {
  try {
    const { name, enabled, sessionId } = req.body;
    if (!name) return res.status(400).json({ message: 'name is required' });

    // Se sessionId foi fornecido e não é um ObjectId válido, buscar pela sessão
    let finalData = { ...req.body };
    if (sessionId) {
      // Verificar se é um ObjectId válido ou um nome de sessão
      const isObjectId = /^[0-9a-fA-F]{24}$/.test(sessionId);

      if (!isObjectId) {
        // É um nome de sessão, buscar o ObjectId
        logger.debug(`[bot-config] sessionId "${sessionId}" não é ObjectId, buscando sessão por nome...`);
        const session = await Session.findOne({ name: sessionId });

        if (!session) {
          logger.warn(`[bot-config] Sessão "${sessionId}" não encontrada`);
          return res.status(404).json({ message: `Sessão "${sessionId}" não encontrada` });
        }

        logger.debug(`[bot-config] Sessão encontrada: ${session._id}`);
        finalData.sessionId = session._id;
      }
    }

    const bot = await botConfigRepository.create(finalData);

    return res.status(200).json(bot);
  } catch (err) {
    logger.error('Error to botConfigController Contact >>> ', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

export const update = async (req, res) => {
  try {
    const { id } = req.params
    if (!id) {
      return res.status(422).json({ message: 'ID not founded' }, req);
    }
    const { name, enabled, sessionId } = req.body;
    if (!enabled || !name) return res.status(400).json({ message: 'Status and name is required' });

    const bot = await botConfigRepository.findById(id);
    if (!bot) return res.status(404).json({ message: 'the BOT not be founded!' });

    // Se sessionId foi fornecido e não é um ObjectId válido, buscar pela sessão
    let finalData = { ...req.body };
    if (sessionId) {
      // Verificar se é um ObjectId válido ou um nome de sessão
      const isObjectId = /^[0-9a-fA-F]{24}$/.test(sessionId);

      if (!isObjectId) {
        // É um nome de sessão, buscar o ObjectId
        logger.debug(`[bot-config] sessionId "${sessionId}" não é ObjectId, buscando sessão por nome...`);
        const session = await Session.findOne({ name: sessionId });

        if (!session) {
          logger.warn(`[bot-config] Sessão "${sessionId}" não encontrada`);
          return res.status(404).json({ message: `Sessão "${sessionId}" não encontrada` });
        }

        logger.debug(`[bot-config] Sessão encontrada: ${session._id}`);
        finalData.sessionId = session._id;
      }
    }

    const updated = await botConfigRepository.update(id, finalData)
    return res.status(200).json(updated);
  } catch (err) {
    logger.error('botConfigController error ', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
}

  export const findById = async (req, res) => {
  try {
    const { id } = req.params
    if (!id) {
      return res.status(422).json({ message: 'ID not founded' }, req);
    }
    const bot = await botConfigRepository.findById(id);

    if (!bot) return res.status(404).json({ message: 'Bot not founded!' });

    return res.json(bot).status(200);
  } catch (err) {
    logger.error('botConfigController error', err);
    return res.status(500).json({ message: 'Internal server error' });
  }

}

export const remove = async (req, res) => {
  try {
    const { id } = req.params
    if (!id) {
      return res.status(422).json({ message: 'ID not founded' }, req);
    }

    const bot = await botConfigRepository.findById(id);
    if (!bot) return res.status(404).json({ message: 'Bot not founded!' });

    // Remove todas as auto responses associadas
    await autoResponseRepository.destroyByBotConfig(id);

    // Remove o bot
    await botConfigRepository.destroy(id);

    return res.status(204).json({});
  } catch (err) {
    logger.error('botConfigController remove error', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
}

export const findResponsesByConfigId = async (req, res) => {
  try {
    const { id } = req.params
    if (!id) {
      return res.status(422).json({ message: 'ID not founded' }, req);
    } 
    const bot = await autoResponseRepository.findByBotConfig(id);
    if (!bot) return res.status(404).json({ message: 'Bot not founded!' });

    return res.json(bot).status(200);
  } catch (err) {
    logger.error('botConfigController error', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
}

export const insertAutoResponse = async (req, res) => {
  try {
    const { id } = req.params
    const { question, answer } = req.body
    if (!id) {
      return res.status(422).json({ message: 'ID not founded' }, req);
    }
    if (!question) {
      return res.status(422).json({ message: 'Question is required' })
    }
    if (!answer) {
      return res.status(422).json({ message: 'Answer is required' })
    }
    
    const bot = await autoResponseRepository.create({ ...req.body, botConfig: id });
    
    return res.status(200).json(bot);
  } catch (err) {
    logger.error('botConfigController error :: insertAutoResponse ---> ', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
}
export const updateAutoResponse = async (req, res) => {
  try {
    const { id, bot } = req.params
    if (!id) {
      return res.status(422).json({ message: 'ID not founded' }, req);
    }
    if (!bot) {
      return res.status(422).json({ message: 'BOT not founded' }, req);
    }
    const response = await autoResponseRepository.update(id, req.body);
    
    return res.json(response).status(200);
  } catch (err) {
    logger.error('botConfigController error :: updateAutoResponse ---> ', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
}

export const deleteAutoResponse = async (req, res) => {
  try {
    const { id } = req.params
    if (!id) {
      return res.status(404).json({ message: 'Auto Response not founded' }, req);
    }
    await autoResponseRepository.destroy(id);
    
    return res.json({}).status(204);
  } catch (err) {
    logger.error('botConfigController error :: deleteAutoResponse ---> ', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
}
