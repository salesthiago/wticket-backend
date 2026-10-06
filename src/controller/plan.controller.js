import logger from '../utils/logger.js';
import planRepository from '../repositories/plan.repository.js';
import { MODULE_CODES } from '../models/module.model.js';
import { PLAN_CYCLES } from '../models/plan.model.js';
import subscriptionService from '../services/billing/subscription.service.js';

const isSuperAdmin = (req) => req.user?.role === 'super_admin';

// Campos que, ao mudar, exigem recriar o produto recorrente no AbacatePay.
const PRODUCT_FIELDS = ['name', 'price', 'cycle'];

// Sanitiza/valida o corpo de criação/edição de plano.
function validatePlanBody(body, { partial = false } = {}) {
  const errors = [];
  const data = {};

  if (body.name !== undefined) {
    if (!String(body.name).trim()) errors.push('name é obrigatório');
    else data.name = String(body.name).trim();
  } else if (!partial) {
    errors.push('name é obrigatório');
  }

  if (body.description !== undefined) data.description = String(body.description).trim();

  if (body.moduleCodes !== undefined) {
    if (!Array.isArray(body.moduleCodes) || body.moduleCodes.length === 0) {
      errors.push('moduleCodes deve ter ao menos um módulo');
    } else {
      const invalid = body.moduleCodes.filter(c => !MODULE_CODES.includes(c));
      if (invalid.length) errors.push(`Módulos inválidos: ${invalid.join(', ')}`);
      else data.moduleCodes = [...new Set(body.moduleCodes)];
    }
  } else if (!partial) {
    errors.push('moduleCodes é obrigatório');
  }

  if (body.price !== undefined) {
    const price = Number(body.price);
    if (isNaN(price) || price < 0) errors.push('price deve ser >= 0');
    else data.price = price;
  } else if (!partial) {
    errors.push('price é obrigatório');
  }

  if (body.cycle !== undefined) {
    if (!PLAN_CYCLES.includes(body.cycle)) errors.push(`cycle inválido. Valores: ${PLAN_CYCLES.join(', ')}`);
    else data.cycle = body.cycle;
  }

  if (body.isActive !== undefined) data.isActive = !!body.isActive;

  if (body.trialDays !== undefined) {
    const trialDays = Number(body.trialDays);
    if (isNaN(trialDays) || trialDays < 0) errors.push('trialDays deve ser >= 0');
    else data.trialDays = Math.trunc(trialDays);
  }

  return { data, errors };
}

// GET /api/plans?onlyActive=true  → público (a tela de cadastro precisa listar)
export const findAll = async (req, res) => {
  try {
    const query = req.query.onlyActive === 'true' ? { isActive: true } : {};
    const plans = await planRepository.findAll({ query });
    return res.status(200).json(plans);
  } catch (err) {
    logger.error('Plan findAll error', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

export const findById = async (req, res) => {
  try {
    const plan = await planRepository.findById(req.params.id);
    if (!plan) return res.status(404).json({ message: 'Plano não encontrado' });
    return res.json(plan);
  } catch (err) {
    logger.error('Plan findById error', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

export const create = async (req, res) => {
  try {
    if (!isSuperAdmin(req)) return res.status(403).json({ message: 'Only super_admin can create plans' });

    const { data, errors } = validatePlanBody(req.body || {});
    if (errors.length) return res.status(422).json({ message: errors.join('; '), errors });

    const exists = await planRepository.findByName(data.name);
    if (exists) return res.status(422).json({ message: 'Já existe um plano com este nome' });

    const created = await planRepository.create(data);

    // Cria a assinatura (produto recorrente) no AbacatePay. Best-effort: se falhar,
    // o plano fica salvo e o produto será criado sob demanda no 1º checkout.
    let plan = created;
    let abacateError = null;
    try {
      plan = await subscriptionService.ensurePlanProduct(created);
    } catch (err) {
      abacateError = err?.message || 'Falha ao criar produto no AbacatePay';
      logger.warn(`Plan create :: produto AbacatePay não criado p/ plano ${created._id}: ${abacateError}`);
    }

    return res.status(201).json({ ...plan.toObject?.() ?? plan, abacateError });
  } catch (err) {
    logger.error('Plan create error', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

export const update = async (req, res) => {
  try {
    if (!isSuperAdmin(req)) return res.status(403).json({ message: 'Only super_admin can update plans' });

    const { data, errors } = validatePlanBody(req.body || {}, { partial: true });
    if (errors.length) return res.status(422).json({ message: errors.join('; '), errors });

    if (data.name) {
      const exists = await planRepository.findByName(data.name);
      if (exists && String(exists._id) !== req.params.id) {
        return res.status(422).json({ message: 'Já existe um plano com este nome' });
      }
    }

    const updated = await planRepository.update(req.params.id, data);
    if (!updated) return res.status(404).json({ message: 'Plano não encontrado' });

    // Se mudou nome/preço/ciclo (ou ainda não há produto), recria o produto
    // recorrente no AbacatePay (a API v2 não tem update de produto). Best-effort.
    let plan = updated;
    let abacateError = null;
    const touchedProduct = PRODUCT_FIELDS.some(f => data[f] !== undefined);
    if (touchedProduct || !updated.abacateProductId) {
      try {
        plan = await subscriptionService.ensurePlanProduct(updated, { recreate: true });
      } catch (err) {
        abacateError = err?.message || 'Falha ao atualizar produto no AbacatePay';
        logger.warn(`Plan update :: produto AbacatePay não sincronizado p/ plano ${updated._id}: ${abacateError}`);
      }
    }

    return res.json({ ...plan.toObject?.() ?? plan, abacateError });
  } catch (err) {
    logger.error('Plan update error', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

export const destroy = async (req, res) => {
  try {
    if (!isSuperAdmin(req)) return res.status(403).json({ message: 'Only super_admin can delete plans' });
    const deleted = await planRepository.destroy(req.params.id);
    if (!deleted) return res.status(404).json({ message: 'Plano não encontrado' });
    return res.status(200).json({ message: 'Plano removido' });
  } catch (err) {
    logger.error('Plan destroy error', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
};
