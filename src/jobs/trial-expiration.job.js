import cron from 'node-cron';
import Company from '../models/company.model.js';
import subscriptionService from '../services/billing/subscription.service.js';
import logger from '../utils/logger.js';

const SCHEDULE = '*/30 * * * *'; // a cada 30 min

/**
 * Varre empresas ativas e não isentas sem nenhum módulo ativo (trial expirado
 * ou assinatura vencida sem renovação) e garante uma cobrança pendente para
 * cada uma — mesma lógica usada pelo gate de billing (idempotente: não
 * duplica cobrança enquanto a anterior seguir pendente). Roda independente do
 * usuário acessar o sistema, para a cobrança sair no instante em que o
 * período de teste vence.
 */
export async function run() {
  const cursor = Company.find({ subscriptionExempt: false, status: 'active' }).cursor();

  let checked = 0;
  let charged = 0;
  for (let company = await cursor.next(); company != null; company = await cursor.next()) {
    checked++;
    if (company.activeModuleCodes().length > 0) continue; // ainda tem módulo ativo, nada a fazer

    try {
      const payment = await subscriptionService.ensureChargeForCompany(company);
      if (payment) charged++;
    } catch (err) {
      logger.warn(`TrialExpiration :: falha ao processar empresa ${company._id}: ${err.message}`);
    }
  }

  if (charged) {
    logger.info(`TrialExpiration :: ${charged}/${checked} empresa(s) sem módulo ativo receberam cobrança automática`);
  }
}

export function start() {
  cron.schedule(SCHEDULE, () => {
    run().catch(err => logger.error('TrialExpiration :: erro na execução agendada', err));
  });
  logger.info(`TrialExpiration :: job agendado (${SCHEDULE})`);
}

export default { start, run };
