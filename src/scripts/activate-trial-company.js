// Ativa manualmente uma empresa que ficou presa em pending_payment porque se
// cadastrou com um plano de trial cujo `trialDays` não tinha sido salvo
// corretamente (bug corrigido em src/controller/plan.controller.js).
//
// Uso:
//   node src/scripts/activate-trial-company.js <emailDaEmpresaOuDoDono> [trialDays]
//
// Se [trialDays] não for informado, usa o trialDays do plano vinculado à empresa
// (plan.trialDays). Se a empresa não tiver planId ou o plano não tiver trial,
// é obrigatório informar trialDays manualmente.

import dotenv from 'dotenv';
import mongoose from 'mongoose';
import Company from '../models/company.model.js';
import Plan from '../models/plan.model.js';
import User from '../models/user.model.js';

dotenv.config();

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/wticket';

async function main() {
  const [, , identifier, trialDaysArg] = process.argv;
  if (!identifier) {
    console.error('Uso: node src/scripts/activate-trial-company.js <emailDaEmpresaOuDoDono> [trialDays]');
    process.exit(1);
  }

  await mongoose.connect(MONGO_URI);
  console.log(`Conectado a ${MONGO_URI}`);

  try {
    let company = await Company.findOne({ email: identifier.toLowerCase().trim() });

    if (!company) {
      const owner = await User.findOne({ email: identifier.toLowerCase().trim() });
      if (owner) company = await Company.findById(owner.companyId);
    }

    if (!company) {
      console.error(`Empresa não encontrada para "${identifier}"`);
      process.exit(1);
    }

    console.log(`Empresa encontrada: ${company.name} (${company._id}) — status atual: ${company.status}`);

    let trialDays = trialDaysArg ? Number(trialDaysArg) : null;
    if (!trialDays) {
      const plan = company.planId ? await Plan.findById(company.planId) : null;
      trialDays = plan?.trialDays || 0;
    }

    if (!trialDays || trialDays <= 0) {
      console.error('trialDays inválido (plano sem trial e nenhum valor informado no argumento).');
      process.exit(1);
    }

    const now = new Date();
    const trialEndsAt = new Date(now.getTime() + trialDays * 24 * 60 * 60 * 1000);

    company.status = 'active';
    company.trialEndsAt = trialEndsAt;
    company.modules = company.modules.map(m => ({
      ...m.toObject(),
      subscriptionStatus: 'active',
      activatedAt: now,
      expiresAt: trialEndsAt
    }));

    await company.save();

    console.log(`Empresa ${company.name} ativada com trial de ${trialDays} dias, expira em ${trialEndsAt.toISOString()}`);
  } finally {
    await mongoose.disconnect();
  }
}

main().catch(err => {
  console.error('Erro ao ativar empresa:', err);
  process.exit(1);
});
