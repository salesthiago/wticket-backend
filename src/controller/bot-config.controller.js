

import logger from '../utils/logger.js';
import { diacriticSensitiveRegex } from '../utils/formatter.js';
import botConfigRepository from '../repositories/bot-config.repository.js';
import autoResponseRepository from '../repositories/auto-response.repository.js';
import Session from '../models/session.model.js';

export const findAll = async (req, res) => {
  try {
    const companyId = req.user.companyId;
    const { search, isActive, enabled } = req.query;
    const page = (req?.page - 1) || 0;
    const rowsPerPage = req?.perPage || 10;

    const query = {};
    if (search) {
      query.name = { $regex: diacriticSensitiveRegex(search), $options: "i" };
    }
    if (isActive) query.isActive = isActive;
    if (enabled) query.enabled = enabled;

    const items = await botConfigRepository.findAll(companyId, { query, page, rowsPerPage });

    return res.status(200).json(items);
  } catch (err) {
    logger.error('bot-config FindALL error >>> ', err);
    res.status(500).json({ message: 'Internal server error' });
  }
};

export const create = async (req, res) => {
  try {
    const companyId = req.user.companyId;
    const { name, sessionId } = req.body;
    if (!name) return res.status(400).json({ message: 'name is required' });

    let finalData = { ...req.body, companyId };
    if (sessionId) {
      const isObjectId = /^[0-9a-fA-F]{24}$/.test(sessionId);
      if (!isObjectId) {
        const session = await Session.findOne({ name: sessionId, companyId });
        if (!session) {
          return res.status(404).json({ message: `Sessão "${sessionId}" não encontrada` });
        }
        finalData.sessionId = session._id;
      }
    }

    const bot = await botConfigRepository.create(finalData);
    return res.status(200).json(bot);
  } catch (err) {
    logger.error('botConfigController create error >>> ', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

export const update = async (req, res) => {
  try {
    const companyId = req.user.companyId;
    const { id } = req.params;
    if (!id) return res.status(422).json({ message: 'ID not founded' });

    const { name, enabled, sessionId } = req.body;
    if (!enabled || !name) return res.status(400).json({ message: 'Status and name is required' });

    const bot = await botConfigRepository.findById(companyId, id);
    if (!bot) return res.status(404).json({ message: 'the BOT not be founded!' });

    let finalData = { ...req.body };
    if (sessionId) {
      const isObjectId = /^[0-9a-fA-F]{24}$/.test(sessionId);
      if (!isObjectId) {
        const session = await Session.findOne({ name: sessionId, companyId });
        if (!session) {
          return res.status(404).json({ message: `Sessão "${sessionId}" não encontrada` });
        }
        finalData.sessionId = session._id;
      }
    }

    const updated = await botConfigRepository.update(companyId, id, finalData);
    return res.status(200).json(updated);
  } catch (err) {
    logger.error('botConfigController update error ', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

export const findById = async (req, res) => {
  try {
    const companyId = req.user.companyId;
    const { id } = req.params;
    if (!id) return res.status(422).json({ message: 'ID not founded' });

    const bot = await botConfigRepository.findById(companyId, id);
    if (!bot) return res.status(404).json({ message: 'Bot not founded!' });

    return res.status(200).json(bot);
  } catch (err) {
    logger.error('botConfigController findById error', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

export const remove = async (req, res) => {
  try {
    const companyId = req.user.companyId;
    const { id } = req.params;
    if (!id) return res.status(422).json({ message: 'ID not founded' });

    const bot = await botConfigRepository.findById(companyId, id);
    if (!bot) return res.status(404).json({ message: 'Bot not founded!' });

    await autoResponseRepository.destroyByBotConfig(companyId, id);
    await botConfigRepository.destroy(companyId, id);

    return res.status(204).json({});
  } catch (err) {
    logger.error('botConfigController remove error', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

export const findResponsesByConfigId = async (req, res) => {
  try {
    const companyId = req.user.companyId;
    const { id } = req.params;
    if (!id) return res.status(422).json({ message: 'ID not founded' });

    const responses = await autoResponseRepository.findByBotConfig(id, { companyId });
    if (!responses) return res.status(404).json({ message: 'Bot not founded!' });

    return res.status(200).json(responses);
  } catch (err) {
    logger.error('botConfigController findResponsesByConfigId error', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

export const insertAutoResponse = async (req, res) => {
  try {
    const companyId = req.user.companyId;
    const { id } = req.params;
    const { question, answer } = req.body;
    if (!id) return res.status(422).json({ message: 'ID not founded' });
    if (!question) return res.status(422).json({ message: 'Question is required' });
    if (!answer) return res.status(422).json({ message: 'Answer is required' });

    const response = await autoResponseRepository.create({
      ...req.body,
      botConfig: id,
      companyId
    });

    return res.status(200).json(response);
  } catch (err) {
    logger.error('botConfigController :: insertAutoResponse ---> ', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

export const updateAutoResponse = async (req, res) => {
  try {
    const companyId = req.user.companyId;
    const { id, bot } = req.params;
    if (!id) return res.status(422).json({ message: 'ID not founded' });
    if (!bot) return res.status(422).json({ message: 'BOT not founded' });

    const response = await autoResponseRepository.update(companyId, id, req.body);
    return res.status(200).json(response);
  } catch (err) {
    logger.error('botConfigController :: updateAutoResponse ---> ', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

export const deleteAutoResponse = async (req, res) => {
  try {
    const companyId = req.user.companyId;
    const { id } = req.params;
    if (!id) return res.status(404).json({ message: 'Auto Response not founded' });

    await autoResponseRepository.destroy(companyId, id);

    return res.status(204).json({});
  } catch (err) {
    logger.error('botConfigController :: deleteAutoResponse ---> ', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
};
