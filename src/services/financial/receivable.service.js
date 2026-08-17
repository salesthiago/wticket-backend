import logger from '../../utils/logger.js';
import receivableRepository from '../../repositories/financial/receivable.repository.js';
import serviceOrderRepository from '../../repositories/service-order.repository.js';
import projectRepository from '../../repositories/project.repository.js';
import { PAYMENT_METHODS } from '../../models/financial/receivable.model.js';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function isPastDue(dueDate) {
  if (!dueDate) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const d = dueDate instanceof Date ? dueDate : new Date(dueDate);
  d.setHours(0, 0, 0, 0);
  return d < today;
}

/**
 * Atualiza o status para 'overdue' se o título estiver pendente e vencido.
 * Persiste a mudança em disco.
 * @param {object} doc Mongoose document
 * @returns {Promise<object>} doc (possivelmente com status atualizado)
 */
async function recomputeStatus(doc) {
  if (!doc) return doc;
  if (doc.status !== 'pending') return doc;
  if (!isPastDue(doc.dueDate)) return doc;

  doc.status = 'overdue';
  doc.statusHistory = doc.statusHistory || [];
  doc.statusHistory.push({
    status: 'overdue',
    notes: 'Recomputado automaticamente após vencimento',
    changedAt: new Date()
  });
  await doc.save();
  return doc;
}

async function recomputeStatusBulk(docs) {
  if (!Array.isArray(docs)) return docs;
  await Promise.all(docs.map(d => recomputeStatus(d)));
  return docs;
}

// ─── Service principal ────────────────────────────────────────────────────────

class ReceivableService {
  // ─── CRUD ────────────────────────────────────────────────────────────────

  async create({ companyId, userId, data }) {
    if (!companyId) throw Object.assign(new Error('companyId é obrigatório'), { status: 422 });
    const errors = this._validateCreate(data);
    if (errors.length) throw Object.assign(new Error(errors.join('; ')), { status: 422, details: errors });

    const payload = {
      companyId,
      description: data.description,
      amount: Number(data.amount),
      dueDate: new Date(data.dueDate),
      paymentMethod: data.paymentMethod,
      customerId: data.customerId || null,
      serviceOrderId: data.serviceOrderId || null,
      projectId: data.projectId || null,
      notes: data.notes || null,
      createdBy: userId,
      status: 'pending',
      statusHistory: [{
        status: 'pending',
        notes: data.notes || 'Lançamento manual',
        changedBy: userId,
        changedAt: new Date()
      }]
    };

    const doc = await receivableRepository.create(payload);
    await recomputeStatus(doc);
    return doc;
  }

  async update({ companyId, id, data }) {
    const current = await receivableRepository.findById(companyId, id);
    if (!current) throw Object.assign(new Error('Título não encontrado'), { status: 404 });
    if (current.status === 'paid') throw Object.assign(new Error('Título pago não pode ser editado. Estorne primeiro.'), { status: 422 });
    if (current.status === 'cancelled') throw Object.assign(new Error('Título cancelado não pode ser editado'), { status: 422 });

    const patch = {};
    if (data.description !== undefined) patch.description = data.description;
    if (data.amount !== undefined) patch.amount = Number(data.amount);
    if (data.dueDate !== undefined) patch.dueDate = new Date(data.dueDate);
    if (data.paymentMethod !== undefined) {
      if (!PAYMENT_METHODS.includes(data.paymentMethod)) {
        throw Object.assign(new Error('Forma de pagamento inválida'), { status: 422 });
      }
      patch.paymentMethod = data.paymentMethod;
    }
    if (data.customerId !== undefined) patch.customerId = data.customerId || null;
    if (data.notes !== undefined) patch.notes = data.notes;

    const updated = await receivableRepository.update(companyId, id, patch);
    await recomputeStatus(updated);
    return updated;
  }

  async findAll(companyId, params = {}) {
    const result = await receivableRepository.findAll(companyId, params);
    await recomputeStatusBulk(result.records);
    return result;
  }

  async findById(companyId, id) {
    const doc = await receivableRepository.findById(companyId, id);
    if (doc) await recomputeStatus(doc);
    return doc;
  }

  async destroy(companyId, id) {
    return await receivableRepository.softDelete(companyId, id);
  }

  // ─── Operações de status ─────────────────────────────────────────────────

  /**
   * Registra o pagamento (baixa).
   * Permite registrar baixa em pending OU overdue (vencido segue baixável).
   */
  async registerPayment({ companyId, userId, id, paymentDate, paymentMethod, notes }) {
    const current = await receivableRepository.findById(companyId, id);
    if (!current) throw Object.assign(new Error('Título não encontrado'), { status: 404 });
    if (current.status === 'paid') throw Object.assign(new Error('Título já está pago'), { status: 422 });
    if (current.status === 'cancelled') throw Object.assign(new Error('Título cancelado não pode ser baixado'), { status: 422 });

    const patch = {
      status: 'paid',
      paymentDate: paymentDate ? new Date(paymentDate) : new Date(),
      paidBy: userId
    };
    if (paymentMethod) {
      if (!PAYMENT_METHODS.includes(paymentMethod)) {
        throw Object.assign(new Error('Forma de pagamento inválida'), { status: 422 });
      }
      patch.paymentMethod = paymentMethod;
    }

    const updated = await receivableRepository.update(companyId, id, patch);
    await receivableRepository.pushStatus(companyId, id, {
      status: 'paid',
      notes: notes || 'Baixa registrada',
      changedBy: userId,
      changedAt: new Date()
    });
    return await receivableRepository.findById(companyId, id);
  }

  /**
   * Estorna a baixa de pagamento (reverte 'paid' → 'pending'/'overdue').
   */
  async reversePayment({ companyId, userId, id, notes }) {
    const current = await receivableRepository.findById(companyId, id);
    if (!current) throw Object.assign(new Error('Título não encontrado'), { status: 404 });
    if (current.status !== 'paid') throw Object.assign(new Error('Apenas títulos pagos podem ser estornados'), { status: 422 });

    const newStatus = isPastDue(current.dueDate) ? 'overdue' : 'pending';
    await receivableRepository.update(companyId, id, {
      status: newStatus,
      paymentDate: null,
      paidBy: null
    });
    await receivableRepository.pushStatus(companyId, id, {
      status: newStatus,
      notes: notes || 'Pagamento estornado',
      changedBy: userId,
      changedAt: new Date()
    });
    return await receivableRepository.findById(companyId, id);
  }

  /**
   * Cancela o título (não pode ser estornado depois — operação terminal).
   */
  async cancel({ companyId, userId, id, reason }) {
    const current = await receivableRepository.findById(companyId, id);
    if (!current) throw Object.assign(new Error('Título não encontrado'), { status: 404 });
    if (current.status === 'cancelled') throw Object.assign(new Error('Título já está cancelado'), { status: 422 });
    if (current.status === 'paid') throw Object.assign(new Error('Título pago não pode ser cancelado. Estorne primeiro.'), { status: 422 });

    await receivableRepository.update(companyId, id, {
      status: 'cancelled',
      cancelReason: reason || null,
      cancelledBy: userId
    });
    await receivableRepository.pushStatus(companyId, id, {
      status: 'cancelled',
      notes: reason || 'Cancelado',
      changedBy: userId,
      changedAt: new Date()
    });
    return await receivableRepository.findById(companyId, id);
  }

  // ─── Faturamento de OS ───────────────────────────────────────────────────

  /**
   * Cria um título a receber a partir de uma Ordem de Serviço.
   * Regras:
   *  - OS deve ter diagnóstico
   *  - OS não pode ter outro título ativo (não cancelado)
   */
  async invoiceFromServiceOrder({ companyId, userId, serviceOrderId, data }) {
    if (!companyId) throw Object.assign(new Error('companyId é obrigatório'), { status: 422 });

    const so = await serviceOrderRepository.findById(companyId, serviceOrderId);
    if (!so) throw Object.assign(new Error('Ordem de serviço não encontrada'), { status: 404 });

    if (!so.diagnosis || !so.diagnosis.trim()) {
      throw Object.assign(new Error('OS sem diagnóstico não pode ser faturada'), { status: 422 });
    }

    // Anti-duplicidade
    const existing = await receivableRepository.findActiveByServiceOrder(companyId, serviceOrderId);
    if (existing && existing.length > 0) {
      throw Object.assign(
        new Error(`OS já possui título ativo (${existing[0].number}). Cancele-o antes de faturar novamente.`),
        { status: 422 }
      );
    }

    // Defaults a partir da OS
    const servicesTotal = (so.services || []).reduce((acc, s) => acc + Number(s.total || 0), 0);
    const partsTotal = (so.parts || []).reduce((acc, p) => acc + Number(p.total || 0), 0);
    const defaultAmount = so.finalCost > 0 ? so.finalCost : (servicesTotal + partsTotal || so.estimatedCost || 0);

    const description = data?.description
      || `OS ${so.orderNumber} — ${so.equipment?.type || 'serviço'}`;

    const dueDate = data?.dueDate
      ? new Date(data.dueDate)
      : (() => { const d = new Date(); d.setDate(d.getDate() + 30); return d; })();

    if (!data?.paymentMethod) {
      throw Object.assign(new Error('Forma de pagamento é obrigatória'), { status: 422 });
    }

    const customerId = data?.customerId || (so.customerId?._id || so.customerId);

    return await this.create({
      companyId,
      userId,
      data: {
        description,
        amount: data?.amount != null ? Number(data.amount) : defaultAmount,
        dueDate,
        paymentMethod: data.paymentMethod,
        customerId,
        serviceOrderId,
        notes: data?.notes || `Faturamento da OS ${so.orderNumber}`
      }
    });
  }

  async listByServiceOrder(companyId, serviceOrderId) {
    const list = await receivableRepository.listByServiceOrder(companyId, serviceOrderId);
    await recomputeStatusBulk(list);
    return list;
  }

  // ─── Faturamento de Projeto ──────────────────────────────────────────────

  /**
   * Cria um título a receber a partir de um Projeto.
   * O título (descrição) é sempre o número do projeto.
   * Regras:
   *  - Projeto não pode ter outro título ativo (não cancelado)
   */
  async invoiceFromProject({ companyId, userId, projectId, data }) {
    if (!companyId) throw Object.assign(new Error('companyId é obrigatório'), { status: 422 });

    const project = await projectRepository.findById(projectId, { companyId });
    if (!project) throw Object.assign(new Error('Projeto não encontrado'), { status: 404 });

    // Anti-duplicidade
    const existing = await receivableRepository.findActiveByProject(companyId, projectId);
    if (existing && existing.length > 0) {
      throw Object.assign(
        new Error(`Projeto já possui título ativo (${existing[0].number}). Cancele-o antes de faturar novamente.`),
        { status: 422 }
      );
    }

    if (!data?.paymentMethod) {
      throw Object.assign(new Error('Forma de pagamento é obrigatória'), { status: 422 });
    }
    if (!data?.dueDate) {
      throw Object.assign(new Error('Data de vencimento é obrigatória'), { status: 422 });
    }

    let defaultAmount = 0;
    if (data?.amount == null) {
      const stats = await projectRepository.getStats(projectId, companyId);
      defaultAmount = (stats.totalWorkedHours || 0) * (project.hourlyRate || 0);
    }

    const customerId = data?.customerId || (project.customerId?._id || project.customerId);

    return await this.create({
      companyId,
      userId,
      data: {
        description: project.projectNumber,
        amount: data?.amount != null ? Number(data.amount) : defaultAmount,
        dueDate: data.dueDate,
        paymentMethod: data.paymentMethod,
        customerId,
        projectId,
        notes: data?.notes || `Faturamento do projeto ${project.projectNumber}`
      }
    });
  }

  async listByProject(companyId, projectId) {
    const list = await receivableRepository.listByProject(companyId, projectId);
    await recomputeStatusBulk(list);
    return list;
  }

  // ─── Dashboard ───────────────────────────────────────────────────────────

  async dashboard(companyId, params = {}) {
    // Garante que pendentes vencidos estejam refletidos
    const pending = await receivableRepository.findAll(companyId, { status: 'pending', limit: 1000 });
    await recomputeStatusBulk(pending.records);

    const agg = await receivableRepository.aggregateByStatus(companyId, params);
    const summary = {
      pending: { count: 0, total: 0 },
      paid: { count: 0, total: 0 },
      overdue: { count: 0, total: 0 },
      cancelled: { count: 0, total: 0 },
      totalCount: 0,
      totalAmount: 0
    };
    for (const item of agg) {
      if (summary[item._id]) {
        summary[item._id].count = item.count;
        summary[item._id].total = +Number(item.total).toFixed(2);
      }
      summary.totalCount += item.count;
      summary.totalAmount += Number(item.total) || 0;
    }
    summary.totalAmount = +summary.totalAmount.toFixed(2);
    return summary;
  }

  // ─── Validação ───────────────────────────────────────────────────────────

  _validateCreate(data) {
    const errors = [];
    if (!data?.description || !String(data.description).trim()) errors.push('description é obrigatório');
    if (data?.amount == null || isNaN(Number(data.amount)) || Number(data.amount) <= 0) errors.push('amount deve ser maior que zero');
    if (!data?.dueDate || isNaN(new Date(data.dueDate).getTime())) errors.push('dueDate é obrigatório (data válida)');
    if (!data?.paymentMethod) errors.push('paymentMethod é obrigatório');
    else if (!PAYMENT_METHODS.includes(data.paymentMethod)) errors.push(`paymentMethod inválido. Valores: ${PAYMENT_METHODS.join(', ')}`);
    return errors;
  }
}

export default new ReceivableService();
