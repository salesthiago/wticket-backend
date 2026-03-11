import Ticket from '../models/ticket.model.js';
import logger from '../utils/logger.js';

class TicketRepository {
  async create(ticketData) {
    try {
      const ticket = new Ticket(ticketData);
      return await ticket.save();
    } catch (error) {
      throw new Error(error.message);
    }
  }

  async findById(id) {
    try {
      return await Ticket.findById(id)
        .populate('assignedTo', 'name email')
        .populate('messages');
    } catch (error) {
      throw new Error(error.message);
    }
  }

  async findByContact(sessionName, contactNumber) {
    try {
        return await Ticket.findOne({
        sessionName: sessionName,
        contactNumber: contactNumber,
        status: { $in: ['opened', 'in_progress', 'paused'] }
      }).sort({ createdAt: -1 });
    } catch (error) {
      throw new Error(error.message);
    }
  }

  async updateOrCreate(sessionName, contactNumber, updateData) {
    try {
      return await Ticket.findOneAndUpdate(
        {
          sessionName: sessionName,
          contactNumber: contactNumber,
          status: { $ne: 'closed' }
        },
        updateData,
        { upsert: true, new: true }
      );
    } catch (error) {
      throw error;
    }
  }

  async findAll(sessionName = null, category = null) {
    try {
      const query = {};
      if (sessionName) query.sessionName = sessionName;
      if (category) query.category = category;
      return await Ticket.find(query)
        .populate('saleItems.product', 'name price sku')
        .sort({ lastMessage: -1 })
        .exec();
    } catch (error) {
      throw error;
    }
  }

  async updateStatus(id, status, additionalData = {}) {
    try {
      const updateData = { status, ...additionalData };
      
      if (status === 'finished' || status === 'canceled') {
        updateData.closedAt = new Date();
      }
      if (status === 'finished') {
        updateData.resolvedAt = new Date();
      }

      return await Ticket.findByIdAndUpdate(
        id,
        { $set: updateData },
        { new: true }
      ).populate('assignedTo', 'name email');
    } catch (error) {
      throw new Error('Erro ao atualizar status:' + error.message);
    }
  }

  async assignTicket(id, userId) {
    try {
      return await Ticket.findByIdAndUpdate(
        id,
        { 
          $set: { 
            assignedTo: userId,
            status: 'in_progress'
          }
        },
        { new: true }
      ).populate('assignedTo', 'name email');
    } catch (error) {
      throw new Error('Erro ao atribuir ticket: '+ error.message);
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
      throw new Error('Erro ao adicionar mensagem: '+ error.message);
    }
  }

  async getTicketsStats(sessionName) {
    try {
      return await Ticket.aggregate([
        { $match: { sessionName } },
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 }
          }
        }
      ]);
    } catch (error) {
      logger.error('Erro ao obter estatísticas: ', error.message);
      throw new Error('Erro ao obter estatísticas: ' + error.message);
    }
  }

  async deleteTicket(id) {
    try {
      return await Ticket.findByIdAndDelete(id);
    } catch (error) {
      logger.error('Erro ao deletar: ', error);
      throw new Error('Erro ao deletar ticket: '+ error.message);
    }
  }

  async dashboardByStatus(query = {}) {
    try {
      const dashboardData = await Ticket.aggregate([
        { $match: query },
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 },
            totalMessages: { $sum: { $size: '$messages' } },
            avgMessagesPerTicket: { $avg: { $size: '$messages' } },
            oldestTicket: { $min: '$createdAt' },
            newestTicket: { $max: '$createdAt' }
          }
        },
        {
          $project: {
            status: '$_id',
            count: 1,
            totalMessages: 1,
            avgMessagesPerTicket: { $round: ['$avgMessagesPerTicket', 2] },
            oldestTicket: 1,
            newestTicket: 1,
            _id: 0
          }
        },
        { $sort: { status: 1 } }
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
            lowPriority: {
              $sum: { $cond: [{ $eq: ['$priority', 'low'] }, 1, 0] }
            },
            mediumPriority: {
              $sum: { $cond: [{ $eq: ['$priority', 'medium'] }, 1, 0] }
            },
            highPriority: {
              $sum: { $cond: [{ $eq: ['$priority', 'high'] }, 1, 0] }
            },
            urgentPriority: {
              $sum: { $cond: [{ $eq: ['$priority', 'urgent'] }, 1, 0] }
            }
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
          priorityBreakdown: {
            low: 0,
            medium: 0,
            high: 0,
            urgent: 0
          }
        }
      };

    } catch (error) {
      logger.error('Repository - dashboard Error : ', error)
      throw new Error('Repository - Dashboard Error:' + error.message);
    }
  }

  async dashboardWithTimeAnalysis(query = {}) {
    try {
      const today = new Date();
      const startOfToday = new Date(today.setHours(0, 0, 0, 0));
      const startOfWeek = new Date(today.setDate(today.getDate() - today.getDay()));
      const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

      const timeAnalysis = await Ticket.aggregate([
        { $match: query },
        {
          $facet: {
            today: [
              { $match: { createdAt: { $gte: startOfToday } } },
              { $group: { _id: '$status', count: { $sum: 1 } } }
            ],
            thisWeek: [
              { $match: { createdAt: { $gte: startOfWeek } } },
              {
                $group: {
                  _id: { $dayOfWeek: '$createdAt' },
                  count: { $sum: 1 }
                }
              },
              {
                $project: {
                  _id: 0,
                  day: {
                    $switch: {
                      branches: [
                        { case: { $eq: ['$_id', 1] }, then: 'sunday' },
                        { case: { $eq: ['$_id', 2] }, then: 'monday' },
                        { case: { $eq: ['$_id', 3] }, then: 'tuesday' },
                        { case: { $eq: ['$_id', 4] }, then: 'wednesday' },
                        { case: { $eq: ['$_id', 5] }, then: 'thursday' },
                        { case: { $eq: ['$_id', 6] }, then: 'friday' },
                        { case: { $eq: ['$_id', 7] }, then: 'saturday' }
                      ],
                      default: 'unknown'
                    }
                  },
                  count: 1
                }
              },
              { $sort: { '_id': 1 } }
            ],
            thisMonth: [
              { $match: { createdAt: { $gte: startOfMonth } } },
              { $group: { _id: '$status', count: { $sum: 1 } } }
            ],
            byHour: [
              {
                $group: {
                  _id: {
                    hour: { $hour: '$createdAt' },
                    status: '$status'
                  },
                  count: { $sum: 1 }
                }
              },
              { $sort: { '_id.hour': 1 } }
            ]
          }
        }
      ]);

      return timeAnalysis[0];
    } catch (error) {
      logger.error('Repository :: dashboardWithTimeAnalysis >>>>> ', error)
      throw new Error('Repository - Time Analysis Error: '+ error.message);
    }
  }
}

export default new TicketRepository();