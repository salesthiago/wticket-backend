import mongoose from 'mongoose';
import logger from '../../utils/logger.js';
import receivableRepository from '../../repositories/financial/receivable.repository.js';
import serviceOrderRepository from '../../repositories/service-order.repository.js';
import projectRepository from '../../repositories/project.repository.js';
import ticketRepository from '../../repositories/ticket.repository.js';
import { PAYMENT_METHODS } from '../../models/financial/receivable.model.js';

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Converte um trecho de HTML (ex.: descrição rich-text de projeto) em texto
 * simples, preservando quebras de parágrafo. Usado para preencher o campo
 * `invoiceDescription`, que é sempre texto puro.
 */
function stripHtml(html) {
  if (!html) return '';
  return String(html)
    .replace(/<\s*br\s*\/?\s*>/gi, '\n')
    .replace(/<\s*\/\s*(p|div|li|h[1-6]|tr)\s*>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]+\n/g, '\n')
    .trim();
}

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
      invoiceDescription: data.invoiceDescription != null ? String(data.invoiceDescription) : '',
      billingBreakdown: data.billingBreakdown && (data.billingBreakdown.workedHours != null || data.billingBreakdown.hourlyRate != null)
        ? {
            workedHours: data.billingBreakdown.workedHours != null ? Number(data.billingBreakdown.workedHours) : null,
            hourlyRate: data.billingBreakdown.hourlyRate != null ? Number(data.billingBreakdown.hourlyRate) : null,
            tasks: Array.isArray(data.billingBreakdown.tasks) ? data.billingBreakdown.tasks : []
          }
        : null,
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
    if (data.invoiceDescription !== undefined) patch.invoiceDescription = data.invoiceDescription != null ? String(data.invoiceDescription) : '';
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
    const doc = await receivableRepository.softDelete(companyId, id);
    if (doc) await ticketRepository.releaseInvoiced(doc._id);
    return doc;
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
    // Tarefas de projeto cobradas neste título voltam a ficar disponíveis.
    await ticketRepository.releaseInvoiced(current._id);
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
        invoiceDescription: data?.invoiceDescription != null ? String(data.invoiceDescription) : '',
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
   *  - Fatura só as tarefas selecionadas (data.ticketIds); o valor é a soma
   *    das horas delas x valor/hora do projeto
   *  - Tarefa já faturada (em título não cancelado) não entra de novo
   */
  async invoiceFromProject({ companyId, userId, projectId, data }) {
    if (!companyId) throw Object.assign(new Error('companyId é obrigatório'), { status: 422 });

    const project = await projectRepository.findById(projectId, { companyId });
    if (!project) throw Object.assign(new Error('Projeto não encontrado'), { status: 404 });

    if (!data?.paymentMethod) {
      throw Object.assign(new Error('Forma de pagamento é obrigatória'), { status: 422 });
    }
    if (!data?.dueDate) {
      throw Object.assign(new Error('Data de vencimento é obrigatória'), { status: 422 });
    }

    // Tarefas (tickets) a faturar. Cada tarefa só pode ser faturada uma vez:
    // ao gerar o título ela fica marcada (invoicedReceivableId) e só é
    // liberada se o título for cancelado/excluído.
    const ticketIds = [...new Set((Array.isArray(data?.ticketIds) ? data.ticketIds : []).map(String))];
    if (!ticketIds.length) {
      throw Object.assign(new Error('Selecione ao menos uma tarefa para faturar'), { status: 422 });
    }
    if (ticketIds.some(tid => !mongoose.isValidObjectId(tid))) {
      throw Object.assign(new Error('Tarefa inválida'), { status: 422 });
    }
    const tasks = await ticketRepository.findProjectTasksByIds({ companyId, projectId, ids: ticketIds });
    if (tasks.length !== ticketIds.length) {
      throw Object.assign(new Error('Uma ou mais tarefas não pertencem a este projeto'), { status: 422 });
    }
    const alreadyInvoiced = tasks.filter(t => t.invoicedReceivableId);
    if (alreadyInvoiced.length) {
      throw Object.assign(
        new Error(`Tarefa(s) já faturada(s): ${alreadyInvoiced.map(t => t.taskNumber || t._id).join(', ')}`),
        { status: 409 }
      );
    }

    // Memória de cálculo: horas das tarefas selecionadas x valor/hora do projeto.
    const workedHours = tasks.reduce((sum, t) => sum + Number(t.workedHours || 0), 0);
    const hourlyRate = project.hourlyRate || 0;
    const computedAmount = workedHours * hourlyRate;
    const billedTasks = tasks.map(t => ({ ticketId: t._id, taskNumber: t.taskNumber, hours: Number(t.workedHours || 0) }));

    const customerId = data?.customerId || (project.customerId?._id || project.customerId);

    // A descrição da fatura é preenchida com a descrição do projeto (texto puro).
    const invoiceDescription = data?.invoiceDescription != null
      ? String(data.invoiceDescription)
      : stripHtml(project.description || '');

    const receivable = await this.create({
      companyId,
      userId,
      data: {
        description: project.projectNumber,
        invoiceDescription,
        billingBreakdown: { workedHours, hourlyRate, tasks: billedTasks },
        amount: data?.amount != null ? Number(data.amount) : computedAmount,
        dueDate: data.dueDate,
        paymentMethod: data.paymentMethod,
        customerId,
        projectId,
        notes: data?.notes || `Faturamento do projeto ${project.projectNumber}`
      }
    });

    // Marca as tarefas no título. Se outra requisição faturou alguma delas no
    // meio do caminho, desfaz tudo para não cobrar a mesma tarefa duas vezes.
    const marked = await ticketRepository.markInvoiced(tasks, receivable._id);
    if (marked !== tasks.length) {
      await ticketRepository.releaseInvoiced(receivable._id);
      await receivableRepository.softDelete(companyId, receivable._id);
      throw Object.assign(new Error('Algumas tarefas acabaram de ser faturadas em outro título. Atualize a tela e tente novamente.'), { status: 409 });
    }
    return receivable;
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
