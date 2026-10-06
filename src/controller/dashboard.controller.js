import logger from '../utils/logger.js';
import ticketRepository from '../repositories/ticket.repository.js';
import serviceOrderRepository from '../repositories/service-order.repository.js';
import Company from '../models/company.model.js';
import Ticket from '../models/ticket.model.js';

const MONTHS = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];

export const attendance = async (req, res) => {
  try {
    const companyId = req.user.companyId ?? null;
    const data = await ticketRepository.attendanceDashboard(companyId);
    return res.status(200).json(data);
  } catch (err) {
    logger.error('dashboard.attendance error >>>', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

export const serviceOrder = async (req, res) => {
  try {
    const companyId = req.user.companyId;
    if (!companyId) return res.status(400).json({ message: 'Empresa não vinculada ao usuário' });
    const data = await serviceOrderRepository.serviceOrderDashboard(companyId);
    return res.status(200).json(data);
  } catch (err) {
    logger.error('dashboard.serviceOrder error >>>', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

export const platform = async (req, res) => {
  try {
    if (req.user.role !== 'super_admin') {
      return res.status(403).json({ message: 'Acesso restrito ao super administrador' });
    }

    const now = new Date();
    const twelveMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 11, 1);

    const [companySummary, monthlySignups, ticketAvg] = await Promise.all([
      Company.aggregate([
        { $group: { _id: '$status', count: { $sum: 1 } } }
      ]),
      Company.aggregate([
        { $match: { createdAt: { $gte: twelveMonthsAgo } } },
        { $group: {
          _id: { year: { $year: '$createdAt' }, month: { $month: '$createdAt' } },
          new:       { $sum: 1 },
          cancelled: { $sum: { $cond: [{ $eq: ['$status', 'cancelled'] }, 1, 0] } }
        }},
        { $sort: { '_id.year': 1, '_id.month': 1 } }
      ]),
      Ticket.aggregate([
        { $match: { companyId: { $ne: null } } },
        { $group: { _id: '$companyId', count: { $sum: 1 } } },
        { $group: { _id: null, avg: { $avg: '$count' } } }
      ])
    ]);

    const totals = { total: 0, active: 0, suspended: 0, cancelled: 0, pending_payment: 0 };
    companySummary.forEach(s => {
      if (s._id in totals) totals[s._id] = s.count;
      totals.total += s.count;
    });

    return res.status(200).json({
      companies: totals,
      cancellationRate: totals.total > 0
        ? +((totals.cancelled / totals.total) * 100).toFixed(1) : 0,
      avgTicketsPerCompany: ticketAvg[0]?.avg != null
        ? +ticketAvg[0].avg.toFixed(1) : 0,
      monthlySignups: monthlySignups.map(m => ({
        label: `${MONTHS[m._id.month - 1]}/${String(m._id.year).slice(2)}`,
        new: m.new,
        cancelled: m.cancelled
      }))
    });
  } catch (err) {
    logger.error('dashboard.platform error >>>', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
};
