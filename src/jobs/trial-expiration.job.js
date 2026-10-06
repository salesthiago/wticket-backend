import cron from 'node-cron';
import Company from '../models/company.model.js';
import subscriptionService from '../services/billing/subscription.service.js';
import logger from '../utils/logger.js';

const SCHEDULE = '*/30 * * * *'; // a cada 30 min

/**
 * Varre empresas ativas e não isentas sem nenhum módulo ativo (trial expirado
 * ou assinatura vencida sem renovação): suspende a empresa e garante uma
 * cobrança pendente para cada uma (subscriptionService.getBillingStatus faz
 * as duas coisas, idempotente — não repete a suspensão nem duplica cobrança
 * enquanto a anterior seguir pendente). Roda independente do usuário acessar
 * o sistema, para a suspensão/cobrança saírem no instante em que o período
 * de teste vence.
 */
export async function run() {
  const cursor = Company.find({ subscriptionExempt: false, status: 'active' }).cursor();

  let checked = 0;
  let affected = 0;
  for (let company = await cursor.next(); company != null; company = await cursor.next()) {
    checked++;
    if (company.activeModuleCodes().length > 0) continue; // ainda tem módulo ativo, nada a fazer

    try {
      const status = await subscriptionService.getBillingStatus(company._id);
      if (status.blocked) affected++;
    } catch (err) {
      logger.warn(`TrialExpiration :: falha ao processar empresa ${company._id}: ${err.message}`);
    }
  }

  if (affected) {
    logger.info(`TrialExpiration :: ${affected}/${checked} empresa(s) sem módulo ativo suspensas/com cobrança garantida`);
  }
}

export function start() {
  cron.schedule(SCHEDULE, () => {
    run().catch(err => logger.error('TrialExpiration :: erro na execução agendada', err));
  });
  logger.info(`TrialExpiration :: job agendado (${SCHEDULE})`);
}

export default { start, run };
