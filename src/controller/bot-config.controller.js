

import logger from '../utils/logger.js';
import { diacriticSensitiveRegex, onlyNumbers } from '../utils/formatter.js';
import botConfigRepository from '../repositories/bot-config.repository.js';
import autoResponseRepository from '../repositories/auto-response.repository.js';

export const findAll = async (req, res) => {
  try {
    
    const { search } = req.query;
    const page = (req?.page - 1) || 0;
    const rowsPerPage = req?.perPage || 10;
    
    const query = {}
    if (search) {
        query.name = {
            $regex: diacriticSensitiveRegex(search),
            $options: "i",
        }
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
    const { name, enabled } = req.body;
    if (!name) return res.status(400).json({ message: 'name is required' });

    const bot = await botConfigRepository.create(req.body);
    
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
    const { name, enabled } = req.body;
    if (!enabled || !name) return res.status(400).json({ message: 'Status and name is required' });

    const bot = await botConfigRepository.findById(id);
    if (!bot) return res.status(404).json({ message: 'the BOT not be founded!' });
    const updated = await botConfigRepository.update(id, req.body)
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
