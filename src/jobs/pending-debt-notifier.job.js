import cron from 'node-cron';
import Receivable from '../models/financial/receivable.model.js';
import Company from '../models/company.model.js';
import User from '../models/user.model.js';
import emailService from '../services/email/email.service.js';
import logger from '../utils/logger.js';

const RENOTIFY_AFTER_DAYS = 3;
const SCHEDULE = '0 8 * * *'; // 08:00 todo dia

function formatCurrency(value) {
  return Number(value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function formatDate(date) {
  return new Date(date).toLocaleDateString('pt-BR');
}

/** Varre títulos vencidos/pendentes-vencidos e notifica o dono de cada empresa (uma vez a cada RENOTIFY_AFTER_DAYS). */
export async function run() {
  const enabled = await emailService.isEnabled();
  if (!enabled) {
    logger.info('PendingDebtNotifier :: serviço de e-mail desabilitado, pulando execução');
    return;
  }

  const now = new Date();
  const overdue = await Receivable.find({
    isActive: true,
    status: { $in: ['pending', 'overdue'] },
    dueDate: { $lt: now }
  }).lean();

  if (!overdue.length) return;

  const byCompany = new Map();
  for (const r of overdue) {
    const key = String(r.companyId);
    if (!byCompany.has(key)) byCompany.set(key, []);
    byCompany.get(key).push(r);
  }

  for (const [companyId, receivables] of byCompany) {
    try {
      const company = await Company.findById(companyId);
      if (!company) continue;

      if (company.lastDebtNotificationAt) {
        const daysSince = (now - company.lastDebtNotificationAt) / (1000 * 60 * 60 * 24);
        if (daysSince < RENOTIFY_AFTER_DAYS) continue;
      }

      const owner = company.ownerId
        ? await User.findById(company.ownerId)
        : await User.findOne({ companyId: company._id, role: 'company_admin' });
      if (!owner) continue;

      const items = receivables
        .map(r => `- ${r.description}: ${formatCurrency(r.amount)} (venceu em ${formatDate(r.dueDate)})`)
        .join('\n');
      const totalAmount = formatCurrency(receivables.reduce((sum, r) => sum + Number(r.amount || 0), 0));

      await emailService.sendTemplated('pending_debt', owner.email, {
        name: owner.name,
        companyName: company.name,
        items,
        totalAmount
      });

      company.lastDebtNotificationAt = now;
      await company.save();
    } catch (err) {
      logger.warn(`PendingDebtNotifier :: falha ao notificar empresa ${companyId}: ${err.message}`);
    }
  }
}

export function start() {
  cron.schedule(SCHEDULE, () => {
    run().catch(err => logger.error('PendingDebtNotifier :: erro na execução agendada', err));
  });
  logger.info(`PendingDebtNotifier :: job agendado (${SCHEDULE})`);
}

export default { start, run };
