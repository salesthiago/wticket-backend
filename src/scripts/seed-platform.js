import dotenv from 'dotenv';
import mongoose from 'mongoose';
import User from '../models/user.model.js';
import Module from '../models/module.model.js';

dotenv.config();

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/wticket';

const SUPER_ADMIN = {
  name: 'Sales (Owner)',
  email: 'sales.go@gmail.com',
  password: process.env.SUPER_ADMIN_PASSWORD || 'change-me-now',
  role: 'super_admin',
  status: 'enabled',
  companyId: null
};

const MODULES = [
  {
    code: 'attendance',
    name: 'Atendimento',
    description: 'Cadastro de clientes, agendamentos e tickets de atendimento.',
    features: ['contacts', 'appointments', 'tickets', 'whatsapp_sessions'],
    price: 0,
    requires: []
  },
  {
    code: 'service_order',
    name: 'Ordem de Serviço',
    description: 'Cadastro de produtos, clientes e ordens de serviço.',
    features: ['products', 'customers', 'service_orders'],
    price: 0,
    requires: []
  },
  {
    code: 'auto_attendance',
    name: 'Atendimento Automático',
    description: 'Bots e inteligência artificial para automatizar atendimentos. Complemento do módulo Atendimento.',
    features: ['bot_config', 'ai_agents', 'ai_providers', 'auto_response'],
    price: 0,
    requires: ['attendance']
  }
];

async function connectDB() {
  await mongoose.connect(MONGO_URI);
  console.log('Connected to MongoDB');
}

async function upsertModules() {
  console.log('\nSeeding modules...');
  for (const m of MODULES) {
    const existing = await Module.findOne({ code: m.code });
    if (existing) {
      await Module.updateOne({ code: m.code }, { $set: m });
      console.log(`  updated: ${m.code}`);
    } else {
      await Module.create(m);
      console.log(`  created: ${m.code}`);
    }
  }
}

async function upsertSuperAdmin() {
  console.log('\nSeeding super_admin...');
  const existing = await User.findOne({ email: SUPER_ADMIN.email });
  if (existing) {
    existing.role = 'super_admin';
    existing.status = 'enabled';
    existing.companyId = null;
    if (process.env.SUPER_ADMIN_PASSWORD) {
      existing.password = process.env.SUPER_ADMIN_PASSWORD;
    }
    await existing.save();
    console.log(`  updated: ${SUPER_ADMIN.email}`);
  } else {
    await User.create(SUPER_ADMIN);
    console.log(`  created: ${SUPER_ADMIN.email}`);
    if (!process.env.SUPER_ADMIN_PASSWORD) {
      console.log('  WARNING: default password "change-me-now" used. Set SUPER_ADMIN_PASSWORD in .env and re-run.');
    }
  }
}

async function run() {
  try {
    await connectDB();
    await upsertModules();
    await upsertSuperAdmin();
    console.log('\nPlatform seed complete.');
  } catch (err) {
    console.error('Seed error:', err);
    process.exit(1);
  } finally {
    await mongoose.connection.close();
    process.exit(0);
  }
}

run();
