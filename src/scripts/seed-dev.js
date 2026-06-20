import dotenv from 'dotenv';
import mongoose from 'mongoose';
import Company from '../models/company.model.js';
import User from '../models/user.model.js';
import Module from '../models/module.model.js';
import TicketCategory from '../models/ticket-category.model.js';
import TicketSubject from '../models/ticket-subject.model.js';
import TicketStatus from '../models/ticket-status.model.js';

dotenv.config();

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/wticket';

const DEV_COMPANY = {
  name: 'Empresa Dev Ltda',
  email: 'dev@wticket.dev',
  phone: '11999999999',
  document: '00000000000100',
  documentType: 'cnpj',
  status: 'active'
};

const DEV_USER = {
  name: 'Admin Dev',
  email: 'admin@wticket.dev',
  password: 'dev123',
  role: 'company_admin',
  status: 'enabled'
};

const TICKET_STATUSES = [
  { name: 'opened',           label: 'Aberto',              color: '#3B82F6', isDefault: true,  order: 1 },
  { name: 'in_progress',      label: 'Em Andamento',        color: '#F59E0B', isDefault: false, order: 2 },
  { name: 'waiting_customer', label: 'Aguardando Cliente',  color: '#8B5CF6', isDefault: false, order: 3 },
  { name: 'resolved',         label: 'Resolvido',           color: '#10B981', isDefault: false, order: 4 },
  { name: 'closed',           label: 'Fechado',             color: '#6B7280', isDefault: false, order: 5 }
];

const TICKET_CATEGORIES = [
  { name: 'Suporte',     description: 'Problemas técnicos e dúvidas de uso',  color: '#3B82F6' },
  { name: 'Comercial',   description: 'Cotações, propostas e vendas',          color: '#10B981' },
  { name: 'Financeiro',  description: 'Cobranças, pagamentos e faturas',       color: '#F59E0B' }
];

const TICKET_SUBJECTS_BY_CATEGORY = {
  'Suporte': [
    { name: 'Erro no sistema',  description: 'Falha ou comportamento inesperado' },
    { name: 'Dúvida de uso',    description: 'Como utilizar uma funcionalidade' }
  ],
  'Comercial': [
    { name: 'Solicitar proposta', description: 'Pedido de cotação ou proposta comercial' },
    { name: 'Cancelamento',       description: 'Solicitação de cancelamento de serviço' }
  ],
  'Financeiro': [
    { name: 'Boleto / Fatura', description: 'Segunda via de boleto ou fatura' },
    { name: 'Estorno',         description: 'Pedido de reembolso ou estorno' }
  ]
};

async function connectDB() {
  await mongoose.connect(MONGO_URI);
  console.log('Connected to MongoDB');
}

async function seedCompany() {
  console.log('\nSeeding company...');
  let company = await Company.findOne({ email: DEV_COMPANY.email });
  if (company) {
    Object.assign(company, DEV_COMPANY);
    await company.save();
    console.log(`  updated: ${DEV_COMPANY.email}`);
  } else {
    company = await Company.create(DEV_COMPANY);
    console.log(`  created: ${DEV_COMPANY.email}`);
  }
  return company;
}

async function seedUser(company) {
  console.log('\nSeeding user...');
  let user = await User.findOne({ email: DEV_USER.email });
  if (user) {
    user.name = DEV_USER.name;
    user.role = DEV_USER.role;
    user.status = DEV_USER.status;
    user.companyId = company._id;
    await user.save();
    console.log(`  updated: ${DEV_USER.email}`);
  } else {
    user = await User.create({ ...DEV_USER, companyId: company._id });
    console.log(`  created: ${DEV_USER.email} / senha: ${DEV_USER.password}`);
  }

  if (!company.ownerId || company.ownerId.toString() !== user._id.toString()) {
    company.ownerId = user._id;
    await company.save();
  }

  return user;
}

async function seedModules(company) {
  console.log('\nSeeding modules on company...');
  const modules = await Module.find({});
  if (!modules.length) {
    console.log('  WARNING: no modules found — run npm run seed:platform first');
    return;
  }

  const now = new Date();
  const expiresAt = new Date(now.getFullYear() + 10, now.getMonth(), now.getDate());

  const updatedModules = modules.map(m => ({
    moduleId: m._id,
    code: m.code,
    subscriptionStatus: 'active',
    activatedAt: now,
    expiresAt
  }));

  company.modules = updatedModules;
  await company.save();
  console.log(`  activated: ${modules.map(m => m.code).join(', ')}`);
}

async function seedTicketStatuses(companyId) {
  console.log('\nSeeding ticket statuses...');
  // Reset default antes de upsert para evitar conflito com o hook pre-save
  await TicketStatus.updateMany({ companyId }, { $set: { isDefault: false } });

  for (const s of TICKET_STATUSES) {
    const existing = await TicketStatus.findOne({ name: s.name, companyId });
    if (existing) {
      Object.assign(existing, { ...s, companyId });
      await existing.save();
      console.log(`  updated: ${s.name}`);
    } else {
      await TicketStatus.create({ ...s, companyId });
      console.log(`  created: ${s.name}`);
    }
  }
}

async function seedTicketCategories(companyId) {
  console.log('\nSeeding ticket categories...');
  const categoryMap = {};

  for (const c of TICKET_CATEGORIES) {
    let cat = await TicketCategory.findOne({ name: c.name, companyId });
    if (cat) {
      Object.assign(cat, { ...c, companyId });
      await cat.save();
      console.log(`  updated: ${c.name}`);
    } else {
      cat = await TicketCategory.create({ ...c, companyId });
      console.log(`  created: ${c.name}`);
    }
    categoryMap[c.name] = cat._id;
  }

  return categoryMap;
}

async function seedTicketSubjects(categoryMap, companyId) {
  console.log('\nSeeding ticket subjects...');
  for (const [categoryName, subjects] of Object.entries(TICKET_SUBJECTS_BY_CATEGORY)) {
    const categoryId = categoryMap[categoryName];
    for (const s of subjects) {
      const existing = await TicketSubject.findOne({ name: s.name, categoryId, companyId });
      if (existing) {
        Object.assign(existing, { ...s, categoryId, companyId });
        await existing.save();
        console.log(`  updated: ${s.name}`);
      } else {
        await TicketSubject.create({ ...s, categoryId, companyId });
        console.log(`  created: ${s.name}`);
      }
    }
  }
}

async function run() {
  try {
    await connectDB();
    const company = await seedCompany();
    await seedUser(company);
    await seedModules(company);
    const companyId = company._id;
    await seedTicketStatuses(companyId);
    const categoryMap = await seedTicketCategories(companyId);
    await seedTicketSubjects(categoryMap, companyId);
    console.log('\nDev seed complete.');
    console.log(`\n  Company : ${DEV_COMPANY.name}`);
    console.log(`  Login   : ${DEV_USER.email}`);
    console.log(`  Senha   : ${DEV_USER.password}`);
  } catch (err) {
    console.error('Seed error:', err);
    process.exit(1);
  } finally {
    await mongoose.connection.close();
    process.exit(0);
  }
}

run();
