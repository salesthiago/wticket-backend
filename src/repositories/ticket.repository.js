import Ticket from '../models/ticket.model.js';
import logger from '../utils/logger.js';

// Note: companyId is optional in many methods because the message-processor
// service still creates/updates tickets without tenant context.
// TODO: make services tenant-aware and tighten these signatures.
class TicketRepository {
  async create(ticketData) {
    try {
      const ticket = new Ticket(ticketData);
      return await ticket.save();
    } catch (error) {
      throw new Error(error.message);
    }
  }

  async findById(id, { companyId } = {}) {
    try {
      const query = { _id: id };
      if (companyId) query.companyId = companyId;
      return await Ticket.findOne(query)
        .populate('assignedTo', 'name email')
        .populate('categoryId', 'name color')
        .populate('subjectId', 'name')
        .populate('statusId', 'name label color isDone isInProgress')
        .populate('appointmentId')
        .populate('serviceOrderId', 'orderNumber status')
        .populate('projectId', 'title projectNumber')
        .populate('customerId', 'name phone email')
        .populate('responses.respondedBy', 'name email');
    } catch (error) {
      throw new Error(error.message);
    }
  }

  async findByContact(contactNumber) {
    try {
      return await Ticket.findOne({
        contactNumber,
        // status aberto buscado por statusId não-nulo (sem restrição de enum)
      }).populate('statusId', 'name label').sort({ createdAt: -1 });
    } catch (error) {
      throw new Error(error.message);
    }
  }

  async findAll({ categoryId = null, statusId = null, assignedTo = null, companyId = null, projectId = null } = {}) {
    try {
      const query = { companyId: companyId ?? null };
      if (categoryId) query.categoryId = categoryId;
      if (statusId) query.statusId = statusId;
      if (assignedTo) query.assignedTo = assignedTo;
      if (projectId) query.projectId = projectId;

      return await Ticket.find(query)
        .populate('categoryId', 'name color')
        .populate('subjectId', 'name')
        .populate('statusId', 'name label color isDone isInProgress')
        .populate('assignedTo', 'name email')
        .populate('customerId', 'name phone email')
        .populate('saleItems.product', 'name price sku')
        .sort({ createdAt: -1 })
        .exec();
    } catch (error) {
      throw error;
    }
  }

  async updateStatus(id, statusId) {
    try {
      return await Ticket.findByIdAndUpdate(
        id,
        { $set: { statusId } },
        { new: true }
      )
        .populate('statusId', 'name label color')
        .populate('assignedTo', 'name email');
    } catch (error) {
      throw new Error('Erro ao atualizar status: ' + error.message);
    }
  }

  async addResponse(ticketId, { content, respondedBy }) {
    try {
      return await Ticket.findByIdAndUpdate(
        ticketId,
        {
          $push: {
            responses: { content, respondedBy, respondedAt: new Date() }
          }
        },
        { new: true }
      )
        .populate('responses.respondedBy', 'name email')
        .populate('statusId', 'name label color');
    } catch (error) {
      throw new Error('Erro ao adicionar resposta: ' + error.message);
    }
  }

  async assignTicket(id, userId, { companyId } = {}) {
    try {
      return await Ticket.findByIdAndUpdate(
        id,
        { $set: { assignedTo: userId } },
        { new: true }
      ).populate('assignedTo', 'name email');
    } catch (error) {
      throw new Error('Erro ao atribuir ticket: ' + error.message);
    }
  }

  async addMessage(ticketId, messageId) {
    try {
      return await Ticket.findByIdAndUpdate(
        ticketId,
        {
          $push: { messages: messageId },
          $set: { lastMessage: new Date() }
        },
        { new: true }
      );
    } catch (error) {
      throw new Error('Erro ao adicionar mensagem: ' + error.message);
    }
  }

  async update(id, data) {
    try {
      return await Ticket.findByIdAndUpdate(
        id,
        { $set: data },
        { new: true }
      )
        .populate('categoryId', 'name color')
        .populate('subjectId', 'name')
        .populate('statusId', 'name label color');
    } catch (error) {
      throw new Error('Erro ao atualizar ticket: ' + error.message);
    }
  }

  async getTicketsStats() {
    try {
      const match = { sessionName };
      if (companyId) match.companyId = companyId;
      return await Ticket.aggregate([
        {
          $group: {
            _id: '$statusId',
            count: { $sum: 1 }
          }
        }
      ]);
    } catch (error) {
      logger.error('Erro ao obter estatísticas: ', error.message);
      throw new Error('Erro ao obter estatísticas: ' + error.message);
    }
  }

  async deleteTicket(id, { companyId } = {}) {
    try {
      const filter = { _id: id };
      if (companyId) filter.companyId = companyId;
      return await Ticket.findOneAndDelete(filter);
    } catch (error) {
      logger.error('Erro ao deletar: ', error);
      throw new Error('Erro ao deletar ticket: ' + error.message);
    }
  }

  async attendanceDashboard(companyId = null) {
    const match = { companyId: companyId ?? null };
    const now = new Date();
    const eighteenMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 17, 1);
    const MONTHS = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];

    const [statusBreakdown, prioritySummary, responseStats, resolutionStats, monthlyTrend] =
      await Promise.all([
        Ticket.aggregate([
          { $match: match },
          { $group: { _id: '$statusId', count: { $sum: 1 } } },
          { $lookup: { from: 'ticketstatuses', localField: '_id', foreignField: '_id', as: 'status' } },
          { $project: { status: { $arrayElemAt: ['$status', 0] }, count: 1 } },
          { $sort: { 'status.order': 1 } }
        ]),

        Ticket.aggregate([
          { $match: match },
          { $group: {
            _id: null,
            total: { $sum: 1 },
            low:    { $sum: { $cond: [{ $eq: ['$priority', 'low'] },    1, 0] } },
            medium: { $sum: { $cond: [{ $eq: ['$priority', 'medium'] }, 1, 0] } },
            high:   { $sum: { $cond: [{ $eq: ['$priority', 'high'] },   1, 0] } },
            urgent: { $sum: { $cond: [{ $eq: ['$priority', 'urgent'] }, 1, 0] } }
          }}
        ]),

        Ticket.aggregate([
          { $match: match },
          { $project: { hasResponse: { $gt: [{ $size: { $ifNull: ['$responses', []] } }, 0] } } },
          { $group: { _id: '$hasResponse', count: { $sum: 1 } } }
        ]),

        Ticket.aggregate([
          { $match: { ...match, resolvedAt: { $exists: true, $ne: null } } },
          { $project: { hrs: { $divide: [{ $subtract: ['$resolvedAt', '$createdAt'] }, 3600000] } } },
          { $group: { _id: null, avgHours: { $avg: '$hrs' } } }
        ]),

        Ticket.aggregate([
          { $match: { ...match, createdAt: { $gte: eighteenMonthsAgo } } },
          { $group: { _id: { year: { $year: '$createdAt' }, month: { $month: '$createdAt' } }, count: { $sum: 1 } } },
          { $sort: { '_id.year': 1, '_id.month': 1 } }
        ])
      ]);

    const sum = prioritySummary[0] || { total: 0, low: 0, medium: 0, high: 0, urgent: 0 };
    return {
      summary: {
        totalTickets: sum.total,
        withResponses:    responseStats.find(r => r._id === true)?.count  || 0,
        withoutResponses: responseStats.find(r => r._id === false)?.count || 0,
        avgResolutionHours: resolutionStats[0]?.avgHours != null
          ? +resolutionStats[0].avgHours.toFixed(1) : null
      },
      byStatus: statusBreakdown.map(s => ({
        label: s.status?.label || 'Sem status',
        color: s.status?.color || '#6c757d',
        count: s.count
      })),
      byPriority: { low: sum.low, medium: sum.medium, high: sum.high, urgent: sum.urgent },
      monthlyTrend: monthlyTrend.map(m => ({
        label: `${MONTHS[m._id.month - 1]}/${String(m._id.year).slice(2)}`,
        count: m.count
      }))
    };
  }

  async dashboardByStatus(query = {}) {
    try {
      const dashboardData = await Ticket.aggregate([
        { $match: query },
        {
          $group: {
            _id: '$statusId',
            count: { $sum: 1 },
            totalMessages: { $sum: { $size: '$messages' } },
            avgMessagesPerTicket: { $avg: { $size: '$messages' } },
            oldestTicket: { $min: '$createdAt' },
            newestTicket: { $max: '$createdAt' }
          }
        },
        {
          $lookup: {
            from: 'ticketstatuses',
            localField: '_id',
            foreignField: '_id',
            as: 'status'
          }
        },
        {
          $project: {
            status: { $arrayElemAt: ['$status', 0] },
            count: 1,
            totalMessages: 1,
            avgMessagesPerTicket: { $round: ['$avgMessagesPerTicket', 2] },
            oldestTicket: 1,
            newestTicket: 1,
            _id: 0
          }
        },
        { $sort: { 'status.order': 1 } }
      ]);

      const totals = await Ticket.aggregate([
        { $match: query },
        {
          $group: {
            _id: null,
            totalTickets: { $sum: 1 },
            totalMessages: { $sum: { $size: '$messages' } },
            avgMessagesAll: { $avg: { $size: '$messages' } },
            oldestTicket: { $min: '$createdAt' },
            newestTicket: { $max: '$createdAt' },
            lowPriority: { $sum: { $cond: [{ $eq: ['$priority', 'low'] }, 1, 0] } },
            mediumPriority: { $sum: { $cond: [{ $eq: ['$priority', 'medium'] }, 1, 0] } },
            highPriority: { $sum: { $cond: [{ $eq: ['$priority', 'high'] }, 1, 0] } },
            urgentPriority: { $sum: { $cond: [{ $eq: ['$priority', 'urgent'] }, 1, 0] } }
          }
        },
        {
          $project: {
            _id: 0,
            totalTickets: 1,
            totalMessages: 1,
            avgMessagesAll: { $round: ['$avgMessagesAll', 2] },
            oldestTicket: 1,
            newestTicket: 1,
            priorityBreakdown: {
              low: '$lowPriority',
              medium: '$mediumPriority',
              high: '$highPriority',
              urgent: '$urgentPriority'
            }
          }
        }
      ]);

      return {
        statusBreakdown: dashboardData,
        summary: totals[0] || {
          totalTickets: 0,
          totalMessages: 0,
          avgMessagesAll: 0,
          oldestTicket: null,
          newestTicket: null,
          priorityBreakdown: { low: 0, medium: 0, high: 0, urgent: 0 }
        }
      };
    } catch (error) {
      logger.error('Repository - dashboard Error : ', error);
      throw new Error('Repository - Dashboard Error: ' + error.message);
    }
  }
}

export default new TicketRepository();
